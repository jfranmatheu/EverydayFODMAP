import { Button, Card } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase, insertRow } from '@/lib/database';
import {
    ActivityLog,
    ActivityType,
    BRISTOL_SCALE,
    BristolType,
    INTENSITY_LABELS,
    MEAL_TYPE_LABELS,
    MealType,
    ScheduledActivity,
    SYMPTOM_TYPES,
    Treatment,
    TreatmentLog,
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeInRight,
} from 'react-native-reanimated';

type LogType = 'meal' | 'water' | 'symptom' | 'bowel' | 'treatment' | 'activity';

interface LogOption {
  id: LogType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}

export default function LogScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: LogType }>();
  const [activeType, setActiveType] = useState<LogType | null>(params.type || null);

  const activityColor = '#FF9800';
  
  const logOptions: LogOption[] = [
    { id: 'meal', icon: 'restaurant', label: 'Comida', color: colors.primary },
    { id: 'water', icon: 'water', label: 'Agua', color: colors.water },
    { id: 'activity', icon: 'fitness', label: 'Actividad', color: activityColor },
    { id: 'symptom', icon: 'pulse', label: 'Síntoma', color: colors.symptom },
    { id: 'bowel', icon: 'medical', label: 'Deposición', color: colors.bowel },
    { id: 'treatment', icon: 'medkit', label: 'Tratamiento', color: colors.treatment },
  ];

  const handleBack = () => {
    setActiveType(null);
  };

  if (activeType) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Pressable onPress={handleBack} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
            {logOptions.find(o => o.id === activeType)?.label}
          </Text>
        </View>
        
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {activeType === 'meal' && <MealForm colors={colors} onSuccess={handleBack} />}
          {activeType === 'water' && <WaterForm colors={colors} onSuccess={handleBack} />}
          {activeType === 'activity' && <ActivityForm colors={colors} onSuccess={handleBack} />}
          {activeType === 'symptom' && <SymptomForm colors={colors} onSuccess={handleBack} />}
          {activeType === 'bowel' && <BowelForm colors={colors} onSuccess={handleBack} />}
          {activeType === 'treatment' && <TreatmentForm colors={colors} onSuccess={handleBack} />}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <Text style={{ 
          fontSize: 24, 
          fontWeight: '700', 
          color: colors.text,
          marginBottom: 8,
        }}>
          ¿Qué quieres registrar?
        </Text>
        <Text style={{ 
          fontSize: 15, 
          color: colors.textSecondary,
          marginBottom: 24,
        }}>
          Selecciona una opción para añadir un nuevo registro
        </Text>
      </Animated.View>

      <View style={{ gap: 12 }}>
        {logOptions.map((option, index) => (
          <Animated.View 
            key={option.id}
            entering={FadeInRight.delay(150 + index * 50).springify()}
          >
            <Card onPress={() => setActiveType(option.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: option.color + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name={option.icon} size={26} color={option.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 17, 
                    fontWeight: '600', 
                    color: colors.text,
                  }}>
                    {option.label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </View>
            </Card>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

// Water Form
function WaterForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const [glasses, setGlasses] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const now = new Date();
      await insertRow('water_intake', {
        glasses,
        amount_ml: glasses * 250,
        date: now.toISOString().split('T')[0],
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

// Meal Form
function MealForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('other');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [foods, setFoods] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [selectedFoods, setSelectedFoods] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  React.useEffect(() => {
    loadRecipesAndFoods();
  }, []);

  const loadRecipesAndFoods = async () => {
    try {
      const db = await getDatabase();
      const recipesData = await db.getAllAsync('SELECT * FROM recipes ORDER BY name ASC');
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setRecipes(recipesData);
      setFoods(foodsData);
      console.log('[MealForm] Loaded:', recipesData.length, 'recipes,', foodsData.length, 'foods');
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
    setSelectedRecipe(recipe);
    setName(recipe.name);
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleSelectFood = (food: any) => {
    if (!selectedFoods.find(f => f.id === food.id)) {
      setSelectedFoods([...selectedFoods, food]);
    }
    setSearchQuery('');
  };

  const handleRemoveFood = (foodId: number) => {
    setSelectedFoods(selectedFoods.filter(f => f.id !== foodId));
  };

  const handleSave = async () => {
    if (!name.trim() && !selectedRecipe && selectedFoods.length === 0) {
      Alert.alert('Error', 'Por favor, introduce un nombre o selecciona una receta/alimento');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const mealName = name.trim() || selectedRecipe?.name || selectedFoods.map(f => f.name).join(', ');
      
      const mealId = await insertRow('meals', {
        name: mealName,
        meal_type: mealType,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: notes.trim() || null,
      });

      // Add meal items if recipe or foods selected
      if (selectedRecipe) {
        await insertRow('meal_items', {
          meal_id: mealId,
          recipe_id: selectedRecipe.id,
          food_id: null,
          quantity: 1,
          unit: 'porción',
        });
      }

      for (const food of selectedFoods) {
        await insertRow('meal_items', {
          meal_id: mealId,
          food_id: food.id,
          recipe_id: null,
          quantity: 1,
          unit: food.serving_size || 'porción',
        });
      }

      Alert.alert('¡Guardado!', 'Comida registrada correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const getFodmapColor = (level: string) => {
    switch (level) {
      case 'low': return colors.fodmapLow;
      case 'medium': return colors.fodmapMedium;
      case 'high': return colors.fodmapHigh;
      default: return colors.textMuted;
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Recipe/Food Search */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
            Buscar receta o alimento
          </Text>
          {(selectedRecipe || selectedFoods.length > 0) && (
            <Pressable onPress={() => {
              setSelectedRecipe(null);
              setSelectedFoods([]);
              setName('');
            }}>
              <Text style={{ fontSize: 12, color: colors.error }}>Limpiar</Text>
            </Pressable>
          )}
        </View>
        
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.cardElevated,
          borderRadius: 10,
          paddingHorizontal: 12,
        }}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSearch(text.length > 0);
            }}
            onFocus={() => setShowSearch(true)}
            placeholder="Buscar recetas o alimentos..."
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              fontSize: 15,
              color: colors.text,
              padding: 12,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(''); setShowSearch(false); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Search Results */}
        {showSearch && (searchQuery.length > 0 || recipes.length > 0 || foods.length > 0) && (
          <View style={{ marginTop: 12, maxHeight: 200 }}>
            {/* Recipes */}
            {filteredRecipes.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>
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
                      backgroundColor: colors.cardElevated,
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Ionicons name="book" size={16} color={colors.primary} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{recipe.name}</Text>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getFodmapColor(recipe.fodmap_level),
                    }} />
                  </Pressable>
                ))}
              </>
            )}

            {/* Foods (Alimentos) */}
            {filteredFoods.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginTop: 8 }}>
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
                      backgroundColor: selectedFoods.find(f => f.id === food.id) 
                        ? colors.primary + '20' 
                        : colors.cardElevated,
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Ionicons name="nutrition" size={16} color={getFodmapColor(food.fodmap_level)} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{food.name}</Text>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getFodmapColor(food.fodmap_level),
                    }} />
                  </Pressable>
                ))}
              </>
            )}

            {filteredRecipes.length === 0 && filteredFoods.length === 0 && searchQuery.length > 0 && (
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 16 }}>
                No se encontraron resultados
              </Text>
            )}
          </View>
        )}

        {/* Selected items */}
        {(selectedRecipe || selectedFoods.length > 0) && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>
              SELECCIONADOS
            </Text>
            {selectedRecipe && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 10,
                backgroundColor: colors.primary + '15',
                borderRadius: 8,
                marginBottom: 6,
                borderWidth: 1,
                borderColor: colors.primary + '30',
              }}>
                <Ionicons name="book" size={16} color={colors.primary} style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' }}>
                  {selectedRecipe.name}
                </Text>
                <Pressable onPress={() => { setSelectedRecipe(null); setName(''); }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            )}
            {selectedFoods.map((food) => (
              <View
                key={`selected-${food.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  backgroundColor: getFodmapColor(food.fodmap_level) + '15',
                  borderRadius: 8,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: getFodmapColor(food.fodmap_level) + '30',
                }}
              >
                <Ionicons name="nutrition" size={16} color={getFodmapColor(food.fodmap_level)} style={{ marginRight: 10 }} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{food.name}</Text>
                <Pressable onPress={() => handleRemoveFood(food.id)}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Custom Name (if not using recipe) */}
      {!selectedRecipe && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
            Nombre de la comida {selectedFoods.length > 0 ? '(opcional)' : ''}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={selectedFoods.length > 0 ? 'Se usarán los alimentos seleccionados' : 'Ej: Ensalada de pollo'}
            placeholderTextColor={colors.textMuted}
            style={{
              fontSize: 16,
              color: colors.text,
              padding: 12,
              backgroundColor: colors.cardElevated,
              borderRadius: 10,
            }}
          />
        </Card>
      )}

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Tipo de comida
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setMealType(type)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: mealType === type ? colors.primary : colors.cardElevated,
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: mealType === type ? '#FFFFFF' : colors.textSecondary,
              }}>
                {MEAL_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
          Notas (opcional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade notas adicionales..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{
            fontSize: 15,
            color: colors.text,
            padding: 12,
            backgroundColor: colors.cardElevated,
            borderRadius: 10,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar comida
      </Button>
    </View>
  );
}

// Symptom Form
function SymptomForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const [symptomType, setSymptomType] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Timestamp fields
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));
  
  // Cause/correlation fields
  const [selectedTreatment, setSelectedTreatment] = useState<number | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<number | null>(null);
  const [stressType, setStressType] = useState<'personal' | 'professional' | 'other' | null>(null);
  const [stressNotes, setStressNotes] = useState('');
  
  // Data for dropdowns
  const [treatments, setTreatments] = useState<{ id: number; name: string }[]>([]);
  const [meals, setMeals] = useState<{ id: number; name: string; date: string; time: string }[]>([]);

  React.useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    try {
      const db = await getDatabase();
      
      // Load recent treatments
      const treatmentsData = await db.getAllAsync<{ id: number; name: string }>(
        'SELECT id, name FROM treatments WHERE is_active = 1 ORDER BY name'
      );
      setTreatments(treatmentsData || []);
      
      // Load recent meals (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const mealsData = await db.getAllAsync<{ id: number; name: string; date: string; time: string }>(
        `SELECT id, name, date, time FROM meals WHERE date >= ? ORDER BY date DESC, time DESC LIMIT 20`,
        [sevenDaysAgo.toISOString().split('T')[0]]
      );
      setMeals(mealsData || []);
    } catch (error) {
      console.error('Error loading dropdown data:', error);
    }
  };

  const handleSave = async () => {
    if (!symptomType) {
      Alert.alert('Error', 'Por favor, selecciona un tipo de síntoma');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const logDate = useCurrentTime ? now.toISOString().split('T')[0] : customDate;
      const logTime = useCurrentTime ? now.toTimeString().slice(0, 5) : customTime;
      
      await insertRow('symptoms', {
        type: symptomType,
        intensity,
        date: logDate,
        time: logTime,
        notes: notes.trim() || null,
        treatment_id: selectedTreatment || null,
        meal_id: selectedMeal || null,
        stress_type: stressType || null,
        stress_notes: (stressType === 'other' && stressNotes.trim()) ? stressNotes.trim() : null,
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
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: symptomType === type ? '#FFFFFF' : colors.textSecondary,
              }}>
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
                  ? level <= 3 ? colors.fodmapLow 
                    : level <= 6 ? colors.fodmapMedium 
                    : colors.fodmapHigh
                  : colors.cardElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: '600',
                color: intensity >= level ? '#FFFFFF' : colors.textMuted,
              }}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Timestamp */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          ¿Cuándo apareció el síntoma?
        </Text>
        
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: useCurrentTime ? 0 : 14 }}>
          <Pressable
            onPress={() => setUseCurrentTime(true)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: useCurrentTime ? colors.symptom : colors.cardElevated,
            }}
          >
            <Ionicons 
              name="time" 
              size={18} 
              color={useCurrentTime ? '#FFFFFF' : colors.textSecondary} 
            />
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: useCurrentTime ? '#FFFFFF' : colors.textSecondary,
            }}>
              Ahora mismo
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setUseCurrentTime(false)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: !useCurrentTime ? colors.symptom : colors.cardElevated,
            }}
          >
            <Ionicons 
              name="calendar" 
              size={18} 
              color={!useCurrentTime ? '#FFFFFF' : colors.textSecondary} 
            />
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: !useCurrentTime ? '#FFFFFF' : colors.textSecondary,
            }}>
              Otra hora
            </Text>
          </Pressable>
        </View>

        {!useCurrentTime && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                Fecha
              </Text>
              <TextInput
                value={customDate}
                onChangeText={setCustomDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                Hora
              </Text>
              <TextInput
                value={customTime}
                onChangeText={setCustomTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Possible Causes / Correlation */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Posible causa o correlación (opcional)
        </Text>
        
        {/* Treatment */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            ¿Relacionado con un medicamento?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => setSelectedTreatment(null)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: selectedTreatment === null ? colors.cardElevated : colors.card,
                borderWidth: 1,
                borderColor: selectedTreatment === null ? colors.border : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                Ninguno
              </Text>
            </Pressable>
            {treatments.map((treatment) => (
              <Pressable
                key={treatment.id}
                onPress={() => setSelectedTreatment(treatment.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: selectedTreatment === treatment.id ? colors.treatment : colors.cardElevated,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selectedTreatment === treatment.id ? '#FFFFFF' : colors.textSecondary,
                }}>
                  {treatment.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Meal */}
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            ¿Relacionado con una comida?
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable
              onPress={() => setSelectedMeal(null)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: selectedMeal === null ? colors.cardElevated : colors.card,
                borderWidth: 1,
                borderColor: selectedMeal === null ? colors.border : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                Ninguna
              </Text>
            </Pressable>
            {meals.slice(0, 10).map((meal) => (
              <Pressable
                key={meal.id}
                onPress={() => setSelectedMeal(meal.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: selectedMeal === meal.id ? colors.primary : colors.cardElevated,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selectedMeal === meal.id ? '#FFFFFF' : colors.textSecondary,
                }}>
                  {meal.name || 'Comida'} {meal.date}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stress */}
        <View>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
            ¿Relacionado con estrés?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: stressType === 'other' ? 10 : 0 }}>
            <Pressable
              onPress={() => setStressType(stressType === 'personal' ? null : 'personal')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 12,
                borderRadius: 12,
                backgroundColor: stressType === 'personal' ? '#E91E63' : colors.cardElevated,
              }}
            >
              <Ionicons 
                name={stressType === 'personal' ? 'heart' : 'heart-outline'} 
                size={16} 
                color={stressType === 'personal' ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: stressType === 'personal' ? '#FFFFFF' : colors.textSecondary,
              }}>
                Personal
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStressType(stressType === 'professional' ? null : 'professional')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 12,
                borderRadius: 12,
                backgroundColor: stressType === 'professional' ? '#FF9800' : colors.cardElevated,
              }}
            >
              <Ionicons 
                name={stressType === 'professional' ? 'briefcase' : 'briefcase-outline'} 
                size={16} 
                color={stressType === 'professional' ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: stressType === 'professional' ? '#FFFFFF' : colors.textSecondary,
              }}>
                Profesional
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStressType(stressType === 'other' ? null : 'other')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 12,
                borderRadius: 12,
                backgroundColor: stressType === 'other' ? '#9C27B0' : colors.cardElevated,
              }}
            >
              <Ionicons 
                name={stressType === 'other' ? 'ellipse' : 'ellipse-outline'} 
                size={16} 
                color={stressType === 'other' ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: stressType === 'other' ? '#FFFFFF' : colors.textSecondary,
              }}>
                Otro
              </Text>
            </Pressable>
          </View>
          {stressType === 'other' && (
            <TextInput
              value={stressNotes}
              onChangeText={setStressNotes}
              placeholder="Especifica el motivo..."
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 14,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                marginTop: 8,
              }}
            />
          )}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
          Notas (opcional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade notas adicionales..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{
            fontSize: 15,
            color: colors.text,
            padding: 12,
            backgroundColor: colors.cardElevated,
            borderRadius: 10,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar síntoma
      </Button>
    </View>
  );
}

// Bowel Movement Form
function BowelForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
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
        date: now.toISOString().split('T')[0],
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
              <Text style={{ fontSize: 24, marginRight: 12 }}>
                {BRISTOL_SCALE[type].emoji}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: '600', 
                  color: bristolType === type ? colors.bowel : colors.text,
                }}>
                  {BRISTOL_SCALE[type].name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {BRISTOL_SCALE[type].description}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Urgencia: {urgency}/5
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((level) => (
            <Pressable
              key={level}
              onPress={() => setUrgency(level)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: urgency >= level ? colors.warning : colors.cardElevated,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: urgency >= level ? '#FFFFFF' : colors.textMuted,
              }}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
          Dolor: {pain}/10
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
            <Pressable
              key={level}
              onPress={() => setPain(level)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: pain >= level && level > 0
                  ? level <= 3 ? colors.fodmapLow 
                    : level <= 6 ? colors.fodmapMedium 
                    : colors.fodmapHigh
                  : colors.cardElevated,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{
                fontSize: 11,
                fontWeight: '600',
                color: pain >= level && level > 0 ? '#FFFFFF' : colors.textMuted,
              }}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
          Notas (opcional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Añade notas adicionales..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={{
            fontSize: 15,
            color: colors.text,
            padding: 12,
            backgroundColor: colors.cardElevated,
            borderRadius: 10,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
        />
      </Card>

      <Button onPress={handleSave} loading={loading} fullWidth size="lg">
        Guardar deposición
      </Button>
    </View>
  );
}

// Treatment Form - Two blocks: My treatments + Quick entry
function TreatmentForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  
  // Data
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [todayLogs, setTodayLogs] = useState<TreatmentLog[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  
  // Quick entry modal
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customDate, setCustomDate] = useState(today);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const DOSAGE_UNITS = ['mg', 'g', 'ml', 'gotas', 'comprimido', 'cápsula', 'cucharada', 'sobre'];

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const [treatmentsData, logsData] = await Promise.all([
        db.getAllAsync<Treatment>('SELECT * FROM treatments WHERE is_active = 1 ORDER BY name'),
        db.getAllAsync<TreatmentLog>(`SELECT * FROM treatment_logs WHERE date = ? ORDER BY time DESC`, [today])
      ]);
      setTreatments(treatmentsData);
      setTodayLogs(logsData);
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
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().slice(0, 5),
        taken: 1,
        skipped: 0,
        amount_taken: treatment.dosage_amount,
        unit: treatment.dosage_unit,
      });
      Alert.alert('¡Guardado!', `Toma de ${treatment.name} registrada`);
      loadData();
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
      const logDate = useCurrentTime ? now.toISOString().split('T')[0] : customDate;
      const logTime = useCurrentTime ? now.toTimeString().slice(0, 5) : customTime;
      
      // Quick entry - create or find treatment
      const existing = await (db as any).getFirstAsync(
        'SELECT id FROM treatments WHERE name = ?',
        [quickName.trim()]
      );
      
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
        date: logDate,
        time: logTime,
        taken: 1,
        skipped: 0,
        amount_taken: parseFloat(dosageAmount) || null,
        unit: dosageAmount.trim() ? dosageUnit : null,
        notes: notes.trim() || null,
      });

      Alert.alert('¡Guardado!', `Toma de ${quickName.trim()} registrada`);
      setShowQuickModal(false);
      resetQuickForm();
      loadData();
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const resetQuickForm = () => {
    setQuickName('');
    setDosageAmount('');
    setDosageUnit('mg');
    setUseCurrentTime(true);
    setNotes('');
  };

  const getTodayLogsForTreatment = (treatmentId: number) => {
    return todayLogs.filter(log => log.treatment_id === treatmentId);
  };

  return (
    <View style={{ gap: 20 }}>
      {/* BLOCK 1: My Treatments */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.treatment + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="medical" size={20} color={colors.treatment} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Mis Tratamientos
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Registra tomas de tus tratamientos activos
              </Text>
            </View>
          </View>
        </View>

        {/* Today's quick log for each treatment */}
        {loadingTreatments ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={colors.treatment} />
          </View>
        ) : treatments.length === 0 ? (
          <View style={{ 
            padding: 24, 
            alignItems: 'center', 
            backgroundColor: colors.cardElevated,
            borderRadius: 12,
          }}>
            <Ionicons name="medical-outline" size={32} color={colors.textMuted} />
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
              No tienes tratamientos activos
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {treatments.slice(0, 5).map((treatment) => {
              const logsToday = getTodayLogsForTreatment(treatment.id);
              return (
                <View 
                  key={treatment.id} 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 12,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {treatment.name}
                    </Text>
                    {treatment.dosage_amount && (
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {treatment.dosage_amount} {treatment.dosage_unit}
                      </Text>
                    )}
                    {logsToday.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.fodmapLow} />
                        <Text style={{ fontSize: 11, color: colors.fodmapLow }}>
                          {logsToday.length} toma{logsToday.length !== 1 ? 's' : ''} hoy
                        </Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleQuickLogTreatment(treatment)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      backgroundColor: colors.treatment,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                      + Toma
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Create new treatment button */}
        <Pressable
          onPress={() => router.push('/treatment/new')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
            marginTop: 12,
            backgroundColor: colors.treatment + '15',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.treatment + '30',
            borderStyle: 'dashed',
            gap: 8,
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.treatment} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.treatment }}>
            Crear nuevo tratamiento
          </Text>
        </Pressable>

        {/* Link to manage all treatments */}
        <Pressable
          onPress={() => router.push('/treatment')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            marginTop: 8,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            Ver todos mis tratamientos
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* BLOCK 2: Quick Entry */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#8B5CF6' + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="flash" size={20} color="#8B5CF6" />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              Toma Puntual
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Registra una toma rápida sin crear tratamiento
            </Text>
          </View>
        </View>

        {/* Today's quick logs */}
        {todayLogs.filter(log => !log.treatment_id || !treatments.find(t => t.id === log.treatment_id)).length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              Tomas puntuales de hoy:
            </Text>
            <View style={{ gap: 6 }}>
              {todayLogs.filter(log => !log.treatment_id || !treatments.find(t => t.id === log.treatment_id)).slice(0, 3).map((log) => (
                <View 
                  key={log.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 8,
                    gap: 8,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={14} color={colors.fodmapLow} />
                  <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>
                    {log.treatment_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {log.time}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick entry button */}
        <Pressable
          onPress={() => setShowQuickModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: '#8B5CF6',
            borderRadius: 12,
            gap: 10,
          }}
        >
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
            Registrar toma puntual
          </Text>
        </Pressable>
      </View>

      {/* Quick Entry Modal */}
      <Modal
        visible={showQuickModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQuickModal(false)}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          justifyContent: 'flex-end' 
        }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '90%',
          }}>
            {/* Modal Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Toma Puntual
              </Text>
              <Pressable onPress={() => setShowQuickModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16, paddingBottom: 32 }}>
                {/* Treatment name */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Medicamento / Suplemento
                  </Text>
                  <TextInput
                    value={quickName}
                    onChangeText={setQuickName}
                    placeholder="Ej: Ibuprofeno, Vitamina D..."
                    placeholderTextColor={colors.textMuted}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 14,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                    }}
                  />
                </View>

                {/* Dosage */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Dosis (opcional)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      value={dosageAmount}
                      onChangeText={setDosageAmount}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        width: 80,
                        fontSize: 20,
                        fontWeight: '700',
                        color: colors.text,
                        padding: 14,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 12,
                        textAlign: 'center',
                      }}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {DOSAGE_UNITS.map(unit => (
                        <Pressable
                          key={unit}
                          onPress={() => setDosageUnit(unit)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 14,
                            borderRadius: 12,
                            backgroundColor: dosageUnit === unit ? '#8B5CF6' : colors.cardElevated,
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: dosageUnit === unit ? '#FFFFFF' : colors.textSecondary,
                          }}>
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Timestamp */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    ¿Cuándo?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => setUseCurrentTime(true)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: useCurrentTime ? '#8B5CF6' : colors.cardElevated,
                      }}
                    >
                      <Ionicons name="time" size={16} color={useCurrentTime ? '#FFFFFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: useCurrentTime ? '#FFFFFF' : colors.textSecondary }}>
                        Ahora
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setUseCurrentTime(false)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: !useCurrentTime ? '#8B5CF6' : colors.cardElevated,
                      }}
                    >
                      <Ionicons name="calendar" size={16} color={!useCurrentTime ? '#FFFFFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !useCurrentTime ? '#FFFFFF' : colors.textSecondary }}>
                        Otra hora
                      </Text>
                    </Pressable>
                  </View>
                  {!useCurrentTime && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TextInput
                        value={customDate}
                        onChangeText={setCustomDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 10,
                          textAlign: 'center',
                        }}
                      />
                      <TextInput
                        value={customTime}
                        onChangeText={setCustomTime}
                        placeholder="HH:MM"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 10,
                          textAlign: 'center',
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Notes */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Notas (opcional)
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Observaciones..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      minHeight: 60,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Save button */}
                <Button 
                  onPress={handleSaveQuickEntry} 
                  loading={loading} 
                  fullWidth 
                  size="lg"
                  disabled={!quickName.trim()}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                      Registrar toma
                    </Text>
                  </View>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Activity Form - Two blocks: My workouts + Quick entry
function ActivityForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  
  // Data
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [todayLogs, setTodayLogs] = useState<ActivityLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Quick entry modal
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [duration, setDuration] = useState('30');
  const [intensity, setIntensity] = useState(5);
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customDate, setCustomDate] = useState(today);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));
  const [loading, setLoading] = useState(false);

  const activityColor = '#FF9800';

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const [scheduled, types, logs] = await Promise.all([
        db.getAllAsync<ScheduledActivity>('SELECT * FROM scheduled_activities WHERE is_active = 1 ORDER BY name'),
        db.getAllAsync<ActivityType>('SELECT * FROM activity_types ORDER BY usage_count DESC, name ASC'),
        db.getAllAsync<ActivityLog>(`SELECT al.*, at.name as activity_name, at.icon, at.color 
          FROM activity_logs al 
          LEFT JOIN activity_types at ON al.activity_type_id = at.id 
          WHERE al.date = ? ORDER BY al.time DESC`, [today])
      ]);
      setScheduledActivities(scheduled);
      setActivityTypes(types);
      setTodayLogs(logs);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleQuickLogScheduled = async (scheduled: ScheduledActivity) => {
    setLoading(true);
    try {
      const now = new Date();
      
      // Find activity type
      const actType = activityTypes.find(t => t.id === scheduled.activity_type_id);
      
      // Log the activity
      await insertRow('activity_logs', {
        activity_type_id: scheduled.activity_type_id,
        scheduled_activity_id: scheduled.id,
        duration_minutes: scheduled.duration_minutes || 30,
        intensity: 5,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().slice(0, 5),
      });
      
      // Mark as completed in scheduled_activity_logs
      await insertRow('scheduled_activity_logs', {
        scheduled_activity_id: scheduled.id,
        date: now.toISOString().split('T')[0],
        status: 'completed',
        actual_duration_minutes: scheduled.duration_minutes || 30,
      });

      Alert.alert('¡Guardado!', `${scheduled.name} completado`);
      loadData();
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar la actividad');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickEntry = async () => {
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
      const logDate = useCurrentTime ? now.toISOString().split('T')[0] : customDate;
      const logTime = useCurrentTime ? now.toTimeString().slice(0, 5) : customTime;
      let activityTypeId: number;

      if (showCustom && customName.trim()) {
        const result = await db.runAsync(
          'INSERT INTO activity_types (name, icon, color, is_custom, usage_count) VALUES (?, ?, ?, 1, 1)',
          [customName.trim(), 'fitness', '#FF9800']
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
        distance_km: distance ? parseFloat(distance) : null,
        calories: calories ? parseInt(calories) : null,
        date: logDate,
        time: logTime,
        notes: notes.trim() || null,
      });

      Alert.alert('¡Guardado!', 'Actividad registrada correctamente');
      setShowQuickModal(false);
      resetQuickForm();
      loadData();
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const resetQuickForm = () => {
    setSelectedType(null);
    setCustomName('');
    setShowCustom(false);
    setDuration('30');
    setIntensity(5);
    setDistance('');
    setCalories('');
    setNotes('');
    setUseCurrentTime(true);
  };

  return (
    <View style={{ gap: 20 }}>
      {/* BLOCK 1: My Workouts / Scheduled Activities */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: activityColor + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="fitness" size={20} color={activityColor} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Mis Entrenamientos
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                Programas de ejercicio activos
              </Text>
            </View>
          </View>
        </View>

        {/* Today's activities from scheduled */}
        {loadingData ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={activityColor} />
          </View>
        ) : scheduledActivities.length === 0 ? (
          <View style={{ 
            padding: 24, 
            alignItems: 'center', 
            backgroundColor: colors.cardElevated,
            borderRadius: 12,
          }}>
            <Ionicons name="barbell-outline" size={32} color={colors.textMuted} />
            <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
              No tienes entrenamientos programados
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {scheduledActivities.slice(0, 5).map((scheduled) => {
              const actType = activityTypes.find(t => t.id === scheduled.activity_type_id);
              const todayCompleted = todayLogs.some(log => log.scheduled_activity_id === scheduled.id);
              return (
                <View 
                  key={scheduled.id} 
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: todayCompleted ? colors.fodmapLow + '15' : colors.cardElevated,
                    borderRadius: 12,
                    gap: 12,
                    borderWidth: todayCompleted ? 1 : 0,
                    borderColor: colors.fodmapLow + '30',
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: (actType?.color || activityColor) + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons 
                      name={(actType?.icon || 'fitness') as any} 
                      size={18} 
                      color={actType?.color || activityColor} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {scheduled.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {scheduled.duration_minutes} min · {scheduled.frequency}
                    </Text>
                    {todayCompleted && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="checkmark-circle" size={12} color={colors.fodmapLow} />
                        <Text style={{ fontSize: 11, color: colors.fodmapLow }}>
                          Completado hoy
                        </Text>
                      </View>
                    )}
                  </View>
                  {!todayCompleted && (
                    <Pressable
                      onPress={() => handleQuickLogScheduled(scheduled)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        backgroundColor: activityColor,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>
                        Completar
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Create new workout program */}
        <Pressable
          onPress={() => router.push('/activity/schedule')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 14,
            marginTop: 12,
            backgroundColor: activityColor + '15',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: activityColor + '30',
            borderStyle: 'dashed',
            gap: 8,
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={activityColor} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: activityColor }}>
            Crear programa de entrenamiento
          </Text>
        </Pressable>

        {/* Link to manage all workouts */}
        <Pressable
          onPress={() => router.push('/activity')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            marginTop: 8,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
            Ver todos mis entrenamientos
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* BLOCK 2: Quick Activity Entry */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#10B981' + '20',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="flash" size={20} color="#10B981" />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              Actividad Puntual
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              Registra cualquier actividad física rápidamente
            </Text>
          </View>
        </View>

        {/* Today's quick logs */}
        {todayLogs.filter(log => !log.scheduled_activity_id).length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              Actividades de hoy:
            </Text>
            <View style={{ gap: 6 }}>
              {todayLogs.filter(log => !log.scheduled_activity_id).slice(0, 3).map((log: any) => (
                <View 
                  key={log.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 10,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 8,
                    gap: 8,
                  }}
                >
                  <Ionicons name={(log.icon || 'fitness') as any} size={14} color={log.color || activityColor} />
                  <Text style={{ fontSize: 13, color: colors.text, flex: 1 }}>
                    {log.activity_name || 'Actividad'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {log.duration_minutes}min · {log.time}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quick entry button */}
        <Pressable
          onPress={() => setShowQuickModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backgroundColor: '#10B981',
            borderRadius: 12,
            gap: 10,
          }}
        >
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>
            Registrar actividad
          </Text>
        </Pressable>
      </View>

      {/* Quick Entry Modal */}
      <Modal
        visible={showQuickModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQuickModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '92%',
          }}>
            {/* Modal Header */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Actividad Puntual
              </Text>
              <Pressable onPress={() => setShowQuickModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16, paddingBottom: 32 }}>
                {/* Activity Type */}
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                      {showCustom ? 'Actividad personalizada' : 'Tipo de actividad'}
                    </Text>
                    <Pressable onPress={() => setShowCustom(!showCustom)}>
                      <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>
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
                      style={{
                        fontSize: 16,
                        color: colors.text,
                        padding: 14,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 12,
                      }}
                    />
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
                          <Ionicons 
                            name={type.icon as any} 
                            size={14} 
                            color={selectedType?.id === type.id ? '#FFFFFF' : type.color} 
                          />
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '600',
                            color: selectedType?.id === type.id ? '#FFFFFF' : colors.textSecondary,
                          }}>
                            {type.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Duration and Distance */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                      Duración (min)
                    </Text>
                    <TextInput
                      value={duration}
                      onChangeText={setDuration}
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.text,
                        padding: 12,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                      Distancia (km)
                    </Text>
                    <TextInput
                      value={distance}
                      onChangeText={setDistance}
                      placeholder="—"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.text,
                        padding: 12,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}
                    />
                  </View>
                </View>

                {/* Intensity */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
                    Intensidad: {intensity}/10
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
                    {INTENSITY_LABELS[intensity]}
                  </Text>
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
                            ? level <= 3 ? colors.fodmapLow 
                              : level <= 6 ? activityColor 
                              : colors.fodmapHigh
                            : colors.cardElevated,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: intensity >= level ? '#FFFFFF' : colors.textMuted,
                        }}>
                          {level}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Timestamp */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    ¿Cuándo?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => setUseCurrentTime(true)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: useCurrentTime ? '#10B981' : colors.cardElevated,
                      }}
                    >
                      <Ionicons name="time" size={16} color={useCurrentTime ? '#FFFFFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: useCurrentTime ? '#FFFFFF' : colors.textSecondary }}>
                        Ahora
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setUseCurrentTime(false)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: !useCurrentTime ? '#10B981' : colors.cardElevated,
                      }}
                    >
                      <Ionicons name="calendar" size={16} color={!useCurrentTime ? '#FFFFFF' : colors.textSecondary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: !useCurrentTime ? '#FFFFFF' : colors.textSecondary }}>
                        Otra hora
                      </Text>
                    </Pressable>
                  </View>
                  {!useCurrentTime && (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <TextInput
                        value={customDate}
                        onChangeText={setCustomDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 10,
                          textAlign: 'center',
                        }}
                      />
                      <TextInput
                        value={customTime}
                        onChangeText={setCustomTime}
                        placeholder="HH:MM"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 10,
                          textAlign: 'center',
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Calories */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Calorías (opcional)
                  </Text>
                  <TextInput
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="Ej: 200"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                </View>

                {/* Notes */}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Notas (opcional)
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Cómo te sentiste, detalles..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      minHeight: 60,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Save button */}
                <Button 
                  onPress={handleSaveQuickEntry} 
                  loading={loading} 
                  fullWidth 
                  size="lg"
                  disabled={!selectedType && !customName.trim()}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                      Guardar actividad
                    </Text>
                  </View>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
