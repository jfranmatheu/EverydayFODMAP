import { Platform } from 'react-native';
import { INTERNAL_FOODS, INTERNAL_RECIPES, loadInternalData } from './internal-data';

const DATABASE_NAME = 'everyday_fodmap.db';
const WEB_STORAGE_KEY = 'everyday_fodmap_webdb';

// In-memory storage for web preview - make it accessible for debugging
let webStorage: Record<string, any[]> = {};

// Load from localStorage on init (web only)
function loadWebStorage(): Record<string, any[]> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(WEB_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[WebDB] Loaded from localStorage:', Object.keys(parsed));
        return parsed;
      }
    } catch (e) {
      console.error('[WebDB] Error loading from localStorage:', e);
    }
  }
  return {};
}

// Save to localStorage (web only)
function saveWebStorage(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(webStorage));
      console.log('[WebDB] Saved to localStorage');
    } catch (e) {
      console.error('[WebDB] Error saving to localStorage:', e);
    }
  }
}

// Initialize webStorage from localStorage
if (typeof window !== 'undefined') {
  webStorage = loadWebStorage();
  (window as any).__webStorage = webStorage;
  (window as any).__saveWebStorage = saveWebStorage;
  (window as any).__clearWebStorage = () => {
    webStorage = {};
    localStorage.removeItem(WEB_STORAGE_KEY);
    console.log('[WebDB] Storage cleared');
  };
}

// Helper to parse INSERT query and extract column names
function parseInsertQuery(sql: string): { table: string; columns: string[] } | null {
  // Normalize whitespace (handle multiline queries)
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  
  // Match: INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
  const match = normalizedSql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s*\(([^)]+)\)/i);
  if (match) {
    const table = match[1];
    const columns = match[2].split(',').map(c => c.trim());
    console.log(`[WebDB] Parsed INSERT: table=${table}, columns=`, columns);
    return { table, columns };
  }
  // Match: INSERT INTO table VALUES (...)
  const simpleMatch = normalizedSql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)\s+VALUES/i);
  if (simpleMatch) {
    console.log(`[WebDB] Parsed simple INSERT: table=${simpleMatch[1]}`);
    return { table: simpleMatch[1], columns: [] };
  }
  console.log(`[WebDB] Could not parse INSERT query: ${normalizedSql.substring(0, 100)}`);
  return null;
}

// Helper to compare values with type coercion
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  // Handle number/string comparison
  if (typeof a === 'number' && typeof b === 'string') return a === parseInt(b);
  if (typeof a === 'string' && typeof b === 'number') return parseInt(a) === b;
  return String(a) === String(b);
}

// Helper to filter items based on WHERE clause
function filterByWhere(items: any[], sql: string, params?: any[]): any[] {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/i);
  
  // No WHERE clause - return all items
  if (!whereMatch) {
    return items;
  }
  
  // WHERE clause exists but no params - return all items (for queries like WHERE 1=1)
  if (!params || params.length === 0) {
    return items;
  }
  
  const whereClause = whereMatch[1];
  
  // Handle: date BETWEEN ? AND ?
  if (whereClause.toLowerCase().includes('between')) {
    const startDate = params[0];
    const endDate = params[1];
    return items.filter(item => item.date >= startDate && item.date <= endDate);
  }
  
  // Generic handler: extract column name from "column = ?" pattern
  const columnMatch = whereClause.match(/(\w+)\s*=\s*\?/);
  if (columnMatch) {
    const column = columnMatch[1];
    const value = params[0];
    console.log(`[WebDB] Filtering by ${column} = ${value}, items before: ${items.length}`);
    const filtered = items.filter(item => valuesEqual(item[column], value));
    console.log(`[WebDB] After filter: ${filtered.length}`);
    return filtered;
  }
  
  // Default: return all items if we can't parse the WHERE clause
  console.log(`[WebDB] Unhandled WHERE clause: ${whereClause}`);
  return items;
}

