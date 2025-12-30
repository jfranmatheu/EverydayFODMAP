import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase, insertRow } from '@/lib/database';
import {
    BMI_CATEGORIES,
    GENDER_LABELS,
    Gender,
    UserProfile,
    WeightLog,
    calculateAge,
    calculateBMI,
    getBMICategory
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Card } from './Card';

// Weight Chart Component - uses onLayout for accurate pixel calculations
const WeightChart = ({ 
  points, 
  chartHeight, 
  leftPadding, 
  colors 
}: { 
  points: Array<{ xPercent: number; y: number; entry: any; weight: number }>;
  chartHeight: number;
  leftPadding: number;
  colors: any;
}) => {
  const [chartWidth, setChartWidth] = React.useState<number>(200); // Default estimate
  
  return (
    <View 
      onLayout={(e) => {
        const width = e.nativeEvent.layout.width;
        if (width > 0) {
          setChartWidth(width);
        }
      }}
      style={{ 
        marginLeft: leftPadding, 
        flex: 1, 
        position: 'relative',
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
        height: chartHeight,
      }}
    >
      {/* Grid line */}
      <View style={{ 
        position: 'absolute', 
        left: 0, 
        right: 0, 
        top: chartHeight / 2,
        borderTopWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
      }} />
      
      {/* Draw lines and points using absolute pixel positions */}
      {points.map((point, index) => {
        const nextPoint = index < points.length - 1 ? points[index + 1] : null;
        
        // Convert percentage X to absolute pixels
        const pointX = (point.xPercent / 100) * chartWidth;
        const pointY = point.y;
        const nextX = nextPoint ? (nextPoint.xPercent / 100) * chartWidth : null;
        const nextY = nextPoint ? nextPoint.y : null;
        
        return (
          <React.Fragment key={point.entry.id || index}>
            {/* Line segment to next point */}
            {nextPoint && nextX !== null && nextY !== null && (() => {
              // Calculate differences in pixels (both X and Y now in same units)
              const dx = nextX - pointX;
              const dy = nextY - pointY;
              
              // Calculate angle and distance
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              return (
                <View
                  key={`line-${index}`}
                  style={{
                    position: 'absolute',
                    left: pointX,
                    top: pointY - 1.25, // Center the 2.5px line vertically
                    width: distance,
                    height: 2.5,
                    backgroundColor: colors.primary,
                    transform: [{ rotate: `${angle}deg` }],
                    transformOrigin: '0% 50%',
                  }}
                />
              );
            })()}
            {/* Point dot - positioned at exact point center */}
            <View
              key={`point-${index}`}
              style={{
                position: 'absolute',
                left: pointX - 5, // Center the 10px point horizontally
                top: pointY - 5,  // Center the 10px point vertically
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: index === points.length - 1 ? colors.primary : colors.background,
                borderWidth: 2.5,
                borderColor: colors.primary,
                zIndex: 10,
              }}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
};

interface ProfileCardProps {
  style?: ViewStyle;
}

export function ProfileCard({ style }: ProfileCardProps) {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  
  // Internal state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightLog[]>([]);
  const [weightPeriod, setWeightPeriod] = useState<'all' | '2y' | '1y' | '6m' | '3m' | '1m'>('all');
  
  // Modal states
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddWeightModal, setShowAddWeightModal] = useState(false);
  
  // Form states
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<Gender | null>(null);
  const [editHeight, setEditHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Load data
  const loadProfile = useCallback(async () => {
    try {
      const db = await getDatabase();
      const profileData = await db.getFirstAsync(
        'SELECT * FROM user_profile WHERE id = 1'
      ) as UserProfile | null;
      
      console.log('[ProfileCard] Loaded profile:', profileData);
      setProfile(profileData);
      
      if (profileData) {
        setEditBirthDate(profileData.birth_date || '');
        setEditGender(profileData.gender as Gender | null);
        setEditHeight(profileData.height_cm?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, []);
  
  const loadLatestWeight = useCallback(async () => {
    try {
      const db = await getDatabase();
      const weightData = await db.getFirstAsync(
        'SELECT * FROM weight_logs ORDER BY date DESC, time DESC LIMIT 1'
      ) as WeightLog | null;
      
      console.log('[ProfileCard] Loaded weight:', weightData);
      setLatestWeight(weightData);
      
      // Load weight history (last 30 entries for timeline)
      const historyData = await db.getAllAsync(
        'SELECT * FROM weight_logs ORDER BY date DESC, time DESC LIMIT 30'
      ) as WeightLog[];
      
      // Reverse to show oldest first for chart
      setWeightHistory(historyData.reverse());
    } catch (error) {
      console.error('Error loading weight:', error);
    }
  }, []);
  
  const loadData = useCallback(async () => {
    await Promise.all([loadProfile(), loadLatestWeight()]);
  }, [loadProfile, loadLatestWeight]);
  
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
  
  // Handlers
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const db = await getDatabase();
      
      // Validate date format
      if (editBirthDate && !/^\d{4}-\d{2}-\d{2}$/.test(editBirthDate)) {
        Alert.alert('Error', 'Formato de fecha incorrecto. Usa AAAA-MM-DD');
        setSaving(false);
        return;
      }
      
      const birthDate = editBirthDate || null;
      const gender = editGender || null;
      const heightCm = editHeight ? parseFloat(editHeight) : null;
      
      console.log('[ProfileCard] Saving profile:', { birthDate, gender, heightCm });
      
      // Always try to update first, then insert if no changes
      const updateResult = await db.runAsync(
        `UPDATE user_profile SET birth_date = ?, gender = ?, height_cm = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [birthDate, gender, heightCm]
      );
      
      console.log('[ProfileCard] Update result:', updateResult);
      
      // If no rows updated, insert
      if (!profile) {
        await db.runAsync(
          `INSERT INTO user_profile (id, birth_date, gender, height_cm) VALUES (1, ?, ?, ?)`,
          [birthDate, gender, heightCm]
        );
        console.log('[ProfileCard] Inserted new profile');
      }
      
      await loadProfile();
      setShowEditProfileModal(false);
      Alert.alert('¡Guardado!', 'Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddWeight = async () => {
    const weightValue = parseFloat(newWeight);
    if (!newWeight || isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      Alert.alert('Error', 'Por favor, introduce un peso válido (1-500 kg)');
      return;
    }
    
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      await insertRow('weight_logs', {
        weight_kg: weightValue,
        date: dateStr,
        time: timeStr,
      });
      
      await loadLatestWeight();
      setShowAddWeightModal(false);
      setNewWeight('');
      Alert.alert('¡Guardado!', `Peso de ${weightValue.toFixed(1)} kg registrado`);
    } catch (error) {
      console.error('Error saving weight:', error);
      Alert.alert('Error', 'No se pudo guardar el peso');
    } finally {
      setSaving(false);
    }
  };
  
  // Calculate BMI if we have weight and height
  const bmi = latestWeight && profile?.height_cm 
    ? calculateBMI(latestWeight.weight_kg, profile.height_cm)
    : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;
  const bmiInfo = bmiCategory ? BMI_CATEGORIES[bmiCategory] : null;
  
  // Calculate age if we have birth date
  const age = profile?.birth_date ? calculateAge(profile.birth_date) : null;

  const hasProfileData = profile?.birth_date || profile?.gender || profile?.height_cm || latestWeight;

  return (
    <>
      <Card style={{ 
        padding: 0, 
        overflow: 'hidden',
        marginBottom: 0,
        ...style,
      }}>
        {/* Profile Header */}
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
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="person" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                Mi Perfil
              </Text>
              {profile?.gender && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons 
                    name={profile.gender === 'male' ? 'male' : profile.gender === 'female' ? 'female' : 'male-female'} 
                    size={12} 
                    color={colors.textMuted} 
                  />
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {GENDER_LABELS[profile.gender]}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <Pressable
            onPress={() => setShowEditProfileModal(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: colors.cardElevated,
            }}
          >
            <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>Editar</Text>
          </Pressable>
        </View>

        {/* Profile Content */}
        {hasProfileData ? (
          <View style={{ padding: 16 }}>
            {/* Stats Row */}
            <View style={{ 
              flexDirection: 'row', 
              justifyContent: 'space-around',
              marginBottom: 16,
            }}>
              {/* Age */}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                  EDAD
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                  {age ?? '—'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  años
                </Text>
              </View>
              
              {/* Height */}
              <View style={{ 
                alignItems: 'center', 
                flex: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                  ALTURA
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                  {profile?.height_cm ?? '—'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  cm
                </Text>
              </View>
              
              {/* Weight */}
              <Pressable 
                onPress={() => setShowAddWeightModal(true)}
                style={{ alignItems: 'center', flex: 1 }}
              >
                <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                  PESO
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                    {latestWeight?.weight_kg.toFixed(1) ?? '—'}
                  </Text>
                  <Ionicons name="add-circle" size={18} color={colors.fodmapLow} />
                </View>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  kg
                </Text>
              </Pressable>
            </View>

            {/* Weight Timeline - Line Chart */}
            {weightHistory.length > 1 && (
              <View style={{
                marginBottom: 16,
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                padding: 14,
              }}>
                {/* Header with period selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="trending-up" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                    Historial de peso
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 8 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>
                      {weightHistory.length} registros
                    </Text>
                    <Pressable
                      onPress={() => {
                        const periods: typeof weightPeriod[] = ['all', '2y', '1y', '6m', '3m', '1m'];
                        const currentIndex = periods.indexOf(weightPeriod);
                        const nextIndex = (currentIndex + 1) % periods.length;
                        setWeightPeriod(periods[nextIndex]);
                      }}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: colors.primary + '20',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>
                        {weightPeriod === 'all' ? 'Todo' : 
                         weightPeriod === '2y' ? '2 años' :
                         weightPeriod === '1y' ? '1 año' :
                         weightPeriod === '6m' ? '6 meses' :
                         weightPeriod === '3m' ? '3 meses' : '1 mes'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                
                {/* Line Chart */}
                <View style={{ height: 80 }}>
                  {(() => {
                    // Filter by period
                    const now = new Date();
                    const filteredHistory = weightHistory.filter(w => {
                      if (weightPeriod === 'all') return true;
                      const entryDate = new Date(w.date);
                      const monthsAgo = (now.getFullYear() - entryDate.getFullYear()) * 12 + now.getMonth() - entryDate.getMonth();
                      if (weightPeriod === '2y') return monthsAgo <= 24;
                      if (weightPeriod === '1y') return monthsAgo <= 12;
                      if (weightPeriod === '6m') return monthsAgo <= 6;
                      if (weightPeriod === '3m') return monthsAgo <= 3;
                      if (weightPeriod === '1m') return monthsAgo <= 1;
                      return true;
                    });
                    
                    if (filteredHistory.length < 2) {
                      return (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>
                            No hay suficientes datos para este periodo
                          </Text>
                        </View>
                      );
                    }
                    
                    const weights = filteredHistory.map(w => w.weight_kg);
                    const minW = Math.min(...weights) - 0.5;
                    const maxW = Math.max(...weights) + 0.5;
                    const range = maxW - minW || 1;
                    const displayHistory = filteredHistory.slice(-20); // Max 20 points for readability
                    
                    // Simple and reliable line chart using SVG-like approach with View
                    const chartHeight = 60;
                    const chartWidth = 100; // percentage
                    const leftPadding = 40; // for Y-axis labels
                    const rightPadding = 8;
                    const usableWidth = chartWidth - (rightPadding * 2);
                    
                    // Calculate positions as percentages
                    // Ensure points are evenly spaced and don't go beyond boundaries
                    const points = displayHistory.map((entry, index) => {
                      const xPercent = displayHistory.length > 1 
                        ? rightPadding + ((index / (displayHistory.length - 1)) * usableWidth)
                        : rightPadding + (usableWidth / 2);
                      // Clamp xPercent to ensure it stays within bounds
                      const clampedX = Math.max(rightPadding, Math.min(100 - rightPadding, xPercent));
                      const y = chartHeight - ((entry.weight_kg - minW) / range) * chartHeight;
                      return { xPercent: clampedX, y, entry, weight: entry.weight_kg };
                    });
                    
                    return (
                      <View style={{ flex: 1, position: 'relative' }}>
                        {/* Y-axis labels */}
                        <View style={{ 
                          position: 'absolute', 
                          left: 0, 
                          top: 0, 
                          bottom: 20,
                          width: 35,
                          justifyContent: 'space-between',
                        }}>
                          <Text style={{ fontSize: 9, color: colors.textMuted }}>{maxW.toFixed(1)}</Text>
                          <Text style={{ fontSize: 9, color: colors.textMuted }}>{minW.toFixed(1)}</Text>
                        </View>
                        
                        {/* Chart area - using onLayout for accurate pixel calculations */}
                        <WeightChart 
                          points={points}
                          chartHeight={chartHeight}
                          leftPadding={leftPadding}
                          colors={colors}
                        />
                        
                        {/* X-axis dates */}
                        <View style={{ 
                          flexDirection: 'row', 
                          justifyContent: 'space-between',
                          marginLeft: 40,
                          marginTop: 4,
                        }}>
                          {displayHistory.length > 0 && (
                            <>
                              <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                {new Date(displayHistory[0].date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                              </Text>
                              {displayHistory.length > 2 && (
                                <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                  {new Date(displayHistory[Math.floor(displayHistory.length / 2)].date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                </Text>
                              )}
                              <Text style={{ fontSize: 9, color: colors.textMuted }}>
                                {new Date(displayHistory[displayHistory.length - 1].date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </View>
                
                {/* Weight change summary */}
                {(() => {
                  const filteredHistory = weightHistory.filter(w => {
                    if (weightPeriod === 'all') return true;
                    const now = new Date();
                    const entryDate = new Date(w.date);
                    const monthsAgo = (now.getFullYear() - entryDate.getFullYear()) * 12 + now.getMonth() - entryDate.getMonth();
                    if (weightPeriod === '2y') return monthsAgo <= 24;
                    if (weightPeriod === '1y') return monthsAgo <= 12;
                    if (weightPeriod === '6m') return monthsAgo <= 6;
                    if (weightPeriod === '3m') return monthsAgo <= 3;
                    if (weightPeriod === '1m') return monthsAgo <= 1;
                    return true;
                  });
                  
                  if (filteredHistory.length >= 2) {
                    const firstWeight = filteredHistory[0].weight_kg;
                    const lastWeight = filteredHistory[filteredHistory.length - 1].weight_kg;
                    const change = lastWeight - firstWeight;
                    const changeColor = change > 0 ? colors.error : change < 0 ? colors.fodmapLow : colors.textMuted;
                    
                    return (
                      <View style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        marginTop: 10,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          Variación: <Text style={{ fontWeight: '600', color: changeColor }}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)} kg
                          </Text>
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          Mín: {Math.min(...filteredHistory.map(w => w.weight_kg)).toFixed(1)} kg • 
                          Máx: {Math.max(...filteredHistory.map(w => w.weight_kg)).toFixed(1)} kg
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>
            )}

            {/* BMI Card - ALWAYS SHOW IF POSSIBLE */}
            {bmi !== null && bmiInfo ? (
              <Animated.View 
                entering={FadeInUp.delay(200).springify()}
                style={{
                  backgroundColor: bmiInfo.color + '12',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: bmiInfo.color + '40',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '500' }}>
                      Índice de Masa Corporal (IMC)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                      <Text style={{ 
                        fontSize: 40, 
                        fontWeight: '800', 
                        color: bmiInfo.color,
                      }}>
                        {bmi.toFixed(1)}
                      </Text>
                      <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '500' }}>
                        kg/m²
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 24,
                    backgroundColor: bmiInfo.color,
                  }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '700', 
                      color: '#FFFFFF',
                    }}>
                      {bmiInfo.label}
                    </Text>
                  </View>
                </View>
                
                {/* BMI Scale Visualization */}
                <View style={{ marginTop: 20 }}>
                  <View style={{ 
                    flexDirection: 'row', 
                    height: 10, 
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}>
                    <View style={{ flex: 1, backgroundColor: BMI_CATEGORIES.underweight.color }} />
                    <View style={{ flex: 1.5, backgroundColor: BMI_CATEGORIES.normal.color }} />
                    <View style={{ flex: 1, backgroundColor: BMI_CATEGORIES.overweight.color }} />
                    <View style={{ flex: 1.5, backgroundColor: BMI_CATEGORIES.obese.color }} />
                  </View>
                  {/* Indicator */}
                  <View style={{ 
                    position: 'absolute',
                    top: -2,
                    left: `${Math.min(Math.max((bmi - 15) / 25 * 100, 2), 98)}%`,
                    marginLeft: -8,
                  }}>
                    <View style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: '#FFFFFF',
                      borderWidth: 3,
                      borderColor: bmiInfo.color,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 3,
                      elevation: 4,
                    }} />
                  </View>
                </View>
                
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between',
                  marginTop: 8,
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>15</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>18.5</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>25</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>30</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>40</Text>
                </View>
              </Animated.View>
            ) : (
              // Prompt to add data for BMI
              <View style={{
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
              }}>
                <Ionicons name="analytics-outline" size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                  {!profile?.height_cm && !latestWeight 
                    ? 'Añade tu altura y peso para calcular tu IMC'
                    : !profile?.height_cm 
                    ? 'Añade tu altura para calcular tu IMC'
                    : 'Añade tu peso para calcular tu IMC'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          /* Empty State */
          <Pressable 
            onPress={() => setShowEditProfileModal(true)}
            style={{ padding: 32, alignItems: 'center' }}
          >
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.primary + '15',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}>
              <Ionicons name="person-add" size={28} color={colors.primary} />
            </View>
            <Text style={{ 
              fontSize: 15, 
              fontWeight: '600',
              color: colors.text,
              marginBottom: 4,
            }}>
              Configura tu perfil
            </Text>
            <Text style={{ 
              fontSize: 13, 
              color: colors.textSecondary,
              textAlign: 'center',
            }}>
              Añade tu información para calcular tu IMC y seguir tu progreso
            </Text>
          </Pressable>
        )}
      </Card>
      
      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditProfileModal(false)}
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
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Editar Perfil
              </Text>
              <Pressable onPress={() => setShowEditProfileModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 20, paddingBottom: 32 }}>
                {/* Birth Date */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Fecha de nacimiento
                  </Text>
                  <TextInput
                    value={editBirthDate}
                    onChangeText={setEditBirthDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 14,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                    }}
                  />
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    Ejemplo: 1990-05-15
                  </Text>
                </View>

                {/* Gender */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Sexo
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['male', 'female', 'other'] as Gender[]).map((gender) => (
                      <Pressable
                        key={gender}
                        onPress={() => setEditGender(gender)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 14,
                          borderRadius: 12,
                          backgroundColor: editGender === gender ? colors.primary : colors.cardElevated,
                          borderWidth: 2,
                          borderColor: editGender === gender ? colors.primary : 'transparent',
                        }}
                      >
                        <Ionicons 
                          name={gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'male-female'} 
                          size={18} 
                          color={editGender === gender ? '#FFFFFF' : colors.textSecondary} 
                        />
                        <Text style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: editGender === gender ? '#FFFFFF' : colors.textSecondary,
                        }}>
                          {GENDER_LABELS[gender]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Height */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Altura (cm)
                  </Text>
                  <TextInput
                    value={editHeight}
                    onChangeText={setEditHeight}
                    placeholder="170"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.text,
                      padding: 16,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                </View>

                {/* Save Button */}
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                    {saving ? 'Guardando...' : 'Guardar Perfil'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Weight Modal */}
      <Modal
        visible={showAddWeightModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddWeightModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
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
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Registrar Peso
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <Pressable onPress={() => setShowAddWeightModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ padding: 20 }}>
              {/* Weight Display */}
              <View style={{
                backgroundColor: colors.cardElevated,
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>
                  PESO ACTUAL
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <TextInput
                    value={newWeight}
                    onChangeText={setNewWeight}
                    placeholder="0.0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      fontSize: 56,
                      fontWeight: '800',
                      color: colors.fodmapLow,
                      textAlign: 'center',
                      minWidth: 150,
                    }}
                  />
                  <Text style={{ fontSize: 24, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                    kg
                  </Text>
                </View>
                
                {/* Previous weight comparison */}
                {latestWeight && (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginTop: 12,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Último: {latestWeight.weight_kg.toFixed(1)} kg
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Weight Buttons */}
              {latestWeight && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                    <Pressable
                      key={delta}
                      onPress={() => {
                        const base = newWeight ? parseFloat(newWeight) : latestWeight.weight_kg;
                        if (!isNaN(base)) {
                          setNewWeight((base + delta).toFixed(1));
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        backgroundColor: delta > 0 ? colors.fodmapHigh + '15' : colors.fodmapLow + '15',
                        borderRadius: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ 
                        fontSize: 14, 
                        fontWeight: '600', 
                        color: delta > 0 ? colors.fodmapHigh : colors.fodmapLow 
                      }}>
                        {delta > 0 ? '+' : ''}{delta}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Save Button */}
              <Pressable
                onPress={handleAddWeight}
                disabled={saving || !newWeight}
                style={{
                  backgroundColor: colors.fodmapLow,
                  paddingVertical: 18,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                  opacity: saving || !newWeight ? 0.6 : 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                  {saving ? 'Guardando...' : 'Guardar Peso'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
