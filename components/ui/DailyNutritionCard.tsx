import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateMacroGrams } from '@/lib/types';
import { getDatabase, insertRow } from '@/lib/database';

interface DailyNutritionCardProps {
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  targets: { calories: number; protein_pct: number; carbs_pct: number; fat_pct: number };
  water: number; // in liters
  waterTarget: number; // in liters
  onEditTargets: () => void;
  onWaterAdded?: () => void; // Callback when water is added
}

export function DailyNutritionCard({
  consumed,
  targets,
  water,
  waterTarget,
  onEditTargets,
  onWaterAdded,
}: DailyNutritionCardProps) {
  const { colors } = useTheme();
  
  const targetMacros = calculateMacroGrams(targets.calories, targets.protein_pct, targets.carbs_pct, targets.fat_pct);
  const calorieProgress = Math.min(consumed.calories / targets.calories, 1.5);
  const caloriePercent = Math.round((consumed.calories / targets.calories) * 100);
  
  const macros = [
    { 
      label: 'Proteína', 
      consumed: consumed.protein, 
      target: targetMacros.protein_g, 
      color: '#E91E63',
      icon: 'fish' as keyof typeof Ionicons.glyphMap,
    },
    { 
      label: 'Carbos', 
      consumed: consumed.carbs, 
      target: targetMacros.carbs_g, 
      color: '#FF9800',
      icon: 'leaf' as keyof typeof Ionicons.glyphMap,
    },
    { 
      label: 'Grasas', 
      consumed: consumed.fat, 
      target: targetMacros.fat_g, 
      color: '#2196F3',
      icon: 'water' as keyof typeof Ionicons.glyphMap,
    },
  ];
  
  const isOverCalories = consumed.calories > targets.calories;
  const calorieColor = isOverCalories ? '#E91E63' : '#4CAF50';
  
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
      if (onWaterAdded) {
        onWaterAdded();
      } else {
        Alert.alert('¡Agregado!', '1 vaso de agua registrado');
      }
    } catch (error) {
      console.error('Error adding water:', error);
      Alert.alert('Error', 'No se pudo agregar el agua');
    }
  };
  
  return (
    <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden', flex: 1 }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
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
          onPress={onEditTargets}
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
              {consumed.calories}
            </Text>
            <Text style={{ fontSize: 18, color: colors.textSecondary, marginLeft: 4 }}>
              / {targets.calories}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            {isOverCalories 
              ? `${consumed.calories - targets.calories} kcal sobre el objetivo`
              : `${targets.calories - consumed.calories} kcal restantes`
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
                  {water.toFixed(2)}
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
                width: `${Math.min((water / waterTarget) * 100, 100)}%`,
                height: '100%',
                backgroundColor: colors.water,
                borderRadius: 5,
              }}
            />
          </View>
          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
            {water >= waterTarget 
              ? '¡Objetivo alcanzado! 🎉'
              : `${(waterTarget - water).toFixed(2)} L restantes`
            }
          </Text>
        </View>
      </View>
    </Card>
  );
}

