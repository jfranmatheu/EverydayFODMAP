// ============================================================
// FODMAP SYSTEM (Monash University Style)
// ============================================================

export type FODMAPLevel = 'low' | 'medium' | 'high' | 'unknown';
export type FODMAPColor = 'green' | 'yellow' | 'red' | 'gray';

// Individual FODMAP categories (Monash style)
export interface FODMAPDetails {
  // Oligosaccharides
  fructans: FODMAPLevel;
  fructans_amount?: string; // e.g., "0.2g per serve"
  gos: FODMAPLevel; // Galacto-oligosaccharides
  gos_amount?: string;
  
  // Disaccharides
  lactose: FODMAPLevel;
  lactose_amount?: string;
  
  // Monosaccharides
  fructose: FODMAPLevel; // Excess fructose
  fructose_amount?: string;
  
  // Polyols
  sorbitol: FODMAPLevel;
  sorbitol_amount?: string;
  mannitol: FODMAPLevel;
  mannitol_amount?: string;
  
  // Overall level (calculated or manual)
  overall: FODMAPLevel;
  
  // Recommended serving size for low FODMAP
  safe_serving?: string;
  // Serving that becomes medium/high
  limit_serving?: string;
}

export const FODMAP_CATEGORIES = [
  { key: 'fructans', label: 'Fructanos', icon: 'leaf' },
  { key: 'gos', label: 'GOS', icon: 'ellipse' },
  { key: 'lactose', label: 'Lactosa', icon: 'water' },
  { key: 'fructose', label: 'Fructosa', icon: 'nutrition' },
  { key: 'sorbitol', label: 'Sorbitol', icon: 'cube' },
  { key: 'mannitol', label: 'Manitol', icon: 'cube-outline' },
] as const;

export function getFODMAPColor(level: FODMAPLevel): FODMAPColor {
  switch (level) {
    case 'low': return 'green';
    case 'medium': return 'yellow';
    case 'high': return 'red';
    default: return 'gray';
  }
}

export function getOverallFODMAP(details: Partial<FODMAPDetails>): FODMAPLevel {
  const levels = [
    details.fructans,
    details.gos,
    details.lactose,
    details.fructose,
    details.sorbitol,
    details.mannitol,
  ].filter(Boolean) as FODMAPLevel[];
  
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.some(l => l === 'low')) return 'low';
  return 'unknown';
}

// ============================================================
// NUTRITION INFO
// ============================================================

export interface NutritionInfo {
  // Per 100g or per serving
  per_serving?: boolean;
  serving_size?: string;
  
  // Macros
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  sugars_g?: number;
  
  // Micros (optional)
  sodium_mg?: number;
  potassium_mg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
}

// Nutri-Score (A-E rating used in Europe)
export type NutriScore = 'A' | 'B' | 'C' | 'D' | 'E' | null;

export const NUTRISCORE_COLORS: Record<string, string> = {
  'A': '#038141',
  'B': '#85BB2F',
  'C': '#FECB02',
  'D': '#EE8100',
  'E': '#E63E11',
};

// ============================================================
// FOODS (formerly Ingredients)
// ============================================================

export type FoodCategory = 
  | 'vegetable'
  | 'fruit'
  | 'grain'
  | 'protein'
  | 'dairy'
  | 'fat'
  | 'beverage'
  | 'condiment'
  | 'processed'
  | 'other';

export const FOOD_CATEGORIES: { id: FoodCategory; label: string; icon: string }[] = [
  { id: 'vegetable', label: 'Verdura', icon: 'leaf' },
  { id: 'fruit', label: 'Fruta', icon: 'nutrition' },
  { id: 'grain', label: 'Cereal/Grano', icon: 'apps' },
  { id: 'protein', label: 'Proteína', icon: 'fish' },
  { id: 'dairy', label: 'Lácteo', icon: 'water' },
  { id: 'fat', label: 'Grasa/Aceite', icon: 'water-outline' },
  { id: 'beverage', label: 'Bebida', icon: 'cafe' },
  { id: 'condiment', label: 'Condimento', icon: 'flask' },
  { id: 'processed', label: 'Procesado', icon: 'cube' },
  { id: 'other', label: 'Otro', icon: 'ellipse' },
];

