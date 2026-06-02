import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

const NUTRIENT_KEYS = [
  'water_g','energy_kcal','energy_atwater_general_kcal','energy_atwater_specific_kcal',
  'protein_g','fat_total_g','carbohydrate_g','fiber_g','sugars_total_g','nitrogen_g','ash_g',
  'calcium_mg','iron_mg','magnesium_mg','phosphorus_mg','potassium_mg','sodium_mg',
  'zinc_mg','copper_mg','manganese_mg','selenium_mcg',
  'vitamin_a_rae_mcg','retinol_mcg','carotene_beta_mcg','vitamin_c_mg','vitamin_d_mcg',
  'vitamin_e_mg','vitamin_k1_mcg','thiamin_mg','riboflavin_mg','niacin_mg',
  'pantothenic_acid_mg','vitamin_b6_mg','biotin_mcg','folate_total_mcg','folate_dfe_mcg',
  'vitamin_b12_mcg','choline_total_mg','lycopene_mcg','caffeine_mg','theobromine_mg',
  'tryptophan_g','threonine_g','isoleucine_g','leucine_g','lysine_g','methionine_g',
  'cystine_g','phenylalanine_g','tyrosine_g','valine_g','arginine_g','histidine_g',
  'alanine_g','aspartic_acid_g','glutamic_acid_g','glycine_g','proline_g','serine_g',
  'sfa_total_g','mufa_total_g','pufa_total_g','cholesterol_mg','sfa_4_0_g','sfa_6_0_g',
  'sfa_8_0_g','sfa_10_0_g','sfa_12_0_g','sfa_14_0_g','sfa_16_0_g','sfa_18_0_g',
  'mufa_18_1_g','pufa_18_2_g','pufa_18_3_g','pufa_20_4_g','pufa_20_5_epa_g',
  'pufa_22_5_dpa_g','pufa_22_6_dha_g','starch_g','sucrose_g','glucose_g',
  'fructose_g','lactose_g','iodine_mcg','carotene_alpha_mcg','vitamin_e_added_mg',
  'vitamin_k2_mcg','folate_food_mcg','vitamin_b12_added_mcg','lutein_zeaxanthin_mcg',
  'sugars_added_g','galactose_g','maltose_g','sfa_20_0_g','sfa_22_0_g','mufa_16_1_g',
  'mufa_20_1_g','mufa_22_1_g','pufa_18_4_g','tocopherol_beta_mg','tocopherol_gamma_mg',
  'tocopherol_delta_mg','fluoride_mcg',
] as const

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  const start = new Date(`${dateParam}T00:00:00.000Z`)
  const end = new Date(`${dateParam}T23:59:59.999Z`)

  const meals = await prisma.meal.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { foodItems: true },
    orderBy: { createdAt: 'asc' },
  })

  const totals: Record<string, number> = {}
  for (const key of NUTRIENT_KEYS) {
    totals[key] = 0
  }

  for (const meal of meals) {
    for (const item of meal.foodItems) {
      for (const key of NUTRIENT_KEYS) {
        const val = (item as Record<string, unknown>)[key]
        if (typeof val === 'number' && !isNaN(val)) {
          totals[key] += val
        }
      }
    }
  }

  return NextResponse.json({
    date: dateParam,
    mealCount: meals.length,
    totals,
  })
}
