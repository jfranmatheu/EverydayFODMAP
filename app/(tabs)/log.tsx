import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { 
  FadeInDown,
  FadeInRight,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button } from '@/components/ui';
import { insertRow, getDatabase } from '@/lib/database';
import { SYMPTOM_TYPES, BRISTOL_SCALE, BristolType, MEAL_TYPE_LABELS, MealType, ActivityType, INTENSITY_LABELS } from '@/lib/types';

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

  const handleSave = async () => {
    if (!symptomType) {
      Alert.alert('Error', 'Por favor, selecciona un tipo de síntoma');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      await insertRow('symptoms', {
        type: symptomType,
        intensity,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
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

// Treatment Form (simplified - direct quick entry)
function TreatmentForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const router = useRouter();
  
  // Quick entry fields
  const [quickName, setQuickName] = useState('');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  
  // Timestamp fields
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const DOSAGE_UNITS = ['mg', 'g', 'ml', 'gotas', 'comprimido', 'cápsula', 'cucharada', 'sobre'];

  const handleSaveQuickEntry = async () => {
    // Validation for quick entry
    if (!quickName.trim()) {
      Alert.alert('Error', 'Por favor, introduce el nombre del tratamiento');
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      
      // Determine date/time
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

      // Log the treatment
      await insertRow('treatment_logs', {
        treatment_id: treatmentId,
        treatment_name: quickName.trim(),
        scheduled_time: null,
        dose_index: null,
        date: logDate,
        time: logTime,
        taken: 1,
        skipped: 0,
        amount_taken: parseFloat(dosageAmount) || null,
        unit: dosageAmount.trim() ? dosageUnit : null,
        notes: notes.trim() || null,
      });

      Alert.alert('¡Guardado!', `Toma de ${quickName.trim()} registrada`);
      onSuccess();
    } catch (error) {
      console.error('Error saving treatment:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Header: Manage treatments button */}
      <Pressable
        onPress={() => router.push('/treatment')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 14,
          backgroundColor: colors.treatment + '15',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.treatment + '30',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="medical" size={20} color={colors.treatment} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.treatment }}>
            Gestionar mis tratamientos
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.treatment} />
      </Pressable>

      {/* Title */}
      <View style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>
          Registrar Toma Puntual
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
          Registra una toma de medicamento o suplemento
        </Text>
      </View>

      {/* Treatment name */}
          <Card>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Datos del medicamento
            </Text>
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                Nombre del medicamento / suplemento
              </Text>
              <TextInput
                value={quickName}
                onChangeText={setQuickName}
                placeholder="Ej: Ibuprofeno, Omeprazol, Vitamina D..."
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

            {/* Dosage amount + unit */}
            <View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                Dosis tomada (opcional)
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
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {DOSAGE_UNITS.map(unit => (
                    <Pressable
                      key={unit}
                      onPress={() => setDosageUnit(unit)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: dosageUnit === unit ? colors.treatment : colors.cardElevated,
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
          </Card>

          {/* Timestamp */}
          <Card>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              ¿Cuándo tomaste la dosis?
            </Text>
            
            {/* Quick options */}
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
                  backgroundColor: useCurrentTime ? colors.treatment : colors.cardElevated,
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
                  backgroundColor: !useCurrentTime ? colors.treatment : colors.cardElevated,
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

            {/* Custom date/time inputs */}
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

          {/* Notes */}
          <Card>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Notas (opcional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Efectos, motivo de la toma, observaciones..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
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
          </Card>

          {/* Summary & Save */}
          <View style={{ 
            backgroundColor: colors.treatment + '10', 
            borderRadius: 14, 
            padding: 16, 
            borderWidth: 1,
            borderColor: colors.treatment + '20',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Ionicons name="checkmark-circle" size={22} color={colors.treatment} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Resumen del registro
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, color: colors.text }}>
                <Text style={{ fontWeight: '700' }}>
                  {quickName.trim() || 'Sin nombre'}
                </Text>
                {dosageAmount.trim() && (
                  <Text style={{ color: colors.textSecondary }}>
                    {' '}· {dosageAmount} {dosageUnit}
                  </Text>
                )}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                {'  '}
                {useCurrentTime 
                  ? 'Ahora mismo' 
                  : `${customDate} a las ${customTime}`}
              </Text>
            </View>
          </View>

          <Button 
            onPress={handleSaveQuickEntry} 
            loading={loading} 
            fullWidth 
            size="lg"
            disabled={!quickName.trim()}
            style={{ marginTop: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                Registrar toma
              </Text>
            </View>
          </Button>
    </View>
  );
}

// Activity Form
function ActivityForm({ colors, onSuccess }: { colors: any; onSuccess: () => void }) {
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState('30');
  const [intensity, setIntensity] = useState(5);
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [recommendations, setRecommendations] = useState<ActivityType[]>([]);

  React.useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const db = await getDatabase();
      const types = await db.getAllAsync<ActivityType>(
        'SELECT * FROM activity_types ORDER BY usage_count DESC, name ASC'
      );
      setActivityTypes(types);
      
      // Get top 3 most used as recommendations
      const topUsed = types.filter(t => t.usage_count > 0).slice(0, 3);
      setRecommendations(topUsed);
    } catch (error) {
      console.error('Error loading activity types:', error);
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
        // Create new custom activity type
        const result = await db.runAsync(
          'INSERT INTO activity_types (name, icon, color, is_custom, usage_count) VALUES (?, ?, ?, 1, 1)',
          [customName.trim(), 'fitness', '#FF9800']
        );
        activityTypeId = result.lastInsertRowId;
      } else if (selectedType) {
        activityTypeId = selectedType.id;
        // Update usage count
        await db.runAsync(
          'UPDATE activity_types SET usage_count = usage_count + 1 WHERE id = ?',
          [activityTypeId]
        );
      } else {
        Alert.alert('Error', 'Por favor, selecciona una actividad');
        setLoading(false);
        return;
      }

      // Insert activity log
      await insertRow('activity_logs', {
        activity_type_id: activityTypeId,
        duration_minutes: parseInt(duration),
        intensity,
        distance_km: distance ? parseFloat(distance) : null,
        calories: calories ? parseInt(calories) : null,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
        notes: notes.trim() || null,
      });

      Alert.alert('¡Guardado!', 'Actividad registrada correctamente');
      onSuccess();
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'No se pudo guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const activityColor = '#FF9800';

  return (
    <View style={{ gap: 16 }}>
      {/* Recommendations */}
      {recommendations.length > 0 && !showCustom && (
        <Card>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
            ⭐ Recomendadas (tus más frecuentes)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {recommendations.map((type) => (
              <Pressable
                key={type.id}
                onPress={() => setSelectedType(type)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: selectedType?.id === type.id ? type.color : colors.cardElevated,
                  gap: 6,
                }}
              >
                <Ionicons 
                  name={type.icon as any} 
                  size={16} 
                  color={selectedType?.id === type.id ? '#FFFFFF' : type.color} 
                />
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: selectedType?.id === type.id ? '#FFFFFF' : colors.text,
                }}>
                  {type.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      {/* Activity Type Selection */}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
            Tipo de actividad
          </Text>
          <Pressable onPress={() => setShowCustom(!showCustom)}>
            <Text style={{ fontSize: 13, color: activityColor, fontWeight: '600' }}>
              {showCustom ? 'Ver lista' : '+ Personalizada'}
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
              padding: 12,
              backgroundColor: colors.cardElevated,
              borderRadius: 10,
            }}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {activityTypes.map((type) => (
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
      </Card>

      {/* Duration and Intensity */}
      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Duración (min)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                textAlign: 'center',
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Distancia (km)
            </Text>
            <TextInput
              value={distance}
              onChangeText={setDistance}
              placeholder="Opcional"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={{
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                textAlign: 'center',
              }}
            />
          </View>
        </View>
      </Card>

      {/* Intensity */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>
          Intensidad: {intensity}/10
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
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
      </Card>

      {/* Calories (optional) */}
      <Card>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
          Calorías quemadas (opcional)
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
      </Card>

      {/* Notes */}
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
        Guardar actividad
      </Button>
    </View>
  );
}
