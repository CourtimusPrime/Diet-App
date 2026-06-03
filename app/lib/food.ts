import OpenAI from 'openai'
import { prisma } from '@/app/lib/prisma'
import { searchUSDA, nutrientsToColumns } from '@/app/lib/usda'
import type { USDAFood } from '@/app/lib/usda'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const SERVING_SIZES =
  '1 cup = 240ml (liquids) or ~128g (salad greens) or ~200g (cooked grains)\n' +
  '1 tbsp = 15ml / ~14g\n' +
  '1 tsp = 5ml / ~4g\n' +
  '1 oz = 28g\n' +
  '1 slice bread = ~30g\n' +
  '1 large egg = ~50g\n' +
  '1 medium apple = ~182g\n' +
  '1 shot (spirits) = 44ml / ~44g\n' +
  '1 can soda/beer = 355ml / ~355g\n' +
  '1 medium banana = ~118g\n' +
  '1 medium potato = ~213g\n' +
  '1 chicken breast (medium) = ~174g\n' +
  '1 cup cooked rice = ~186g\n' +
  '1 cup cooked pasta = ~140g\n' +
  '1 cup raw oats = ~80g\n' +
  '1 cup whole milk = ~244g\n' +
  '1 cup orange juice = ~248g'

export interface ExtractedFood {
  name: string
  quantityG: number
  quantityDisplay: string
}

export async function extractFoodItems(userMessage: string): Promise<ExtractedFood[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'google/gemini-3.5-flash',
      messages: [
        {
          role: 'system',
          content: `You extract individual food items from meal descriptions.
Use USDA-friendly food names (e.g. "chicken breast raw" not "grilled chicken", "egg whole raw" not "scrambled eggs").
Convert all quantities to grams using these references:
${SERVING_SIZES}
For grains and pasta, assume cooked weight unless the user specifies 'dry' or 'uncooked'. When quantity is vague (e.g. 'a bowl', 'some'), estimate conservatively using a single standard serving.
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
    })

    const content = response.choices[0]?.message?.content
    if (!content) return []
    const parsed = JSON.parse(content) as { foods: ExtractedFood[] }
    return parsed.foods ?? []
  } catch (err) {
    console.error('[food] extractFoodItems error:', err)
    return []
  }
}

export class NoFoodItemsError extends Error {
  constructor() {
    super('No food items found in description')
  }
}

async function usdaMatchSafe(foodName: string): Promise<USDAFood | null> {
  try {
    return await searchUSDA(foodName)
  } catch (err) {
    console.warn('[food] USDA lookup failed for "' + foodName + '":', err)
    return null
  }
}

export async function logMeal(description: string, userId?: string | null) {
  const foods = await extractFoodItems(description)
  if (foods.length === 0) throw new NoFoodItemsError()

  const usdaResults = await Promise.all(
    foods.map(async (food) => ({ food, usdaResult: await usdaMatchSafe(food.name) })),
  )

  const foodItemsData = usdaResults.map(({ food, usdaResult }) => {
    if (usdaResult !== null) {
      return {
        name: food.name,
        quantityG: food.quantityG,
        quantityDisplay: food.quantityDisplay,
        usdaFdcId: usdaResult.fdcId,
        usdaDescription: usdaResult.description,
        usdaMatched: true,
        ...nutrientsToColumns(usdaResult, food.quantityG),
      }
    }
    return {
      name: food.name,
      quantityG: food.quantityG,
      quantityDisplay: food.quantityDisplay,
      usdaMatched: false,
    }
  })

  return prisma.meal.create({
    data: { description, userId: userId ?? undefined, foodItems: { create: foodItemsData } },
    include: { foodItems: true },
  })
}
