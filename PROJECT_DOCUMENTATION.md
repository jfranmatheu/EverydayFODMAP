# Everyday FODMAP - Project Documentation

## Overview

**Everyday FODMAP** is a comprehensive React Native mobile application designed to help users manage IBS (Irritable Bowel Syndrome) through FODMAP diet tracking. The app enables users to log their daily food intake, symptoms, bowel movements, water consumption, treatments, and physical activities, providing insights into potential food triggers.

### Key Features

- 📱 Daily food diary with FODMAP level tracking
- 🍽️ Meal logging by type (breakfast, lunch, dinner, snacks)
- 💧 Water intake tracking
- 😷 Symptom logging with intensity scales
- 💊 Treatment/medication management
- 🏃 Physical activity tracking
- 📊 Analysis and correlation insights
- 🧮 BMI calculation and weight tracking
- 🔥 Daily calorie and macro tracking with gamified UI
- 🎯 Nutritional target setting
- 📸 Photo attachment for meals
- 🔔 Reminders and notifications

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.81.5 | Cross-platform mobile framework |
| Expo | 54.0.30 | Development platform and native features |
| Expo Router | 6.0.21 | File-based navigation |
| expo-sqlite | 16.0.10 | Local SQLite database |
| expo-image-picker | 17.0.10 | Photo selection for meals |
| NativeWind | 4.2.1 | Tailwind CSS for React Native |
| React Native Reanimated | 4.1.1 | Animations |
| TypeScript | 5.9.2 | Type safety |

---

## Project Structure

```
FODMAPTracker/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab-based navigation screens
│   │   ├── _layout.tsx          # Tab navigator configuration
│   │   ├── index.tsx            # Home screen (profile, BMI, nutrition)
│   │   ├── log.tsx              # Daily diary (tab-based categories)
│   │   ├── foods.tsx            # Food database browser
│   │   ├── recipes.tsx          # Recipe browser
│   │   ├── analysis.tsx         # Data analysis & insights
│   │   ├── settings.tsx         # App settings
│   │   └── calendar.tsx         # Calendar view (hidden, merged with log)
│   ├── activity/                 # Activity management screens
│   │   ├── index.tsx            # Activity list
│   │   └── schedule.tsx         # Schedule activities
│   ├── food/
│   │   └── [id].tsx             # Food detail view
│   ├── recipe/
│   │   └── [id].tsx             # Recipe detail view
│   ├── treatment/
│   │   ├── index.tsx            # Treatment list
│   │   └── [id].tsx             # Treatment detail view
│   ├── _layout.tsx              # Root layout (providers, fonts)
│   └── +not-found.tsx           # 404 page
├── components/
│   └── ui/                       # Reusable UI components
│       └── index.tsx            # Card, Button, etc.
├── contexts/
│   ├── DatabaseContext.tsx      # Database readiness state
│   └── ThemeContext.tsx         # Theme (light/dark) provider
├── lib/
│   ├── database.ts              # SQLite database setup & helpers
│   ├── types.ts                 # TypeScript interfaces & types
│   ├── internal-data.ts         # Built-in foods & recipes data
│   ├── recipe-format.ts         # Recipe parsing utilities
│   └── notifications.ts         # Push notification helpers
├── assets/                       # Images, fonts, etc.
├── data/                         # JSON data files
│   ├── alimentos.json           # Internal food database
│   └── recetas.json             # Internal recipe database
├── app.json                      # Expo configuration
├── package.json                  # Dependencies
├── tailwind.config.js           # NativeWind/Tailwind config
└── tsconfig.json                # TypeScript configuration
```

---

## App Flow

### Navigation Structure

The app uses a tab-based navigation with the following tabs (in order):

1. **Inicio (Home)** - User profile, BMI, daily nutrition summary, quick actions
2. **Diario (Daily Log)** - Tab-based category logging (meals, water, activity, symptoms, bowel, treatments)
3. **Alimentos (Foods)** - Browse and search food database
4. **Recetas (Recipes)** - Browse and search recipes
5. **Análisis (Analysis)** - View correlations and insights

Additional screens accessible via stack navigation:
- Settings (from Home header)
- Food detail (`/food/[id]`)
- Recipe detail (`/recipe/[id]`)
- Treatment management (`/treatment/`)
- Activity scheduling (`/activity/`)

### User Flow

