import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Nutrient metadata (label + unit for all 103 columns) ─────────────────────
const NUTRIENT_META: Record<string, { label: string; unit: string }> = {
  water_g:                       { label: 'Water',                      unit: 'g' },
  energy_kcal:                   { label: 'Energy',                     unit: 'kcal' },
  energy_atwater_general_kcal:   { label: 'Energy (Atwater General)',   unit: 'kcal' },
  energy_atwater_specific_kcal:  { label: 'Energy (Atwater Specific)',  unit: 'kcal' },
  protein_g:                     { label: 'Protein',                    unit: 'g' },
  fat_total_g:                   { label: 'Total Fat',                  unit: 'g' },
  carbohydrate_g:                { label: 'Carbohydrate',               unit: 'g' },
  fiber_g:                       { label: 'Fiber',                      unit: 'g' },
  sugars_total_g:                { label: 'Total Sugars',               unit: 'g' },
  nitrogen_g:                    { label: 'Nitrogen',                   unit: 'g' },
  ash_g:                         { label: 'Ash',                        unit: 'g' },
  calcium_mg:                    { label: 'Calcium',                    unit: 'mg' },
  iron_mg:                       { label: 'Iron',                       unit: 'mg' },
  magnesium_mg:                  { label: 'Magnesium',                  unit: 'mg' },
  phosphorus_mg:                 { label: 'Phosphorus',                 unit: 'mg' },
  potassium_mg:                  { label: 'Potassium',                  unit: 'mg' },
  sodium_mg:                     { label: 'Sodium',                     unit: 'mg' },
  zinc_mg:                       { label: 'Zinc',                       unit: 'mg' },
  copper_mg:                     { label: 'Copper',                     unit: 'mg' },
  manganese_mg:                  { label: 'Manganese',                  unit: 'mg' },
  selenium_mcg:                  { label: 'Selenium',                   unit: 'mcg' },
  vitamin_a_rae_mcg:             { label: 'Vitamin A (RAE)',            unit: 'mcg' },
  retinol_mcg:                   { label: 'Retinol',                    unit: 'mcg' },
  carotene_beta_mcg:             { label: 'Beta-Carotene',              unit: 'mcg' },
  vitamin_c_mg:                  { label: 'Vitamin C',                  unit: 'mg' },
  vitamin_d_mcg:                 { label: 'Vitamin D',                  unit: 'mcg' },
  vitamin_e_mg:                  { label: 'Vitamin E',                  unit: 'mg' },
  vitamin_k1_mcg:                { label: 'Vitamin K1',                 unit: 'mcg' },
  thiamin_mg:                    { label: 'Thiamin (B1)',               unit: 'mg' },
  riboflavin_mg:                 { label: 'Riboflavin (B2)',            unit: 'mg' },
  niacin_mg:                     { label: 'Niacin (B3)',                unit: 'mg' },
  pantothenic_acid_mg:           { label: 'Pantothenic Acid (B5)',      unit: 'mg' },
  vitamin_b6_mg:                 { label: 'Vitamin B6',                 unit: 'mg' },
  biotin_mcg:                    { label: 'Biotin',                     unit: 'mcg' },
  folate_total_mcg:              { label: 'Folate (Total)',             unit: 'mcg' },
  folate_dfe_mcg:                { label: 'Folate (DFE)',               unit: 'mcg' },
  vitamin_b12_mcg:               { label: 'Vitamin B12',               unit: 'mcg' },
  choline_total_mg:              { label: 'Choline',                    unit: 'mg' },
  lycopene_mcg:                  { label: 'Lycopene',                   unit: 'mcg' },
  caffeine_mg:                   { label: 'Caffeine',                   unit: 'mg' },
  theobromine_mg:                { label: 'Theobromine',                unit: 'mg' },
  tryptophan_g:                  { label: 'Tryptophan',                 unit: 'g' },
  threonine_g:                   { label: 'Threonine',                  unit: 'g' },
  isoleucine_g:                  { label: 'Isoleucine',                 unit: 'g' },
  leucine_g:                     { label: 'Leucine',                    unit: 'g' },
  lysine_g:                      { label: 'Lysine',                     unit: 'g' },
  methionine_g:                  { label: 'Methionine',                 unit: 'g' },
  cystine_g:                     { label: 'Cystine',                    unit: 'g' },
  phenylalanine_g:               { label: 'Phenylalanine',              unit: 'g' },
  tyrosine_g:                    { label: 'Tyrosine',                   unit: 'g' },
  valine_g:                      { label: 'Valine',                     unit: 'g' },
  arginine_g:                    { label: 'Arginine',                   unit: 'g' },
  histidine_g:                   { label: 'Histidine',                  unit: 'g' },
  alanine_g:                     { label: 'Alanine',                    unit: 'g' },
  aspartic_acid_g:               { label: 'Aspartic Acid',              unit: 'g' },
  glutamic_acid_g:               { label: 'Glutamic Acid',              unit: 'g' },
  glycine_g:                     { label: 'Glycine',                    unit: 'g' },
  proline_g:                     { label: 'Proline',                    unit: 'g' },
  serine_g:                      { label: 'Serine',                     unit: 'g' },
  sfa_total_g:                   { label: 'Saturated Fat',              unit: 'g' },
  mufa_total_g:                  { label: 'Monounsaturated Fat',        unit: 'g' },
  pufa_total_g:                  { label: 'Polyunsaturated Fat',        unit: 'g' },
  cholesterol_mg:                { label: 'Cholesterol',                unit: 'mg' },
  sfa_4_0_g:                     { label: 'SFA 4:0 (Butyric)',          unit: 'g' },
  sfa_6_0_g:                     { label: 'SFA 6:0 (Caproic)',          unit: 'g' },
  sfa_8_0_g:                     { label: 'SFA 8:0 (Caprylic)',         unit: 'g' },
  sfa_10_0_g:                    { label: 'SFA 10:0 (Capric)',          unit: 'g' },
  sfa_12_0_g:                    { label: 'SFA 12:0 (Lauric)',          unit: 'g' },
  sfa_14_0_g:                    { label: 'SFA 14:0 (Myristic)',        unit: 'g' },
  sfa_16_0_g:                    { label: 'SFA 16:0 (Palmitic)',        unit: 'g' },
  sfa_18_0_g:                    { label: 'SFA 18:0 (Stearic)',         unit: 'g' },
  mufa_18_1_g:                   { label: 'MUFA 18:1 (Oleic)',          unit: 'g' },
  pufa_18_2_g:                   { label: 'PUFA 18:2 (Linoleic)',       unit: 'g' },
  pufa_18_3_g:                   { label: 'PUFA 18:3 (ALA)',            unit: 'g' },
  pufa_20_4_g:                   { label: 'PUFA 20:4 (Arachidonic)',    unit: 'g' },
  pufa_20_5_epa_g:               { label: 'EPA (Omega-3)',              unit: 'g' },
  pufa_22_5_dpa_g:               { label: 'DPA (Omega-3)',              unit: 'g' },
  pufa_22_6_dha_g:               { label: 'DHA (Omega-3)',              unit: 'g' },
  starch_g:                      { label: 'Starch',                     unit: 'g' },
  sucrose_g:                     { label: 'Sucrose',                    unit: 'g' },
  glucose_g:                     { label: 'Glucose',                    unit: 'g' },
  fructose_g:                    { label: 'Fructose',                   unit: 'g' },
  lactose_g:                     { label: 'Lactose',                    unit: 'g' },
  iodine_mcg:                    { label: 'Iodine',                     unit: 'mcg' },
  carotene_alpha_mcg:            { label: 'Alpha-Carotene',             unit: 'mcg' },
  vitamin_e_added_mg:            { label: 'Vitamin E (Added)',          unit: 'mg' },
  vitamin_k2_mcg:                { label: 'Vitamin K2',                 unit: 'mcg' },
  folate_food_mcg:               { label: 'Folate (Food)',              unit: 'mcg' },
  vitamin_b12_added_mcg:         { label: 'Vitamin B12 (Added)',        unit: 'mcg' },
  lutein_zeaxanthin_mcg:         { label: 'Lutein + Zeaxanthin',        unit: 'mcg' },
  sugars_added_g:                { label: 'Added Sugars',               unit: 'g' },
  galactose_g:                   { label: 'Galactose',                  unit: 'g' },
  maltose_g:                     { label: 'Maltose',                    unit: 'g' },
  sfa_20_0_g:                    { label: 'SFA 20:0 (Arachidic)',       unit: 'g' },
  sfa_22_0_g:                    { label: 'SFA 22:0 (Behenic)',         unit: 'g' },
  mufa_16_1_g:                   { label: 'MUFA 16:1 (Palmitoleic)',    unit: 'g' },
  mufa_20_1_g:                   { label: 'MUFA 20:1',                  unit: 'g' },
  mufa_22_1_g:                   { label: 'MUFA 22:1',                  unit: 'g' },
  pufa_18_4_g:                   { label: 'PUFA 18:4',                  unit: 'g' },
  tocopherol_beta_mg:            { label: 'Beta-Tocopherol',            unit: 'mg' },
  tocopherol_gamma_mg:           { label: 'Gamma-Tocopherol',           unit: 'mg' },
  tocopherol_delta_mg:           { label: 'Delta-Tocopherol',           unit: 'mg' },
  fluoride_mcg:                  { label: 'Fluoride',                   unit: 'mcg' },
}