// A food item (can be simple or compound)
export interface Food {
  id: number;
  name: string;
  category: FoodCategory;
  
  // FODMAP information (Monash style)
  fodmap_details?: FODMAPDetails;
  fodmap_level: FODMAPLevel; // Quick reference (overall)
  
  // Compound food - contains other foods/ingredients
  is_compound: boolean;
  sub_foods?: FoodComponent[]; // Only if is_compound
  
  // Nutrition
  nutrition?: NutritionInfo;
  nutri_score?: NutriScore;
  
  // Details
  serving_size?: string;
  brand?: string; // For processed foods
  barcode?: string;
  
  // Media
  image_uri?: string;
  
  // Metadata
  notes?: string;
  tags?: string[];
  folder_id?: number;
  is_favorite?: boolean;
  
  // Source tracking
  source?: 'user' | 'internal' | 'external';
  source_id?: string;
  
  created_at: string;
  updated_at?: string;
}

// Alias for backwards compatibility
export type Ingredient = Food;

// Component of a compound food
export interface FoodComponent {
  food_id: number;
  food_name?: string; // Denormalized for display
  quantity: number;
  unit: string;
  fodmap_level?: FODMAPLevel;
}

// ============================================================
// RECIPES
// ============================================================

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'other';
export type RecipeSource = 'user' | 'internal' | 'external';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
  dessert: 'Postre',
  other: 'Otro',
};

export const DIFFICULTY_LABELS: Record<RecipeDifficulty, string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
};

// A recipe step
export interface RecipeStep {
  order: number;
  title?: string; // Optional section title (e.g., "Preparación", "Cocción")
  instruction: string;
  duration_minutes?: number;
  tip?: string; // Optional tip for this step
}

// Ingredient in a recipe
export interface RecipeIngredient {
  food_id?: number; // Reference to food in database
  name: string; // Display name (or custom if no food_id)
  quantity: number;
  unit: string;
  fodmap_level?: FODMAPLevel;
  notes?: string;
  optional?: boolean;
  alternatives?: string[]; // FODMAP-friendly alternatives
}

// Full recipe
export interface Recipe {
  id: number;
  name: string;
  description?: string;
  
  // Recipe content
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  notes?: string; // Additional notes (separate from steps)
  
  // Times
  prep_time: number;
  cook_time: number;
  total_time?: number;
  
  // Servings
  servings: number;
  
  // FODMAP
  fodmap_level: FODMAPLevel;
  fodmap_details?: Partial<FODMAPDetails>;
  
  // Classification
  meal_types?: MealType[];
  difficulty?: RecipeDifficulty;
  cuisine?: string;
  dietary?: string[]; // 'vegetarian', 'vegan', 'gluten-free', etc.
  tags?: string[];
  
  // Nutrition (per serving)
  nutrition?: NutritionInfo;
  
  // Media
  image_uri?: string;
  
  // Source tracking
  source: RecipeSource;
  source_id?: string; // External ID or URL
  source_name?: string; // e.g., "Monash University", "User Collection"
  
  // If this is a user copy of an external recipe
  original_recipe_id?: number;
  is_modified_copy?: boolean;
  is_hidden?: boolean; // Original gets hidden when user creates a modified copy
  
  // Metadata
  folder_id?: number;
  is_favorite?: boolean;
  created_at: string;
  updated_at?: string;
}

// ============================================================
// MEALS (Daily food log)
// ============================================================

export interface Meal {
  id: number;
  name: string;
  meal_type: MealType;
  date: string;
  time: string;
  
  // Can include foods or recipes
  items?: MealItem[];
  
  // Quick entry without items
  notes?: string;
  image_uri?: string;
  
  created_at: string;
}

export interface MealItem {
  id: number;
  meal_id: number;
  food_id?: number;
  recipe_id?: number;
  name?: string; // Display name
  quantity: number;
  unit: string;
  fodmap_level?: FODMAPLevel;
}

// ============================================================
// SYMPTOMS
// ============================================================

