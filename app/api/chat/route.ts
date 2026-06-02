import OpenAI from 'openai';
import { prisma } from '@/app/lib/prisma';
import { searchUSDA, nutrientsToColumns } from '@/app/lib/usda';

// ── OpenAI client (OpenRouter) ────────────────────────────────────────────────

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// ── Serving size reference for quantity normalisation ─────────────────────────

const SERVING_SIZES =
  '1 cup = 240ml (liquids) or ~128g (salad greens) or ~200g (cooked grains)\n' +
  '1 tbsp = 15ml / ~14g\n' +
  '1 tsp = 5ml / ~4g\n' +
  '1 oz = 28g\n' +
  '1 slice bread = ~30g\n' +
  '1 large egg = ~50g\n' +
  '1 medium apple = ~182g';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedFood {
  name: string;
  quantityG: number;
  quantityDisplay: string;
}

// ── Task 1: extractFoodItems — structured LLM parse ───────────────────────────

/**
 * Extract individual food items from a natural-language meal description.
 *
 * Uses google/gemini-2.0-flash-001 via OpenRouter with response_format json_schema
 * strict mode to enforce output shape. Returns [] on any error — never throws.
 */
async function extractFoodItems(userMessage: string): Promise<ExtractedFood[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'system',
          content: `You extract individual food items from meal descriptions.
Use USDA-friendly food names (e.g. "chicken breast raw" not "grilled chicken", "egg whole raw" not "scrambled eggs").
Convert all quantities to grams using these references:
${SERVING_SIZES}
Return JSON matching the schema exactly.`,
        },
        { role: 'user', content: userMessage },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'food_extraction',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              foods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    quantityG: { type: 'number' },
                    quantityDisplay: { type: 'string' },
                  },
                  required: ['name', 'quantityG', 'quantityDisplay'],
                  additionalProperties: false,
                },
              },
            },
            required: ['foods'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { foods: ExtractedFood[] };
    return parsed.foods ?? [];
  } catch (err) {
    console.error('[chat] extractFoodItems error:', err);
    return [];
  }
}

// ── Task 2: POST handler — USDA lookup, DB write, SSE stream ──────────────────

export async function POST(req: Request): Promise<Response> {
  // Validate request body
  let message: string;
  try {
    const body = (await req.json()) as { message?: unknown };
    if (!body.message || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    message = body.message;
  } catch {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Extract food items from natural language
        const foods = await extractFoodItems(message);

        if (foods.length === 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'text', text: "I couldn't identify any food items in that message. Try describing what you ate more specifically." })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        // Step 2: Parallel USDA lookups
        const usdaResults = await Promise.all(
          foods.map(async (food) => {
            const usdaResult = await searchUSDA(food.name);
            return { food, usdaResult };
          }),
        );

        // Step 3: Build FoodItem data array — handle null USDA results gracefully
        const foodItemsData = usdaResults.map(({ food, usdaResult }) => {
          if (usdaResult !== null) {
            const columns = nutrientsToColumns(usdaResult, food.quantityG);
            return {
              name: food.name,
              quantityG: food.quantityG,
              quantityDisplay: food.quantityDisplay,
              usdaFdcId: usdaResult.fdcId,
              usdaDescription: usdaResult.description,
              usdaMatched: true,
              ...columns,
            };
          } else {
            return {
              name: food.name,
              quantityG: food.quantityG,
              quantityDisplay: food.quantityDisplay,
              usdaMatched: false,
            };
          }
        });

        // Step 4: Write Meal + FoodItems in a single Prisma create
        const meal = await prisma.meal.create({
          data: {
            description: message,
            foodItems: { create: foodItemsData },
          },
          include: { foodItems: true },
        });

        // Step 5: Send meal data as first SSE chunk
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'meal', meal })}\n\n`),
        );

        // Step 6: Stream friendly confirmation message
        const confirmStream = await openai.chat.completions.create({
          model: 'google/gemini-2.0-flash-001',
          stream: true,
          messages: [
            {
              role: 'system',
              content:
                'Write a brief, friendly 1-2 sentence confirmation of the meal just logged. Mention the foods.',
            },
            {
              role: 'user',
              content: 'Logged: ' + meal.foodItems.map((f) => f.name).join(', '),
            },
          ],
        });

        for await (const chunk of confirmStream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`),
            );
          }
        }

        // Step 7: Signal end of stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[chat] POST handler error:', err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