const NUTRIENT_KEYS = Object.keys(NUTRIENT_META)

function localDateStr(date?: string): string {
  if (date) return date
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function getDailyTotals(date: string): Promise<Record<string, number>> {
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(`${date}T23:59:59.999Z`)

  const meals = await prisma.meal.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { foodItems: true },
  })

  const totals: Record<string, number> = {}
  for (const key of NUTRIENT_KEYS) totals[key] = 0

  for (const meal of meals) {
    for (const item of meal.foodItems) {
      for (const key of NUTRIENT_KEYS) {
        const val = (item as Record<string, unknown>)[key]
        if (typeof val === 'number' && !isNaN(val)) totals[key] += val
      }
    }
  }
  return totals
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = new McpServer({
  name: 'nutrilog',
  version: '1.0.0',
})

server.tool(
  'get_daily_nutrition',
  'Get summed nutrient totals for a date. Returns all 103 nutrient values.',
  { date: z.string().optional().describe('Date as YYYY-MM-DD; defaults to today') },
  async ({ date }) => {
    const d = localDateStr(date)
    const totals = await getDailyTotals(d)
    return { content: [{ type: 'text' as const, text: JSON.stringify({ date: d, totals }) }] }
  },
)

server.tool(
  'get_goals',
  'Get all saved daily nutrition goals (DailyTarget records).',
  {},
  async () => {
    const rows = await prisma.dailyTarget.findMany({ orderBy: { columnName: 'asc' } })
    return { content: [{ type: 'text' as const, text: JSON.stringify(rows) }] }
  },
)

server.tool(
  'set_goal',
  'Upsert a daily nutrition goal. Label and unit are auto-derived from the nutrient column name.',
  {
    columnName: z.string().describe('Nutrient column name, e.g. "protein_g" or "energy_kcal"'),
    targetAmount: z.number().describe('Daily target amount in the nutrient\'s native unit'),
  },
  async ({ columnName, targetAmount }) => {
    const meta = NUTRIENT_META[columnName]
    if (!meta) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown column: ${columnName}. Call list_nutrients to see valid names.`,
          },
        ],
        isError: true,
      }
    }
    const record = await prisma.dailyTarget.upsert({
      where: { columnName },
      update: { targetAmount, label: meta.label, unit: meta.unit },
      create: { columnName, targetAmount, label: meta.label, unit: meta.unit },
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(record) }] }
  },
)

server.tool(
  'list_nutrients',
  'List all 103 available nutrient column names with their labels and units.',
  {},
  async () => {
    const list = Object.entries(NUTRIENT_META).map(([key, { label, unit }]) => ({
      columnName: key,
      label,
      unit,
    }))
    return { content: [{ type: 'text' as const, text: JSON.stringify(list) }] }
  },
)

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)