// Web mock database implementation
function createWebMockDatabase() {
  console.log('[WebDB] Creating web mock database');
  
  return {
    execAsync: async (sql: string) => {
      console.log('[WebDB] execAsync called');
      const tableMatches = sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g);
      let tablesCreated = false;
      for (const match of tableMatches) {
        if (!webStorage[match[1]]) {
          webStorage[match[1]] = [];
          console.log(`[WebDB] Created table: ${match[1]}`);
          tablesCreated = true;
        }
      }
      if (tablesCreated) {
        saveWebStorage();
      }
    },
    runAsync: async (sql: string, params?: any[]) => {
      const normalizedForLog = sql.replace(/\s+/g, ' ').trim();
      console.log('[WebDB] runAsync:', normalizedForLog.substring(0, 100));
      console.log('[WebDB] params:', JSON.stringify(params));
      
      // Handle INSERT
      const insertInfo = parseInsertQuery(sql);
      if (insertInfo) {
        const { table, columns } = insertInfo;
        if (!webStorage[table]) {
          webStorage[table] = [];
          console.log(`[WebDB] Auto-created table: ${table}`);
        }
        
        // Generate unique ID
        const maxId = webStorage[table].reduce((max, item) => Math.max(max, item.id || 0), 0);
        const id = maxId + 1;
        
        const newRow: Record<string, any> = { id, created_at: new Date().toISOString() };
        
        if (columns.length > 0 && params) {
          columns.forEach((col, i) => {
            if (params[i] !== undefined) {
              newRow[col] = params[i];
            }
          });
        }
        
        webStorage[table].push(newRow);
        console.log(`[WebDB] INSERT into ${table}:`, newRow);
        console.log(`[WebDB] Table ${table} now has ${webStorage[table].length} rows`);
        saveWebStorage();
        return { lastInsertRowId: id };
      }
      
      // Handle DELETE
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      const deleteTableMatch = normalizedSql.match(/DELETE FROM (\w+)/i);
      
      if (deleteTableMatch) {
        const table = deleteTableMatch[1];
        
        if (!webStorage[table]) {
          webStorage[table] = [];
          return { changes: 0 };
        }
        
        const items = webStorage[table];
        const initialLength = items.length;
        
        // Check for WHERE clause with placeholder
        const whereParamMatch = normalizedSql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
        if (whereParamMatch && params && params.length > 0) {
          const column = whereParamMatch[1];
          const value = params[0];
          webStorage[table] = items.filter((item: any) => !valuesEqual(item[column], value));
          const deletedCount = initialLength - webStorage[table].length;
          console.log(`[WebDB] DELETE from ${table} WHERE ${column}=${value}, deleted ${deletedCount}/${initialLength} rows`);
          if (deletedCount > 0) saveWebStorage();
          return { changes: deletedCount };
        }
        
        // Check for WHERE clause with literal string value (e.g., source = 'user')
        const whereLiteralMatch = normalizedSql.match(/WHERE\s+(\w+)\s*=\s*'([^']+)'/i);
        if (whereLiteralMatch) {
          const column = whereLiteralMatch[1];
          const value = whereLiteralMatch[2];
          webStorage[table] = items.filter((item: any) => !valuesEqual(item[column], value));
          const deletedCount = initialLength - webStorage[table].length;
          console.log(`[WebDB] DELETE from ${table} WHERE ${column}='${value}', deleted ${deletedCount}/${initialLength} rows`);
          if (deletedCount > 0) saveWebStorage();
          return { changes: deletedCount };
        }
        
        // No WHERE clause - delete all rows
        if (!normalizedSql.includes('WHERE')) {
          webStorage[table] = [];
          console.log(`[WebDB] DELETE ALL from ${table}, deleted ${initialLength} rows`);
          if (initialLength > 0) saveWebStorage();
          return { changes: initialLength };
        }
        
        console.log(`[WebDB] Unhandled DELETE query: ${normalizedSql}`);
        return { changes: 0 };
      }
      
      // Handle UPDATE
      const updateMatch = sql.match(/UPDATE (\w+) SET (.+) WHERE id = \?/i);
      if (updateMatch && params) {
        const table = updateMatch[1];
        const setClause = updateMatch[2];
        const items = webStorage[table] || [];
        const id = params[params.length - 1];
        const item = items.find((i: any) => i.id === id);
        if (item) {
          const setCols = setClause.split(',').map(s => s.split('=')[0].trim());
          setCols.forEach((col, i) => {
            if (col !== 'updated_at' && params[i] !== undefined) {
              item[col] = params[i];
            }
          });
          item.updated_at = new Date().toISOString();
          console.log(`[WebDB] UPDATE ${table}:`, item);
          saveWebStorage();
        }
      }
      
      return { lastInsertRowId: 0 };
    },
    getAllAsync: async <T>(sql: string, params?: any[]): Promise<T[]> => {
      console.log('[WebDB] getAllAsync:', sql.substring(0, 80), params);
      
      // Extract main table from query
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (!fromMatch) {
        console.log('[WebDB] Could not extract table name from query');
        return [];
      }
      
      const table = fromMatch[1];
      
      // Ensure table exists
      if (!webStorage[table]) {
        webStorage[table] = [];
        console.log(`[WebDB] Table ${table} does not exist, returning empty`);
      }
      
      let items = [...webStorage[table]];
      console.log(`[WebDB] SELECT from ${table}: found ${items.length} total rows`);
      
      // Apply WHERE filter
      items = filterByWhere(items, sql, params);
      
      // Handle COUNT(*)
      if (sql.toLowerCase().includes('count(*)')) {
        console.log(`[WebDB] COUNT result: ${items.length}`);
        return [{ count: items.length }] as T[];
      }
      
      // Handle SUM(glasses) for water
      if (sql.toLowerCase().includes('sum(glasses)')) {
        const total = items.reduce((acc, item) => acc + (item.glasses || 0), 0);
        console.log(`[WebDB] SUM(glasses) result: ${total}`);
        return [{ total }] as T[];
      }
      
      // Handle GROUP BY date
      if (sql.toLowerCase().includes('group by date')) {
        const grouped: Record<string, any> = {};
        items.forEach(item => {
          if (!grouped[item.date]) {
            grouped[item.date] = { date: item.date, count: 0, total: 0 };
          }
          grouped[item.date].count++;
          if (item.glasses) grouped[item.date].total += item.glasses;
        });
        return Object.values(grouped) as T[];
      }
      
      // Handle ORDER BY
      if (sql.toLowerCase().includes('order by')) {
        const orderMatch = sql.match(/ORDER BY\s+(\w+)(?:\s+(DESC|ASC))?/i);
        if (orderMatch) {
          const orderCol = orderMatch[1];
          const desc = orderMatch[2]?.toUpperCase() === 'DESC';
          items.sort((a, b) => {
            const aVal = a[orderCol];
            const bVal = b[orderCol];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
      }
      
      // Handle LIMIT
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        items = items.slice(0, parseInt(limitMatch[1]));
      }
      
      console.log(`[WebDB] getAllAsync returning ${items.length} rows`);
      return items as T[];
    },
    getFirstAsync: async <T>(sql: string, params?: any[]): Promise<T | null> => {
      console.log('[WebDB] getFirstAsync:', sql.substring(0, 80), params);
      
      const fromMatch = sql.match(/FROM\s+(\w+)/i);
      if (!fromMatch) {
        console.log('[WebDB] Could not extract table name');
        return null;
      }
      
      const table = fromMatch[1];
      
      // Ensure table exists
      if (!webStorage[table]) {
        webStorage[table] = [];
      }
      
      let items = [...webStorage[table]];
      console.log(`[WebDB] getFirstAsync from ${table}: ${items.length} total rows`);
      
      // Apply WHERE filter
      items = filterByWhere(items, sql, params);
      console.log(`[WebDB] After WHERE filter: ${items.length} rows`);
      
      // Handle COUNT(*)
      if (sql.toLowerCase().includes('count(*)')) {
        const result = { count: items.length } as T;
        console.log(`[WebDB] COUNT result:`, result);
        return result;
      }
      
      // Handle SUM with COALESCE
      if (sql.toLowerCase().includes('sum(glasses)') || sql.toLowerCase().includes('coalesce(sum(glasses)')) {
        const total = items.reduce((acc, item) => acc + (item.glasses || 0), 0);
        const result = { total } as T;
        console.log(`[WebDB] SUM result:`, result);
        return result;
      }
      
      const result = (items[0] as T) || null;
      console.log(`[WebDB] getFirstAsync result:`, result);
      return result;
    },
  };
}

