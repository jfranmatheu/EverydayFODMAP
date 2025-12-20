/**
 * Everyday FODMAP - Internal Data Loader
 * 
 * Loads foods and recipes from JSON files in assets/data/
 * Images are optional and should have the same name as the JSON file.
 */

// Import all food JSON files
import aceiteOliva from '@/assets/data/foods/aceite-oliva.json';
import ajo from '@/assets/data/foods/ajo.json';
import arrozBlanco from '@/assets/data/foods/arroz-blanco.json';
import bebidaAlmendras from '@/assets/data/foods/bebida-almendras.json';
import cebolla from '@/assets/data/foods/cebolla.json';
import espinacas from '@/assets/data/foods/espinacas.json';
import fresas from '@/assets/data/foods/fresas.json';
import huevo from '@/assets/data/foods/huevo.json';
import lecheSinLactosa from '@/assets/data/foods/leche-sin-lactosa.json';
import manzana from '@/assets/data/foods/manzana.json';
import pimientoRojo from '@/assets/data/foods/pimiento-rojo.json';
import platanoVerde from '@/assets/data/foods/platano-verde.json';
import pollo from '@/assets/data/foods/pollo.json';
import tomate from '@/assets/data/foods/tomate.json';
import zanahoria from '@/assets/data/foods/zanahoria.json';

// Import all recipe JSON files
import arrozConPollo from '@/assets/data/recipes/arroz-con-pollo.json';
import ensaladaMediterranea from '@/assets/data/recipes/ensalada-mediterranea.json';
import pastaTomate from '@/assets/data/recipes/pasta-tomate.json';
import polloLimon from '@/assets/data/recipes/pollo-limon.json';
import smoothieFresasPlatano from '@/assets/data/recipes/smoothie-fresas-platano.json';
import tortillaPatatas from '@/assets/data/recipes/tortilla-patatas.json';

// Types for internal data (matching JSON structure)
export interface InternalFoodData {
  id: string;
  name: string;
  category: string;
  fodmap_level: string;
  fodmap_details?: {
    fructans?: string;
    fructans_amount?: string;
    gos?: string;
    gos_amount?: string;
    lactose?: string;
    lactose_amount?: string;
    fructose?: string;
    fructose_amount?: string;
    sorbitol?: string;
    sorbitol_amount?: string;
    mannitol?: string;
    mannitol_amount?: string;
    overall?: string;
    safe_serving?: string;
    limit_serving?: string;
  };
  serving_size?: string;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    saturated_fat_g?: number;
    sugars_g?: number;
    sodium_mg?: number;
  };
  nutri_score?: string;
  notes?: string;
}

export interface InternalRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  fodmap_level?: string;
  notes?: string;
  optional?: boolean;
}

export interface InternalRecipeStep {
  order: number;
  title?: string;
  instruction: string;
  duration_minutes?: number;
  tip?: string;
}

export interface InternalRecipeData {
  id: string;
  name: string;
  description?: string;
  fodmap_level: string;
  prep_time: number;
  cook_time: number;
  servings: number;
  difficulty?: string;
  meal_types?: string[];
  cuisine?: string;
  dietary?: string[];
  ingredients: InternalRecipeIngredient[];
  steps: InternalRecipeStep[];
  notes?: string;
  nutrition?: {
    per_serving?: boolean;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
  };
}

// Collected internal foods
export const INTERNAL_FOODS: InternalFoodData[] = [
  zanahoria,
  espinacas,
  pimientoRojo,
  tomate,
  ajo,
  cebolla,
  arrozBlanco,
  pollo,
  huevo,
  platanoVerde,
  fresas,
  manzana,
  lecheSinLactosa,
  aceiteOliva,
  bebidaAlmendras,
] as InternalFoodData[];

// Collected internal recipes
export const INTERNAL_RECIPES: InternalRecipeData[] = [
  arrozConPollo,
  smoothieFresasPlatano,
  ensaladaMediterranea,
  tortillaPatatas,
  pastaTomate,
  polloLimon,
] as InternalRecipeData[];

/**
 * Load internal data into the database
 * Called during database initialization
 */
export async function loadInternalData(db: any): Promise<void> {
  console.log('[InternalData] Loading internal foods and recipes from JSON...');
  
  // Check if already loaded
  const existingFoods = await db.getAllAsync(
    "SELECT COUNT(*) as count FROM foods WHERE source = 'internal'"
  );
  
  if (existingFoods[0]?.count > 0) {
    console.log('[InternalData] Internal data already loaded, skipping');
    return;
  }

  let foodsLoaded = 0;
  let recipesLoaded = 0;

  // Load foods
  for (const food of INTERNAL_FOODS) {
    try {
      await db.runAsync(
        `INSERT INTO foods (name, category, fodmap_level, fodmap_details, nutrition, serving_size, notes, source, source_id, is_compound)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'internal', ?, 0)`,
        [
          food.name,
          food.category,
          food.fodmap_level,
          food.fodmap_details ? JSON.stringify(food.fodmap_details) : null,
          food.nutrition ? JSON.stringify(food.nutrition) : null,
          food.serving_size || null,
          food.notes || null,
          food.id, // source_id for reference
        ]
      );
      foodsLoaded++;
    } catch (e) {
      console.log(`[InternalData] Error loading food ${food.name}:`, e);
    }
  }

  // Load recipes
  for (const recipe of INTERNAL_RECIPES) {
    try {
      const result = await db.runAsync(
        `INSERT INTO recipes (name, description, fodmap_level, prep_time, cook_time, servings, difficulty, cuisine, meal_types, dietary, nutrition, notes, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'internal', ?)`,
        [
          recipe.name,
          recipe.description || null,
          recipe.fodmap_level,
          recipe.prep_time,
          recipe.cook_time,
          recipe.servings,
          recipe.difficulty || null,
          recipe.cuisine || null,
          recipe.meal_types ? JSON.stringify(recipe.meal_types) : null,
          recipe.dietary ? JSON.stringify(recipe.dietary) : null,
          recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
          recipe.notes || null,
          recipe.id, // source_id for reference
        ]
      );
      
      const recipeId = result.lastInsertRowId;

      // Insert steps
      if (recipe.steps) {
        for (const step of recipe.steps) {
          await db.runAsync(
            `INSERT INTO recipe_steps (recipe_id, step_order, title, instruction, duration_minutes, tip)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [recipeId, step.order, step.title || null, step.instruction, step.duration_minutes || null, step.tip || null]
          );
        }
      }

      // Insert ingredients
      if (recipe.ingredients) {
        for (const ing of recipe.ingredients) {
          await db.runAsync(
            `INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, fodmap_level, notes, is_optional)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [recipeId, ing.name, ing.quantity, ing.unit, ing.fodmap_level || null, ing.notes || null, ing.optional ? 1 : 0]
          );
        }
      }
      
      recipesLoaded++;
    } catch (e) {
      console.log(`[InternalData] Error loading recipe ${recipe.name}:`, e);
    }
  }

  console.log(`[InternalData] Loaded ${foodsLoaded} foods and ${recipesLoaded} recipes from JSON files`);
}

/**
 * Get count of available internal data
 */
export function getInternalDataCount(): { foods: number; recipes: number } {
  return {
    foods: INTERNAL_FOODS.length,
    recipes: INTERNAL_RECIPES.length,
  };
}
