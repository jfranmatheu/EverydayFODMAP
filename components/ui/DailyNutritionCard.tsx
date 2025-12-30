import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase, insertRow } from '@/lib/database';
import { calculateAge, calculateDailyCalories, calculateMacroGrams, NutritionInfo, UserProfile, WeightLog } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card } from './Card';

interface DailyNutritionCardProps {
  profile: UserProfile | null;
  style?: any;
  onProfileUpdated?: () => void; // Optional callback to notify parent when profile is updated
}

export function DailyNutritionCard({ profile, style, onProfileUpdated }: DailyNutritionCardProps) {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  
  // Internal state
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayMacros, setTodayMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [todayWater, setTodayWater] = useState(0); // in liters
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  
  // Modal states
  const [showNutritionTargetsModal, setShowNutritionTargetsModal] = useState(false);
  
  // Form states
  const [editTargetCalories, setEditTargetCalories] = useState('');
  const [editTargetProtein, setEditTargetProtein] = useState('');
  const [editTargetCarbs, setEditTargetCarbs] = useState('');
  const [editTargetFat, setEditTargetFat] = useState('');
  const [editTargetWater, setEditTargetWater] = useState('');
  
  // Load data
  const loadLatestWeight = useCallback(async () => {
    try {
      const db = await getDatabase();
      const weightData = await db.getFirstAsync(
        'SELECT * FROM weight_logs ORDER BY date DESC, time DESC LIMIT 1'
      ) as WeightLog | null;
      setLatestWeight(weightData);
    } catch (error) {
      console.error('Error loading weight:', error);
    }
  }, []);
  
  const loadTodayNutrition = useCallback(async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      
      // Get all meal items for today
      const items = await db.getAllAsync(
        `SELECT mi.quantity, f.nutrition as food_nutrition, r.nutrition as recipe_nutrition
         FROM meal_items mi
         JOIN meals m ON mi.meal_id = m.id
         LEFT JOIN foods f ON mi.food_id = f.id
         LEFT JOIN recipes r ON mi.recipe_id = r.id
         WHERE m.date = ?`,
        [today]
      ) as any[];
      
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      
      for (const item of items) {
        const nutritionStr = item.food_nutrition || item.recipe_nutrition;
        if (nutritionStr) {
          try {
            const nutrition: NutritionInfo = typeof nutritionStr === 'string' 
              ? JSON.parse(nutritionStr) 
              : nutritionStr;
            const qty = item.quantity || 1;
            totalCalories += (nutrition.calories || 0) * qty;
            totalProtein += (nutrition.protein_g || 0) * qty;
            totalCarbs += (nutrition.carbs_g || 0) * qty;
            totalFat += (nutrition.fat_g || 0) * qty;
          } catch (e) {
            // Skip invalid nutrition data
          }
        }
      }
      
      setTodayCalories(Math.round(totalCalories));
      setTodayMacros({
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
      });
      
      // Load today's water intake
      const waterIntake = await db.getAllAsync(
        'SELECT * FROM water_intake WHERE date = ?',
        [today]
      ) as any[];
      
      const totalWaterMl = waterIntake.reduce((sum, w) => sum + (w.amount_ml || 0), 0);
      setTodayWater(totalWaterMl / 1000); // Convert to liters
    } catch (error) {
      console.error('Error loading today nutrition:', error);
    }
  }, []);
  
  const loadData = useCallback(async () => {
    await Promise.all([loadTodayNutrition(), loadLatestWeight()]);
  }, [loadTodayNutrition, loadLatestWeight]);
  
  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady, loadData]);
  
  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadData();
      }
    }, [isReady, loadData])
  );
  
  // Initialize form values when profile changes
  useEffect(() => {
    if (profile) {
      setEditTargetCalories(profile.target_calories?.toString() || '');
      setEditTargetProtein(profile.target_protein_pct?.toString() || '');
      setEditTargetCarbs(profile.target_carbs_pct?.toString() || '');
      setEditTargetFat(profile.target_fat_pct?.toString() || '');
      setEditTargetWater((profile.target_water_l || 2.5).toString());
    }
  }, [profile]);
  
  // Handlers
  const handleSaveTargets = async () => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        `UPDATE user_profile SET 
          target_calories = ?, 
          target_protein_pct = ?, 
          target_carbs_pct = ?, 
          target_fat_pct = ?,
          target_water_l = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`,
        [
          parseInt(editTargetCalories) || 2000,
          parseInt(editTargetProtein) || 20,
          parseInt(editTargetCarbs) || 50,
          parseInt(editTargetFat) || 30,
          parseFloat(editTargetWater) || 2.5,
        ]
      );
      setShowNutritionTargetsModal(false);
      Alert.alert('¡Guardado!', 'Objetivos nutricionales actualizados');
      // Notify parent to reload profile
      if (onProfileUpdated) {
        onProfileUpdated();
      }
    } catch (error) {
      console.error('Error saving targets:', error);
      Alert.alert('Error', 'No se pudieron guardar los objetivos');
    }
  };
  
  const handleAddWater = async () => {
    try {
      const db = await getDatabase();
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      await insertRow('water_intake', {
        glasses: 1,
        amount_ml: 250,
        date: today,
        time: now.toTimeString().split(' ')[0].slice(0, 5),
      });
      await loadTodayNutrition();
      Alert.alert('¡Agregado!', '1 vaso de agua registrado');
    } catch (error) {
      console.error('Error adding water:', error);
      Alert.alert('Error', 'No se pudo agregar el agua');
    }
  };
  
  // Calculate targets
  const targets = {
    calories: profile?.target_calories || 2000,
    protein_pct: profile?.target_protein_pct || 20,
    carbs_pct: profile?.target_carbs_pct || 50,
    fat_pct: profile?.target_fat_pct || 30,
  };
  const waterTarget = profile?.target_water_l || 2.5;
  
  const targetMacros = calculateMacroGrams(targets.calories, targets.protein_pct, targets.carbs_pct, targets.fat_pct);
  const calorieProgress = Math.min(todayCalories / targets.calories, 1.5);
  
  const macros = [
    { 
      label: 'Proteína', 
      consumed: todayMacros.protein, 
      target: targetMacros.protein_g, 
      color: '#E91E63',
      icon: 'fish' as keyof typeof Ionicons.glyphMap,
    },
    { 
      label: 'Carbos', 
      consumed: todayMacros.carbs, 
      target: targetMacros.carbs_g, 
      color: '#FF9800',
      icon: 'leaf' as keyof typeof Ionicons.glyphMap,
    },
    { 
      label: 'Grasas', 
      consumed: todayMacros.fat, 
      target: targetMacros.fat_g, 
      color: '#2196F3',
      icon: 'water' as keyof typeof Ionicons.glyphMap,
    },
  ];
  
  const isOverCalories = todayCalories > targets.calories;
  const calorieColor = isOverCalories ? '#E91E63' : '#4CAF50';
  
  return (
    <>
      <Card style={{ marginBottom: 0, padding: 0, overflow: 'hidden', flex: 1, ...style }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          paddingTop: 20, // HACK: to match the 'My Profile' card header height...
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: '#4CAF50' + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="flame" size={18} color="#4CAF50" />
            </View>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
              Balance del día
            </Text>
          </View>
          <Pressable 
            onPress={() => setShowNutritionTargetsModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.cardElevated,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
            }}
          >
            <Ionicons name="flag" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
              Objetivos
            </Text>
          </Pressable>
        </View>
        
        {/* Calories Section */}
        <View style={{ padding: 16, paddingTop: 20 }}>
          {/* Big calorie display */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 1, marginBottom: 6 }}>
              CALORÍAS CONSUMIDAS
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ 
                fontSize: 48, 
                fontWeight: '800', 
                color: calorieColor,
              }}>
                {todayCalories}
              </Text>
              <Text style={{ fontSize: 18, color: colors.textSecondary, marginLeft: 4 }}>
                / {targets.calories}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
              {isOverCalories 
                ? `${todayCalories - targets.calories} kcal sobre el objetivo`
                : `${targets.calories - todayCalories} kcal restantes`
              }
            </Text>
          </View>
          
          {/* Calorie Progress Bar */}
          <View style={{ marginBottom: 24 }}>
            <View style={{
              height: 12,
              backgroundColor: colors.cardElevated,
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              <View 
                style={{
                  width: `${Math.min(calorieProgress * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: calorieColor,
                  borderRadius: 6,
                }}
              />
              {/* Target marker */}
              <View style={{
                position: 'absolute',
                left: '66.67%', // 100% marker at 2/3
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: colors.text + '30',
              }} />
            </View>
          </View>
          
          {/* Macros Grid */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {macros.map((macro) => {
              const progress = macro.target > 0 ? Math.min(macro.consumed / macro.target, 1) : 0;
              const percent = Math.round(progress * 100);
              
              return (
                <View 
                  key={macro.label}
                  style={{
                    flex: 1,
                    backgroundColor: macro.color + '10',
                    borderRadius: 14,
                    padding: 14,
                    alignItems: 'center',
                  }}
                >
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: macro.color + '25',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}>
                    <Ionicons name={macro.icon} size={16} color={macro.color} />
                  </View>
                  <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 4 }}>
                    {macro.label.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: macro.color }}>
                    {macro.consumed}g
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    / {macro.target}g
                  </Text>
                  
                  {/* Mini progress bar */}
                  <View style={{
                    width: '100%',
                    height: 4,
                    backgroundColor: macro.color + '20',
                    borderRadius: 2,
                    marginTop: 8,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${percent}%`,
                      height: '100%',
                      backgroundColor: macro.color,
                      borderRadius: 2,
                    }} />
                  </View>
                </View>
              );
            })}
          </View>
          
          {/* Water Section */}
          <View style={{ 
            marginTop: 20, 
            paddingTop: 20, 
            borderTopWidth: 1, 
            borderTopColor: colors.border 
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.water + '25',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="water" size={18} color={colors.water} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                  Agua
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ fontSize: 24, fontWeight: '700', color: colors.water }}>
                    {todayWater.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 14, color: colors.textSecondary, marginLeft: 4 }}>
                    / {waterTarget.toFixed(1)} L
                  </Text>
                </View>
                <Pressable
                  onPress={handleAddWater}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.water,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
            
            {/* Water Progress Bar */}
            <View style={{
              height: 10,
              backgroundColor: colors.cardElevated,
              borderRadius: 5,
              overflow: 'hidden',
            }}>
              <View 
                style={{
                  width: `${Math.min((todayWater / waterTarget) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: colors.water,
                  borderRadius: 5,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
              {todayWater >= waterTarget 
                ? '¡Objetivo alcanzado! 🎉'
                : `${(waterTarget - todayWater).toFixed(2)} L restantes`
              }
            </Text>
          </View>
        </View>
      </Card>
      
      {/* Nutrition Targets Modal */}
      <Modal
        visible={showNutritionTargetsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNutritionTargetsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '85%',
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.primary + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="flag" size={20} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Objetivos Nutricionales
                </Text>
              </View>
              <Pressable onPress={() => setShowNutritionTargetsModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Auto-calculate Button */}
              {profile?.height_cm && latestWeight && profile?.birth_date && profile?.gender && (
                <Pressable
                  onPress={() => {
                    const age = calculateAge(profile.birth_date!);
                    if (age) {
                      const recommended = calculateDailyCalories(
                        latestWeight.weight_kg,
                        profile.height_cm!,
                        age,
                        profile.gender!,
                        'moderate'
                      );
                      setEditTargetCalories(Math.round(recommended).toString());
                      Alert.alert(
                        'Calorías Calculadas',
                        `Basado en tu perfil (${latestWeight.weight_kg}kg, ${profile.height_cm}cm, ${age} años), tu ingesta diaria recomendada es de ${Math.round(recommended)} kcal para un nivel de actividad moderado.`,
                        [{ text: 'OK' }]
                      );
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: colors.primary + '15',
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: colors.primary + '30',
                  }}
                >
                  <Ionicons name="calculator" size={20} color={colors.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                    Calcular calorías recomendadas
                  </Text>
                </Pressable>
              )}
              
              {/* Calories Target */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                  Calorías diarias objetivo
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={editTargetCalories}
                    onChangeText={setEditTargetCalories}
                    placeholder="2000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.text,
                      padding: 14,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>kcal</Text>
                </View>
              </View>
              
              {/* Macros Percentages */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                Distribución de macronutrientes (%)
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#E91E63' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="fish" size={20} color="#E91E63" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Proteína
                    </Text>
                    <TextInput
                      value={editTargetProtein}
                      onChangeText={setEditTargetProtein}
                      placeholder="20"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#E91E63',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
                
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#FF9800' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="leaf" size={20} color="#FF9800" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Carbos
                    </Text>
                    <TextInput
                      value={editTargetCarbs}
                      onChangeText={setEditTargetCarbs}
                      placeholder="50"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#FF9800',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
                
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#2196F3' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="water" size={20} color="#2196F3" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Grasas
                    </Text>
                    <TextInput
                      value={editTargetFat}
                      onChangeText={setEditTargetFat}
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#2196F3',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
              </View>
              
              {/* Total check */}
              {(() => {
                const total = (parseInt(editTargetProtein) || 0) + (parseInt(editTargetCarbs) || 0) + (parseInt(editTargetFat) || 0);
                const isValid = total === 100;
                return (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 12,
                    backgroundColor: isValid ? colors.fodmapLow + '15' : colors.fodmapHigh + '15',
                    borderRadius: 10,
                    marginBottom: 20,
                  }}>
                    <Ionicons 
                      name={isValid ? 'checkmark-circle' : 'warning'} 
                      size={18} 
                      color={isValid ? colors.fodmapLow : colors.fodmapHigh} 
                    />
                    <Text style={{ 
                      fontSize: 13, 
                      color: isValid ? colors.fodmapLow : colors.fodmapHigh,
                      fontWeight: '600',
                    }}>
                      Total: {total}% {!isValid && '(debe sumar 100%)'}
                    </Text>
                  </View>
                );
              })()}

              {/* Water Target */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="water" size={18} color={colors.water} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                    Agua diaria objetivo
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={editTargetWater}
                    onChangeText={setEditTargetWater}
                    placeholder="2.5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.water,
                      padding: 14,
                      backgroundColor: colors.water + '15',
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>L</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                  Recomendación: 2.5L diarios
                </Text>
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveTargets}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 30,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                  Guardar Objetivos
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
