import OpenAI from 'openai';
import { logMeal, NoFoodItemsError } from '@/app/lib/food';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
});

export async function POST(req: Request): Promise<Response> {
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
        let meal: Awaited<ReturnType<typeof logMeal>>;
        try {
          meal = await logMeal(message);
        } catch (err) {
          if (err instanceof NoFoodItemsError) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'text', text: "I couldn't identify any food items in that message. Try describing what you ate more specifically." })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            return;
          }
          throw err;
        }

        // Step 5: Send meal data as first SSE chunk
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'meal', meal })}\n\n`),
        );

        // Step 6: Stream friendly confirmation message
        const confirmStream = await openai.chat.completions.create({
          model: 'google/gemini-3.5-flash',
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