let db: any = null;
let SQLiteModule: any = null;

export async function getDatabase(): Promise<any> {
  if (db) return db;
  
  if (Platform.OS === 'web') {
    db = createWebMockDatabase();
    return db;
  }
  
  // Dynamic import for native platforms only
  if (!SQLiteModule) {
    SQLiteModule = require('expo-sqlite');
  }
  db = await SQLiteModule.openDatabaseAsync(DATABASE_NAME);
  return db;
}

// Load internal data for web mock
async function loadInternalDataWeb(): Promise<void> {
  // Check if already loaded
  if (webStorage['foods'] && webStorage['foods'].some((f: any) => f.source === 'internal')) {
    console.log('[WebDB] Internal data already loaded');
    return;
  }

  // Load foods
  if (!webStorage['foods']) webStorage['foods'] = [];
  
  let foodId = webStorage['foods'].length + 1;
  for (const food of INTERNAL_FOODS) {
    webStorage['foods'].push({
      id: foodId++,
      name: food.name,
      category: food.category,
      fodmap_level: food.fodmap_level,
      fodmap_details: food.fodmap_details ? JSON.stringify(food.fodmap_details) : null,
      nutrition: food.nutrition ? JSON.stringify(food.nutrition) : null,
      serving_size: food.serving_size,
      notes: food.notes,
      source: 'internal',
      source_id: food.id, // Original ID from JSON (e.g., "zanahoria")
      is_compound: false,
      created_at: new Date().toISOString(),
    });
  }

  // Load recipes
  if (!webStorage['recipes']) webStorage['recipes'] = [];
  if (!webStorage['recipe_steps']) webStorage['recipe_steps'] = [];
  if (!webStorage['recipe_ingredients']) webStorage['recipe_ingredients'] = [];

  let recipeId = webStorage['recipes'].length + 1;
  let stepId = webStorage['recipe_steps'].length + 1;
  let ingId = webStorage['recipe_ingredients'].length + 1;

  for (const recipe of INTERNAL_RECIPES) {
    const currentRecipeId = recipeId++;
    
    webStorage['recipes'].push({
      id: currentRecipeId,
      name: recipe.name,
      description: recipe.description,
      fodmap_level: recipe.fodmap_level,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      notes: recipe.notes,
      meal_types: recipe.meal_types ? JSON.stringify(recipe.meal_types) : null,
      dietary: recipe.dietary ? JSON.stringify(recipe.dietary) : null,
      nutrition: recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
      source: 'internal',
      source_id: recipe.id, // Original ID from JSON (e.g., "arroz-con-pollo")
      created_at: new Date().toISOString(),
    });

    // Add steps
    if (recipe.steps) {
      for (const step of recipe.steps) {
        webStorage['recipe_steps'].push({
          id: stepId++,
          recipe_id: currentRecipeId,
          step_order: step.order,
          title: step.title,
          instruction: step.instruction,
          duration_minutes: step.duration_minutes,
          tip: step.tip,
        });
      }
    }

    // Add ingredients
    if (recipe.ingredients) {
      for (const ing of recipe.ingredients) {
        webStorage['recipe_ingredients'].push({
          id: ingId++,
          recipe_id: currentRecipeId,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          fodmap_level: ing.fodmap_level,
          notes: ing.notes,
          is_optional: ing.optional ? 1 : 0,
        });
      }
    }
  }

  saveWebStorage();
  console.log(`[WebDB] Loaded ${INTERNAL_FOODS.length} internal foods and ${INTERNAL_RECIPES.length} internal recipes`);
}

