// Database model types

export type FODMAPLevel = 'low' | 'medium' | 'high';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  color: string;
  created_at: string;
}

export interface Ingredient {
  id: number;
  name: string;
  fodmap_level: FODMAPLevel;
  fructose: number;
  lactose: number;
  fructans: number;
  galactans: number;
  polyols: number;
  serving_size: string | null;
  notes: string | null;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Recipe {
  id: number;
  name: string;
  description: string | null;
  instructions: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number;
  fodmap_level: FODMAPLevel;
  image_uri: string | null;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  ingredients?: RecipeIngredient[];
  tags?: Tag[];
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  quantity: number;
  unit: string | null;
  ingredient?: Ingredient;
}

export interface Meal {
  id: number;
  name: string;
  meal_type: MealType;
  date: string;
  time: string | null;
  notes: string | null;
  created_at: string;
  items?: MealItem[];
}

export interface MealItem {
  id: number;
  meal_id: number;
  ingredient_id: number | null;
  recipe_id: number | null;
  quantity: number | null;
  unit: string | null;
  ingredient?: Ingredient;
  recipe?: Recipe;
}

export interface WaterIntake {
  id: number;
  glasses: number;
  amount_ml: number;
  date: string;
  time: string;
  created_at: string;
}

export interface Treatment {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  time_of_day: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
}

export interface TreatmentLog {
  id: number;
  treatment_id: number;
  date: string;
  time: string;
  taken: number;
  notes: string | null;
  created_at: string;
  treatment?: Treatment;
}

export interface Symptom {
  id: number;
  type: string;
  intensity: number;
  date: string;
  time: string;
  duration_minutes: number | null;
  notes: string | null;
  meal_id: number | null;
  treatment_id: number | null;
  created_at: string;
  meal?: Meal;
  treatment?: Treatment;
}

export interface BowelMovement {
  id: number;
  bristol_type: BristolType;
  color: string | null;
  urgency: number;
  pain: number;
  discomfort: number;
  date: string;
  time: string;
  notes: string | null;
  created_at: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications_enabled: boolean;
  external_recipes_enabled: boolean;
}

export interface DefaultMeal {
  id: number;
  day_of_week: number;
  meal_type: MealType;
  is_enabled: number;
}

// Bristol scale descriptions
export const BRISTOL_SCALE: Record<BristolType, { name: string; description: string; emoji: string }> = {
  1: { name: 'Tipo 1', description: 'Trozos duros separados', emoji: '🔘' },
  2: { name: 'Tipo 2', description: 'En forma de salchicha con bultos', emoji: '🥜' },
  3: { name: 'Tipo 3', description: 'Salchicha con grietas', emoji: '🌭' },
  4: { name: 'Tipo 4', description: 'Suave y lisa como serpiente', emoji: '🐍' },
  5: { name: 'Tipo 5', description: 'Trozos blandos con bordes definidos', emoji: '☁️' },
  6: { name: 'Tipo 6', description: 'Trozos blandos con bordes irregulares', emoji: '💨' },
  7: { name: 'Tipo 7', description: 'Líquido sin trozos sólidos', emoji: '💧' },
};

// Symptom types
export const SYMPTOM_TYPES = [
  'Hinchazón',
  'Dolor abdominal',
  'Gases',
  'Náuseas',
  'Diarrea',
  'Estreñimiento',
  'Acidez',
  'Reflujo',
  'Fatiga',
  'Dolor de cabeza',
  'Otro',
] as const;

// Meal type labels
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Merienda',
  other: 'Otro',
};

// Day of week labels
export const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

// Activity types
export type FrequencyType = 'daily' | 'weekly' | 'specific_days' | 'interval' | 'monthly';
export type ActivityLogStatus = 'completed' | 'skipped' | 'partial';

export interface ActivityType {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_custom: number;
  usage_count: number;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  activity_type_id: number;
  duration_minutes: number;
  intensity: number;
  distance_km: number | null;
  calories: number | null;
  date: string;
  time: string;
  notes: string | null;
  scheduled_activity_id: number | null;
  created_at: string;
  activity_type?: ActivityType;
}

export interface ScheduledActivity {
  id: number;
  activity_type_id: number;
  name: string;
  duration_minutes: number;
  frequency_type: FrequencyType;
  frequency_value: string | null;
  start_date: string;
  end_date: string | null;
  reminder_enabled: number;
  reminder_time: string | null;
  is_active: number;
  created_at: string;
  activity_type?: ActivityType;
}

export interface ScheduledActivityLog {
  id: number;
  scheduled_activity_id: number;
  date: string;
  status: ActivityLogStatus;
  actual_duration_minutes: number | null;
  notes: string | null;
  skip_reason: string | null;
  created_at: string;
}

// Frequency type labels
export const FREQUENCY_TYPE_LABELS: Record<FrequencyType, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  specific_days: 'Días específicos',
  interval: 'Cada X días',
  monthly: 'Mensual',
};

// Activity intensity labels
export const INTENSITY_LABELS: Record<number, string> = {
  1: 'Muy suave',
  2: 'Suave',
  3: 'Ligera',
  4: 'Moderada-baja',
  5: 'Moderada',
  6: 'Moderada-alta',
  7: 'Intensa',
  8: 'Muy intensa',
  9: 'Extrema',
  10: 'Máxima',
};
