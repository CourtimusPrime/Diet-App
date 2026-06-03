// USDA FoodData Central integration module
// Provides: NUTRIENT_ID_TO_COLUMN map, searchUSDA(), nutrientsToColumns()
// All USDA nutrient IDs are 4-digit FDC IDs (e.g. 1003 for protein, not 203)

import https from 'node:https';

function httpsGet(url: string): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4 } as object, (res) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        let body: unknown = null;
        try { body = JSON.parse(data); } catch { /* leave body null */ }
        resolve({ statusCode: res.statusCode ?? 0, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('USDA request timeout')); });
  });
}

export const RATE_LIMIT_STATUS_CODES: readonly number[] = [429];

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface USDAFoodNutrient {
  nutrientId: number;
  value: number | null;
}

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: USDAFoodNutrient[];
}

export interface USDASearchResponse {
  foods: USDAFood[];
}

// ── Priority + Core Columns ───────────────────────────────────────────────────

/** DataType priority order: Foundation > SR Legacy > Survey (FNDDS) > Branded */
export const DATA_TYPE_PRIORITY: string[] = [
  'Foundation',
  'SR Legacy',
  'Survey (FNDDS)',
  'Branded',
];

/** Nutrients that are reliably present in both Foundation and SR Legacy datasets */
export const CORE_NUTRIENT_COLUMNS: string[] = [
  'energy_kcal',
  'protein_g',
  'fat_total_g',
  'carbohydrate_g',
  'fiber_g',
];

// ── NUTRIENT_ID_TO_COLUMN map ─────────────────────────────────────────────────
// Maps USDA 4-digit nutrientId → Prisma FoodItem Float? column name
// Every entry in this map corresponds to a Float? column in prisma/schema.prisma
// Verified IDs sourced from live USDA FDC API calls; [ASSUMED] IDs follow FDC 4-digit pattern
// and match RESEARCH.md documentation. Gaps will be verified with a registered USDA key.