```
┌─────────────────┐
│   App Launch    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│         Home Screen             │
│  ┌─────────────────────────┐   │
│  │   Profile Card + BMI    │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ Daily Nutrition Summary │   │
│  │  Calories & Macros      │   │
│  └─────────────────────────┘   │
│  ┌────────┐ ┌────────────┐    │
│  │Activity│ │ Treatments │    │
│  └────────┘ └────────────┘    │
│  ┌─────────────────────────┐   │
│  │    Recent Activity      │   │
│  └─────────────────────────┘   │
└────────────────┬────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌────────┐  ┌────────┐
│ Daily  │  │ Foods  │  │Recipes │
│  Log   │  │ Browse │  │ Browse │
└────┬───┘  └────────┘  └────────┘
     │
     ▼
┌─────────────────────────────────┐
│      Category Tabs              │
│  [Meals][Water][Activity]...    │
├─────────────────────────────────┤
│  Content based on selected tab  │
│  - Meal types (sub-sections)    │
│  - Water log                    │
│  - Activity log                 │
│  - Symptoms log                 │
│  - Bowel movements              │
│  - Treatments log               │
└─────────────────────────────────┘
```

---

## Database Schema

### Core Tables

#### `user_profile`
Stores user's personal information for BMI calculations and nutritional targets.

```sql
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row
  birth_date TEXT,
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  height_cm REAL,
  -- Target nutrition info
  target_calories INTEGER,
  target_protein_pct INTEGER,   -- Percentage of daily calories
  target_carbs_pct INTEGER,
  target_fat_pct INTEGER,
  -- Optional detailed targets
  target_fiber_g REAL,
  target_sugars_g REAL,
  target_sodium_mg REAL,
  target_potassium_mg REAL,
  target_saturated_fat_g REAL,
  target_cholesterol_mg REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `weight_logs`
Historical weight records for tracking progress.

```sql
CREATE TABLE weight_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg REAL NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `foods`
Food database with FODMAP levels and nutrition info.

```sql
CREATE TABLE foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  fodmap_level TEXT CHECK(fodmap_level IN ('low', 'medium', 'high', 'unknown')),
  fodmap_details TEXT,      -- JSON: {fructans, gos, lactose, fructose, sorbitol, mannitol}
  is_compound INTEGER DEFAULT 0,
  nutrition TEXT,           -- JSON: NutritionInfo
  nutri_score TEXT CHECK(nutri_score IN ('A', 'B', 'C', 'D', 'E')),
  serving_size TEXT,
  brand TEXT,
  barcode TEXT,
  image_uri TEXT,
  notes TEXT,
  tags TEXT,                -- JSON array
  folder_id INTEGER,
  is_favorite INTEGER DEFAULT 0,
  source TEXT CHECK(source IN ('user', 'internal', 'external')),
  source_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `recipes`
Recipe database with ingredients, steps, and FODMAP info.

```sql
CREATE TABLE recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  fodmap_level TEXT CHECK(fodmap_level IN ('low', 'medium', 'high', 'unknown')),
  fodmap_details TEXT,      -- JSON
  prep_time INTEGER,        -- minutes
  cook_time INTEGER,        -- minutes
  total_time INTEGER,
  servings INTEGER DEFAULT 1,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  cuisine TEXT,
  meal_types TEXT,          -- JSON array: ['breakfast', 'lunch', etc.]
  dietary TEXT,             -- JSON array: ['vegetarian', 'vegan', etc.]
  nutrition TEXT,           -- JSON: NutritionInfo
  image_uri TEXT,
  notes TEXT,
  tags TEXT,
  folder_id INTEGER,
  is_favorite INTEGER DEFAULT 0,
  source TEXT CHECK(source IN ('user', 'internal', 'external')),
  source_id TEXT,
  source_name TEXT,
  original_recipe_id INTEGER,
  is_modified_copy INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `meals`
Daily meal records grouped by type.

```sql
CREATE TABLE meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'other')),
  date TEXT NOT NULL,       -- YYYY-MM-DD
  time TEXT,                -- HH:MM
  notes TEXT,
  image_uri TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `meal_items`
Individual foods/recipes within a meal.

```sql
CREATE TABLE meal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
  food_id INTEGER REFERENCES foods(id),
  recipe_id INTEGER REFERENCES recipes(id),
  name TEXT,
  quantity REAL,
  unit TEXT,
  fodmap_level TEXT
);
```

#### `symptoms`
Symptom logging with intensity tracking.

```sql
CREATE TABLE symptoms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,       -- 'Hinchazón', 'Dolor', 'Gases', etc.
  intensity INTEGER CHECK(intensity BETWEEN 1 AND 10),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration_minutes INTEGER,
  notes TEXT,
  meal_id INTEGER,          -- Optional link to triggering meal
  stress_type TEXT,
  stress_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `bowel_movements`
Bristol stool scale tracking.

