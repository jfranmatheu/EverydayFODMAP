/**
 * Everyday FODMAP - Open Recipe Format Specification
 * Version: 1.0.0
 * 
 * This format defines how recipes should be structured for import/export
 * and for loading from external repositories.
 */

// FODMAP levels
export type FODMAPLevel = 'low' | 'medium' | 'high' | 'unknown';

// Ingredient in a recipe
export interface RecipeIngredient {
  /** Name of the ingredient */
  name: string;
  /** Quantity (e.g., 100, 2, 0.5) */
  quantity: number;
  /** Unit of measurement */
  unit: 'g' | 'kg' | 'ml' | 'l' | 'cup' | 'tbsp' | 'tsp' | 'piece' | 'slice' | 'clove' | 'pinch' | 'unit';
  /** FODMAP level for this ingredient */
  fodmap_level: FODMAPLevel;
  /** Optional notes (e.g., "ripe", "drained") */
  notes?: string;
  /** Is this ingredient optional? */
  optional?: boolean;
  /** Alternative ingredients (FODMAP-friendly substitutes) */
  alternatives?: string[];
}

// Nutrition information (optional)
export interface NutritionInfo {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  sodium_mg?: number;
}

// A single recipe in the open format
export interface OpenRecipe {
  /** Unique identifier (UUID or slug) */
  id: string;
  /** Recipe name */
  name: string;
  /** Short description */
  description?: string;
  /** Detailed cooking instructions (markdown supported) */
  instructions: string;
  /** List of ingredients with quantities */
  ingredients: RecipeIngredient[];
  /** Preparation time in minutes */
  prep_time: number;
  /** Cooking time in minutes */
  cook_time: number;
  /** Number of servings */
  servings: number;
  /** Overall FODMAP level (calculated or specified) */
  fodmap_level: FODMAPLevel;
  /** Recipe categories/tags */
  tags?: string[];
  /** Meal type suitability */
  meal_types?: ('breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert')[];
  /** Cuisine type */
  cuisine?: string;
  /** Dietary info */
  dietary?: ('vegetarian' | 'vegan' | 'gluten-free' | 'dairy-free' | 'nut-free')[];
  /** Difficulty level */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Nutrition per serving */
  nutrition?: NutritionInfo;
  /** Image URL (optional) */
  image_url?: string;
  /** Source/author */
  source?: string;
  /** Source URL */
  source_url?: string;
  /** ISO date string of creation */
  created_at?: string;
  /** ISO date string of last update */
  updated_at?: string;
  /** Language code (e.g., 'es', 'en') */
  language?: string;
}

// Recipe collection/pack format
export interface RecipeCollection {
  /** Collection metadata */
  meta: {
    /** Collection name */
    name: string;
    /** Description */
    description?: string;
    /** Version of this collection */
    version: string;
    /** Format version (for compatibility) */
    format_version: '1.0.0';
    /** Author/source */
    author?: string;
    /** License (e.g., 'CC-BY-4.0', 'MIT', 'proprietary') */
    license?: string;
    /** URL to the collection source */
    url?: string;
    /** ISO date of last update */
    updated_at: string;
    /** Language code */
    language: string;
    /** Number of recipes in collection */
    recipe_count: number;
  };
  /** Array of recipes */
  recipes: OpenRecipe[];
}

// Example recipe in Spanish
export const exampleRecipe: OpenRecipe = {
  id: 'arroz-con-pollo-fodmap',
  name: 'Arroz con Pollo bajo en FODMAP',
  description: 'Un clásico plato reconfortante adaptado para dieta FODMAP',
  instructions: `## Preparación

1. Sazona el pollo con sal, pimienta y pimentón
2. En una sartén grande, calienta el aceite de oliva
3. Dora el pollo por ambos lados (5 min por lado)
4. Retira el pollo y reserva

## Cocción

5. En la misma sartén, añade el pimiento rojo y cocina 3 min
6. Añade el arroz y tuesta 2 min
7. Vierte el caldo y lleva a ebullición
8. Reduce el fuego, coloca el pollo encima
9. Tapa y cocina 20 min hasta que el arroz absorba el líquido

## Servir

10. Deja reposar 5 min antes de servir
11. Decora con perejil fresco`,
  ingredients: [
    { name: 'Pechuga de pollo', quantity: 400, unit: 'g', fodmap_level: 'low' },
    { name: 'Arroz basmati', quantity: 200, unit: 'g', fodmap_level: 'low' },
    { name: 'Pimiento rojo', quantity: 1, unit: 'piece', fodmap_level: 'low' },
    { name: 'Caldo de pollo bajo en FODMAP', quantity: 500, unit: 'ml', fodmap_level: 'low', notes: 'sin cebolla ni ajo' },
    { name: 'Aceite de oliva', quantity: 2, unit: 'tbsp', fodmap_level: 'low' },
    { name: 'Pimentón dulce', quantity: 1, unit: 'tsp', fodmap_level: 'low' },
    { name: 'Sal', quantity: 1, unit: 'pinch', fodmap_level: 'low' },
    { name: 'Pimienta negra', quantity: 1, unit: 'pinch', fodmap_level: 'low' },
    { name: 'Perejil fresco', quantity: 2, unit: 'tbsp', fodmap_level: 'low', optional: true },
  ],
  prep_time: 15,
  cook_time: 35,
  servings: 4,
  fodmap_level: 'low',
  tags: ['sin gluten', 'proteína', 'reconfortante'],
  meal_types: ['lunch', 'dinner'],
  cuisine: 'española',
  dietary: ['gluten-free', 'dairy-free'],
  difficulty: 'easy',
  nutrition: {
    calories: 380,
    protein_g: 32,
    carbs_g: 42,
    fat_g: 8,
    fiber_g: 2,
  },
  source: 'Everyday FODMAP',
  language: 'es',
};