export const NUTRIENT_ID_TO_COLUMN: Record<number, string> = {
  // ── Proximates (11) ──────────────────────────────────────────────────────────
  1051: 'water_g',                      // Water [VERIFIED: live API]
  1008: 'energy_kcal',                  // Energy (general) [VERIFIED: live API]
  2047: 'energy_atwater_general_kcal',  // Energy, Atwater General [VERIFIED: live API]
  2048: 'energy_atwater_specific_kcal', // Energy, Atwater Specific [VERIFIED: live API]
  1003: 'protein_g',                    // Protein [VERIFIED: live API]
  1004: 'fat_total_g',                  // Total lipid (fat) [VERIFIED: live API]
  1005: 'carbohydrate_g',               // Carbohydrate by difference [VERIFIED: live API]
  1079: 'fiber_g',                      // Fiber, total dietary [VERIFIED: live API]
  1063: 'sugars_total_g',               // Sugars, total [VERIFIED: live API]
  1002: 'nitrogen_g',                   // Nitrogen [VERIFIED: live API]
  1007: 'ash_g',                        // Ash [VERIFIED: live API]

  // ── Minerals (10) ────────────────────────────────────────────────────────────
  1087: 'calcium_mg',    // Calcium [VERIFIED: live API]
  1089: 'iron_mg',       // Iron [VERIFIED: live API]
  1090: 'magnesium_mg',  // Magnesium [VERIFIED: live API]
  1091: 'phosphorus_mg', // Phosphorus [VERIFIED: live API]
  1092: 'potassium_mg',  // Potassium [VERIFIED: live API]
  1093: 'sodium_mg',     // Sodium [VERIFIED: live API]
  1095: 'zinc_mg',       // Zinc [VERIFIED: live API]
  1098: 'copper_mg',     // Copper [VERIFIED: live API]
  1101: 'manganese_mg',  // Manganese [VERIFIED: live API]
  1103: 'selenium_mcg',  // Selenium [VERIFIED: live API]

  // ── Vitamins (20) ────────────────────────────────────────────────────────────
  1106: 'vitamin_a_rae_mcg',   // Vitamin A, RAE [VERIFIED: live API]
  1107: 'retinol_mcg',         // Retinol [ASSUMED: FDC pattern]
  1159: 'carotene_beta_mcg',   // beta-Carotene [ASSUMED: FDC pattern]
  1162: 'vitamin_c_mg',        // Vitamin C [VERIFIED: live API]
  1114: 'vitamin_d_mcg',       // Vitamin D total [VERIFIED: live API]
  1109: 'vitamin_e_mg',        // Vitamin E (alpha-tocopherol) [VERIFIED: live API]
  1185: 'vitamin_k1_mcg',      // Vitamin K1 (phylloquinone) [VERIFIED: live API]
  1165: 'thiamin_mg',          // Thiamin (B1) [VERIFIED: live API]
  1166: 'riboflavin_mg',       // Riboflavin (B2) [VERIFIED: live API]
  1167: 'niacin_mg',           // Niacin (B3) [VERIFIED: live API]
  1170: 'pantothenic_acid_mg', // Pantothenic acid (B5) [ASSUMED: FDC pattern]
  1175: 'vitamin_b6_mg',       // Vitamin B6 [VERIFIED: live API]
  1176: 'biotin_mcg',          // Biotin (B7) [VERIFIED: live API]
  1177: 'folate_total_mcg',    // Folate, total [VERIFIED: live API]
  1190: 'folate_dfe_mcg',      // Folate, DFE [ASSUMED: FDC pattern]
  1178: 'vitamin_b12_mcg',     // Vitamin B12 [VERIFIED: live API]
  1180: 'choline_total_mg',    // Choline, total [ASSUMED: FDC pattern]
  1187: 'lycopene_mcg',        // Lycopene [ASSUMED: FDC pattern]
  1057: 'caffeine_mg',         // Caffeine [ASSUMED: FDC pattern]
  1058: 'theobromine_mg',      // Theobromine [ASSUMED: FDC pattern]

  // ── Amino Acids (18) ─────────────────────────────────────────────────────────
  1210: 'tryptophan_g',    // Tryptophan [VERIFIED: live API]
  1211: 'threonine_g',     // Threonine [VERIFIED: live API]
  1212: 'isoleucine_g',    // Isoleucine [VERIFIED: live API]
  1213: 'leucine_g',       // Leucine [VERIFIED: live API]
  1214: 'lysine_g',        // Lysine [VERIFIED: live API]
  1215: 'methionine_g',    // Methionine [VERIFIED: live API]
  1216: 'cystine_g',       // Cystine [VERIFIED: live API]
  1217: 'phenylalanine_g', // Phenylalanine [VERIFIED: live API]
  1218: 'tyrosine_g',      // Tyrosine [VERIFIED: live API]
  1219: 'valine_g',        // Valine [VERIFIED: live API]
  1220: 'arginine_g',      // Arginine [VERIFIED: live API]
  1221: 'histidine_g',     // Histidine [VERIFIED: live API]
  1222: 'alanine_g',       // Alanine [VERIFIED: live API]
  1223: 'aspartic_acid_g', // Aspartic acid [VERIFIED: live API]
  1224: 'glutamic_acid_g', // Glutamic acid [VERIFIED: live API]
  1225: 'glycine_g',       // Glycine [VERIFIED: live API]
  1226: 'proline_g',       // Proline [VERIFIED: live API]
  1227: 'serine_g',        // Serine [VERIFIED: live API]

  // ── Fatty Acids (22) ─────────────────────────────────────────────────────────
  1258: 'sfa_total_g',     // SFA total [VERIFIED: live API]
  1292: 'mufa_total_g',    // MUFA total [VERIFIED: live API]
  1293: 'pufa_total_g',    // PUFA total [VERIFIED: live API]
  1253: 'cholesterol_mg',  // Cholesterol [VERIFIED: live API]
  1259: 'sfa_4_0_g',       // Butyric acid (4:0) [VERIFIED: live API]
  1260: 'sfa_6_0_g',       // Caproic acid (6:0) [VERIFIED: live API]
  1261: 'sfa_8_0_g',       // Caprylic acid (8:0) [VERIFIED: live API]
  1262: 'sfa_10_0_g',      // Capric acid (10:0) [VERIFIED: live API]
  1263: 'sfa_12_0_g',      // Lauric acid (12:0) [VERIFIED: live API]
  1264: 'sfa_14_0_g',      // Myristic acid (14:0) [VERIFIED: live API]
  1265: 'sfa_16_0_g',      // Palmitic acid (16:0) [VERIFIED: live API]
  1266: 'sfa_18_0_g',      // Stearic acid (18:0) [VERIFIED: live API]
  1268: 'mufa_18_1_g',     // Oleic acid (18:1) [VERIFIED: live API]
  1269: 'pufa_18_2_g',     // Linoleic acid (18:2) [VERIFIED: live API]
  1270: 'pufa_18_3_g',     // Linolenic acid (18:3) [VERIFIED: live API]
  1271: 'pufa_20_4_g',     // Arachidonic acid (20:4) [VERIFIED: live API]
  1278: 'pufa_20_5_epa_g', // EPA (20:5 n-3) [VERIFIED: live API]
  1280: 'pufa_22_5_dpa_g', // DPA (22:5 n-3) [VERIFIED: live API]
  1272: 'pufa_22_6_dha_g', // DHA (22:6 n-3) [VERIFIED: live API]
  1056: 'starch_g',        // Starch [ASSUMED: FDC pattern]
  1010: 'sucrose_g',       // Sucrose [ASSUMED: FDC pattern]
  1011: 'glucose_g',       // Glucose [ASSUMED: FDC pattern]

  // ── Bioactives / Other (22) ──────────────────────────────────────────────────
  1012: 'fructose_g',              // Fructose [ASSUMED: FDC pattern]
  1013: 'lactose_g',               // Lactose [ASSUMED: FDC pattern]
  1100: 'iodine_mcg',              // Iodine [ASSUMED: FDC pattern]
  1108: 'carotene_alpha_mcg',      // alpha-Carotene [ASSUMED: FDC pattern]
  1110: 'vitamin_e_added_mg',      // Vitamin E, added [ASSUMED: FDC pattern]
  1184: 'vitamin_k2_mcg',          // Vitamin K2 (MK-4, menaquinone-4) [ASSUMED: FDC pattern]
  1186: 'folate_food_mcg',         // Folate, food [ASSUMED: FDC pattern]
  1194: 'vitamin_b12_added_mcg',   // Vitamin B12, added [ASSUMED: FDC pattern]
  1183: 'lutein_zeaxanthin_mcg',   // Lutein + zeaxanthin [ASSUMED: FDC pattern]
  2000: 'sugars_added_g',          // Total sugars (added) [ASSUMED: FDC pattern]
  1075: 'galactose_g',             // Galactose [ASSUMED: FDC pattern]
  1014: 'maltose_g',               // Maltose [ASSUMED: FDC pattern]
  1275: 'sfa_20_0_g',              // Arachidic acid (20:0) [ASSUMED: FDC pattern]
  1276: 'sfa_22_0_g',              // Behenic acid (22:0) [ASSUMED: FDC pattern]
  1267: 'mufa_16_1_g',             // Palmitoleic acid (16:1) [ASSUMED: FDC pattern]
  1277: 'mufa_20_1_g',             // Gondoic acid (20:1) [ASSUMED: FDC pattern]
  1279: 'mufa_22_1_g',             // Erucic acid (22:1) [ASSUMED: FDC pattern]
  1273: 'pufa_18_4_g',             // Stearidonic acid (18:4) [ASSUMED: FDC pattern]
  1125: 'tocopherol_beta_mg',      // Tocopherol, beta [ASSUMED: FDC pattern]
  1126: 'tocopherol_gamma_mg',     // Tocopherol, gamma [ASSUMED: FDC pattern]
  1127: 'tocopherol_delta_mg',     // Tocopherol, delta [ASSUMED: FDC pattern]
  1099: 'fluoride_mcg',            // Fluoride [ASSUMED: FDC pattern]
};