```sql
CREATE TABLE bowel_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bristol_type INTEGER CHECK(bristol_type BETWEEN 1 AND 7),
  color TEXT,
  urgency INTEGER CHECK(urgency BETWEEN 1 AND 5),
  pain INTEGER CHECK(pain BETWEEN 0 AND 10),
  discomfort INTEGER CHECK(discomfort BETWEEN 0 AND 10),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  image_uri TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `water_intake`
Daily water consumption tracking.

```sql
CREATE TABLE water_intake (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  glasses INTEGER DEFAULT 1,
  amount_ml INTEGER DEFAULT 250,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `treatments`
Medication and supplement management.

```sql
CREATE TABLE treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'medication',
  dosage_amount REAL,
  dosage_unit TEXT,
  frequency TEXT DEFAULT 'once_daily',
  frequency_value TEXT,
  doses TEXT,               -- JSON array of dose times
  start_date TEXT,
  end_date TEXT,
  is_chronic INTEGER DEFAULT 0,
  specific_days TEXT,
  reminder_enabled INTEGER DEFAULT 0,
  reminder_minutes_before INTEGER DEFAULT 15,
  instructions TEXT,
  side_effects TEXT,
  prescribing_doctor TEXT,
  pharmacy TEXT,
  refill_reminder_enabled INTEGER DEFAULT 0,
  refill_reminder_days INTEGER,
  current_stock INTEGER,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `treatment_logs`
Records of treatment doses taken/skipped.

```sql
CREATE TABLE treatment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  treatment_id INTEGER REFERENCES treatments(id),
  treatment_name TEXT,
  scheduled_time TEXT,
  dose_index INTEGER,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  taken INTEGER DEFAULT 1,
  skipped INTEGER DEFAULT 0,
  skip_reason TEXT,
  amount_taken REAL,
  unit TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `activity_types`
Predefined and custom activity types.

```sql
CREATE TABLE activity_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'fitness',
  color TEXT DEFAULT '#FF9800',
  is_custom INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `activity_logs`
Individual activity records.

```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type_id INTEGER REFERENCES activity_types(id),
  duration_minutes INTEGER NOT NULL,
  intensity INTEGER CHECK(intensity BETWEEN 1 AND 10),
  distance_km REAL,
  calories INTEGER,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  notes TEXT,
  scheduled_activity_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `scheduled_activities`
Recurring activity schedules.

```sql
CREATE TABLE scheduled_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type_id INTEGER REFERENCES activity_types(id),
  name TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  frequency_type TEXT CHECK(frequency_type IN ('daily', 'weekly', 'specific_days', 'interval', 'monthly')),
  frequency_value TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  reminder_enabled INTEGER DEFAULT 0,
  reminder_time TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key TypeScript Types

### FODMAP System

```typescript
type FODMAPLevel = 'low' | 'medium' | 'high' | 'unknown';

interface FODMAPDetails {
  fructans: FODMAPLevel;
  gos: FODMAPLevel;
  lactose: FODMAPLevel;
  fructose: FODMAPLevel;
  sorbitol: FODMAPLevel;
  mannitol: FODMAPLevel;
  overall: FODMAPLevel;
  safe_serving?: string;
  limit_serving?: string;
}
```

### Nutrition Info

```typescript
interface NutritionInfo {
  per_serving?: boolean;
  serving_size?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  sugars_g?: number;
  sodium_mg?: number;
  potassium_mg?: number;
}
```

### User Profile

```typescript
interface UserProfile {
  id: number;
  birth_date: string | null;
  gender: Gender | null;
  height_cm: number | null;
  // Target nutrition
  target_calories: number | null;
  target_protein_pct: number | null;
  target_carbs_pct: number | null;
  target_fat_pct: number | null;
  // Optional detailed targets
  target_fiber_g: number | null;
  target_sugars_g: number | null;
  target_sodium_mg: number | null;
  target_potassium_mg: number | null;
  target_saturated_fat_g: number | null;
  target_cholesterol_mg: number | null;
  created_at: string;
  updated_at: string;
}

type Gender = 'male' | 'female' | 'other';
```

### BMI & Nutrition Calculations

```typescript
type BMICategory = 'underweight' | 'normal' | 'overweight' | 'obese';

const BMI_CATEGORIES = {
  underweight: { min: 0, max: 18.5, label: 'Bajo peso', color: '#3498db' },
  normal: { min: 18.5, max: 25, label: 'Normal', color: '#27ae60' },
  overweight: { min: 25, max: 30, label: 'Sobrepeso', color: '#f39c12' },
  obese: { min: 30, max: 100, label: 'Obesidad', color: '#e74c3c' },
};

function calculateBMI(weightKg: number, heightCm: number): number;
function calculateMacroGrams(calories: number, protein_pct: number, carbs_pct: number, fat_pct: number): MacroTargets;
function calculateDailyCalories(weightKg: number, heightCm: number, ageYears: number, gender: Gender, activityLevel: string): number;
```

### Meal Types

```typescript
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'other';

const MEAL_TYPE_LABELS = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
  dessert: 'Postre',
  other: 'Otro',
};

