import { Button, Card } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteRow, getDatabase, insertRow } from '@/lib/database';
import {
  ActivityType,
  BRISTOL_SCALE,
  BristolType,
  INTENSITY_LABELS,
  MEAL_TYPE_LABELS,
  MealType,
  NutritionInfo,
  SYMPTOM_TYPES,
  Treatment
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown
} from 'react-native-reanimated';

type LogType = 'water' | 'symptom' | 'bowel' | 'treatment' | 'activity';
type LogCategory = 'meals' | 'water' | 'activity' | 'symptoms' | 'bowel' | 'treatments';

// Category tabs configuration
const LOG_CATEGORIES: { key: LogCategory; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'meals', label: 'Comidas', icon: 'restaurant', color: '#4CAF50' },
  { key: 'water', label: 'Agua', icon: 'water', color: '#2196F3' },
  { key: 'activity', label: 'Actividad', icon: 'fitness', color: '#FF9800' },
  { key: 'symptoms', label: 'Síntomas', icon: 'pulse', color: '#E91E63' },
  { key: 'bowel', label: 'Deposiciones', icon: 'medical', color: '#795548' },
  { key: 'treatments', label: 'Medicación', icon: 'medkit', color: '#9C27B0' },
];

// Meal types order for display with icons based on time of day
const MEAL_TYPES_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];

const MEAL_TYPE_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny',
  lunch: 'partly-sunny',
  dinner: 'moon',
  snack: 'cafe',
  dessert: 'ice-cream',
  other: 'restaurant',
};

interface MealWithItems {
  id: number;
  name: string;
  meal_type: MealType;
  date: string;
  time: string;
  notes: string | null;
  image_uri: string | null;
  total_calories: number;
  items: MealItem[];
}

interface MealItem {
  id: number;
  meal_id: number;
  food_id: number | null;
  recipe_id: number | null;
  name: string;
  quantity: number;
  unit: string;
  fodmap_level?: string;
  calories?: number;
  nutrition?: NutritionInfo;
}

interface DayDetails {
  meals: MealWithItems[];
  water: any[];
  symptoms: any[];
  bowelMovements: any[];
  treatments: any[];
  activities: any[];
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function LogScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  
  // Date navigation
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  
  // Day data
  const [dayDetails, setDayDetails] = useState<DayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Active form modal (for non-meal types)
  const [activeFormType, setActiveFormType] = useState<LogType | null>(null);
  
  // Meal editing
  const [editingMealType, setEditingMealType] = useState<MealType | null>(null);
  const [showMealEditor, setShowMealEditor] = useState(false);
  
  // Meal item editing
  const [editingMealItem, setEditingMealItem] = useState<MealItem | null>(null);
  const [showMealItemEditor, setShowMealItemEditor] = useState(false);
  
