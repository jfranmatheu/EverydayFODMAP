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
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
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
  const isNew = id === 'new';

  // Basic info
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('other');
  const [servingSize, setServingSize] = useState('');
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
  
  // Nutrition info
  const [showNutrition, setShowNutrition] = useState(false);
  const [nutrition, setNutrition] = useState<Partial<NutritionInfo>>({});
  const [nutriScore, setNutriScore] = useState<NutriScore>(null);
  
  // Compound food
  const [isCompound, setIsCompound] = useState(false);
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
  const [activeSection, setActiveSection] = useState<'basic' | 'fodmap' | 'nutrition' | 'compound'>('basic');

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
        setServingSize(food.serving_size || '');
        setNotes(food.notes || '');
        setBrand(food.brand || '');
        setImageUri(food.image_uri || null);
        setIsCompound(food.is_compound || false);
        setIsInternal(food.source === 'internal');
        
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
            setNutrition(nutri);
            setShowNutrition(true);
          } catch (e) {
            console.log('Error parsing nutrition:', e);
          }
        }
        
        if (food.nutri_score) {
          setNutriScore(food.nutri_score as NutriScore);
        }
        
        // Load components if compound food
        if (food.is_compound) {
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
        }
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
        serving_size: servingSize.trim() || null,
        notes: notes.trim() || null,
        brand: brand.trim() || null,
        nutrition: showNutrition && Object.keys(nutrition).length > 0 
          ? JSON.stringify(nutrition) 
          : null,
        nutri_score: nutriScore,
        is_compound: isCompound ? 1 : 0,
        image_uri: imageUri,
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
      
      // Insert components if compound food
      if (isCompound && components.length > 0) {
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

  const handleDelete = () => {
    if (isInternal) {
      Alert.alert('No permitido', 'Los alimentos de la base de datos FODMAP no pueden eliminarse');
      return;
    }
    
    Alert.alert(
      'Eliminar alimento',
      '¿Estás seguro de que quieres eliminar este alimento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRow('foods', parseInt(id!));
              Alert.alert('Eliminado', 'Alimento eliminado correctamente');
              router.back();
            } catch (error) {
              console.error('Error deleting food:', error);
              Alert.alert('Error', 'No se pudo eliminar el alimento');
            }
          },
        },
      ]
    );
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

  const SectionTab = ({ section, label, icon }: { section: typeof activeSection; label: string; icon: string }) => (
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
          title: isNew ? 'Nuevo alimento' : (isInternal ? 'Ver alimento' : 'Editar alimento'),
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {isInternal && (
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

        {/* Section Tabs */}
        <View style={{ 
          flexDirection: 'row', 
          borderBottomWidth: 1, 
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}>
          <SectionTab section="basic" label="Básico" icon="information-circle-outline" />
          <SectionTab section="fodmap" label="FODMAP" icon="leaf-outline" />
          <SectionTab section="nutrition" label="Nutrición" icon="fitness-outline" />
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
                    height={120}
                    placeholder="Añadir foto del alimento"
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
                    placeholder="Ej: Arroz, Pollo, Zanahoria..."
                    placeholderTextColor={colors.textMuted}
                    editable={!isInternal}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      opacity: isInternal ? 0.7 : 1,
                    }}
                  />
                </Card>
              </Animated.View>

              {/* Category */}
              <Animated.View entering={FadeInDown.delay(150).springify()}>
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
                <Animated.View entering={FadeInDown.delay(200).springify()}>
                  <Card style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                      Marca
                    </Text>
                    <TextInput
                      value={brand}
                      onChangeText={setBrand}
                      placeholder="Ej: Hacendado, Carrefour..."
                      placeholderTextColor={colors.textMuted}
                      editable={!isInternal}
                      style={{
                        fontSize: 16,
                        color: colors.text,
                        padding: 12,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 10,
                        opacity: isInternal ? 0.7 : 1,
                      }}
                    />
                  </Card>
                </Animated.View>
              )}

              {/* Serving Size */}
              <Animated.View entering={FadeInDown.delay(250).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Tamaño de porción
                  </Text>
                  <TextInput
                    value={servingSize}
                    onChangeText={setServingSize}
                    placeholder="Ej: 100g, 1 taza, 1 unidad..."
                    placeholderTextColor={colors.textMuted}
                    editable={!isInternal}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      opacity: isInternal ? 0.7 : 1,
                    }}
                  />
                </Card>
              </Animated.View>

              {/* Notes */}
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Notas
                  </Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Información adicional..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    editable={!isInternal}
                    style={{
                      fontSize: 15,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      minHeight: 80,
                      textAlignVertical: 'top',
                      opacity: isInternal ? 0.7 : 1,
                    }}
                  />
                </Card>
              </Animated.View>
            </>
          )}

          {/* FODMAP Section */}
          {activeSection === 'fodmap' && (
            <>
              {/* Overall Level */}
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    Nivel FODMAP general
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <FODMAPOption level="low" label="Bajo" />
                    <FODMAPOption level="medium" label="Medio" />
                    <FODMAPOption level="high" label="Alto" />
                  </View>
                </Card>
              </Animated.View>

              {/* Detailed FODMAP Toggle */}
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <Card style={{ marginBottom: 16 }}>
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
                      disabled={isInternal}
                    />
                  </View>
                </Card>
              </Animated.View>

              {/* Detailed FODMAP Categories */}
              {showDetailedFodmap && (
                <Animated.View entering={FadeInDown.delay(200).springify()}>
                  <Card style={{ marginBottom: 16 }}>
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

                    <View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                        POLIOLES
                      </Text>
                      <FODMAPDetailRow category="sorbitol" label="Sorbitol (ciruela, aguacate)" />
                      <FODMAPDetailRow category="mannitol" label="Manitol (champiñón, coliflor)" />
                    </View>
                  </Card>
                </Animated.View>
              )}

              {/* Safe/Limit Serving */}
              {showDetailedFodmap && (
                <Animated.View entering={FadeInDown.delay(250).springify()}>
                  <Card style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>
                      PORCIONES RECOMENDADAS
                    </Text>
                    
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fodmapLow, marginBottom: 6 }}>
                        🟢 Porción segura (bajo FODMAP)
                      </Text>
                      <TextInput
                        value={safeServing}
                        onChangeText={setSafeServing}
                        placeholder="Ej: 75g, 1/2 taza..."
                        placeholderTextColor={colors.textMuted}
                        editable={!isInternal}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          opacity: isInternal ? 0.7 : 1,
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
                        editable={!isInternal}
                        style={{
                          fontSize: 15,
                          color: colors.text,
                          padding: 12,
                          backgroundColor: colors.cardElevated,
                          borderRadius: 8,
                          opacity: isInternal ? 0.7 : 1,
                        }}
                      />
                    </View>
                  </Card>
                </Animated.View>
              )}
            </>
          )}

          {/* Nutrition Section */}
          {activeSection === 'nutrition' && (
            <>
              {/* Toggle */}
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Información nutricional
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Opcional - por 100g o por porción
                      </Text>
                    </View>
                    <Switch
                      value={showNutrition}
                      onValueChange={setShowNutrition}
                      trackColor={{ false: colors.border, true: colors.primary + '50' }}
                      thumbColor={showNutrition ? colors.primary : colors.textMuted}
                      disabled={isInternal}
                    />
                  </View>
                </Card>
              </Animated.View>

              {showNutrition && (
                <>
                  {/* Macros */}
                  <Animated.View entering={FadeInDown.delay(150).springify()}>
                    <Card style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 12 }}>
                        MACRONUTRIENTES (por 100g)
                      </Text>
                      
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Calorías</Text>
                          <TextInput
                            value={nutrition.calories?.toString() || ''}
                            onChangeText={(v) => updateNutrition('calories', v)}
                            placeholder="kcal"
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
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Proteína</Text>
                          <TextInput
                            value={nutrition.protein_g?.toString() || ''}
                            onChangeText={(v) => updateNutrition('protein_g', v)}
                            placeholder="g"
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

                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Carbos</Text>
                          <TextInput
                            value={nutrition.carbs_g?.toString() || ''}
                            onChangeText={(v) => updateNutrition('carbs_g', v)}
                            placeholder="g"
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
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Grasa</Text>
                          <TextInput
                            value={nutrition.fat_g?.toString() || ''}
                            onChangeText={(v) => updateNutrition('fat_g', v)}
                            placeholder="g"
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
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Fibra</Text>
                          <TextInput
                            value={nutrition.fiber_g?.toString() || ''}
                            onChangeText={(v) => updateNutrition('fiber_g', v)}
                            placeholder="g"
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

                  {/* Nutri-Score (for processed foods) */}
                  {category === 'processed' && (
                    <Animated.View entering={FadeInDown.delay(200).springify()}>
                      <Card style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                          Nutri-Score (opcional)
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          {([null, 'A', 'B', 'C', 'D', 'E'] as NutriScore[]).map(score => (
                            <NutriScoreOption key={score || 'none'} score={score} />
                          ))}
                        </View>
                      </Card>
                    </Animated.View>
                  )}
                </>
              )}

              {/* Compound Food Info */}
              <Animated.View entering={FadeInDown.delay(showNutrition ? 250 : 150).springify()}>
                <Card style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Alimento compuesto
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        Contiene múltiples ingredientes
                      </Text>
                    </View>
                    <Switch
                      value={isCompound}
                      onValueChange={setIsCompound}
                      trackColor={{ false: colors.border, true: colors.primary + '50' }}
                      thumbColor={isCompound ? colors.primary : colors.textMuted}
                      disabled={isInternal}
                    />
                  </View>
                </Card>
              </Animated.View>

              {/* Component List */}
              {isCompound && (
                <>
                  {/* Add Component Button */}
                  {!isInternal && (
                    <Animated.View entering={FadeInDown.delay(200).springify()}>
                      <Pressable
                        onPress={() => openComponentModal()}
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

                  {/* Components List */}
                  {components.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                      <Ionicons name="nutrition-outline" size={40} color={colors.textMuted} />
                      <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 10 }}>
                        No hay ingredientes añadidos
                      </Text>
                    </View>
                  ) : (
                    components.map((comp, index) => (
                      <Animated.View
                        key={`${comp.name}-${index}`}
                        entering={FadeInRight.delay(index * 50).springify()}
                        layout={Layout.springify()}
                      >
                        <Card style={{ marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ 
                              width: 10, 
                              height: 10, 
                              borderRadius: 5, 
                              backgroundColor: comp.fodmap_level === 'low' ? colors.fodmapLow 
                                : comp.fodmap_level === 'medium' ? colors.fodmapMedium 
                                : comp.fodmap_level === 'high' ? colors.fodmapHigh 
                                : colors.textMuted,
                              marginRight: 12,
                            }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                                {comp.name}
                              </Text>
                              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                                {comp.quantity} {comp.unit}
                              </Text>
                            </View>
                            {!isInternal && (
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Pressable onPress={() => openComponentModal(comp)}>
                                  <Ionicons name="pencil" size={18} color={colors.textSecondary} />
                                </Pressable>
                                <Pressable onPress={() => deleteComponent(comp)}>
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
        )}
      </View>

      {/* Component Modal */}
      <Modal
        visible={showComponentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowComponentModal(false)}
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
                {editingComponent ? 'Editar ingrediente' : 'Nuevo ingrediente'}
              </Text>
              <Pressable onPress={() => setShowComponentModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView>
              {/* Food Search */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Buscar en alimentos existentes
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
                  <ScrollView nestedScrollEnabled>
                    {filteredFoods.slice(0, 5).map(food => (
                      <Pressable
                        key={food.id}
                        onPress={() => selectFoodForComponent(food)}
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
                    {filteredFoods.length === 0 && (
                      <Text style={{ fontSize: 13, color: colors.textMuted, padding: 10 }}>
                        No se encontraron alimentos
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 8 }}>
                Nombre *
              </Text>
              <TextInput
                value={componentName}
                onChangeText={setComponentName}
                placeholder="Ej: Harina de trigo, Azúcar..."
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
                    value={componentQuantity}
                    onChangeText={setComponentQuantity}
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
                    value={componentUnit}
                    onChangeText={setComponentUnit}
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
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {(['low', 'medium', 'high'] as FODMAPLevel[]).map(level => (
                  <Pressable
                    key={level}
                    onPress={() => setComponentFodmap(level)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: componentFodmap === level 
                        ? level === 'low' ? colors.fodmapLow + '20'
                          : level === 'medium' ? colors.fodmapMedium + '20'
                          : colors.fodmapHigh + '20'
                        : colors.cardElevated,
                      borderWidth: 2,
                      borderColor: componentFodmap === level
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

              <Button onPress={saveComponent} fullWidth size="lg">
                {editingComponent ? 'Guardar cambios' : 'Añadir ingrediente'}
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