const MEAL_TYPE_ICONS = {
  breakfast: 'sunny',
  lunch: 'partly-sunny',
  dinner: 'moon',
  snack: 'cafe',
  dessert: 'ice-cream',
  other: 'restaurant',
};
```

---

## Key Components & Screens

### Home Screen (`app/(tabs)/index.tsx`)

- **Profile Card**: User info with BMI visualization and scale
  - Editable profile with nutritional targets (kcal, macros %)
- **Daily Nutrition Card**: 
  - Gamified calorie counter with progress bar
  - Macro nutrients (protein, carbs, fat) with individual progress
  - Target vs consumed comparison
- **Today's Treatments Card** (Gamified):
  - Progress ring showing doses taken/total
  - List of individual doses with time and dosage
  - Checkbox to mark each dose as taken
  - Celebration animation when all doses complete
  - Handles chronic treatments, specific days, and multiple daily doses
- **Today's Activities Card** (Gamified):
  - Progress ring showing completed/total activities
  - List of scheduled activities for today
  - Button to mark each activity as completed
  - Filters by frequency (daily, weekly, specific days)
  - Trophy celebration when all activities complete
- **Recent Activity Feed**: Today's logged items

### Daily Log Screen (`app/(tabs)/log.tsx`)

- **Custom Header**: Date navigation integrated into page header
  - Day-by-day arrows, current date display, calendar picker button
  - "Today" quick button when viewing past/future dates
- **Category Tabs**: Horizontal scrollable tabs for each category
  - 🍽️ Comidas (Meals)
  - 💧 Agua (Water)
  - 🏃 Actividad (Activity)
  - 😷 Síntomas (Symptoms)
  - 🚽 Deposiciones (Bowel)
  - 💊 Medicación (Treatments)
- **Meal Type Sections** (when Meals tab selected):
  - Multi-column layout on wide screens (768px+)
  - Collapsible sub-sections per meal type
  - Photo display (max-height when image exists)
  - Total calories per meal
  - Item list with pencil edit icon (was arrow)
  - Quantity modal when adding new items (quantity + unit selector)
- **Meal Item Editor**: Edit quantity, unit, move to another meal type, view nutrition, delete

### Database Helper (`lib/database.ts`)

- Platform-aware database initialization
- Web mock database for browser preview
- CRUD helper functions:
  - `insertRow(table, data)`
  - `updateRow(table, id, data)`
  - `deleteRow(table, id)`
  - `getRows<T>(table, where?, params?)`
  - `getRowById<T>(table, id)`

---

## Theme System

The app supports light and dark themes through `ThemeContext`:

```typescript
interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  cardElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  border: string;
  fodmapLow: string;    // Green
  fodmapMedium: string; // Orange
  fodmapHigh: string;   // Red
  symptom: string;
  water: string;
  bowel: string;
  treatment: string;
  // ... more colors
}
```

---

## UI/UX Design Patterns

### Gamified Elements

- **Calorie Progress**: Large number display with animated progress bar
- **Macro Cards**: Individual progress bars with icons for each macro
- **Category Tabs**: Colored badges showing item counts
- **BMI Scale**: Visual indicator on color-coded scale
- **Treatment Progress Ring**: Shows doses taken with percentage badge
- **Activity Progress Ring**: Shows activities completed with trophy on complete
- **Celebration States**: Emoji + congratulatory messages when tasks complete
- **Interactive Checkboxes**: Satisfying press-to-complete interactions

### Interaction Patterns

- **Quantity Modal**: When adding food/recipe, prompts for quantity and unit selection
- **Edit Icon**: Pencil icon on list items indicates editability
- **Collapsible Sections**: Dropdown toggle for meal item lists
- **Photo Attachments**: Camera icon in meal headers for quick photo capture

---

## Development

### Running the App

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Platform-specific
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### Web Development Note

The app includes a web mock database (`createWebMockDatabase` in `lib/database.ts`) that stores data in localStorage. This allows development and testing in the browser without native SQLite.

### Key Files to Edit

| Task | File(s) |
|------|---------|
| Add new screen | `app/(tabs)/*.tsx` or `app/**/*.tsx` |
| Modify database | `lib/database.ts` |
| Add types | `lib/types.ts` |
| Update theme | `contexts/ThemeContext.tsx` |
| Add internal data | `data/*.json` + `lib/internal-data.ts` |
| UI components | `components/ui/index.tsx` |

---

## Future Considerations

- [ ] Export data to CSV/PDF
- [ ] Sync with cloud storage
- [ ] Integration with wearables
- [ ] AI-powered food recognition
- [ ] Nutritionist sharing features
- [ ] Multi-language support

---

## License

Private project - All rights reserved.

---

*Last updated: 29 December 2024 - v2*