// ── DUPLICATE_NUTRIENT_IDS ────────────────────────────────────────────────────
// Documents known nutrientId ambiguities across USDA datasets.
// When the same nutrientId is returned more than once in a single food response,
// the first occurrence is kept and subsequent ones are skipped with a console.warn.
// This map documents WHY a given ID is flagged — for auditing and future maintenance.

export const DUPLICATE_NUTRIENT_IDS: Record<number, { note: string }> = {
  1278: {
    note: 'SR Legacy may emit 1278 as palmitoleic; Foundation uses 1267 for palmitoleic (mufa_16_1_g). EPA mapping retained. Duplicate entry skipped.',
  },
};

// ── USDA API helpers ──────────────────────────────────────────────────────────

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

/**
 * Search USDA FoodData Central for a food item by name.
 *
 * Strategy:
 * 1. First tries `foodName + " raw"` to prefer Foundation Foods entries.
 * 2. If zero results, retries with the plain `foodName`.
 * 3. Returns the highest-priority dataType match (Foundation > SR Legacy > Survey > Branded).
 * 4. Returns null (never throws) if both queries return empty results or on fetch error.
 *
 * Per CONTEXT.md: zero USDA results must NOT block meal save (usdaMatched=false path).
 */
export async function searchUSDA(foodName: string): Promise<USDAFood | null> {
  const apiKey = process.env.USDA_API_KEY ?? 'DEMO_KEY';
  const queries = [`${foodName} raw`, foodName];

  for (const query of queries) {
    try {
      const url = new URL(`${USDA_BASE}/foods/search`);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('query', query);
      url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS),Branded');
      url.searchParams.set('pageSize', '5');

      const data = await httpsGet(url.toString());

      if (data.statusCode === 403) {
        console.error('[usda] HTTP 403 — invalid or revoked USDA API key. Check USDA_API_KEY in .env');
        return null;
      }
      if (RATE_LIMIT_STATUS_CODES.includes(data.statusCode)) {
        console.warn(`[usda] Rate limit hit (HTTP ${data.statusCode}) for query "${query}" — storing with null nutrients`);
        return null;
      }

      const body = data.body as USDASearchResponse;
      if (body?.foods?.length > 0) {
        // Select highest-priority dataType match
        const sorted = [...body.foods].sort((a, b) => {
          const ai = DATA_TYPE_PRIORITY.indexOf(a.dataType);
          const bi = DATA_TYPE_PRIORITY.indexOf(b.dataType);
          // Unknown dataTypes sort last
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
        });
        return sorted[0];
      }
    } catch (err) {
      console.error(`[usda] Fetch error for query "${query}":`, err);
      continue;
    }
  }

  // Both queries returned empty results (or both failed)
  return null;
}

/**
 * Convert USDA per-100g nutrient values to consumed quantity.
 *
 * Iterates food.foodNutrients, looks up each nutrientId in NUTRIENT_ID_TO_COLUMN,
 * and scales by (quantityG / 100). Unknown nutrient IDs are silently ignored.
 * Null nutrient values are skipped.
 *
 * Returns a Record<string, number> keyed by Prisma FoodItem column name,
 * ready to spread into a Prisma create/update call.
 */
export function nutrientsToColumns(
  food: USDAFood,
  quantityG: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  const seenIds = new Set<number>();

  for (const nutrient of food.foodNutrients) {
    if (seenIds.has(nutrient.nutrientId)) {
      console.warn(
        '[usda] Duplicate nutrientId skipped:',
        nutrient.nutrientId,
        '→',
        NUTRIENT_ID_TO_COLUMN[nutrient.nutrientId] ?? 'unknown',
      );
      continue;
    }
    seenIds.add(nutrient.nutrientId);

    const columnName = NUTRIENT_ID_TO_COLUMN[nutrient.nutrientId];
    if (columnName && nutrient.value != null) {
      result[columnName] = (nutrient.value * quantityG) / 100;
    }
  }

  return result;
}