export async function initDatabase(): Promise<void> {
  const database = await getDatabase();

  if (Platform.OS === 'web') {
    // Initialize web mock tables
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS tags;
      CREATE TABLE IF NOT EXISTS folders;
      CREATE TABLE IF NOT EXISTS foods;
      CREATE TABLE IF NOT EXISTS food_components;
      CREATE TABLE IF NOT EXISTS recipes;
      CREATE TABLE IF NOT EXISTS recipe_steps;
      CREATE TABLE IF NOT EXISTS recipe_ingredients;
      CREATE TABLE IF NOT EXISTS meals;
      CREATE TABLE IF NOT EXISTS meal_items;
      CREATE TABLE IF NOT EXISTS water_intake;
      CREATE TABLE IF NOT EXISTS treatments;
      CREATE TABLE IF NOT EXISTS treatment_logs;
      CREATE TABLE IF NOT EXISTS symptoms;
      CREATE TABLE IF NOT EXISTS bowel_movements;
      CREATE TABLE IF NOT EXISTS settings;
      CREATE TABLE IF NOT EXISTS default_meals;
      CREATE TABLE IF NOT EXISTS activity_types;
      CREATE TABLE IF NOT EXISTS activity_logs;
      CREATE TABLE IF NOT EXISTS scheduled_activities;
      CREATE TABLE IF NOT EXISTS scheduled_activity_logs;
      CREATE TABLE IF NOT EXISTS ingredients;
    `);
    
    // Add default activity types for web (only if not already set)
    if (!webStorage['activity_types'] || webStorage['activity_types'].length === 0) {
      const defaultActivities = [
        { id: 1, name: 'Caminar', icon: 'walk', color: '#4CAF50' },
        { id: 2, name: 'Correr', icon: 'fitness', color: '#F44336' },
        { id: 3, name: 'Ciclismo', icon: 'bicycle', color: '#2196F3' },
        { id: 4, name: 'Natación', icon: 'water', color: '#00BCD4' },
        { id: 5, name: 'Yoga', icon: 'body', color: '#9C27B0' },
        { id: 6, name: 'Gimnasio', icon: 'barbell', color: '#FF5722' },
        { id: 7, name: 'Estiramientos', icon: 'accessibility', color: '#8BC34A' },
        { id: 8, name: 'Meditación', icon: 'leaf', color: '#607D8B' },
      ];
      webStorage['activity_types'] = defaultActivities;
      saveWebStorage();
    }

    // Load internal foods data for web
    await loadInternalDataWeb();
    
    console.log('Web mock database initialized');
    console.log('[WebDB] Current tables:', Object.keys(webStorage));
    console.log('[WebDB] Current data counts:', Object.fromEntries(
      Object.entries(webStorage).map(([k, v]) => [k, v.length])
    ));
    return;
  }

  // Native database initialization
  await database.execAsync('PRAGMA foreign_keys = ON;');

  await database.execAsync(`
    -- Tags table
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#4CAF50',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Folders table
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      icon TEXT,
      color TEXT DEFAULT '#2196F3',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Foods table (replaces ingredients, supports compound foods)
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      fodmap_level TEXT CHECK(fodmap_level IN ('low', 'medium', 'high', 'unknown')) DEFAULT 'unknown',
      fodmap_details TEXT, -- JSON with fructans, gos, lactose, fructose, sorbitol, mannitol
      is_compound INTEGER DEFAULT 0,
      nutrition TEXT, -- JSON with nutrition info
      nutri_score TEXT CHECK(nutri_score IN ('A', 'B', 'C', 'D', 'E') OR nutri_score IS NULL),
      serving_size TEXT,
      brand TEXT,
      barcode TEXT,
      image_uri TEXT,
      notes TEXT,
      tags TEXT, -- JSON array
      folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
      is_favorite INTEGER DEFAULT 0,
      source TEXT CHECK(source IN ('user', 'internal', 'external')) DEFAULT 'user',
      source_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Food components (for compound foods)
    CREATE TABLE IF NOT EXISTS food_components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
      component_food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
      name TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      fodmap_level TEXT CHECK(fodmap_level IN ('low', 'medium', 'high'))
    );

    -- Food tags junction table
    CREATE TABLE IF NOT EXISTS food_tags (
      food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (food_id, tag_id)
    );

    -- Recipes table (enhanced)
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      fodmap_level TEXT CHECK(fodmap_level IN ('low', 'medium', 'high', 'unknown')) DEFAULT 'unknown',
      fodmap_details TEXT, -- JSON
      prep_time INTEGER,
      cook_time INTEGER,
      total_time INTEGER,
      servings INTEGER DEFAULT 1,
      difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
      cuisine TEXT,
      meal_types TEXT, -- JSON array
      dietary TEXT, -- JSON array
      nutrition TEXT, -- JSON
      image_uri TEXT,
      notes TEXT,
      tags TEXT, -- JSON array
      folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
      is_favorite INTEGER DEFAULT 0,
      source TEXT CHECK(source IN ('user', 'internal', 'external')) DEFAULT 'user',
      source_id TEXT,
      source_name TEXT,
      original_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      is_modified_copy INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Recipe steps table
    CREATE TABLE IF NOT EXISTS recipe_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      title TEXT,
      instruction TEXT NOT NULL,
      duration_minutes INTEGER,
      tip TEXT
    );

    -- Recipe ingredients (enhanced)
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
      food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      fodmap_level TEXT,
      notes TEXT,
      is_optional INTEGER DEFAULT 0,
      alternatives TEXT -- JSON array
    );

    -- Recipe tags junction table
    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, tag_id)
    );

    -- Meals table (enhanced)
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'other')) DEFAULT 'other',
      date TEXT NOT NULL,
      time TEXT,
      notes TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Meal items (foods or recipes)
    CREATE TABLE IF NOT EXISTS meal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
      food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
      recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
      name TEXT,
      quantity REAL,
      unit TEXT,
      fodmap_level TEXT
    );

    -- Water intake table
    CREATE TABLE IF NOT EXISTS water_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      glasses INTEGER DEFAULT 1,
      amount_ml INTEGER DEFAULT 250,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Treatments table (expanded for chronic/periodic treatments)
    CREATE TABLE IF NOT EXISTS treatments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'medication',
      -- Dosage
      dosage_amount REAL,
      dosage_unit TEXT,
      -- Frequency
      frequency TEXT DEFAULT 'once_daily',
      frequency_value TEXT,
      doses TEXT, -- JSON array of TreatmentDose objects
      -- Schedule
      start_date TEXT,
      end_date TEXT,
      is_chronic INTEGER DEFAULT 0,
      specific_days TEXT,
      -- Reminders
      reminder_enabled INTEGER DEFAULT 0,
      reminder_minutes_before INTEGER DEFAULT 15,
      -- Additional info
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

    -- Treatment logs table (expanded)
    CREATE TABLE IF NOT EXISTS treatment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      treatment_id INTEGER REFERENCES treatments(id) ON DELETE CASCADE,
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

    -- Symptoms table
    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      intensity INTEGER CHECK(intensity BETWEEN 1 AND 10) DEFAULT 5,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      duration_minutes INTEGER,
      notes TEXT,
      meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
      treatment_id INTEGER REFERENCES treatments(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Bowel movements table (Bristol scale)
    CREATE TABLE IF NOT EXISTS bowel_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bristol_type INTEGER CHECK(bristol_type BETWEEN 1 AND 7) NOT NULL,
      color TEXT,
      urgency INTEGER CHECK(urgency BETWEEN 1 AND 5) DEFAULT 3,
      pain INTEGER CHECK(pain BETWEEN 0 AND 10) DEFAULT 0,
      discomfort INTEGER CHECK(discomfort BETWEEN 0 AND 10) DEFAULT 0,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      image_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Legacy ingredients table (for compatibility)
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      fodmap_level TEXT DEFAULT 'low',
      serving_size TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Default meals per day of week
    CREATE TABLE IF NOT EXISTS default_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6) NOT NULL,
      meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')) NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      UNIQUE(day_of_week, meal_type)
    );

    -- Activity types (predefined and user-created)
    CREATE TABLE IF NOT EXISTS activity_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT 'fitness',
      color TEXT DEFAULT '#FF9800',
      is_custom INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity logs (individual activities recorded)
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE CASCADE,
      duration_minutes INTEGER NOT NULL,
      intensity INTEGER CHECK(intensity BETWEEN 1 AND 10) DEFAULT 5,
      distance_km REAL,
      calories INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      scheduled_activity_id INTEGER REFERENCES scheduled_activities(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Scheduled/recurring activities
    CREATE TABLE IF NOT EXISTS scheduled_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 30,
      frequency_type TEXT CHECK(frequency_type IN ('daily', 'weekly', 'specific_days', 'interval', 'monthly')) NOT NULL,
      frequency_value TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      reminder_enabled INTEGER DEFAULT 0,
      reminder_time TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Scheduled activity completions/skips
    CREATE TABLE IF NOT EXISTS scheduled_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduled_activity_id INTEGER REFERENCES scheduled_activities(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT CHECK(status IN ('completed', 'skipped', 'partial')) NOT NULL,
      actual_duration_minutes INTEGER,
      notes TEXT,
      skip_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(scheduled_activity_id, date)
    );
  `);

  // Insert default activity types
  const defaultActivities = [
    { name: 'Caminar', icon: 'walk', color: '#4CAF50' },
    { name: 'Correr', icon: 'fitness', color: '#F44336' },
    { name: 'Ciclismo', icon: 'bicycle', color: '#2196F3' },
    { name: 'Natación', icon: 'water', color: '#00BCD4' },
    { name: 'Yoga', icon: 'body', color: '#9C27B0' },
    { name: 'Gimnasio', icon: 'barbell', color: '#FF5722' },
    { name: 'Estiramientos', icon: 'accessibility', color: '#8BC34A' },
    { name: 'Meditación', icon: 'leaf', color: '#607D8B' },
    { name: 'Baile', icon: 'musical-notes', color: '#E91E63' },
    { name: 'Senderismo', icon: 'trail-sign', color: '#795548' },
  ];

  for (const activity of defaultActivities) {
    await database.runAsync(
      'INSERT OR IGNORE INTO activity_types (name, icon, color, is_custom) VALUES (?, ?, ?, 0)',
      [activity.name, activity.icon, activity.color]
    );
  }

  // Insert default settings
  await database.runAsync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', 'auto'),
    ('language', 'es'),
    ('notifications_enabled', 'true'),
    ('external_recipes_enabled', 'false')
  `);

  // Insert default meals for each day
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
  for (let day = 0; day < 7; day++) {
    for (const mealType of mealTypes) {
      await database.runAsync(
        'INSERT OR IGNORE INTO default_meals (day_of_week, meal_type, is_enabled) VALUES (?, ?, ?)',
        [day, mealType, 1]
      );
    }
  }

  // Load internal foods and recipes from JSON files
  await loadInternalData(database);

  console.log('Database initialized successfully');
}

// Generic CRUD helpers
export async function insertRow(table: string, data: Record<string, any>): Promise<number> {
  const database = await getDatabase();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const result = await database.runAsync(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  );
  
  return result.lastInsertRowId;
}

export async function updateRow(table: string, id: number, data: Record<string, any>): Promise<void> {
  const database = await getDatabase();
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  
  await database.runAsync(
    `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [...values, id]
  );
}

export async function deleteRow(table: string, id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function getRows<T>(table: string, where?: string, params?: any[]): Promise<T[]> {
  const database = await getDatabase();
  const query = where 
    ? `SELECT * FROM ${table} WHERE ${where}` 
    : `SELECT * FROM ${table}`;
  return await database.getAllAsync(query, params || []) as T[];
}

export async function getRowById<T>(table: string, id: number): Promise<T | null> {
  const database = await getDatabase();
  return await database.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, [id]) as T | null;
}