  // Expanded meal sections
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());
  
  // Selected category tab
  const [selectedCategory, setSelectedCategory] = useState<LogCategory>('meals');

  const activityColor = '#FF9800';
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isReady) {
      loadDayDetails();
    }
  }, [isReady, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadDayDetails();
      }
    }, [isReady, selectedDate])
  );

  const loadDayDetails = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();

      // Load meals with their items
      const mealsRaw = await db.getAllAsync(
        'SELECT * FROM meals WHERE date = ? ORDER BY time',
        [selectedDate]
      );
      
      const mealsWithItems: MealWithItems[] = [];
      for (const meal of mealsRaw as any[]) {
        const items = await db.getAllAsync(
          `SELECT mi.*, 
                  f.name as food_name, f.fodmap_level as food_fodmap, f.nutrition as food_nutrition,
                  r.name as recipe_name, r.fodmap_level as recipe_fodmap, r.nutrition as recipe_nutrition
           FROM meal_items mi
           LEFT JOIN foods f ON mi.food_id = f.id
           LEFT JOIN recipes r ON mi.recipe_id = r.id
           WHERE mi.meal_id = ?`,
          [meal.id]
        );
        
        let totalCalories = 0;
        const processedItems = items.map((item: any) => {
          // Parse nutrition JSON if available
          let nutrition: NutritionInfo | undefined;
          try {
            const nutritionStr = item.food_nutrition || item.recipe_nutrition;
            if (nutritionStr) {
              nutrition = typeof nutritionStr === 'string' ? JSON.parse(nutritionStr) : nutritionStr;
            }
          } catch (e) {
            nutrition = undefined;
          }
          
          const itemCalories = nutrition?.calories ? (nutrition.calories * (item.quantity || 1)) : 0;
          totalCalories += itemCalories;
          
          return {
            ...item,
            name: item.name || item.food_name || item.recipe_name || 'Item',
            fodmap_level: item.fodmap_level || item.food_fodmap || item.recipe_fodmap,
            calories: itemCalories,
            nutrition,
          };
        });
        
        mealsWithItems.push({
          ...meal,
          image_uri: meal.image_uri || null,
          total_calories: totalCalories,
          items: processedItems,
        });
      }

      const water = await db.getAllAsync(
        'SELECT * FROM water_intake WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const symptoms = await db.getAllAsync(
        'SELECT * FROM symptoms WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const bowelMovements = await db.getAllAsync(
        'SELECT * FROM bowel_movements WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const treatments = await db.getAllAsync(
        `SELECT tl.*, t.name, t.dosage_amount, t.dosage_unit 
         FROM treatment_logs tl 
         LEFT JOIN treatments t ON tl.treatment_id = t.id 
         WHERE tl.date = ? ORDER BY tl.time`,
        [selectedDate]
      );

      const activities = await db.getAllAsync(
        `SELECT al.*, at.name as type_name, at.icon, at.color 
         FROM activity_logs al
         LEFT JOIN activity_types at ON al.activity_type_id = at.id
         WHERE al.date = ? ORDER BY al.time`,
        [selectedDate]
      );

      setDayDetails({ meals: mealsWithItems, water, symptoms, bowelMovements, treatments, activities });
    } catch (error) {
      console.error('Error loading day details:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDay = (direction: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(today);
  };

  const formatSelectedDate = () => {
    if (selectedDate === today) return 'Hoy';
    const date = new Date(selectedDate + 'T12:00:00');
    const dayName = DAY_NAMES[date.getDay()];
    const day = date.getDate();
    const month = MONTH_NAMES[date.getMonth()];
    return `${dayName}, ${day} de ${month}`;
  };

  const handleOpenDatePicker = () => {
    const current = new Date(selectedDate + 'T12:00:00');
    setPickerYear(current.getFullYear());
    setPickerMonth(current.getMonth());
    setShowDatePicker(true);
  };

  const handleSelectDate = (day: number) => {
    // Build date string directly to avoid timezone issues with Date.toISOString()
    const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setShowDatePicker(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Convert Sunday=0 to Sunday=6 for Monday-first week
    const dayOfWeek = firstDay.getDay();
    const startingDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const days: (number | null)[] = [];
    
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const handleFormSuccess = () => {
    setActiveFormType(null);
    loadDayDetails();
  };

  const handleMealEditorSuccess = () => {
    setShowMealEditor(false);
    setEditingMealType(null);
    loadDayDetails();
  };

  const getTotalWater = () => {
    if (!dayDetails) return 0;
    return dayDetails.water.reduce((acc, w) => acc + (w.glasses || 0), 0);
  };

  // Get meal for a specific type
  const getMealForType = (mealType: MealType): MealWithItems | null => {
    if (!dayDetails) return null;
    return dayDetails.meals.find(m => m.meal_type === mealType) || null;
  };

  const handleEditMeal = (mealType: MealType) => {
    setEditingMealType(mealType);
    setShowMealEditor(true);
  };

  const SectionHeader = ({ 
    title, 
    icon, 
    color, 
    count,
    onAdd,
  }: { 
    title: string; 
    icon: keyof typeof Ionicons.glyphMap; 
    color: string;
    count: number;
    onAdd: () => void;
  }) => (
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      marginBottom: 12,
      marginTop: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
          {title}
        </Text>
        {count > 0 && (
          <View style={{
            backgroundColor: color + '20',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color }}>
              {count}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        onPress={onAdd}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="add" size={18} color={color} />
      </Pressable>
    </View>
  );

  const toggleMealExpanded = (mealType: MealType) => {
    setExpandedMeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mealType)) {
        newSet.delete(mealType);
      } else {
        newSet.add(mealType);
      }
      return newSet;
    });
  };

  const handlePickImage = async (mealType: MealType) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const db = await getDatabase();
        const meal = getMealForType(mealType);
        
        if (meal) {
          await db.runAsync(
            'UPDATE meals SET image_uri = ? WHERE id = ?',
            [imageUri, meal.id]
          );
        } else {
          // Create meal if it doesn't exist
          const now = new Date();
          await db.runAsync(
            'INSERT INTO meals (name, meal_type, date, time, image_uri) VALUES (?, ?, ?, ?, ?)',
            [MEAL_TYPE_LABELS[mealType], mealType, selectedDate, now.toTimeString().slice(0, 5), imageUri]
          );
        }
        await loadDayDetails();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleEditItem = (item: MealItem) => {
    setEditingMealItem(item);
    setShowMealItemEditor(true);
  };

  // Meal Type Sub-section Component - NEW DESIGN
  const MealTypeSection = ({ mealType }: { mealType: MealType }) => {
    const meal = getMealForType(mealType);
    const itemCount = meal?.items.length || 0;
    const totalCalories = meal?.total_calories || 0;
    const isExpanded = expandedMeals.has(mealType);
    const imageUri = meal?.image_uri;
    
    const getFodmapColor = (level: string | undefined) => {
      switch (level) {
        case 'low': return colors.fodmapLow;
        case 'medium': return colors.fodmapMedium;
        case 'high': return colors.fodmapHigh;
        default: return colors.textMuted;
      }
    };

    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        {/* Photo (if exists) */}
        {imageUri && (
          <Image 
            source={{ uri: imageUri }} 
            style={{ 
              width: '100%', 
              height: 120, 
              backgroundColor: colors.cardElevated,
            }}
            resizeMode="cover"
          />
        )}
        
        {/* Header - Lighter background */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          backgroundColor: colors.cardElevated,
          borderBottomWidth: isExpanded && itemCount > 0 ? 1 : 0,
          borderBottomColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name={MEAL_TYPE_ICONS[mealType]} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 15, 
                fontWeight: '600', 
                color: colors.text,
              }}>
                {MEAL_TYPE_LABELS[mealType]}
              </Text>
              {totalCalories > 0 && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {Math.round(totalCalories)} kcal
                </Text>
              )}
            </View>
          </View>
          
          {/* Action buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Photo button */}
            <Pressable
              onPress={() => handlePickImage(mealType)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera-outline" size={16} color={colors.textSecondary} />
            </Pressable>
            
            {/* Add item button */}
            <Pressable
              onPress={() => handleEditMeal(mealType)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        
        {/* Dropdown toggle */}
        <Pressable
          onPress={() => toggleMealExpanded(mealType)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            paddingVertical: 10,
            backgroundColor: isExpanded ? colors.card : colors.cardElevated + '80',
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            {itemCount === 0 ? 'Sin elementos' : `${itemCount} elemento${itemCount !== 1 ? 's' : ''}`}
          </Text>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={18} 
            color={colors.textMuted} 
          />
        </Pressable>
        
        {/* Expanded items list */}
        {isExpanded && itemCount > 0 && (
          <View style={{ backgroundColor: colors.card }}>
            {meal!.items.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => handleEditItem(item)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                }}
              >
                {/* FODMAP indicator */}
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: getFodmapColor(item.fodmap_level),
                  marginRight: 12,
                }} />
                
                {/* Item info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '500', 
                    color: colors.text,
                  }}>
                    {item.name}
                  </Text>
                  {item.quantity && item.unit && (
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {item.quantity} {item.unit}
                    </Text>
                  )}
                </View>
                
                {/* Calories and edit icon */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {item.calories !== undefined && item.calories > 0 && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
                      {Math.round(item.calories)} kcal
                    </Text>
                  )}
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="pencil" size={14} color={colors.primary} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Meals Grid Component for multi-column on wide screens
  const MealsGrid = () => {
    const { width } = useWindowDimensions();
    const isWideScreen = width >= 768;
    
    if (isWideScreen) {
      // 2-column layout for tablets/wide screens
      const leftColumn = MEAL_TYPES_ORDER.filter((_, i) => i % 2 === 0);
      const rightColumn = MEAL_TYPES_ORDER.filter((_, i) => i % 2 === 1);
      
      return (
        <Animated.View entering={FadeInDown.springify()}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              {leftColumn.map((mealType) => (
                <MealTypeSection key={mealType} mealType={mealType} />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {rightColumn.map((mealType) => (
                <MealTypeSection key={mealType} mealType={mealType} />
              ))}
            </View>
          </View>
        </Animated.View>
      );
    }
    
    // Single column for mobile
    return (
      <Animated.View entering={FadeInDown.springify()}>
        {MEAL_TYPES_ORDER.map((mealType) => (
          <MealTypeSection key={mealType} mealType={mealType} />
        ))}
      </Animated.View>
    );
  };

  // Check if showing forms or day view
  if (activeFormType) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Pressable onPress={() => setActiveFormType(null)} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
            {activeFormType === 'water' && 'Añadir Agua'}
            {activeFormType === 'activity' && 'Añadir Actividad'}
            {activeFormType === 'symptom' && 'Añadir Síntoma'}
            {activeFormType === 'bowel' && 'Añadir Deposición'}
            {activeFormType === 'treatment' && 'Añadir Tratamiento'}
          </Text>
        </View>
        
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {activeFormType === 'water' && <WaterForm colors={colors} onSuccess={handleFormSuccess} selectedDate={selectedDate} />}
          {activeFormType === 'activity' && <ActivityForm colors={colors} onSuccess={handleFormSuccess} selectedDate={selectedDate} router={router} />}
          {activeFormType === 'symptom' && <SymptomForm colors={colors} onSuccess={handleFormSuccess} selectedDate={selectedDate} />}
          {activeFormType === 'bowel' && <BowelForm colors={colors} onSuccess={handleFormSuccess} selectedDate={selectedDate} />}
          {activeFormType === 'treatment' && <TreatmentForm colors={colors} onSuccess={handleFormSuccess} selectedDate={selectedDate} router={router} />}
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Custom Header with Date Navigation */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <TouchableOpacity 
            onPress={() => navigateDay(-1)}
            activeOpacity={0.7}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleOpenDatePicker}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '700', 
              color: colors.text,
            }}>
              {formatSelectedDate()}
            </Text>
            <View style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.primary + '15',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="calendar" size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {selectedDate !== today && (
              <TouchableOpacity 
                onPress={goToToday}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>Hoy</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => navigateDay(1)}
              activeOpacity={0.7}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Tabs */}
        <View style={{ backgroundColor: colors.surface, paddingTop: 8, paddingBottom: 12 }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {LOG_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const count = cat.key === 'meals' 
                ? dayDetails?.meals.reduce((acc, m) => acc + m.items.length, 0) || 0
                : cat.key === 'water' ? getTotalWater()
                : cat.key === 'activity' ? dayDetails?.activities.length || 0
                : cat.key === 'symptoms' ? dayDetails?.symptoms.length || 0
                : cat.key === 'bowel' ? dayDetails?.bowelMovements.length || 0
                : dayDetails?.treatments.length || 0;
              
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: isSelected ? cat.color : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? cat.color : colors.border,
                  }}
                >
                  <Ionicons 
                    name={cat.icon} 
                    size={16} 
                    color={isSelected ? '#FFFFFF' : cat.color} 
                  />
                  <Text style={{ 
                    fontSize: 13, 
                    fontWeight: '600', 
                    color: isSelected ? '#FFFFFF' : colors.text,
                  }}>
                    {cat.label}
                  </Text>
                  {count > 0 && (
                    <View style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : cat.color + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}>
                      <Text style={{ 
                        fontSize: 11, 
                        fontWeight: '700', 
                        color: isSelected ? '#FFFFFF' : cat.color,
                      }}>
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Category Content */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Meals Category - Multi-column on wide screens */}
            {selectedCategory === 'meals' && (
              <MealsGrid />
            )}

            {/* Water Category */}
            {selectedCategory === 'water' && (
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Consumo de agua
                  </Text>
                  <Pressable
                    onPress={() => setActiveFormType('water')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.water,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
                
                <Card style={{ marginBottom: 16, padding: 20 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 48, fontWeight: '800', color: colors.water }}>
                      {getTotalWater()}
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 4 }}>
                      {getTotalWater() === 1 ? 'vaso' : 'vasos'} de agua
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      backgroundColor: colors.water + '15',
                      borderRadius: 20,
                    }}>
                      <Ionicons name="water" size={18} color={colors.water} />
                      <Text style={{ fontSize: 14, color: colors.water, fontWeight: '600' }}>
                        {getTotalWater() * 250} ml
                      </Text>
                    </View>
                  </View>
                </Card>

                {dayDetails && dayDetails.water.length > 0 && (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {dayDetails.water.map((w, index) => (
                      <View 
                        key={w.id}
                        style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderBottomWidth: index < dayDetails.water.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 16, marginRight: 12 }}>💧</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                            {w.glasses} {w.glasses === 1 ? 'vaso' : 'vasos'}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            {w.time}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, color: colors.water, fontWeight: '500' }}>
                          {w.amount_ml} ml
                        </Text>
                      </View>
                    ))}
                  </Card>
                )}
              </Animated.View>
            )}

            {/* Activity Category */}
            {selectedCategory === 'activity' && (
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Actividad física
                  </Text>
                  <Pressable
                    onPress={() => setActiveFormType('activity')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: activityColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
                
                {dayDetails && dayDetails.activities.length > 0 ? (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {dayDetails.activities.map((activity: any, index) => (
                      <View 
                        key={activity.id}
                        style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderBottomWidth: index < dayDetails.activities.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: (activity.color || activityColor) + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                        }}>
                          <Ionicons name={(activity.icon || 'fitness') as any} size={22} color={activity.color || activityColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                            {activity.type_name || 'Actividad'}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                            {activity.time} · {activity.duration_minutes} min
                          </Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 12,
                          backgroundColor: activityColor + '20',
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: activityColor }}>
                            {activity.intensity}/10
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                ) : (
                  <Card style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="fitness-outline" size={48} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
                      No hay actividades registradas
                    </Text>
                  </Card>
                )}
              </Animated.View>
            )}

            {/* Symptoms Category */}
            {selectedCategory === 'symptoms' && (
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Síntomas
                  </Text>
                  <Pressable
                    onPress={() => setActiveFormType('symptom')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.symptom,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
                
                {dayDetails && dayDetails.symptoms.length > 0 ? (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {dayDetails.symptoms.map((symptom, index) => (
                      <View 
                        key={symptom.id}
                        style={{ 
                          padding: 14,
                          borderBottomWidth: index < dayDetails.symptoms.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                              {symptom.type}
                            </Text>
                            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                              {symptom.time}
                              {symptom.duration_minutes ? ` · ${symptom.duration_minutes} min` : ''}
                            </Text>
                          </View>
                          <View style={{ 
                            paddingHorizontal: 12, 
                            paddingVertical: 6, 
                            borderRadius: 12,
                            backgroundColor: symptom.intensity <= 3 ? colors.fodmapLow + '20' 
                              : symptom.intensity <= 6 ? colors.fodmapMedium + '20' 
                              : colors.fodmapHigh + '20',
                          }}>
                            <Text style={{ 
                              fontSize: 13, 
                              fontWeight: '700',
                              color: symptom.intensity <= 3 ? colors.fodmapLow 
                                : symptom.intensity <= 6 ? colors.fodmapMedium 
                                : colors.fodmapHigh,
                            }}>
                              {symptom.intensity}/10
                            </Text>
                          </View>
                        </View>
                        {symptom.notes && (
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                            {symptom.notes}
                          </Text>
                        )}
                      </View>
                    ))}
                  </Card>
                ) : (
                  <Card style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="pulse-outline" size={48} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
                      No hay síntomas registrados
                    </Text>
                  </Card>
                )}
              </Animated.View>
            )}

            {/* Bowel Movements Category */}
            {selectedCategory === 'bowel' && (
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Deposiciones
                  </Text>
                  <Pressable
                    onPress={() => setActiveFormType('bowel')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.bowel,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
                
                {dayDetails && dayDetails.bowelMovements.length > 0 ? (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {dayDetails.bowelMovements.map((bm, index) => (
                      <View 
                        key={bm.id}
                        style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderBottomWidth: index < dayDetails.bowelMovements.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{
                          width: 50,
                          height: 50,
                          borderRadius: 12,
                          backgroundColor: colors.bowel + '15',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                        }}>
                          <Text style={{ fontSize: 28 }}>
                            {BRISTOL_SCALE[bm.bristol_type as keyof typeof BRISTOL_SCALE]?.emoji || '💩'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                            {BRISTOL_SCALE[bm.bristol_type as keyof typeof BRISTOL_SCALE]?.name || 'Tipo ' + bm.bristol_type}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                            {bm.time}
                          </Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 10,
                          backgroundColor: colors.bowel + '15',
                        }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.bowel }}>
                            Tipo {bm.bristol_type}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                ) : (
                  <Card style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="medical-outline" size={48} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
                      No hay deposiciones registradas
                    </Text>
                  </Card>
                )}
              </Animated.View>
            )}

            {/* Treatments Category */}
            {selectedCategory === 'treatments' && (
              <Animated.View entering={FadeInDown.springify()}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Medicación
                  </Text>
                  <Pressable
                    onPress={() => setActiveFormType('treatment')}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.treatment,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  </Pressable>
                </View>
                
                {dayDetails && dayDetails.treatments.length > 0 ? (
                  <Card style={{ padding: 0, overflow: 'hidden' }}>
                    {dayDetails.treatments.map((treatment, index) => (
                      <View 
                        key={treatment.id}
                        style={{ 
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderBottomWidth: index < dayDetails.treatments.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        }}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.treatment + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                        }}>
                          <Ionicons name="medkit" size={20} color={colors.treatment} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                            {treatment.treatment_name || treatment.name || 'Tratamiento'}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                            {treatment.time}
                            {treatment.dosage_amount ? ` · ${treatment.dosage_amount} ${treatment.dosage_unit || ''}` : ''}
                          </Text>
                        </View>
                        {treatment.taken === 1 && (
                          <View style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: colors.fodmapLow + '20',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name="checkmark" size={16} color={colors.fodmapLow} />
                          </View>
                        )}
                      </View>
                    ))}
                  </Card>
                ) : (
                  <Card style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="medkit-outline" size={48} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
                      No hay medicación registrada
                    </Text>
                  </Card>
                )}
              </Animated.View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <Pressable 
          style={{ 
            flex: 1, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => setShowDatePicker(false)}
        >
          <Pressable 
            style={{ 
              backgroundColor: colors.card, 
              borderRadius: 20,
              padding: 16,
              width: '100%',
              maxWidth: 360,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Month/Year Navigation */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: 16,
            }}>
              <Pressable
                onPress={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear(pickerYear - 1);
                  } else {
                    setPickerMonth(pickerMonth - 1);
                  }
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>
              
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                {MONTH_NAMES[pickerMonth].charAt(0).toUpperCase() + MONTH_NAMES[pickerMonth].slice(1)} {pickerYear}
              </Text>
              
              <Pressable
                onPress={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear(pickerYear + 1);
                  } else {
                    setPickerMonth(pickerMonth + 1);
                  }
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Day headers - Lunes a Domingo */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 12, 
                    fontWeight: '600', 
                    color: colors.textMuted,
                  }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar days */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {getDaysInMonth(pickerYear, pickerMonth).map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
                }

                const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;

                return (
                  <Pressable
                    key={day}
                    onPress={() => handleSelectDate(day)}
                    style={{
                      width: '14.28%',
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + '20' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isToday || isSelected ? '700' : '500',
                        color: isSelected ? '#FFFFFF' : isToday ? colors.primary : colors.text,
                      }}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Quick Actions */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                onPress={() => { setShowDatePicker(false); goToToday(); }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                  Ir a Hoy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowDatePicker(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Cerrar
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Meal Editor Modal */}
      <Modal
        visible={showMealEditor}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMealEditor(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '90%',
          }}>
            {editingMealType && (
              <MealEditor 
                colors={colors}
                selectedDate={selectedDate}
                mealType={editingMealType}
                existingMeal={getMealForType(editingMealType)}
                onClose={() => { setShowMealEditor(false); setEditingMealType(null); }}
                onSuccess={handleMealEditorSuccess}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Meal Item Editor Modal */}
      <Modal
        visible={showMealItemEditor}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMealItemEditor(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '85%',
          }}>
            {editingMealItem && (
              <MealItemEditor 
                colors={colors}
                item={editingMealItem}
                mealTypes={MEAL_TYPES_ORDER}
                onClose={() => { setShowMealItemEditor(false); setEditingMealItem(null); }}
                onSuccess={() => { setShowMealItemEditor(false); setEditingMealItem(null); loadDayDetails(); }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// MEAL EDITOR COMPONENT
// ============================================================

interface MealEditorProps {
  colors: any;
  selectedDate: string;
  mealType: MealType;
  existingMeal: MealWithItems | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedMealItem {
  id?: number;
  food_id?: number;
  recipe_id?: number;
  name: string;
  fodmap_level?: string;
  quantity: number;
  unit: string;
}

function MealEditor({ colors, selectedDate, mealType, existingMeal, onClose, onSuccess }: MealEditorProps) {
  const [notes, setNotes] = useState(existingMeal?.notes || '');
  const [selectedItems, setSelectedItems] = useState<SelectedMealItem[]>(
    existingMeal?.items.map(item => ({
      id: item.id,
      food_id: item.food_id || undefined,
      recipe_id: item.recipe_id || undefined,
      name: item.name,
      fodmap_level: item.fodmap_level,
      quantity: item.quantity || 1,
      unit: item.unit || 'porción',
    })) || []
  );
  
  const [recipes, setRecipes] = useState<any[]>([]);
  const [foods, setFoods] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Quantity modal state
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<{ 
    food_id?: number; 
    recipe_id?: number; 
    name: string; 
    fodmap_level?: string; 
  } | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState('1');
  const [pendingUnit, setPendingUnit] = useState('porción');

  const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cucharada', 'cucharadita', 'pieza'];

  useEffect(() => {
    loadRecipesAndFoods();
  }, []);

  const loadRecipesAndFoods = async () => {
    try {
      const db = await getDatabase();
      const recipesData = await db.getAllAsync('SELECT * FROM recipes ORDER BY name ASC');
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setRecipes(recipesData);
      setFoods(foodsData);
    } catch (error) {
      console.error('Error loading recipes/foods:', error);
    }
  };

  const filteredRecipes = recipes.filter(r => 
    r.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFoods = foods.filter(f => 
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectRecipe = (recipe: any) => {
    // Check if already added
    if (selectedItems.some(item => item.recipe_id === recipe.id)) return;
    
    // Open quantity modal
    setPendingItem({
      recipe_id: recipe.id,
      name: recipe.name,
      fodmap_level: recipe.fodmap_level,
    });
    setPendingQuantity('1');
    setPendingUnit('porción');
    setShowQuantityModal(true);
    setSearchQuery('');
    setShowSearch(false);
  };

  const handleSelectFood = (food: any) => {
    // Check if already added
    if (selectedItems.some(item => item.food_id === food.id)) return;
    
    // Open quantity modal
    setPendingItem({
      food_id: food.id,
      name: food.name,
      fodmap_level: food.fodmap_level,
    });
    setPendingQuantity('100');
    setPendingUnit('g');
    setShowQuantityModal(true);
    setSearchQuery('');
    setShowSearch(false);
  };

  const handleConfirmQuantity = () => {
    if (!pendingItem) return;
    
    const qty = parseFloat(pendingQuantity) || 1;
    setSelectedItems([...selectedItems, {
      ...pendingItem,
      quantity: qty,
      unit: pendingUnit,
    }]);
    
    setShowQuantityModal(false);
    setPendingItem(null);
    setPendingQuantity('1');
    setPendingUnit('porción');
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const getFodmapColor = (level: string | undefined) => {
    switch (level) {
      case 'low': return colors.fodmapLow;
      case 'medium': return colors.fodmapMedium;
      case 'high': return colors.fodmapHigh;
      default: return colors.textMuted;
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const now = new Date();
      
      let mealId: number;
      
      if (existingMeal) {
        // Update existing meal
        mealId = existingMeal.id;
        await db.runAsync(
          'UPDATE meals SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [notes.trim() || null, mealId]
        );
        
        // Delete all existing items
        await db.runAsync('DELETE FROM meal_items WHERE meal_id = ?', [mealId]);
      } else {
        // Create new meal
        const result = await db.runAsync(
          'INSERT INTO meals (name, meal_type, date, time, notes) VALUES (?, ?, ?, ?, ?)',
          [
            MEAL_TYPE_LABELS[mealType],
            mealType,
            selectedDate,
            now.toTimeString().slice(0, 5),
            notes.trim() || null,
          ]
        );
        mealId = result.lastInsertRowId;
      }
      
      // Insert new items with quantity and unit
      for (const item of selectedItems) {
        await insertRow('meal_items', {
          meal_id: mealId,
          food_id: item.food_id || null,
          recipe_id: item.recipe_id || null,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        });
      }
      
      Alert.alert('¡Guardado!', `${MEAL_TYPE_LABELS[mealType]} actualizado`);
      onSuccess();
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'No se pudo guardar la comida');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
          {MEAL_TYPE_LABELS[mealType]}
        </Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 32 }}>
          {/* Search */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Añadir alimentos o recetas
            </Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.cardElevated,
              borderRadius: 12,
              paddingHorizontal: 12,
            }}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={(text) => { setSearchQuery(text); setShowSearch(text.length > 0); }}
                onFocus={() => searchQuery.length > 0 && setShowSearch(true)}
                placeholder="Buscar..."
                placeholderTextColor={colors.textMuted}
                style={{ flex: 1, fontSize: 15, color: colors.text, padding: 12 }}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => { setSearchQuery(''); setShowSearch(false); }}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Search Results */}
            {showSearch && searchQuery.length > 0 && (
              <View style={{ 
                marginTop: 8, 
                maxHeight: 200,
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <ScrollView nestedScrollEnabled>
                  {filteredRecipes.length > 0 && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, padding: 10, paddingBottom: 4 }}>
                        RECETAS
                      </Text>
                      {filteredRecipes.slice(0, 5).map((recipe) => (
                        <Pressable
                          key={`recipe-${recipe.id}`}
                          onPress={() => handleSelectRecipe(recipe)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <Ionicons name="book" size={16} color={colors.primary} style={{ marginRight: 10 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{recipe.name}</Text>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getFodmapColor(recipe.fodmap_level) }} />
                        </Pressable>
                      ))}
                    </>
                  )}

                  {filteredFoods.length > 0 && (
                    <>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, padding: 10, paddingBottom: 4 }}>
                        ALIMENTOS
                      </Text>
                      {filteredFoods.slice(0, 5).map((food) => (
                        <Pressable
                          key={`food-${food.id}`}
                          onPress={() => handleSelectFood(food)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <Ionicons name="nutrition" size={16} color={getFodmapColor(food.fodmap_level)} style={{ marginRight: 10 }} />
                          <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{food.name}</Text>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getFodmapColor(food.fodmap_level) }} />
                        </Pressable>
                      ))}
                    </>
                  )}

                  {filteredRecipes.length === 0 && filteredFoods.length === 0 && (
                    <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 16 }}>
                      Sin resultados
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Selected Items */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              {selectedItems.length > 0 ? `Seleccionados (${selectedItems.length})` : 'Sin alimentos añadidos'}
            </Text>
            
            {selectedItems.length > 0 ? (
              <View style={{ gap: 8 }}>
                {selectedItems.map((item, index) => (
                  <View 
                    key={`${item.food_id || item.recipe_id || index}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: getFodmapColor(item.fodmap_level) + '15',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: getFodmapColor(item.fodmap_level) + '30',
                    }}
                  >
                    <Ionicons 
                      name={item.recipe_id ? 'book' : 'nutrition'} 
                      size={16} 
                      color={getFodmapColor(item.fodmap_level)} 
                      style={{ marginRight: 10 }} 
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemoveItem(index)}>
                      <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{
                padding: 24,
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                alignItems: 'center',
              }}>
                <Ionicons name="restaurant-outline" size={32} color={colors.textMuted} />
                <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
                  Busca y añade alimentos o recetas
                </Text>
              </View>
            )}
          </View>

          {/* Notes */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Notas (opcional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Añade notas sobre esta comida..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                fontSize: 15,
                color: colors.text,
                padding: 14,
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Save Button */}
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            Guardar {MEAL_TYPE_LABELS[mealType]}
          </Button>
        </View>
      </ScrollView>

      {/* Quantity Modal */}
      <Modal
        visible={showQuantityModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowQuantityModal(false)}
      >
        <Pressable 
          style={{ 
            flex: 1, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
          onPress={() => setShowQuantityModal(false)}
        >
          <Pressable 
            style={{ 
              backgroundColor: colors.card, 
              borderRadius: 20,
              padding: 20,
              width: '100%',
              maxWidth: 340,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: getFodmapColor(pendingItem?.fodmap_level) + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Ionicons 
                  name={pendingItem?.recipe_id ? 'book' : 'nutrition'} 
                  size={24} 
                  color={getFodmapColor(pendingItem?.fodmap_level)} 
                />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
                {pendingItem?.name}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                ¿Qué cantidad has consumido?
              </Text>
            </View>

            {/* Quantity Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>
                CANTIDAD
              </Text>
              <View style={{
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}>
                <TextInput
                  value={pendingQuantity}
                  onChangeText={setPendingQuantity}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={{
                    fontSize: 32,
                    fontWeight: '700',
                    color: colors.text,
                    textAlign: 'center',
                    minWidth: 100,
                  }}
                />
              </View>
            </View>

            {/* Unit Selection */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 8 }}>
                UNIDAD
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {UNITS.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setPendingUnit(u)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 16,
                      backgroundColor: pendingUnit === u ? colors.primary : colors.cardElevated,
                    }}
                  >
                    <Text style={{ 
                      fontSize: 13, 
                      fontWeight: '500', 
                      color: pendingUnit === u ? '#FFFFFF' : colors.textSecondary 
                    }}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  setShowQuantityModal(false);
                  setPendingItem(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.cardElevated,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmQuantity}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                  Añadir
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ============================================================
// MEAL ITEM EDITOR COMPONENT
// ============================================================

interface MealItemEditorProps {
  colors: any;
  item: MealItem;
  mealTypes: MealType[];
  onClose: () => void;
  onSuccess: () => void;
}

function MealItemEditor({ colors, item, mealTypes, onClose, onSuccess }: MealItemEditorProps) {
  const [quantity, setQuantity] = useState(item.quantity?.toString() || '1');
  const [unit, setUnit] = useState(item.unit || 'porción');
  const [targetMealType, setTargetMealType] = useState<MealType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);

  const UNITS = ['g', 'ml', 'porción', 'unidad', 'taza', 'cucharada', 'cucharadita', 'pieza'];

  const getFodmapColor = (level: string | undefined) => {
    switch (level) {
      case 'low': return colors.fodmapLow;
      case 'medium': return colors.fodmapMedium;
      case 'high': return colors.fodmapHigh;
      default: return colors.textMuted;
    }
  };

  const getFodmapLabel = (level: string | undefined) => {
    switch (level) {
      case 'low': return 'Bajo';
      case 'medium': return 'Medio';
      case 'high': return 'Alto';
      default: return 'Desconocido';
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const qty = parseFloat(quantity) || 1;
      
      // Update quantity and unit
      await db.runAsync(
        'UPDATE meal_items SET quantity = ?, unit = ? WHERE id = ?',
        [qty, unit, item.id]
      );

      // Move to different meal type if selected
      if (targetMealType) {
        // Get target meal for this date
        const targetMeal = await db.getFirstAsync(
          'SELECT id FROM meals WHERE date = (SELECT date FROM meals WHERE id = (SELECT meal_id FROM meal_items WHERE id = ?)) AND meal_type = ?',
          [item.id, targetMealType]
        ) as { id: number } | null;

        if (targetMeal) {
          await db.runAsync(
            'UPDATE meal_items SET meal_id = ? WHERE id = ?',
            [targetMeal.id, item.id]
          );
        } else {
          // Create new meal for target type
          const now = new Date();
          const mealDate = await db.getFirstAsync(
            'SELECT date FROM meals WHERE id = ?',
            [item.meal_id]
          ) as { date: string } | null;
          
          if (mealDate) {
            const result = await db.runAsync(
              'INSERT INTO meals (name, meal_type, date, time) VALUES (?, ?, ?, ?)',
              [MEAL_TYPE_LABELS[targetMealType], targetMealType, mealDate.date, now.toTimeString().slice(0, 5)]
            );
            await db.runAsync(
              'UPDATE meal_items SET meal_id = ? WHERE id = ?',
              [result.lastInsertRowId, item.id]
            );
          }
        }
      }

      Alert.alert('¡Guardado!', 'Elemento actualizado');
      onSuccess();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'No se pudo actualizar el elemento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar elemento',
      `¿Estás seguro de que quieres eliminar "${item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteRow('meal_items', item.id);
              Alert.alert('Eliminado', 'Elemento eliminado');
              onSuccess();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'No se pudo eliminar');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
          Editar elemento
        </Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 32 }}>
          {/* Item Info Card */}
          <View style={{
            backgroundColor: getFodmapColor(item.fodmap_level) + '15',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: getFodmapColor(item.fodmap_level) + '30',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons 
                name={item.recipe_id ? 'book' : 'nutrition'} 
                size={20} 
                color={getFodmapColor(item.fodmap_level)} 
              />
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 10, flex: 1 }}>
                {item.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: getFodmapColor(item.fodmap_level),
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                  FODMAP: {getFodmapLabel(item.fodmap_level)}
                </Text>
              </View>
              {item.calories && item.calories > 0 && (
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {Math.round(item.calories)} kcal
                </Text>
              )}
            </View>
          </View>

          {/* Quantity */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Cantidad
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={{
                  flex: 1,
                  fontSize: 20,
                  fontWeight: '700',
                  color: colors.text,
                  padding: 14,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                  textAlign: 'center',
                }}
              />
            </View>
          </View>

          {/* Unit Selection */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Unidad de medida
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {UNITS.map((u) => (
                  <Pressable
                    key={u}
                    onPress={() => setUnit(u)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: unit === u ? colors.primary : colors.cardElevated,
                    }}
                  >
                    <Text style={{ 
                      fontSize: 13, 
                      fontWeight: '600', 
                      color: unit === u ? '#FFFFFF' : colors.textSecondary 
                    }}>
                      {u}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Move to different meal type */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Mover a otro tipo de comida
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {mealTypes.map((mt) => (
                <Pressable
                  key={mt}
                  onPress={() => setTargetMealType(targetMealType === mt ? null : mt)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: targetMealType === mt ? colors.warning : colors.cardElevated,
                    borderWidth: 1,
                    borderColor: targetMealType === mt ? colors.warning : 'transparent',
                  }}
                >
                  <Text style={{ 
                    fontSize: 13, 
                    fontWeight: '500', 
                    color: targetMealType === mt ? '#FFFFFF' : colors.textSecondary 
                  }}>
                    {MEAL_TYPE_LABELS[mt]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Nutrition Info Toggle */}
          {item.nutrition && (
            <View>
              <Pressable
                onPress={() => setShowNutrition(!showNutrition)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="nutrition" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                    Información nutricional
                  </Text>
                </View>
                <Ionicons 
                  name={showNutrition ? 'chevron-up' : 'chevron-down'} 
                  size={18} 
                  color={colors.textMuted} 
                />
              </Pressable>
              
              {showNutrition && (
                <View style={{
                  marginTop: 8,
                  padding: 14,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {item.nutrition.calories !== undefined && (
                      <NutritionBadge label="Calorías" value={`${item.nutrition.calories} kcal`} colors={colors} />
                    )}
                    {item.nutrition.protein_g !== undefined && (
                      <NutritionBadge label="Proteínas" value={`${item.nutrition.protein_g}g`} colors={colors} />
                    )}
                    {item.nutrition.carbs_g !== undefined && (
                      <NutritionBadge label="Carbos" value={`${item.nutrition.carbs_g}g`} colors={colors} />
                    )}
                    {item.nutrition.fat_g !== undefined && (
                      <NutritionBadge label="Grasas" value={`${item.nutrition.fat_g}g`} colors={colors} />
                    )}
                    {item.nutrition.fiber_g !== undefined && (
                      <NutritionBadge label="Fibra" value={`${item.nutrition.fiber_g}g`} colors={colors} />
                    )}
                    {item.nutrition.sugars_g !== undefined && (
                      <NutritionBadge label="Azúcares" value={`${item.nutrition.sugars_g}g`} colors={colors} />
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 12, marginTop: 8 }}>
            <Button onPress={handleSave} loading={loading} fullWidth size="lg">
              Guardar cambios
            </Button>
            
            <Pressable
              onPress={handleDelete}
              disabled={loading}
              style={{
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                backgroundColor: colors.fodmapHigh + '15',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.fodmapHigh }}>
                Eliminar elemento
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

// Nutrition Badge Component
function NutritionBadge({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

// ============================================================
// OTHER FORMS (Water, Activity, Symptom, Bowel, Treatment)
// ============================================================

// Water Form
function WaterForm({ colors, onSuccess, selectedDate }: { colors: any; onSuccess: () => void; selectedDate: string }) {
  const [glasses, setGlasses] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const now = new Date();
      await insertRow('water_intake', {
        glasses,
        amount_ml: glasses * 250,
        date: selectedDate,
        time: now.toTimeString().split(' ')[0].slice(0, 5),
      });
      Alert.alert('¡Guardado!', `${glasses} vaso${glasses > 1 ? 's' : ''} de agua registrado${glasses > 1 ? 's' : ''}`);
      onSuccess();
    } catch (error) {
      console.error('Error saving water:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 }}>
          ¿Cuántos vasos de agua?
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <Pressable
            onPress={() => setGlasses(Math.max(1, glasses - 1))}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.cardElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="remove" size={24} color={colors.text} />
          </Pressable>
          
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 48, fontWeight: '700', color: colors.water }}>
              {glasses}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              {glasses * 250} ml
            </Text>
          </View>

          <Pressable
            onPress={() => setGlasses(glasses + 1)}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.water + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={24} color={colors.water} />
          </Pressable>
        </View>
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar
      </Button>
    </View>
  );
}

// Symptom Form
function SymptomForm({ colors, onSuccess, selectedDate }: { colors: any; onSuccess: () => void; selectedDate: string }) {
  const [symptomType, setSymptomType] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));

  const handleSave = async () => {
    if (!symptomType) {
      Alert.alert('Error', 'Por favor, selecciona un tipo de síntoma');
      return;
    }

    setLoading(true);
    try {
      await insertRow('symptoms', {
        type: symptomType,
        intensity,
        date: selectedDate,
        time: customTime,
        notes: notes.trim() || null,
      });
      Alert.alert('¡Guardado!', 'Síntoma registrado correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error saving symptom:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Tipo de síntoma
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOM_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setSymptomType(type)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: symptomType === type ? colors.symptom : colors.cardElevated,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: symptomType === type ? '#FFFFFF' : colors.textSecondary }}>
                {type}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Intensidad: {intensity}/10
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <Pressable
              key={level}
              onPress={() => setIntensity(level)}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 32,
                borderRadius: 8,
                backgroundColor: intensity >= level 
                  ? level <= 3 ? colors.fodmapLow : level <= 6 ? colors.fodmapMedium : colors.fodmapHigh
                  : colors.cardElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: intensity >= level ? '#FFFFFF' : colors.textMuted }}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
          Hora
        </Text>
        <TextInput
          value={customTime}
          onChangeText={setCustomTime}
          placeholder="HH:MM"
          placeholderTextColor={colors.textMuted}
          style={{ fontSize: 18, fontWeight: '600', color: colors.text, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 10, textAlign: 'center' }}
        />
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade notas adicionales..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{ fontSize: 15, color: colors.text, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 10, minHeight: 80, textAlignVertical: 'top' }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar síntoma
      </Button>
    </View>
  );
}

// Bowel Form
function BowelForm({ colors, onSuccess, selectedDate }: { colors: any; onSuccess: () => void; selectedDate: string }) {
  const [bristolType, setBristolType] = useState<BristolType>(4);
  const [urgency, setUrgency] = useState(3);
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const now = new Date();
      await insertRow('bowel_movements', {
        bristol_type: bristolType,
        urgency,
        pain,
        discomfort: 0,
        date: selectedDate,
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: notes.trim() || null,
      });
      Alert.alert('¡Guardado!', 'Deposición registrada correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error saving bowel movement:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Escala Bristol
        </Text>
        <View style={{ gap: 8 }}>
          {([1, 2, 3, 4, 5, 6, 7] as BristolType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setBristolType(type)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 10,
                backgroundColor: bristolType === type ? colors.bowel + '20' : colors.cardElevated,
                borderWidth: 1,
                borderColor: bristolType === type ? colors.bowel : 'transparent',
              }}
            >
              <Text style={{ fontSize: 24, marginRight: 12 }}>{BRISTOL_SCALE[type].emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: bristolType === type ? colors.bowel : colors.text }}>
                  {BRISTOL_SCALE[type].name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{BRISTOL_SCALE[type].description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>Urgencia: {urgency}/5</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => setUrgency(level)}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: urgency >= level ? colors.warning : colors.cardElevated, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: urgency >= level ? '#FFFFFF' : colors.textMuted }}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>Dolor: {pain}/10</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <Pressable
              key={level}
              onPress={() => setPain(level)}
              style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: pain >= level && level > 0 ? level <= 3 ? colors.fodmapLow : level <= 6 ? colors.fodmapMedium : colors.fodmapHigh : colors.cardElevated,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: pain >= level && level > 0 ? '#FFFFFF' : colors.textMuted }}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade notas adicionales..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{ fontSize: 15, color: colors.text, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 10, minHeight: 80, textAlignVertical: 'top' }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar deposición
      </Button>
    </View>
  );
}

// Treatment Form (Simplified)
function TreatmentForm({ colors, onSuccess, selectedDate, router }: { colors: any; onSuccess: () => void; selectedDate: string; router: any }) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [quickName, setQuickName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [loading, setLoading] = useState(false);

  const DOSAGE_UNITS = ['mg', 'g', 'ml', 'gotas', 'comprimido', 'cápsula'];

  React.useEffect(() => {
    loadTreatments();
  }, []);

  const loadTreatments = async () => {
    try {
      const db = await getDatabase();
      const data = await db.getAllAsync('SELECT * FROM treatments WHERE is_active = 1 ORDER BY name');
      setTreatments(data as Treatment[]);
    } catch (error) {
      console.error('Error loading treatments:', error);
    } finally {
      setLoadingTreatments(false);
    }
  };

  const handleQuickLogTreatment = async (treatment: Treatment) => {
    setLoading(true);
    try {
      const now = new Date();
      await insertRow('treatment_logs', {
        treatment_id: treatment.id,
        treatment_name: treatment.name,
        date: selectedDate,
        time: now.toTimeString().slice(0, 5),
        taken: 1,
        skipped: 0,
        amount_taken: treatment.dosage_amount,
        unit: treatment.dosage_unit,
      });
      Alert.alert('¡Guardado!', `Toma de ${treatment.name} registrada`);
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar la toma');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickEntry = async () => {
    if (!quickName.trim()) {
      Alert.alert('Error', 'Por favor, introduce el nombre del tratamiento');
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      const now = new Date();
      
      const existing = await db.getFirstAsync('SELECT id FROM treatments WHERE name = ?', [quickName.trim()]) as { id: number } | null;
      let treatmentId: number;
      
      if (existing) {
        treatmentId = existing.id;
      } else {
        const result = await db.runAsync(
          'INSERT INTO treatments (name, dosage_amount, dosage_unit, frequency, is_active) VALUES (?, ?, ?, ?, 1)',
          [quickName.trim(), parseFloat(dosageAmount) || null, dosageUnit, 'as_needed']
        );
        treatmentId = result.lastInsertRowId;
      }

      await insertRow('treatment_logs', {
        treatment_id: treatmentId,
        treatment_name: quickName.trim(),
        date: selectedDate,
        time: now.toTimeString().slice(0, 5),
        taken: 1,
        skipped: 0,
        amount_taken: parseFloat(dosageAmount) || null,
        unit: dosageAmount.trim() ? dosageUnit : null,
      });

      Alert.alert('¡Guardado!', `Toma de ${quickName.trim()} registrada`);
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
          Mis Tratamientos
        </Text>
        
        {loadingTreatments ? (
          <ActivityIndicator color={colors.treatment} />
        ) : treatments.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>
            No tienes tratamientos activos
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {treatments.map((treatment) => (
              <View key={treatment.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.cardElevated, borderRadius: 12, gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{treatment.name}</Text>
                  {treatment.dosage_amount && (
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>{treatment.dosage_amount} {treatment.dosage_unit}</Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleQuickLogTreatment(treatment)}
                  disabled={loading}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.treatment, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>+ Toma</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 }}>
          Toma Puntual
        </Text>
        
        <View style={{ gap: 12 }}>
          <TextInput
            value={quickName}
            onChangeText={setQuickName}
            placeholder="Nombre del medicamento..."
            placeholderTextColor={colors.textMuted}
            style={{ fontSize: 16, color: colors.text, padding: 14, backgroundColor: colors.cardElevated, borderRadius: 12 }}
          />
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={dosageAmount}
              onChangeText={setDosageAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{ width: 80, fontSize: 18, fontWeight: '700', color: colors.text, padding: 14, backgroundColor: colors.cardElevated, borderRadius: 12, textAlign: 'center' }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {DOSAGE_UNITS.map(unit => (
                <Pressable
                  key={unit}
                  onPress={() => setDosageUnit(unit)}
                  style={{ paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12, backgroundColor: dosageUnit === unit ? colors.treatment : colors.cardElevated }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: dosageUnit === unit ? '#FFFFFF' : colors.textSecondary }}>{unit}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Card>

      <Button onPress={handleSaveQuickEntry} loading={loading} fullWidth size="lg" disabled={!quickName.trim()}>
        Registrar toma
      </Button>
    </View>
  );
}

// Activity Form (Simplified)
function ActivityForm({ colors, onSuccess, selectedDate, router }: { colors: any; onSuccess: () => void; selectedDate: string; router: any }) {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [duration, setDuration] = useState('30');
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const activityColor = '#FF9800';

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const types = await db.getAllAsync('SELECT * FROM activity_types ORDER BY usage_count DESC, name ASC');
      setActivityTypes(types as ActivityType[]);
    } catch (error) {
      console.error('Error loading activity types:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    if (!selectedType && !customName.trim()) {
      Alert.alert('Error', 'Por favor, selecciona o crea un tipo de actividad');
      return;
    }

    if (!duration || parseInt(duration) <= 0) {
      Alert.alert('Error', 'Por favor, introduce una duración válida');
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      const now = new Date();
      let activityTypeId: number;

      if (showCustom && customName.trim()) {
        const result = await db.runAsync(
          'INSERT INTO activity_types (name, icon, color, is_custom, usage_count) VALUES (?, ?, ?, 1, 1)',
          [customName.trim(), 'fitness', activityColor]
        );
        activityTypeId = result.lastInsertRowId;
      } else if (selectedType) {
        activityTypeId = selectedType.id;
        await db.runAsync('UPDATE activity_types SET usage_count = usage_count + 1 WHERE id = ?', [activityTypeId]);
      } else {
        Alert.alert('Error', 'Por favor, selecciona una actividad');
        setLoading(false);
        return;
      }

      await insertRow('activity_logs', {
        activity_type_id: activityTypeId,
        duration_minutes: parseInt(duration),
        intensity,
        date: selectedDate,
        time: now.toTimeString().slice(0, 5),
        notes: notes.trim() || null,
      });

      Alert.alert('¡Guardado!', 'Actividad registrada correctamente');
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
            {showCustom ? 'Actividad personalizada' : 'Tipo de actividad'}
          </Text>
          <Pressable onPress={() => setShowCustom(!showCustom)}>
            <Text style={{ fontSize: 12, color: activityColor, fontWeight: '600' }}>
              {showCustom ? 'Ver lista' : '+ Nueva'}
            </Text>
          </Pressable>
        </View>
        
        {showCustom ? (
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Nombre de la actividad..."
            placeholderTextColor={colors.textMuted}
            style={{ fontSize: 16, color: colors.text, padding: 14, backgroundColor: colors.cardElevated, borderRadius: 12 }}
          />
        ) : loadingData ? (
          <ActivityIndicator color={activityColor} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {activityTypes.slice(0, 12).map((type) => (
              <Pressable
                key={type.id}
                onPress={() => setSelectedType(type)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: selectedType?.id === type.id ? type.color : colors.cardElevated,
                  gap: 6,
                }}
              >
                <Ionicons name={type.icon as any} size={14} color={selectedType?.id === type.id ? '#FFFFFF' : type.color} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: selectedType?.id === type.id ? '#FFFFFF' : colors.textSecondary }}>
                  {type.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Duración (minutos)</Text>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          placeholder="30"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          style={{ fontSize: 24, fontWeight: '700', color: colors.text, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 10, textAlign: 'center' }}
        />
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
          Intensidad: {intensity}/10
        </Text>
        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>{INTENSITY_LABELS[intensity]}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <Pressable
              key={level}
              onPress={() => setIntensity(level)}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 28,
                borderRadius: 8,
                backgroundColor: intensity >= level 
                  ? level <= 3 ? colors.fodmapLow : level <= 6 ? activityColor : colors.fodmapHigh
                  : colors.cardElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '600', color: intensity >= level ? '#FFFFFF' : colors.textMuted }}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Cómo te sentiste, detalles..."
          placeholderTextColor={colors.textMuted}
          multiline
          style={{ fontSize: 15, color: colors.text, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 10, minHeight: 60, textAlignVertical: 'top' }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg" disabled={!selectedType && !customName.trim()}>
        Guardar actividad
      </Button>
    </View>
  );
}
