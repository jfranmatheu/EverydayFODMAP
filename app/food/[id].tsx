import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button, FODMAPBadge } from '@/components/ui';
import { getDatabase, insertRow, updateRow, deleteRow, getRowById } from '@/lib/database';
import { 
  FODMAPLevel, 
  Food, 
  FoodCategory, 
  FOOD_CATEGORIES,
  FODMAPDetails,
  NutritionInfo,
  NutriScore,
  NUTRISCORE_COLORS,
  FODMAP_CATEGORIES,
} from '@/lib/types';

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
  
  // Image (placeholder for now)
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // State
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);
  const [isInternal, setIsInternal] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'fodmap' | 'nutrition' | 'compound'>('basic');

  useEffect(() => {
    if (!isNew && id) {
      loadFood();
    }
  }, [id]);

  const loadFood = async () => {
    try {
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
      // Build FODMAP details object
      const fullFodmapDetails: Partial<FODMAPDetails> = showDetailedFodmap ? {
        ...fodmapDetails,
        overall: fodmapLevel,
        safe_serving: safeServing || undefined,
        limit_serving: limitServing || undefined,
      } : undefined;
      
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

      if (isNew) {
        await insertRow('foods', data);
        Alert.alert('¡Guardado!', 'Alimento añadido correctamente');
      } else {
        await updateRow('foods', parseInt(id!), data);
        Alert.alert('¡Guardado!', 'Alimento actualizado correctamente');
      }
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

  const handleImagePick = async () => {
    // Placeholder - will implement with expo-image-picker
    Alert.alert(
      'Seleccionar imagen',
      'Esta funcionalidad estará disponible próximamente',
      [{ text: 'OK' }]
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

  // Components
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
                  <Pressable 
                    onPress={handleImagePick}
                    style={{
                      height: 120,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: colors.border,
                      borderStyle: 'dashed',
                    }}
                  >
                    {imageUri ? (
                      <Text style={{ color: colors.text }}>Imagen seleccionada</Text>
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
                          Añadir imagen (opcional)
                        </Text>
                      </>
                    )}
                  </Pressable>
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
                  
                  {isCompound && !isInternal && (
                    <View style={{ marginTop: 12 }}>
                      <Pressable
                        onPress={() => Alert.alert('Próximamente', 'La gestión de ingredientes estará disponible pronto')}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 12,
                          backgroundColor: colors.primary + '15',
                          borderRadius: 8,
                          gap: 8,
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>
                          Gestionar ingredientes
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              </Animated.View>
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
    </>
  );
}
