import { Button, Card, FODMAPBadge, ImagePickerButton } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { deleteRow, getDatabase, getRowById, insertRow, updateRow } from '@/lib/database';
import {
  FODMAPDetails,
  FODMAPLevel,
  Food,
  FOOD_CATEGORIES,
  FoodCategory,
  NutriScore,
  NUTRISCORE_COLORS,
  NutritionInfo
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';

interface LocalComponent {
  id?: number;
  component_food_id?: number;
  name: string;
  quantity: number;
  unit: string;
  fodmap_level?: FODMAPLevel;
}

export default function FoodScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;
  const isNew = id === 'new';

  // Basic info
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('other');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [notes, setNotes] = useState('');
  const [brand, setBrand] = useState('');
  
  // FODMAP info
  const [fodmapLevel, setFodmapLevel] = useState<FODMAPLevel>('low');
  const [showDetailedFodmap, setShowDetailedFodmap] = useState(false);
  const [fodmapDetails, setFodmapDetails] = useState<Partial<FODMAPDetails>>({
    fructans: 'low',
    gos: 'low',
    lactose: 'low',
    fructose: 'low',
    sorbitol: 'low',
    mannitol: 'low',
  });
  const [safeServing, setSafeServing] = useState('');
  const [limitServing, setLimitServing] = useState('');
  
  // Nutrition info - always enabled for new foods
  const [showNutrition, setShowNutrition] = useState(true);
  const [nutrition, setNutrition] = useState<Partial<NutritionInfo>>({});
  const [nutriScore, setNutriScore] = useState<NutriScore>(null);
  
  // Tags and digestive effect
  const [tags, setTags] = useState<string[]>([]);
  const [digestiveEffect, setDigestiveEffect] = useState<number>(0);
  
  // Default tags
  const DEFAULT_TAGS = [
    'Sin gluten', 'Sin lactosa', 'Sin fructosa', 'Sin sorbitol', 'Sin marisco',
    'Vegano', 'Vegetariano', 'Sin azúcares añadidos', 'Sin edulcorantes',
    'Alto en fibra', 'Bajo en grasa', 'Rico en proteínas', 'Sin conservantes'
  ];
  
  // Components (always available)
  const [components, setComponents] = useState<LocalComponent[]>([]);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<LocalComponent | null>(null);
  const [componentName, setComponentName] = useState('');
  const [componentQuantity, setComponentQuantity] = useState('');
  const [componentUnit, setComponentUnit] = useState('g');
  const [componentFodmap, setComponentFodmap] = useState<FODMAPLevel>('low');
  
  // Food search for components
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [availableFoods, setAvailableFoods] = useState<Food[]>([]);
  
  // Image
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);
  const [isInternal, setIsInternal] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);

  useEffect(() => {
    loadAvailableFoods();
    if (!isNew && id) {
      loadFood();
    }
  }, [id]);

  const loadAvailableFoods = async () => {
    try {
      const db = await getDatabase();
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setAvailableFoods(foodsData as Food[]);
    } catch (error) {
      console.error('Error loading foods:', error);
    }
  };

  const loadFood = async () => {
    try {
      const db = await getDatabase();
      const food = await getRowById<Food>('foods', parseInt(id!));
      if (food) {
        setName(food.name);
        setCategory(food.category || 'other');
        setFodmapLevel(food.fodmap_level);
        
        // Parse serving size (format: "100 g" or "100g")
        if (food.serving_size) {
          const match = food.serving_size.match(/^([\d.,]+)\s*(.*)$/);
          if (match) {
            setServingSize(match[1]);
            setServingUnit(match[2] || 'g');
          } else {
            setServingSize(food.serving_size);
          }
        }
        
        setNotes(food.notes || '');
        setBrand(food.brand || '');
        setImageUri(food.image_uri || null);
        setIsInternal(food.source === 'internal');
        
        // Load components (always available, not just for compound foods)
        const componentsData = await db.getAllAsync(
          'SELECT * FROM food_components WHERE parent_food_id = ?',
          [parseInt(id!)]
        );
        
        setComponents((componentsData as any[]).map((c: any) => ({
          id: c.id,
          component_food_id: c.component_food_id,
          name: c.name || 'Ingrediente',
          quantity: c.quantity,
          unit: c.unit || 'g',
          fodmap_level: c.fodmap_level,
        })));
        
        // Parse FODMAP details
        if (food.fodmap_details) {
          try {
            const details = typeof food.fodmap_details === 'string' 
              ? JSON.parse(food.fodmap_details) 
              : food.fodmap_details;
            setFodmapDetails(details);
            setSafeServing(details.safe_serving || '');
            setLimitServing(details.limit_serving || '');
            setShowDetailedFodmap(true);
          } catch (e) {
            console.log('Error parsing fodmap_details:', e);
          }
        }
        
        // Parse nutrition
        if (food.nutrition) {
          try {
            const nutri = typeof food.nutrition === 'string'
              ? JSON.parse(food.nutrition)
              : food.nutrition;
            console.log('[FoodScreen] Parsed nutrition:', nutri);
            setNutrition(nutri);
            setShowNutrition(true);
          } catch (e) {
            console.log('Error parsing nutrition:', e);
          }
        } else {
          console.log('[FoodScreen] No nutrition data found for food:', food.name);
        }
        
        if (food.nutri_score) {
          setNutriScore(food.nutri_score as NutriScore);
        }
        
        // Parse tags
        if (food.tags) {
          try {
            const parsedTags = typeof food.tags === 'string' ? JSON.parse(food.tags) : food.tags;
            setTags(Array.isArray(parsedTags) ? parsedTags : []);
          } catch (e) {
            console.log('Error parsing tags:', e);
            setTags([]);
          }
        } else {
          setTags([]);
        }
        
        // Load digestive effect
        setDigestiveEffect((food as any).digestive_effect !== undefined && (food as any).digestive_effect !== null ? (food as any).digestive_effect : 0);
      }
    } catch (error) {
      console.error('Error loading food:', error);
      Alert.alert('Error', 'No se pudo cargar el alimento');
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
      
      // Build FODMAP details object
      const fullFodmapDetails: Partial<FODMAPDetails> | null = showDetailedFodmap ? {
        ...fodmapDetails,
        overall: fodmapLevel,
        safe_serving: safeServing || undefined,
        limit_serving: limitServing || undefined,
      } : null;
      
      const data: Record<string, any> = {
        name: name.trim(),
        category,
        fodmap_level: fodmapLevel,
        fodmap_details: fullFodmapDetails ? JSON.stringify(fullFodmapDetails) : null,
        serving_size: servingSize.trim() ? `${servingSize.trim()} ${servingUnit}` : null,
        notes: notes.trim() || null,
        brand: brand.trim() || null,
        nutrition: showNutrition && Object.keys(nutrition).length > 0 
          ? JSON.stringify(nutrition) 
          : null,
        nutri_score: nutriScore,
        is_compound: components.length > 0 ? 1 : 0,
        image_uri: imageUri,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        digestive_effect: digestiveEffect,
        source: 'user',
      };

      let foodId: number;
      
      if (isNew) {
        foodId = await insertRow('foods', data);
      } else {
        foodId = parseInt(id!);
        await updateRow('foods', foodId, data);
        
        // Delete existing components to re-insert
        await db.runAsync('DELETE FROM food_components WHERE parent_food_id = ?', [foodId]);
      }
      
      // Insert components (always, if any exist)
      if (components.length > 0) {
        for (const comp of components) {
          await db.runAsync(
            `INSERT INTO food_components (parent_food_id, component_food_id, name, quantity, unit, fodmap_level)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [foodId, comp.component_food_id || null, comp.name, comp.quantity, comp.unit, comp.fodmap_level || null]
          );
        }
      }
      
      Alert.alert('¡Guardado!', isNew ? 'Alimento añadido correctamente' : 'Alimento actualizado correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving food:', error);
      Alert.alert('Error', 'No se pudo guardar el alimento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (isInternal) {
      Alert.alert('No permitido', 'Los alimentos de la base de datos FODMAP no pueden eliminarse');
      return;
    }
    
    // Use window.confirm on web, Alert.alert on native
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('¿Estás seguro de que quieres eliminar este alimento?')
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            'Eliminar alimento',
            '¿Estás seguro de que quieres eliminar este alimento?',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (confirmed) {
      try {
        await deleteRow('foods', parseInt(id!));
        if (Platform.OS === 'web') {
          alert('Alimento eliminado correctamente');
        } else {
          Alert.alert('Eliminado', 'Alimento eliminado correctamente');
        }
        router.back();
      } catch (error) {
        console.error('Error deleting food:', error);
        Alert.alert('Error', 'No se pudo eliminar el alimento');
      }
    }
  };

  const updateFodmapDetail = (key: keyof FODMAPDetails, value: FODMAPLevel) => {
    setFodmapDetails(prev => ({ ...prev, [key]: value }));
    // Auto-calculate overall level
    const newDetails = { ...fodmapDetails, [key]: value };
    if (Object.values(newDetails).includes('high')) {
      setFodmapLevel('high');
    } else if (Object.values(newDetails).includes('medium')) {
      setFodmapLevel('medium');
    } else {
      setFodmapLevel('low');
    }
  };

  const updateNutrition = (key: keyof NutritionInfo, value: string) => {
    const numValue = parseFloat(value);
    if (value === '' || isNaN(numValue)) {
      const newNutrition = { ...nutrition };
      delete newNutrition[key];
      setNutrition(newNutrition);
    } else {
      setNutrition(prev => ({ ...prev, [key]: numValue }));
    }
  };

  // Component management
  const openComponentModal = (component?: LocalComponent) => {
    if (component) {
      setEditingComponent(component);
      setComponentName(component.name);
      setComponentQuantity(component.quantity.toString());
      setComponentUnit(component.unit || 'g');
      setComponentFodmap(component.fodmap_level || 'low');
    } else {
      setEditingComponent(null);
      setComponentName('');
      setComponentQuantity('');
      setComponentUnit('g');
      setComponentFodmap('low');
    }
    setShowComponentModal(true);
  };

  const saveComponent = () => {
    if (!componentName.trim()) {
      Alert.alert('Error', 'Introduce el nombre del ingrediente');
      return;
    }
    if (!componentQuantity.trim()) {
      Alert.alert('Error', 'Introduce la cantidad');
      return;
    }
    
    const newComponent: LocalComponent = {
      name: componentName.trim(),
      quantity: parseFloat(componentQuantity),
      unit: componentUnit.trim() || 'g',
      fodmap_level: componentFodmap,
    };
    
    if (editingComponent) {
      setComponents(components.map(c => 
        c === editingComponent ? { ...c, ...newComponent } : c
      ));
    } else {
      setComponents([...components, newComponent]);
    }
    
    // Auto-calculate overall FODMAP level based on components
    const allLevels = [...components.map(c => c.fodmap_level), componentFodmap].filter(Boolean);
    if (allLevels.includes('high')) setFodmapLevel('high');
    else if (allLevels.includes('medium')) setFodmapLevel('medium');
    
    setShowComponentModal(false);
  };

  const deleteComponent = (component: LocalComponent) => {
    setComponents(components.filter(c => c !== component));
  };

  const selectFoodForComponent = (food: Food) => {
    setComponentName(food.name);
    setComponentFodmap(food.fodmap_level || 'low');
    if (food.serving_size) {
      const match = food.serving_size.match(/(\d+)/);
      if (match) setComponentQuantity(match[1]);
    }
    setShowFoodSearch(false);
    setFoodSearchQuery('');
  };

  const filteredFoods = availableFoods.filter(f => 
    f.name.toLowerCase().includes(foodSearchQuery.toLowerCase()) &&
    f.id !== parseInt(id || '0') // Exclude current food
  );

  // Modern Nutrition Input Component
  const NutritionInput = ({ 
    label, 
    value, 
    unit, 
    field,
    icon,
    color = colors.primary,
    required = false,
  }: { 
    label: string; 
    value?: number; 
    unit: string; 
    field: keyof NutritionInfo;
    icon?: string;
    color?: string;
    required?: boolean;
  }) => (
    <View style={{ 
      flex: 1,
      backgroundColor: colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      minWidth: 100,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon && <Ionicons name={icon as any} size={14} color={color} />}
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
          {label}{required && ' *'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {isInternal ? (
          <Text style={{ 
            fontSize: 20, 
            fontWeight: '700', 
            color: value !== undefined ? colors.text : colors.textMuted,
          }}>
            {value !== undefined ? value : '-'}
          </Text>
        ) : (
          <TextInput
            value={value?.toString() || ''}
            onChangeText={(v) => updateNutrition(field, v)}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: colors.text,
              padding: 0,
              minWidth: 40,
            }}
          />
        )}
        <Text style={{ 
          fontSize: 12, 
          color: colors.textMuted,
          marginLeft: 4,
        }}>
          {unit}
        </Text>
      </View>
    </View>
  );
  
  // Custom Tag Input Component
  const CustomTagInput = ({ placeholder, onTagAdd }: { placeholder: string; onTagAdd: (tag: string) => void }) => {
    const [inputValue, setInputValue] = useState('');
    
    return (
      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={(e) => {
          const newTag = e.nativeEvent.text.trim();
          if (newTag) {
            onTagAdd(newTag);
            setInputValue('');
          }
        }}
        style={{
          fontSize: 13,
          color: colors.text,
          padding: 10,
          backgroundColor: colors.cardElevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
    );
  };

  // Nutrition Display Row (for read-only detailed view)
  const NutritionDisplayRow = ({ 
    label, 
    value, 
    unit,
    indented = false,
  }: { 
    label: string; 
    value?: number; 
    unit: string; 
    indented?: boolean;
  }) => (
    <View style={{ 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      paddingVertical: 8,
      paddingLeft: indented ? 20 : 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '50',
    }}>
      <Text style={{ 
        fontSize: 13, 
        color: indented ? colors.textSecondary : colors.text,
        fontWeight: indented ? '400' : '500',
      }}>
        {indented && '└ '}{label}
      </Text>
      <Text style={{ 
        fontSize: 13, 
        fontWeight: '600',
        color: value !== undefined ? colors.text : colors.textMuted,
      }}>
        {value !== undefined ? `${value} ${unit}` : '-'}
      </Text>
    </View>
  );

  // UI Components
  const FODMAPOption = ({ level, label, small }: { level: FODMAPLevel; label: string; small?: boolean }) => (
    <Pressable
      onPress={() => !isInternal && setFodmapLevel(level)}
      style={{
        flex: small ? undefined : 1,
        paddingVertical: small ? 8 : 12,
        paddingHorizontal: small ? 12 : 8,
        borderRadius: 10,
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
      <Text style={{
        fontSize: small ? 11 : 12,
        fontWeight: '600',
        color: fodmapLevel === level ? colors.text : colors.textSecondary,
        marginTop: 4,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const FODMAPDetailRow = ({ category, label }: { category: keyof FODMAPDetails; label: string }) => {
    const currentLevel = (fodmapDetails[category] as FODMAPLevel) || 'low';
    
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['low', 'medium', 'high'] as FODMAPLevel[]).map(level => (
            <Pressable
              key={level}
              onPress={() => !isInternal && updateFodmapDetail(category, level)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: currentLevel === level 
                  ? level === 'low' ? colors.fodmapLow + '20'
                    : level === 'medium' ? colors.fodmapMedium + '20'
                    : colors.fodmapHigh + '20'
                  : colors.cardElevated,
                borderWidth: 2,
                borderColor: currentLevel === level
                  ? level === 'low' ? colors.fodmapLow
                    : level === 'medium' ? colors.fodmapMedium
                    : colors.fodmapHigh
                  : 'transparent',
                alignItems: 'center',
                opacity: isInternal ? 0.7 : 1,
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
      </View>
    );
  };

  const CategoryOption = ({ cat }: { cat: typeof FOOD_CATEGORIES[number] }) => (
    <Pressable
      onPress={() => !isInternal && setCategory(cat.id)}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: category === cat.id ? colors.primary + '20' : colors.cardElevated,
        borderWidth: 2,
        borderColor: category === cat.id ? colors.primary : 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginRight: 8,
        marginBottom: 8,
        opacity: isInternal ? 0.7 : 1,
      }}
    >
      <Ionicons 
        name={cat.icon as any} 
        size={16} 
        color={category === cat.id ? colors.primary : colors.textSecondary} 
      />
      <Text style={{
        fontSize: 12,
        fontWeight: '600',
        color: category === cat.id ? colors.primary : colors.textSecondary,
      }}>
        {cat.label}
      </Text>
    </Pressable>
  );

  const NutriScoreOption = ({ score }: { score: NutriScore }) => (
    <Pressable
      onPress={() => !isInternal && setNutriScore(score)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: score ? NUTRISCORE_COLORS[score] : colors.cardElevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: nutriScore === score ? colors.text : 'transparent',
        opacity: isInternal ? 0.7 : 1,
      }}
    >
      <Text style={{ 
        fontSize: 18, 
        fontWeight: '800', 
        color: score ? '#FFFFFF' : colors.textMuted,
      }}>
        {score || '-'}
      </Text>
    </Pressable>
  );

  // Food Read View Component
  const FoodReadView = () => {
    const cat = FOOD_CATEGORIES.find(c => c.id === category);
    
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          padding: isLargeScreen ? 24 : 16, 
          paddingBottom: 100,
          maxWidth: isLargeScreen ? 1200 : undefined,
          alignSelf: isLargeScreen ? 'center' : undefined,
          width: isLargeScreen ? '100%' : undefined,
        }}
      >
        {/* Header Card */}
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {cat && (
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name={cat.icon as any} size={24} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                  {name}
                </Text>
                {brand && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {brand}
                  </Text>
                )}
              </View>
              <FODMAPBadge level={fodmapLevel} size="md" />
            </View>
            
            {/* Image */}
            {imageUri && (
              <View style={{ marginTop: 12, borderRadius: 12, overflow: 'hidden' }}>
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, resizeMode: 'cover' }} />
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Nutrition Card */}
        {showNutrition && Object.keys(nutrition).length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="nutrition" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                  Información Nutricional
                </Text>
                {servingSize && (
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto' }}>
                    por {servingSize} {servingUnit}
                  </Text>
                )}
              </View>

              {/* Calories Hero */}
              {nutrition.calories !== undefined && (
                <View style={{
                  backgroundColor: colors.primary + '10',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                  alignItems: 'center',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Ionicons name="flame" size={24} color={colors.primary} />
                    <Text style={{ fontSize: 32, fontWeight: '800', color: colors.primary }}>
                      {nutrition.calories}
                    </Text>
                    <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                      kcal
                    </Text>
                  </View>
                </View>
              )}

              {/* Macros Grid */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {nutrition.protein_g !== undefined && (
                  <View style={{ flex: 1, backgroundColor: colors.cardElevated, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Ionicons name="fish" size={18} color="#E91E63" />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 }}>
                      {nutrition.protein_g}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>g proteína</Text>
                  </View>
                )}
                {nutrition.carbs_g !== undefined && (
                  <View style={{ flex: 1, backgroundColor: colors.cardElevated, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Ionicons name="leaf" size={18} color="#FF9800" />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 }}>
                      {nutrition.carbs_g}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>g carbohidratos</Text>
                  </View>
                )}
                {nutrition.fat_g !== undefined && (
                  <View style={{ flex: 1, backgroundColor: colors.cardElevated, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Ionicons name="water" size={18} color="#2196F3" />
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 }}>
                      {nutrition.fat_g}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>g grasas</Text>
                  </View>
                )}
              </View>

              {/* Additional Info */}
              <View style={{ gap: 8 }}>
                {nutrition.fiber_g !== undefined && (
                  <NutritionDisplayRow label="Fibra" value={nutrition.fiber_g} unit="g" />
                )}
                {nutrition.sugars_g !== undefined && (
                  <NutritionDisplayRow label="Azúcares" value={nutrition.sugars_g} unit="g" />
                )}
                {nutrition.saturated_fat_g !== undefined && (
                  <NutritionDisplayRow label="Grasas saturadas" value={nutrition.saturated_fat_g} unit="g" />
                )}
                {nutrition.sodium_mg !== undefined && (
                  <NutritionDisplayRow label="Sodio" value={nutrition.sodium_mg} unit="mg" />
                )}
                {nutrition.cholesterol_mg !== undefined && (
                  <NutritionDisplayRow label="Colesterol" value={nutrition.cholesterol_mg} unit="mg" />
                )}
                {nutrition.potassium_mg !== undefined && (
                  <NutritionDisplayRow label="Potasio" value={nutrition.potassium_mg} unit="mg" />
                )}
                {nutrition.calcium_mg !== undefined && (
                  <NutritionDisplayRow label="Calcio" value={nutrition.calcium_mg} unit="mg" />
                )}
                {nutrition.iron_mg !== undefined && (
                  <NutritionDisplayRow label="Hierro" value={nutrition.iron_mg} unit="mg" />
                )}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* FODMAP Card */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: colors.fodmapLow + '15',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="leaf" size={16} color={colors.fodmapLow} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                Información FODMAP
              </Text>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Nivel general
              </Text>
              <FODMAPBadge level={fodmapLevel} size="md" />
            </View>

            {showDetailedFodmap && (
              <View style={{ gap: 8 }}>
                {fodmapDetails.fructans && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Fructanos</Text>
                    <FODMAPBadge level={fodmapDetails.fructans as FODMAPLevel} size="sm" />
                  </View>
                )}
                {fodmapDetails.gos && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>GOS</Text>
                    <FODMAPBadge level={fodmapDetails.gos as FODMAPLevel} size="sm" />
                  </View>
                )}
                {fodmapDetails.lactose && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Lactosa</Text>
                    <FODMAPBadge level={fodmapDetails.lactose as FODMAPLevel} size="sm" />
                  </View>
                )}
                {fodmapDetails.fructose && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Fructosa</Text>
                    <FODMAPBadge level={fodmapDetails.fructose as FODMAPLevel} size="sm" />
                  </View>
                )}
                {fodmapDetails.sorbitol && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Sorbitol</Text>
                    <FODMAPBadge level={fodmapDetails.sorbitol as FODMAPLevel} size="sm" />
                  </View>
                )}
                {fodmapDetails.mannitol && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>Manitol</Text>
                    <FODMAPBadge level={fodmapDetails.mannitol as FODMAPLevel} size="sm" />
                  </View>
                )}
                {(safeServing || limitServing) && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {safeServing && (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: colors.fodmapLow, fontWeight: '600', marginBottom: 4 }}>
                          🟢 Porción segura
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text }}>{safeServing}</Text>
                      </View>
                    )}
                    {limitServing && (
                      <View>
                        <Text style={{ fontSize: 12, color: colors.fodmapMedium, fontWeight: '600', marginBottom: 4 }}>
                          🟡 Porción límite
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.text }}>{limitServing}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Components Card */}
        {components.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="list" size={16} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                  Ingredientes
                </Text>
              </View>
              {components.map((comp, index) => (
                <View key={index} style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 10, 
                  paddingVertical: 8,
                  borderBottomWidth: index < components.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}>
                  <FODMAPBadge level={comp.fodmap_level || 'unknown'} size="sm" />
                  <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>
                    {comp.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {comp.quantity} {comp.unit}
                  </Text>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="pricetag" size={16} color={colors.primary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Etiquetas
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tags.map(tag => (
                  <View
                    key={tag}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      backgroundColor: colors.primary + '15',
                      borderWidth: 1,
                      borderColor: colors.primary + '30',
                    }}
                  >
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: colors.primary,
                    }}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Digestive Effect */}
        {digestiveEffect !== 0 && (
          <Animated.View entering={FadeInDown.delay(275).springify()}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="medical" size={16} color="#9C27B0" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Efecto Digestivo
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>Diarrea</Text>
                <View style={{ flexDirection: 'row', gap: 4, flex: 1, justifyContent: 'center' }}>
                  {[-2, -1, 0, 1, 2].map(value => (
                    <View
                      key={value}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: digestiveEffect === value 
                          ? (value < 0 ? colors.error : value > 0 ? '#FF9800' : colors.primary)
                          : 'transparent',
                        borderWidth: 2,
                        borderColor: digestiveEffect === value 
                          ? (value < 0 ? colors.error : value > 0 ? '#FF9800' : colors.primary)
                          : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: digestiveEffect === value ? '#FFFFFF' : colors.textMuted,
                      }}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '600' }}>Estreñimiento</Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
                {digestiveEffect < 0 ? `Puede empeorar diarrea (${Math.abs(digestiveEffect)})` :
                 digestiveEffect > 0 ? `Puede empeorar estreñimiento (+${digestiveEffect})` :
                 'Neutro'}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Notes */}
        {notes && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                  Notas
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
                {notes}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* Edit Button */}
        {!isInternal && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Button
              onPress={() => setIsEditing(true)}
              style={{ marginBottom: 16 }}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 8 }}>
                Editar alimento
              </Text>
            </Button>
          </Animated.View>
        )}
      </ScrollView>
    );
  };

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
          title: isNew ? 'Nuevo alimento' : (isEditing ? 'Editar alimento' : name || 'Ver alimento'),
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => !isNew && !isEditing && !isInternal ? (
            <Pressable
              onPress={() => setIsEditing(true)}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </Pressable>
          ) : !isNew && isEditing ? (
            <Pressable
              onPress={() => setIsEditing(false)}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="close-outline" size={24} color={colors.text} />
            </Pressable>
          ) : null,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {isInternal && !isEditing && (
          <View style={{
            backgroundColor: colors.primary + '15',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.primary }}>
              Alimento de la base de datos FODMAP (solo lectura)
            </Text>
          </View>
        )}

        {!isEditing && !isNew ? (
          <FoodReadView />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              padding: isLargeScreen ? 24 : 16, 
              paddingBottom: 100,
              maxWidth: isLargeScreen ? 1200 : undefined,
              alignSelf: isLargeScreen ? 'center' : undefined,
              width: isLargeScreen ? '100%' : undefined,
            }}
          >
            {/* Name */}
            <Animated.View entering={FadeInDown.delay(50).springify()}>
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16, marginBottom: 16 }}>
                <Card style={{ flex: 1, marginBottom: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Nombre *
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Ej: Arroz, Pollo, Zanahoria..."
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
                {/* Image - Next to name but separate */}
                <Card style={{ width: isLargeScreen ? 200 : '100%', marginBottom: 0 }}>
                  <ImagePickerButton
                    imageUri={imageUri}
                    onImageSelected={setImageUri}
                    height={isLargeScreen ? 120 : 200}
                  />
                </Card>
              </View>
            </Animated.View>

            {/* Category */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Card style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                  Categoría
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {FOOD_CATEGORIES.map(cat => (
                    <CategoryOption key={cat.id} cat={cat} />
                  ))}
                </View>
              </Card>
            </Animated.View>

            {/* Brand (for processed foods) */}
            {category === 'processed' && (
              <Animated.View entering={FadeInDown.delay(125).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Marca
                  </Text>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="Ej: Hacendado, Carrefour..."
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
              </Animated.View>
            )}
            {/* Row 1: Ingredients | Nutrition */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16, marginBottom: 16 }}>
                {/* Ingredients Section */}
                <Card style={isLargeScreen ? { flex: 1, marginBottom: 0 } : { marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: colors.primary + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="list" size={16} color={colors.primary} />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                        Ingredientes
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => openComponentModal()}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: colors.primary,
                        borderRadius: 8,
                      }}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  {components.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                      <Ionicons name="nutrition-outline" size={32} color={colors.textMuted} />
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>
                        No hay ingredientes añadidos
                      </Text>
                    </View>
                  ) : (
                    components.map((comp, index) => (
                      <Animated.View
                        key={comp.id || `new-${index}`}
                        entering={FadeInRight.delay(50 * index).springify()}
                        layout={Layout.springify()}
                      >
                        <Card style={{ marginBottom: 8 }}>
                          <Pressable
                            onPress={() => openComponentModal(comp)}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                          >
                            <FODMAPBadge level={comp.fodmap_level || 'unknown'} size="sm" />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                                {comp.name}
                              </Text>
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                {comp.quantity} {comp.unit}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                          </Pressable>
                        </Card>
                      </Animated.View>
                    ))
                  )}
                </Card>

                {/* Nutrition Section */}
                <Card style={isLargeScreen ? { flex: 1, marginBottom: 0 } : { marginBottom: 16 }}>
                  {/* Section Header with Serving Size */}
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: colors.primary + '15',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Ionicons name="nutrition" size={16} color={colors.primary} />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                        Información Nutricional
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        por
                      </Text>
                      <TextInput
                        value={servingSize}
                        onChangeText={setServingSize}
                        placeholder="100"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={{
                          width: 60,
                          fontSize: 14,
                          color: colors.text,
                          padding: 6,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          textAlign: 'center',
                        }}
                      />
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {['g', 'ml'].map(unit => (
                          <Pressable
                            key={unit}
                            onPress={() => setServingUnit(unit)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 6,
                              backgroundColor: servingUnit === unit ? colors.primary : colors.cardElevated,
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: servingUnit === unit ? '#FFFFFF' : colors.textSecondary,
                            }}>
                              {unit}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Calories - Hero */}
                  <View style={{
                    backgroundColor: colors.primary + '10',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: colors.primary + '30',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Ionicons name="flame" size={22} color="#FFFFFF" />
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                          Calorías
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        {isInternal ? (
                          <Text style={{ fontSize: 36, fontWeight: '800', color: colors.primary }}>
                            {nutrition.calories ?? '-'}
                          </Text>
                        ) : (
                          <TextInput
                            value={nutrition.calories?.toString() || ''}
                            onChangeText={(v) => updateNutrition('calories', v)}
                            placeholder="0"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            style={{
                              fontSize: 36,
                              fontWeight: '800',
                              color: colors.primary,
                              textAlign: 'right',
                              padding: 0,
                            }}
                          />
                        )}
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
                          kcal
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Macros Grid */}
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: '700', 
                    color: colors.textMuted, 
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    Macronutrientes *
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <NutritionInput label="Proteínas" value={nutrition.protein_g} unit="g" field="protein_g" icon="fish" color="#E91E63" required />
                    <NutritionInput label="Carbohidratos" value={nutrition.carbs_g} unit="g" field="carbs_g" icon="leaf" color="#FF9800" required />
                    <NutritionInput label="Grasas" value={nutrition.fat_g} unit="g" field="fat_g" icon="water" color="#2196F3" required />
                  </View>

                  {/* Secondary Macros */}
                  <Text style={{ 
                    fontSize: 11, 
                    fontWeight: '700', 
                    color: colors.textMuted, 
                    marginBottom: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}>
                    Detalles adicionales
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <NutritionInput label="Fibra" value={nutrition.fiber_g} unit="g" field="fiber_g" />
                    <NutritionInput label="Azúcares" value={nutrition.sugars_g} unit="g" field="sugars_g" />
                    <NutritionInput label="Gr. saturada" value={nutrition.saturated_fat_g} unit="g" field="saturated_fat_g" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <NutritionInput label="Sodio" value={nutrition.sodium_mg} unit="mg" field="sodium_mg" />
                    <NutritionInput label="Colesterol" value={nutrition.cholesterol_mg} unit="mg" field="cholesterol_mg" />
                  </View>
                </Card>
              </View>
            </Animated.View>

            {/* Row 2: Minerals & Vitamins */}
            <Animated.View entering={FadeInDown.delay(175).springify()}>
              <Card style={{ marginBottom: 16 }}>
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 8,
                  marginBottom: 12,
                }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: '#9C27B0' + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="sparkles" size={14} color="#9C27B0" />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    Minerales y Vitaminas (opcional)
                  </Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <NutritionInput label="Potasio" value={nutrition.potassium_mg} unit="mg" field="potassium_mg" color="#9C27B0" />
                  <NutritionInput label="Calcio" value={nutrition.calcium_mg} unit="mg" field="calcium_mg" color="#9C27B0" />
                  <NutritionInput label="Hierro" value={nutrition.iron_mg} unit="mg" field="iron_mg" color="#9C27B0" />
                </View>
                
                {/* Disclaimer */}
                <Text style={{ 
                  fontSize: 10, 
                  color: colors.textMuted, 
                  marginTop: 14,
                  lineHeight: 14,
                  textAlign: 'center',
                }}>
                  * Los valores diarios de referencia se basan en una dieta de 2000 kcal.
                </Text>
              </Card>
            </Animated.View>

            {/* Row 3: Nutri-Score | Digestive Effect */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <View style={{ flexDirection: isLargeScreen ? 'row' : 'column', gap: 16, marginBottom: 16 }}>
                {/* Nutri-Score Card */}
                <Card style={isLargeScreen ? { flex: 1, marginBottom: 0 } : { marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: '#FF9800' + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="star" size={16} color="#FF9800" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                      Nutri-Score
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    {([null, 'A', 'B', 'C', 'D', 'E'] as NutriScore[]).map(score => (
                      <NutriScoreOption key={score || 'none'} score={score} />
                    ))}
                  </View>
                </Card>

                {/* Digestive Effect Card */}
                <Card style={isLargeScreen ? { flex: 1, marginBottom: 0 } : { marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: '#9C27B0' + '15',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons name="medical" size={16} color="#9C27B0" />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                      Efecto Digestivo
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>Diarrea</Text>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {[-2, -1, 0, 1, 2].map(value => (
                          <Pressable
                            key={value}
                            onPress={() => setDigestiveEffect(value)}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              backgroundColor: digestiveEffect === value 
                                ? (value < 0 ? colors.error : value > 0 ? '#FF9800' : colors.primary)
                                : colors.cardElevated,
                              borderWidth: 2,
                              borderColor: digestiveEffect === value 
                                ? (value < 0 ? colors.error : value > 0 ? '#FF9800' : colors.primary)
                                : colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: digestiveEffect === value ? '#FFFFFF' : colors.textMuted,
                            }}>
                              {value}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: '600' }}>Estreñimiento</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}>
                      {digestiveEffect === 0 ? 'Neutro' : 
                       digestiveEffect < 0 ? `Puede empeorar diarrea (${Math.abs(digestiveEffect)})` :
                       `Puede empeorar estreñimiento (+${digestiveEffect})`}
                    </Text>
                  </View>
                </Card>
              </View>
            </Animated.View>

            {/* Row 4: FODMAP */}
            <Animated.View entering={FadeInDown.delay(225).springify()}>
              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: colors.fodmapLow + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="leaf" size={16} color={colors.fodmapLow} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    FODMAP
                  </Text>
                </View>

                {/* Overall Level */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Nivel FODMAP general
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <FODMAPOption level="low" label="Bajo" />
                    <FODMAPOption level="medium" label="Medio" />
                    <FODMAPOption level="high" label="Alto" />
                  </View>
                </View>

                {/* Detailed FODMAP Toggle */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Detalle FODMAP (Monash)
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Especificar nivel por categoría
                      </Text>
                    </View>
                    <Switch
                      value={showDetailedFodmap}
                      onValueChange={setShowDetailedFodmap}
                      trackColor={{ false: colors.border, true: colors.primary + '50' }}
                      thumbColor={showDetailedFodmap ? colors.primary : colors.textMuted}
                    />
                  </View>
                </View>

                {/* Detailed FODMAP Categories */}
                {showDetailedFodmap && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 16 }}>
                      CATEGORÍAS FODMAP
                    </Text>
                    
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                        OLIGOSACÁRIDOS
                      </Text>
                      <FODMAPDetailRow category="fructans" label="Fructanos (trigo, cebolla, ajo)" />
                      <FODMAPDetailRow category="gos" label="GOS (legumbres)" />
                    </View>

                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                        DISACÁRIDOS
                      </Text>
                      <FODMAPDetailRow category="lactose" label="Lactosa (lácteos)" />
                    </View>

                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                        MONOSACÁRIDOS
                      </Text>
                      <FODMAPDetailRow category="fructose" label="Exceso de fructosa (miel, manzana)" />
                    </View>

                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                        POLIOLES
                      </Text>
                      <FODMAPDetailRow category="sorbitol" label="Sorbitol (ciruela, aguacate)" />
                      <FODMAPDetailRow category="mannitol" label="Manitol (champiñón, coliflor)" />
                    </View>

                    {/* Safe/Limit Serving */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fodmapLow, marginBottom: 6 }}>
                        🟢 Porción segura (bajo FODMAP)
                      </Text>
                      <TextInput
                        value={safeServing}
                        onChangeText={setSafeServing}
                        placeholder="Ej: 75g, 1/2 taza..."
                        placeholderTextColor={colors.textMuted}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                        }}
                      />
                    </View>

                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fodmapMedium, marginBottom: 6 }}>
                        🟡 Porción límite (medio/alto FODMAP)
                      </Text>
                      <TextInput
                        value={limitServing}
                        onChangeText={setLimitServing}
                        placeholder="Ej: 150g, 1 taza..."
                        placeholderTextColor={colors.textMuted}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                        }}
                      />
                    </View>
                  </View>
                )}
              </Card>
            </Animated.View>

            {/* Tags - Full width at bottom */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="pricetag" size={16} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Etiquetas
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {DEFAULT_TAGS.map(tag => {
                    const isSelected = tags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => {
                          if (isSelected) {
                            setTags(tags.filter(t => t !== tag));
                          } else {
                            setTags([...tags, tag]);
                          }
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                          backgroundColor: isSelected ? colors.primary : colors.cardElevated,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                        }}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: isSelected ? '#FFFFFF' : colors.text,
                        }}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <CustomTagInput
                  placeholder="Añadir etiqueta personalizada..."
                  onTagAdd={(tag) => {
                    if (tag && !tags.includes(tag)) {
                      setTags([...tags, tag]);
                    }
                  }}
                />
              </Card>
            </Animated.View>

            {/* Notes - At the end */}
            <Animated.View entering={FadeInDown.delay(325).springify()}>
              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                    Notas
                  </Text>
                </View>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Añade notas adicionales sobre este alimento..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={{
                    fontSize: 14,
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

            {/* Save Button */}
            <View style={{ 
              padding: 16, 
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
              <Button onPress={handleSave} loading={loading} fullWidth size="lg">
                {isNew ? 'Añadir alimento' : 'Guardar cambios'}
              </Button>

              {!isNew && (
                <Pressable
                  onPress={handleDelete}
                  style={{ alignItems: 'center', marginTop: 12 }}
                >
                  <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
                    Eliminar alimento
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}

        {/* Component Modal */}
        <Modal
          visible={showComponentModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowComponentModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ 
              backgroundColor: colors.card, 
              borderRadius: 20,
              padding: 20,
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>
                {editingComponent ? 'Editar ingrediente' : 'Añadir ingrediente'}
              </Text>

              {/* Component Name */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                  Nombre del ingrediente
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={componentName}
                    onChangeText={setComponentName}
                    placeholder="Nombre..."
                    placeholderTextColor={colors.textMuted}
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                  <Pressable
                    onPress={() => setShowFoodSearch(true)}
                    style={{
                      padding: 12,
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                    }}
                  >
                    <Ionicons name="search" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* Quantity */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                  Cantidad
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={componentQuantity}
                    onChangeText={setComponentQuantity}
                    placeholder="100"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      textAlign: 'center',
                    }}
                  />
                  <View style={{ flex: 1.5 }}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {['g', 'ml', 'unidad'].map(unit => (
                        <Pressable
                          key={unit}
                          onPress={() => setComponentUnit(unit)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 8,
                            backgroundColor: componentUnit === unit ? colors.primary : colors.cardElevated,
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: componentUnit === unit ? '#FFFFFF' : colors.textSecondary,
                          }}>
                            {unit}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </View>

              {/* FODMAP Level */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                  Nivel FODMAP
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['low', 'medium', 'high', 'unknown'] as FODMAPLevel[]).map(level => (
                    <Pressable
                      key={level}
                      onPress={() => setComponentFodmap(level)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: componentFodmap === level 
                          ? (level === 'low' ? '#27AE60' : level === 'medium' ? '#F39C12' : level === 'high' ? '#E74C3C' : colors.textMuted)
                          : colors.cardElevated,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: componentFodmap === level ? '#FFFFFF' : colors.textSecondary,
                      }}>
                        {level === 'low' ? 'Bajo' : level === 'medium' ? 'Medio' : level === 'high' ? 'Alto' : '?'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button 
                  onPress={() => setShowComponentModal(false)} 
                  variant="outline" 
                  style={{ flex: 1 }}
                >
                  Cancelar
                </Button>
                <Button 
                  onPress={saveComponent}
                  style={{ flex: 1 }}
                >
                  {editingComponent ? 'Guardar' : 'Añadir'}
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {/* Food Search Modal */}
        <Modal
          visible={showFoodSearch}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFoodSearch(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ 
              backgroundColor: colors.card, 
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '80%',
            }}>
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Buscar alimento
                </Text>
                <Pressable onPress={() => setShowFoodSearch(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <View style={{ padding: 16 }}>
                <TextInput
                  value={foodSearchQuery}
                  onChangeText={setFoodSearchQuery}
                  placeholder="Buscar..."
                  placeholderTextColor={colors.textMuted}
                  style={{
                    fontSize: 16,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                  }}
                />
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                {availableFoods
                  .filter(f => 
                    f.name.toLowerCase().includes(foodSearchQuery.toLowerCase()) &&
                    f.id !== (id ? parseInt(id) : -1)
                  )
                  .slice(0, 20)
                  .map(food => (
                    <Pressable
                      key={food.id}
                      onPress={() => {
                        setComponentName(food.name);
                        setComponentFodmap(food.fodmap_level || 'unknown');
                        setShowFoodSearch(false);
                        setFoodSearchQuery('');
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <FODMAPBadge level={food.fodmap_level || 'unknown'} size="sm" />
                      <Text style={{ marginLeft: 12, fontSize: 15, color: colors.text }}>
                        {food.name}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}
