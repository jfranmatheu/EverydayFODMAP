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

// Days of the week (Sunday = 0)
export const DAY_LABELS: string[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

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
  duration_minutes?: number;
  notes?: string;
  meal_id?: number;
  treatment_id?: number;
  stress_type?: 'personal' | 'professional' | 'other';
  stress_notes?: string;
  created_at: string;
}

// ============================================================
// BOWEL MOVEMENTS (Bristol Scale)
// ============================================================

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const BRISTOL_SCALE: Record<BristolType, { label: string; name: string; description: string; emoji: string }> = {
  1: { label: 'Tipo 1', name: 'Bolitas duras', description: 'Trozos duros separados como nueces', emoji: '🫐' },
  2: { label: 'Tipo 2', name: 'Salchicha grumosa', description: 'Forma de salchicha con bultos', emoji: '🥜' },
  3: { label: 'Tipo 3', name: 'Salchicha agrietada', description: 'Salchicha con grietas en superficie', emoji: '🌭' },
  4: { label: 'Tipo 4', name: 'Suave y lisa', description: 'Como serpiente, suave (ideal)', emoji: '🐍' },
  5: { label: 'Tipo 5', name: 'Trozos blandos', description: 'Trozos blandos con bordes definidos', emoji: '☁️' },
  6: { label: 'Tipo 6', name: 'Esponjoso', description: 'Trozos esponjosos y pastosos', emoji: '🧽' },
  7: { label: 'Tipo 7', name: 'Líquido', description: 'Acuoso, sin trozos sólidos', emoji: '💧' },
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

export type TreatmentType = 'medication' | 'supplement' | 'probiotic' | 'enzyme' | 'other';

export const TREATMENT_TYPES: Record<TreatmentType, { label: string; icon: string }> = {
  medication: { label: 'Medicamento', icon: 'medkit' },
  supplement: { label: 'Suplemento', icon: 'fitness' },
  probiotic: { label: 'Probiótico', icon: 'leaf' },
  enzyme: { label: 'Enzima digestiva', icon: 'flask' },
  other: { label: 'Otro', icon: 'ellipse' },
};

export type DosageUnit = 'mg' | 'g' | 'ml' | 'gotas' | 'comprimidos' | 'cápsulas' | 'sobres' | 'cucharadas' | 'unidades';

export const DOSAGE_UNITS: DosageUnit[] = ['mg', 'g', 'ml', 'gotas', 'comprimidos', 'cápsulas', 'sobres', 'cucharadas', 'unidades'];

export type TreatmentFrequency = 'as_needed' | 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'every_x_hours' | 'specific_times' | 'with_meals' | 'before_meals' | 'after_meals' | 'weekly' | 'custom';

export const TREATMENT_FREQUENCY_LABELS: Record<TreatmentFrequency, string> = {
  as_needed: 'Según necesidad',
  once_daily: 'Una vez al día',
  twice_daily: 'Dos veces al día',
  three_times_daily: 'Tres veces al día',
  four_times_daily: 'Cuatro veces al día',
  every_x_hours: 'Cada X horas',
  specific_times: 'Horarios específicos',
  with_meals: 'Con las comidas',
  before_meals: 'Antes de comer',
  after_meals: 'Después de comer',
  weekly: 'Semanal',
  custom: 'Personalizado',
};

export interface TreatmentDose {
  time: string; // HH:MM format
  amount: number;
  unit: DosageUnit;
  notes?: string;
  with_food?: boolean;
}

export interface Treatment {
  id: number;
  name: string;
  type: TreatmentType;
  // Dosage configuration
  dosage_amount?: number;
  dosage_unit?: DosageUnit;
  // Frequency configuration
  frequency: TreatmentFrequency;
  frequency_value?: string; // e.g., "8" for every 8 hours, or JSON for specific times
  doses?: TreatmentDose[]; // Array of daily doses
  // Schedule
  start_date?: string;
  end_date?: string; // null = chronic/indefinite
  is_chronic: boolean;
  // Days configuration (for weekly or specific days)
  specific_days?: string; // comma-separated day indices (0-6)
  // Reminders
  reminder_enabled: boolean;
  reminder_minutes_before?: number; // minutes before each dose
  // Additional info
  instructions?: string; // e.g., "Take with water", "Avoid dairy"
  side_effects?: string;
  prescribing_doctor?: string;
  pharmacy?: string;
  refill_reminder_enabled?: boolean;
  refill_reminder_days?: number; // days before running out
  current_stock?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface TreatmentLog {
  id: number;
  treatment_id: number;
  treatment_name?: string;
  scheduled_time?: string; // The time it was supposed to be taken
  dose_index?: number; // Which dose of the day (0, 1, 2...)
  date: string;
  time: string; // Actual time taken
  taken: boolean;
  skipped: boolean;
  skip_reason?: string;
  amount_taken?: number;
  unit?: DosageUnit;
  notes?: string;
  created_at: string;
}

// ============================================================
// ACTIVITIES & TRAINING
// ============================================================

// Frequency type for scheduled activities
export type FrequencyType = 'daily' | 'weekly' | 'specific_days' | 'interval' | 'monthly';

export const FREQUENCY_TYPE_LABELS: Record<FrequencyType, string> = {
  daily: 'Todos los días',
  weekly: 'Una vez por semana',
  specific_days: 'Días específicos',
  interval: 'Cada X días',
  monthly: 'Una vez al mes',
};

// Activity type from database
export interface ActivityType {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_custom?: boolean;
  usage_count: number;
  created_at?: string;
}

// Default activity type slugs
export type ActivityTypeSlug = 
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

export const DEFAULT_ACTIVITY_TYPES: { slug: ActivityTypeSlug; name: string; icon: string; color: string }[] = [
  { slug: 'walking', name: 'Caminar', icon: 'walk', color: '#4CAF50' },
  { slug: 'running', name: 'Correr', icon: 'fitness', color: '#FF5722' },
  { slug: 'cycling', name: 'Ciclismo', icon: 'bicycle', color: '#2196F3' },
  { slug: 'swimming', name: 'Natación', icon: 'water', color: '#00BCD4' },
  { slug: 'yoga', name: 'Yoga', icon: 'body', color: '#9C27B0' },
  { slug: 'gym', name: 'Gimnasio', icon: 'barbell', color: '#FF9800' },
  { slug: 'stretching', name: 'Estiramientos', icon: 'accessibility', color: '#E91E63' },
  { slug: 'meditation', name: 'Meditación', icon: 'leaf', color: '#8BC34A' },
  { slug: 'dancing', name: 'Baile', icon: 'musical-notes', color: '#F44336' },
  { slug: 'hiking', name: 'Senderismo', icon: 'trail-sign', color: '#795548' },
  { slug: 'other', name: 'Otro', icon: 'ellipse', color: '#607D8B' },
];

export type IntensityLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const INTENSITY_LABELS: Record<number, string> = {
  1: 'Muy ligera',
  2: 'Ligera',
  3: 'Ligera-moderada',
  4: 'Moderada',
  5: 'Moderada',
  6: 'Moderada-intensa',
  7: 'Intensa',
  8: 'Muy intensa',
  9: 'Máxima',
  10: 'Agotamiento total',
};

export interface ActivityLog {
  id: number;
  activity_type_id: number;
  duration_minutes: number;
  intensity: IntensityLevel;
  distance_km?: number;
  calories?: number;
  date: string;
  time: string;
  notes?: string;
  created_at: string;
}

// Scheduled activity (training program)
export interface ScheduledActivity {
  id: number;
  activity_type_id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  frequency_type: FrequencyType;
  frequency_value?: string;
  start_date: string;
  end_date?: string;
  reminder_enabled: boolean;
  reminder_time?: string;
  is_active: boolean;
  created_at: string;
}

export interface ScheduledActivityLog {
  id: number;
  scheduled_activity_id: number;
  date: string;
  status: 'completed' | 'skipped' | 'partial';
  actual_duration_minutes?: number;
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