export const SYMPTOM_TYPES = [
  'Dolor abdominal',
  'Hinchazón',
  'Gases',
  'Náuseas',
  'Diarrea',
  'Estreñimiento',
  'Reflujo',
  'Fatiga',
  'Dolor de cabeza',
  'Otro',
] as const;

export type SymptomType = typeof SYMPTOM_TYPES[number];

export interface Symptom {
  id: number;
  type: SymptomType;
  intensity: number; // 1-10
  date: string;
  time: string;
  notes?: string;
  created_at: string;
}

// ============================================================
// BOWEL MOVEMENTS (Bristol Scale)
// ============================================================

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const BRISTOL_SCALE: Record<BristolType, { label: string; description: string; emoji: string }> = {
  1: { label: 'Tipo 1', description: 'Trozos duros separados', emoji: '🔵' },
  2: { label: 'Tipo 2', description: 'Forma de salchicha con bultos', emoji: '🟤' },
  3: { label: 'Tipo 3', description: 'Salchicha con grietas', emoji: '🟫' },
  4: { label: 'Tipo 4', description: 'Suave y lisa (ideal)', emoji: '🟢' },
  5: { label: 'Tipo 5', description: 'Trozos blandos con bordes', emoji: '🟡' },
  6: { label: 'Tipo 6', description: 'Trozos esponjosos', emoji: '🟠' },
  7: { label: 'Tipo 7', description: 'Líquido, sin trozos', emoji: '🔴' },
};

export interface BowelMovement {
  id: number;
  bristol_type: BristolType;
  urgency: number; // 1-5
  pain: number; // 0-10
  discomfort: number; // 0-10
  date: string;
  time: string;
  notes?: string;
  image_uri?: string; // Optional photo
  created_at: string;
}

// ============================================================
// TREATMENTS
// ============================================================

export interface Treatment {
  id: number;
  name: string;
  dosage?: string;
  frequency?: string;
  time_of_day?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface TreatmentLog {
  id: number;
  treatment_id: number;
  treatment_name?: string;
  date: string;
  time: string;
  taken: boolean;
  notes?: string;
  created_at: string;
}

// ============================================================
// ACTIVITIES
// ============================================================

export type ActivityType = 
  | 'walking'
  | 'running'
  | 'cycling'
  | 'swimming'
  | 'yoga'
  | 'gym'
  | 'stretching'
  | 'meditation'
  | 'dancing'
  | 'hiking'
  | 'other';

export const ACTIVITY_TYPES: { id: ActivityType; label: string; icon: string }[] = [
  { id: 'walking', label: 'Caminar', icon: 'walk' },
  { id: 'running', label: 'Correr', icon: 'fitness' },
  { id: 'cycling', label: 'Ciclismo', icon: 'bicycle' },
  { id: 'swimming', label: 'Natación', icon: 'water' },
  { id: 'yoga', label: 'Yoga', icon: 'body' },
  { id: 'gym', label: 'Gimnasio', icon: 'barbell' },
  { id: 'stretching', label: 'Estiramientos', icon: 'accessibility' },
  { id: 'meditation', label: 'Meditación', icon: 'leaf' },
  { id: 'dancing', label: 'Baile', icon: 'musical-notes' },
  { id: 'hiking', label: 'Senderismo', icon: 'trail-sign' },
  { id: 'other', label: 'Otro', icon: 'ellipse' },
];

export type IntensityLevel = 'low' | 'medium' | 'high';

export const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export interface ActivityLog {
  id: number;
  activity_type: ActivityType;
  custom_name?: string;
  duration_minutes: number;
  intensity: IntensityLevel;
  date: string;
  time: string;
  notes?: string;
  created_at: string;
}

// ============================================================
// WATER INTAKE
// ============================================================

export interface WaterIntake {
  id: number;
  glasses: number;
  amount_ml: number;
  date: string;
  time: string;
  created_at: string;
}

// ============================================================
// TAGS & FOLDERS
// ============================================================

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id?: number;
  icon?: string;
  color?: string;
  created_at: string;
}

// ============================================================
// SETTINGS
// ============================================================

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications_enabled: boolean;
  water_goal_glasses: number;
  default_meal_times: Record<MealType, string>;
  external_recipes_enabled: boolean;
}