// Example collection
export const exampleCollection: RecipeCollection = {
  meta: {
    name: 'Recetas FODMAP Básicas',
    description: 'Colección de recetas esenciales para la dieta baja en FODMAP',
    version: '1.0.0',
    format_version: '1.0.0',
    author: 'Everyday FODMAP Team',
    license: 'CC-BY-4.0',
    updated_at: new Date().toISOString(),
    language: 'es',
    recipe_count: 1,
  },
  recipes: [exampleRecipe],
};

/**
 * Validate a recipe against the format
 */
export function validateRecipe(recipe: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!recipe || typeof recipe !== 'object') {
    return { valid: false, errors: ['Recipe must be an object'] };
  }
  
  const r = recipe as Record<string, unknown>;
  
  // Required fields
  if (!r.id || typeof r.id !== 'string') errors.push('Missing or invalid "id"');
  if (!r.name || typeof r.name !== 'string') errors.push('Missing or invalid "name"');
  if (!r.instructions || typeof r.instructions !== 'string') errors.push('Missing or invalid "instructions"');
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) errors.push('Missing or empty "ingredients"');
  if (typeof r.prep_time !== 'number') errors.push('Missing or invalid "prep_time"');
  if (typeof r.cook_time !== 'number') errors.push('Missing or invalid "cook_time"');
  if (typeof r.servings !== 'number') errors.push('Missing or invalid "servings"');
  if (!['low', 'medium', 'high', 'unknown'].includes(r.fodmap_level as string)) {
    errors.push('Invalid "fodmap_level" (must be low, medium, high, or unknown)');
  }
  
  // Validate ingredients
  if (Array.isArray(r.ingredients)) {
    r.ingredients.forEach((ing, i) => {
      if (!ing || typeof ing !== 'object') {
        errors.push(`Ingredient ${i}: must be an object`);
        return;
      }
      const ingredient = ing as Record<string, unknown>;
      if (!ingredient.name) errors.push(`Ingredient ${i}: missing "name"`);
      if (typeof ingredient.quantity !== 'number') errors.push(`Ingredient ${i}: invalid "quantity"`);
      if (!ingredient.unit) errors.push(`Ingredient ${i}: missing "unit"`);
      if (!['low', 'medium', 'high', 'unknown'].includes(ingredient.fodmap_level as string)) {
        errors.push(`Ingredient ${i}: invalid "fodmap_level"`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a recipe collection
 */
export function validateCollection(collection: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!collection || typeof collection !== 'object') {
    return { valid: false, errors: ['Collection must be an object'] };
  }
  
  const c = collection as Record<string, unknown>;
  
  // Check meta
  if (!c.meta || typeof c.meta !== 'object') {
    errors.push('Missing "meta" object');
  } else {
    const meta = c.meta as Record<string, unknown>;
    if (!meta.name) errors.push('Missing "meta.name"');
    if (!meta.version) errors.push('Missing "meta.version"');
    if (meta.format_version !== '1.0.0') errors.push('Invalid "meta.format_version"');
    if (!meta.language) errors.push('Missing "meta.language"');
  }
  
  // Check recipes
  if (!Array.isArray(c.recipes)) {
    errors.push('Missing "recipes" array');
  } else {
    c.recipes.forEach((recipe, i) => {
      const result = validateRecipe(recipe);
      if (!result.valid) {
        errors.push(`Recipe ${i}: ${result.errors.join(', ')}`);
      }
    });
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Convert an OpenRecipe to internal database format
 */
export function openRecipeToDatabase(recipe: OpenRecipe): {
  recipe: {
    name: string;
    description: string | null;
    instructions: string;
    prep_time: number;
    cook_time: number;
    servings: number;
    fodmap_level: string;
  };
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    fodmap_level: string;
    notes: string | null;
  }[];
} {
  return {
    recipe: {
      name: recipe.name,
      description: recipe.description || null,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      fodmap_level: recipe.fodmap_level,
    },
    ingredients: recipe.ingredients.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      fodmap_level: ing.fodmap_level,
      notes: ing.notes || null,
    })),
  };
}

