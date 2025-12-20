import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button, FODMAPBadge, ImagePickerButton } from '@/components/ui';
import { getDatabase, insertRow, updateRow, deleteRow, getRowById } from '@/lib/database';
import { 
  FODMAPLevel, 
  Recipe, 
  RecipeStep,
  RecipeIngredient,
  RecipeDifficulty,
  MealType,
  DIFFICULTY_LABELS,
  MEAL_TYPE_LABELS,
  Food,
} from '@/lib/types';

interface LocalStep {
  id?: number;
  order: number;
  title?: string;
  instruction: string;
  duration_minutes?: number;
}

interface LocalIngredient {
  id?: number;
  food_id?: number;
  name: string;
  quantity: number;
  unit: string;
  fodmap_level?: FODMAPLevel;
  notes?: string;
  optional?: boolean;
}

export default function RecipeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('4');
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>('easy');
  const [cuisine, setCuisine] = useState('');
  const [notes, setNotes] = useState('');
  
  // FODMAP
  const [fodmapLevel, setFodmapLevel] = useState<FODMAPLevel>('low');
  
  // Meal types
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  
  // Steps
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<LocalStep | null>(null);
  const [stepInstruction, setStepInstruction] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [stepDuration, setStepDuration] = useState('');
  
  // Ingredients
  const [ingredients, setIngredients] = useState<LocalIngredient[]>([]);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<LocalIngredient | null>(null);
  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState('');
  const [ingredientNotes, setIngredientNotes] = useState('');
  const [ingredientOptional, setIngredientOptional] = useState(false);
  const [ingredientFodmap, setIngredientFodmap] = useState<FODMAPLevel>('low');
  
  // Food search
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [availableFoods, setAvailableFoods] = useState<Food[]>([]);
  
  // Image
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // External recipe reference
  const [isExternal, setIsExternal] = useState(false);
  const [originalRecipeId, setOriginalRecipeId] = useState<number | null>(null);
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);
  const [isInternal, setIsInternal] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'ingredients' | 'steps'>('basic');

  useEffect(() => {
    loadFoods();
    if (!isNew && id) {
      loadRecipe();
    }
  }, [id]);

  const loadFoods = async () => {
    try {
      const db = await getDatabase();
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setAvailableFoods(foodsData as Food[]);
    } catch (error) {
      console.error('Error loading foods:', error);
    }
  };

  const loadRecipe = async () => {
    try {
      const db = await getDatabase();
      const recipe = await getRowById<Recipe>('recipes', parseInt(id!));
      
      if (recipe) {
        setName(recipe.name);
        setDescription(recipe.description || '');
        setPrepTime(recipe.prep_time?.toString() || '');
        setCookTime(recipe.cook_time?.toString() || '');
        setServings(recipe.servings?.toString() || '4');
        setDifficulty(recipe.difficulty || 'easy');
        setCuisine(recipe.cuisine || '');
        setNotes(recipe.notes || '');
        setFodmapLevel(recipe.fodmap_level);
        setImageUri(recipe.image_uri || null);
        setIsInternal(recipe.source === 'internal');
        setIsExternal(recipe.source === 'external' || !!recipe.original_recipe_id);
        setOriginalRecipeId(recipe.original_recipe_id || null);
        
        // Parse meal types
        if (recipe.meal_types) {
          try {
            const types = typeof recipe.meal_types === 'string' 
              ? JSON.parse(recipe.meal_types) 
              : recipe.meal_types;
            setMealTypes(types);
          } catch (e) {}
        }
        
        // Load steps
        const stepsData = await db.getAllAsync(
          'SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order ASC',
          [parseInt(id!)]
        );
        setSteps(stepsData.map((s: any) => ({
          id: s.id,
          order: s.step_order,
          title: s.title,
          instruction: s.instruction,
          duration_minutes: s.duration_minutes,
        })));
        
        // Load ingredients
        const ingredientsData = await db.getAllAsync(
          'SELECT * FROM recipe_ingredients WHERE recipe_id = ?',
          [parseInt(id!)]
        );
        setIngredients(ingredientsData.map((i: any) => ({
          id: i.id,
          food_id: i.food_id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          fodmap_level: i.fodmap_level,
          notes: i.notes,
          optional: i.is_optional === 1,
        })));
        
        // Load original recipe if this is a modified copy
        if (recipe.original_recipe_id) {
          const original = await getRowById<Recipe>('recipes', recipe.original_recipe_id);
          setOriginalRecipe(original);
        }
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
      Alert.alert('Error', 'No se pudo cargar la receta');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor, introduce un nombre');
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      
      const data: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        prep_time: prepTime ? parseInt(prepTime) : null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : 4,
        difficulty,
        cuisine: cuisine.trim() || null,
        notes: notes.trim() || null,
        fodmap_level: fodmapLevel,
        meal_types: mealTypes.length > 0 ? JSON.stringify(mealTypes) : null,
        image_uri: imageUri,
        source: 'user',
      };

      let recipeId: number;
      
      if (isNew) {
        recipeId = await insertRow('recipes', data);
      } else {
        recipeId = parseInt(id!);
        await updateRow('recipes', recipeId, data);
        
        // Delete existing steps and ingredients to re-insert
        await db.runAsync('DELETE FROM recipe_steps WHERE recipe_id = ?', [recipeId]);
        await db.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
      }
      
      // Insert steps
      for (const step of steps) {
        await db.runAsync(
          `INSERT INTO recipe_steps (recipe_id, step_order, title, instruction, duration_minutes)
           VALUES (?, ?, ?, ?, ?)`,
          [recipeId, step.order, step.title || null, step.instruction, step.duration_minutes || null]
        );
      }
      
      // Insert ingredients
      for (const ing of ingredients) {
        await db.runAsync(
          `INSERT INTO recipe_ingredients (recipe_id, food_id, name, quantity, unit, fodmap_level, notes, is_optional)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [recipeId, ing.food_id || null, ing.name, ing.quantity, ing.unit, ing.fodmap_level || null, ing.notes || null, ing.optional ? 1 : 0]
        );
      }
      
      Alert.alert('¡Guardado!', isNew ? 'Receta añadida correctamente' : 'Receta actualizada correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'No se pudo guardar la receta');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (isInternal) {
      Alert.alert('No permitido', 'Las recetas de la base de datos FODMAP no pueden eliminarse');
      return;
    }
    
    Alert.alert(
      'Eliminar receta',
      '¿Estás seguro de que quieres eliminar esta receta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRow('recipes', parseInt(id!));
              Alert.alert('Eliminado', 'Receta eliminada correctamente');
              router.back();
            } catch (error) {
              console.error('Error deleting recipe:', error);
              Alert.alert('Error', 'No se pudo eliminar la receta');
            }
          },
        },
      ]
    );
  };

  const handleCreateCopy = async () => {
    // Create an editable copy of an internal/external recipe
    try {
      const db = await getDatabase();
      
      const copyData = {
        name: `${name} (Mi versión)`,
        description,
        prep_time: prepTime ? parseInt(prepTime) : null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : 4,
        difficulty,
        cuisine,
        notes,
        fodmap_level: fodmapLevel,
        meal_types: mealTypes.length > 0 ? JSON.stringify(mealTypes) : null,
        source: 'user',
        original_recipe_id: parseInt(id!),
        is_modified_copy: 1,
      };
      
      const newId = await insertRow('recipes', copyData);
      
      // Copy steps
      for (const step of steps) {
        await db.runAsync(
          `INSERT INTO recipe_steps (recipe_id, step_order, title, instruction, duration_minutes)
           VALUES (?, ?, ?, ?, ?)`,
          [newId, step.order, step.title || null, step.instruction, step.duration_minutes || null]
        );
      }
      
      // Copy ingredients
      for (const ing of ingredients) {
        await db.runAsync(
          `INSERT INTO recipe_ingredients (recipe_id, food_id, name, quantity, unit, fodmap_level, notes, is_optional)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, ing.food_id || null, ing.name, ing.quantity, ing.unit, ing.fodmap_level || null, ing.notes || null, ing.optional ? 1 : 0]
        );
      }
      
      Alert.alert('¡Copiado!', 'Se ha creado una copia editable de esta receta');
      router.replace(`/recipe/${newId}`);
    } catch (error) {
      console.error('Error creating copy:', error);
      Alert.alert('Error', 'No se pudo crear la copia');
    }
  };

  const handleViewOriginal = () => {
    if (originalRecipeId) {
      router.push(`/recipe/${originalRecipeId}`);
    }
  };

  // Step management
  const openStepModal = (step?: LocalStep) => {
    if (step) {
      setEditingStep(step);
      setStepInstruction(step.instruction);
      setStepTitle(step.title || '');
      setStepDuration(step.duration_minutes?.toString() || '');
    } else {
      setEditingStep(null);
      setStepInstruction('');
      setStepTitle('');
      setStepDuration('');
    }
    setShowStepModal(true);
  };

  const saveStep = () => {
    if (!stepInstruction.trim()) {
      Alert.alert('Error', 'Introduce la instrucción del paso');
      return;
    }
    
    if (editingStep) {
      setSteps(steps.map(s => 
        s.order === editingStep.order 
          ? { ...s, instruction: stepInstruction.trim(), title: stepTitle.trim() || undefined, duration_minutes: stepDuration ? parseInt(stepDuration) : undefined }
          : s
      ));
    } else {
      const newStep: LocalStep = {
        order: steps.length + 1,
        instruction: stepInstruction.trim(),
        title: stepTitle.trim() || undefined,
        duration_minutes: stepDuration ? parseInt(stepDuration) : undefined,
      };
      setSteps([...steps, newStep]);
    }
    
    setShowStepModal(false);
  };

  const deleteStep = (order: number) => {
    setSteps(steps.filter(s => s.order !== order).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (order: number, direction: 'up' | 'down') => {
    const index = steps.findIndex(s => s.order === order);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return;
    
    const newSteps = [...steps];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[swapIndex]] = [newSteps[swapIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  // Ingredient management
  const openIngredientModal = (ingredient?: LocalIngredient) => {
    if (ingredient) {
      setEditingIngredient(ingredient);
      setIngredientName(ingredient.name);
      setIngredientQuantity(ingredient.quantity.toString());
      setIngredientUnit(ingredient.unit);
      setIngredientNotes(ingredient.notes || '');
      setIngredientOptional(ingredient.optional || false);
      setIngredientFodmap(ingredient.fodmap_level || 'low');
    } else {
      setEditingIngredient(null);
      setIngredientName('');
      setIngredientQuantity('');
      setIngredientUnit('g');
      setIngredientNotes('');
      setIngredientOptional(false);
      setIngredientFodmap('low');
    }
    setShowIngredientModal(true);
  };

  const saveIngredient = () => {
    if (!ingredientName.trim()) {
      Alert.alert('Error', 'Introduce el nombre del ingrediente');
      return;
    }
    if (!ingredientQuantity.trim()) {
      Alert.alert('Error', 'Introduce la cantidad');
      return;
    }
    
    const newIngredient: LocalIngredient = {
      name: ingredientName.trim(),
      quantity: parseFloat(ingredientQuantity),
      unit: ingredientUnit.trim() || 'g',
      fodmap_level: ingredientFodmap,
      notes: ingredientNotes.trim() || undefined,
      optional: ingredientOptional,
    };
    
    if (editingIngredient) {
      setIngredients(ingredients.map(i => 
        i === editingIngredient ? { ...i, ...newIngredient } : i
      ));
    } else {
      setIngredients([...ingredients, newIngredient]);
    }
    
    // Auto-calculate overall FODMAP level
    const allLevels = [...ingredients.map(i => i.fodmap_level), ingredientFodmap];
    if (allLevels.includes('high')) setFodmapLevel('high');
    else if (allLevels.includes('medium')) setFodmapLevel('medium');
    
    setShowIngredientModal(false);
  };

  const deleteIngredient = (ingredient: LocalIngredient) => {
    setIngredients(ingredients.filter(i => i !== ingredient));
  };

  const selectFood = (food: Food) => {
    setIngredientName(food.name);
    setIngredientFodmap(food.fodmap_level || 'low');
    if (food.serving_size) {
      // Try to parse serving size
      const match = food.serving_size.match(/(\d+)/);
      if (match) setIngredientQuantity(match[1]);
    }
    setShowFoodSearch(false);
    setFoodSearchQuery('');
  };

  const filteredFoods = availableFoods.filter(f => 
    f.name.toLowerCase().includes(foodSearchQuery.toLowerCase())
  );

  // Toggle meal type
  const toggleMealType = (type: MealType) => {
    if (mealTypes.includes(type)) {
      setMealTypes(mealTypes.filter(t => t !== type));
    } else {
      setMealTypes([...mealTypes, type]);
    }
  };

  // Components
  const SectionTab = ({ section, label, icon, count }: { section: typeof activeSection; label: string; icon: string; count?: number }) => (
    <Pressable
      onPress={() => setActiveSection(section)}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: activeSection === section ? colors.primary : 'transparent',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons 
        name={icon as any} 
        size={16} 
        color={activeSection === section ? colors.primary : colors.textSecondary} 
      />
      <Text style={{
        fontSize: 12,
        fontWeight: '600',
        color: activeSection === section ? colors.primary : colors.textSecondary,
      }}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={{
          backgroundColor: activeSection === section ? colors.primary : colors.textMuted,
          borderRadius: 10,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 10, color: '#FFF', fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </Pressable>
  );

  const FODMAPOption = ({ level, label }: { level: FODMAPLevel; label: string }) => (
    <Pressable
      onPress={() => !isInternal && setFodmapLevel(level)}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: fodmapLevel === level 
          ? level === 'low' ? colors.fodmapLow + '20'
            : level === 'medium' ? colors.fodmapMedium + '20'
            : colors.fodmapHigh + '20'
          : colors.cardElevated,
        borderWidth: 2,
        borderColor: fodmapLevel === level
          ? level === 'low' ? colors.fodmapLow
            : level === 'medium' ? colors.fodmapMedium
            : colors.fodmapHigh
          : 'transparent',
        alignItems: 'center',
        opacity: isInternal ? 0.7 : 1,
      }}
    >
      <FODMAPBadge level={level} size="sm" />
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nueva receta' : (isInternal ? 'Ver receta' : 'Editar receta'),
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Info Banner */}
        {(isInternal || originalRecipeId) && (
          <View style={{
            backgroundColor: isInternal ? colors.primary + '15' : colors.fodmapMedium + '15',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Ionicons name="information-circle" size={20} color={isInternal ? colors.primary : colors.fodmapMedium} />
            <Text style={{ flex: 1, fontSize: 12, color: isInternal ? colors.primary : colors.fodmapMedium }}>
              {isInternal 
                ? 'Receta de la base de datos FODMAP (solo lectura)'
                : 'Esta es una copia editada de otra receta'}
            </Text>
            {isInternal && (
              <Pressable 
                onPress={handleCreateCopy}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>Crear copia</Text>
              </Pressable>
            )}
            {originalRecipeId && (
              <Pressable 
                onPress={handleViewOriginal}
                style={{
                  backgroundColor: colors.fodmapMedium,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFF' }}>Ver original</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Section Tabs */}
        <View style={{ 
          flexDirection: 'row', 
          borderBottomWidth: 1, 
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <SectionTab section="basic" label="Básico" icon="information-circle-outline" />
          <SectionTab section="ingredients" label="Ingredientes" icon="nutrition-outline" count={ingredients.length} />
          <SectionTab section="steps" label="Pasos" icon="list-outline" count={steps.length} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        >
          {/* Basic Section */}
          {activeSection === 'basic' && (
            <>
              {/* Image */}
              <Animated.View entering={FadeInDown.delay(50).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <ImagePickerButton
                    imageUri={imageUri}
                    onImageSelected={setImageUri}
                    height={160}
                    placeholder="Añadir foto de la receta"
                    disabled={isInternal}
                  />
                </Card>
              </Animated.View>

              {/* Name */}
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Nombre *
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ej: Arroz con pollo, Ensalada..."
                    placeholderTextColor={colors.textMuted}
                    editable={!isInternal}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                </Card>
              </Animated.View>

              {/* Description */}
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Descripción
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Breve descripción de la receta..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={2}
                    editable={!isInternal}
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
              </Animated.View>

              {/* Times & Servings */}
              <Animated.View entering={FadeInDown.delay(200).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Tiempos y porciones
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Prep. (min)</Text>
                      <TextInput
                        value={prepTime}
                        onChangeText={setPrepTime}
                        placeholder="15"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        editable={!isInternal}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 10,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          textAlign: 'center',
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Cocción (min)</Text>
                      <TextInput
                        value={cookTime}
                        onChangeText={setCookTime}
                        placeholder="30"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        editable={!isInternal}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 10,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          textAlign: 'center',
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Porciones</Text>
                      <TextInput
                        value={servings}
                        onChangeText={setServings}
                        placeholder="4"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        editable={!isInternal}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 10,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          textAlign: 'center',
                        }}
                      />
                    </View>
                  </View>
                </Card>
              </Animated.View>

              {/* Difficulty */}
              <Animated.View entering={FadeInDown.delay(250).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Dificultad
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['easy', 'medium', 'hard'] as RecipeDifficulty[]).map(d => (
                      <Pressable
                        key={d}
                        onPress={() => !isInternal && setDifficulty(d)}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 8,
                          backgroundColor: difficulty === d ? colors.primary + '20' : colors.cardElevated,
                          borderWidth: 2,
                          borderColor: difficulty === d ? colors.primary : 'transparent',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: difficulty === d ? colors.primary : colors.textSecondary }}>
                          {DIFFICULTY_LABELS[d]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {/* FODMAP Level */}
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Nivel FODMAP
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <FODMAPOption level="low" label="Bajo" />
                    <FODMAPOption level="medium" label="Medio" />
                    <FODMAPOption level="high" label="Alto" />
                  </View>
                </Card>
              </Animated.View>

              {/* Meal Types */}
              <Animated.View entering={FadeInDown.delay(350).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Tipo de comida
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map(type => (
                      <Pressable
                        key={type}
                        onPress={() => !isInternal && toggleMealType(type)}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 14,
                          borderRadius: 20,
                          backgroundColor: mealTypes.includes(type) ? colors.primary + '20' : colors.cardElevated,
                          borderWidth: 2,
                          borderColor: mealTypes.includes(type) ? colors.primary : 'transparent',
                        }}
                      >
                        <Text style={{ 
                          fontSize: 12, 
                          fontWeight: '600', 
                          color: mealTypes.includes(type) ? colors.primary : colors.textSecondary 
                        }}>
                          {MEAL_TYPE_LABELS[type]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(400).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Notas adicionales
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Consejos, variaciones, información extra..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    editable={!isInternal}
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                  />
                </Card>
              </Animated.View>
            </>
          )}

          {/* Ingredients Section */}
          {activeSection === 'ingredients' && (
            <>
              {/* Add Ingredient Button */}
              {!isInternal && (
                <Animated.View entering={FadeInDown.delay(50).springify()}>
                  <Pressable
                    onPress={() => openIngredientModal()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 14,
                      backgroundColor: colors.primary + '15',
                      borderRadius: 12,
                      marginBottom: 16,
                      gap: 8,
                      borderWidth: 2,
                      borderColor: colors.primary + '30',
                      borderStyle: 'dashed',
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                      Añadir ingrediente
                    </Text>
                  </Pressable>
                </Animated.View>
              )}

              {/* Ingredients List */}
              {ingredients.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="nutrition-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>
                    No hay ingredientes añadidos
                  </Text>
                </View>
              ) : (
                ingredients.map((ing, index) => (
                  <Animated.View
                    key={`${ing.name}-${index}`}
                    entering={FadeInRight.delay(index * 50).springify()}
                    layout={Layout.springify()}
                  >
                    <Card style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ 
                          width: 10, 
                          height: 10, 
                          borderRadius: 5, 
                          backgroundColor: ing.fodmap_level === 'low' ? colors.fodmapLow 
                            : ing.fodmap_level === 'medium' ? colors.fodmapMedium 
                            : ing.fodmap_level === 'high' ? colors.fodmapHigh 
                            : colors.textMuted,
                          marginRight: 12,
                        }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                            {ing.name}
                            {ing.optional && <Text style={{ color: colors.textMuted }}> (opcional)</Text>}
                          </Text>
                          <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                            {ing.quantity} {ing.unit}
                            {ing.notes && ` • ${ing.notes}`}
                          </Text>
                        </View>
                        {!isInternal && (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable onPress={() => openIngredientModal(ing)}>
                              <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => deleteIngredient(ing)}>
                              <Ionicons name="trash-outline" size={18} color={colors.error} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </Card>
                  </Animated.View>
                ))
              )}
            </>
          )}

          {/* Steps Section */}
          {activeSection === 'steps' && (
            <>
              {/* Add Step Button */}
              {!isInternal && (
                <Animated.View entering={FadeInDown.delay(50).springify()}>
                  <Pressable
                    onPress={() => openStepModal()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 14,
                      backgroundColor: colors.primary + '15',
                      borderRadius: 12,
                      marginBottom: 16,
                      gap: 8,
                      borderWidth: 2,
                      borderColor: colors.primary + '30',
                      borderStyle: 'dashed',
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                      Añadir paso
                    </Text>
                  </Pressable>
                </Animated.View>
              )}

              {/* Steps List */}
              {steps.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Ionicons name="list-outline" size={48} color={colors.textMuted} />
                  <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 12 }}>
                    No hay pasos añadidos
                  </Text>
                </View>
              ) : (
                steps.map((step, index) => (
                  <Animated.View
                    key={step.order}
                    entering={FadeInRight.delay(index * 50).springify()}
                    layout={Layout.springify()}
                  >
                    <Card style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <View style={{ 
                          width: 28, 
                          height: 28, 
                          borderRadius: 14, 
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>{step.order}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          {step.title && (
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
                              {step.title}
                            </Text>
                          )}
                          <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
                            {step.instruction}
                          </Text>
                          {step.duration_minutes && (
                            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                              ⏱ {step.duration_minutes} min
                            </Text>
                          )}
                        </View>
                        {!isInternal && (
                          <View style={{ gap: 6 }}>
                            <Pressable onPress={() => moveStep(step.order, 'up')}>
                              <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.textMuted : colors.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => moveStep(step.order, 'down')}>
                              <Ionicons name="chevron-down" size={18} color={index === steps.length - 1 ? colors.textMuted : colors.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => openStepModal(step)}>
                              <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                            </Pressable>
                            <Pressable onPress={() => deleteStep(step.order)}>
                              <Ionicons name="trash-outline" size={16} color={colors.error} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </Card>
                  </Animated.View>
                ))
              )}
            </>
          )}
        </ScrollView>

        {/* Save Button */}
        {!isInternal && (
          <View style={{ 
            padding: 16, 
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
            <Button onPress={handleSave} loading={loading} fullWidth size="lg">
              {isNew ? 'Añadir receta' : 'Guardar cambios'}
            </Button>

            {!isNew && (
              <Pressable
                onPress={handleDelete}
                style={{ alignItems: 'center', marginTop: 12 }}
              >
                <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
                  Eliminar receta
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Step Modal */}
      <Modal
        visible={showStepModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStepModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ 
            backgroundColor: colors.surface, 
            borderTopLeftRadius: 20, 
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {editingStep ? 'Editar paso' : 'Nuevo paso'}
              </Text>
              <Pressable onPress={() => setShowStepModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Título de la sección (opcional)
              </Text>
              <TextInput
                value={stepTitle}
                onChangeText={setStepTitle}
                placeholder="Ej: Preparación, Cocción..."
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              />

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Instrucción *
              </Text>
              <TextInput
                value={stepInstruction}
                onChangeText={setStepInstruction}
                placeholder="Describe qué hacer en este paso..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  marginBottom: 16,
                }}
              />

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Duración (minutos, opcional)
              </Text>
              <TextInput
                value={stepDuration}
                onChangeText={setStepDuration}
                placeholder="5"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  marginBottom: 20,
                }}
              />

              <Button onPress={saveStep} fullWidth size="lg">
                {editingStep ? 'Guardar cambios' : 'Añadir paso'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ingredient Modal */}
      <Modal
        visible={showIngredientModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIngredientModal(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ 
            backgroundColor: colors.surface, 
            borderTopLeftRadius: 20, 
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: '90%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                {editingIngredient ? 'Editar ingrediente' : 'Nuevo ingrediente'}
              </Text>
              <Pressable onPress={() => setShowIngredientModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView>
              {/* Food Search */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Buscar en alimentos
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                paddingHorizontal: 12,
                marginBottom: 8,
              }}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={foodSearchQuery}
                  onChangeText={setFoodSearchQuery}
                  onFocus={() => setShowFoodSearch(true)}
                  placeholder="Buscar alimento..."
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: colors.text,
                    padding: 10,
                  }}
                />
              </View>

              {showFoodSearch && foodSearchQuery.length > 0 && (
                <View style={{ maxHeight: 150, marginBottom: 12 }}>
                  <ScrollView>
                    {filteredFoods.slice(0, 5).map(food => (
                      <Pressable
                        key={food.id}
                        onPress={() => selectFood(food)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 10,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          marginBottom: 4,
                        }}
                      >
                        <View style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: 4, 
                          backgroundColor: food.fodmap_level === 'low' ? colors.fodmapLow 
                            : food.fodmap_level === 'medium' ? colors.fodmapMedium 
                            : colors.fodmapHigh,
                          marginRight: 10,
                        }} />
                        <Text style={{ fontSize: 14, color: colors.text }}>{food.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8 }}>
                Nombre *
              </Text>
              <TextInput
                value={ingredientName}
                onChangeText={setIngredientName}
                placeholder="Ej: Pollo, Arroz..."
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Cantidad *
                  </Text>
                  <TextInput
                    value={ingredientQuantity}
                    onChangeText={setIngredientQuantity}
                    placeholder="100"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Unidad
                  </Text>
                  <TextInput
                    value={ingredientUnit}
                    onChangeText={setIngredientUnit}
                    placeholder="g"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                </View>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Nivel FODMAP
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {(['low', 'medium', 'high'] as FODMAPLevel[]).map(level => (
                  <Pressable
                    key={level}
                    onPress={() => setIngredientFodmap(level)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: ingredientFodmap === level 
                        ? level === 'low' ? colors.fodmapLow + '20'
                          : level === 'medium' ? colors.fodmapMedium + '20'
                          : colors.fodmapHigh + '20'
                        : colors.cardElevated,
                      borderWidth: 2,
                      borderColor: ingredientFodmap === level
                        ? level === 'low' ? colors.fodmapLow
                          : level === 'medium' ? colors.fodmapMedium
                          : colors.fodmapHigh
                        : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: level === 'low' ? colors.fodmapLow
                        : level === 'medium' ? colors.fodmapMedium
                        : colors.fodmapHigh,
                    }} />
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Notas (opcional)
              </Text>
              <TextInput
                value={ingredientNotes}
                onChangeText={setIngredientNotes}
                placeholder="Sin piel, picado fino..."
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              />

              <Pressable
                onPress={() => setIngredientOptional(!ingredientOptional)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: ingredientOptional ? colors.primary : colors.border,
                  backgroundColor: ingredientOptional ? colors.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {ingredientOptional && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={{ fontSize: 14, color: colors.text }}>Ingrediente opcional</Text>
              </Pressable>

              <Button onPress={saveIngredient} fullWidth size="lg">
                {editingIngredient ? 'Guardar cambios' : 'Añadir ingrediente'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
