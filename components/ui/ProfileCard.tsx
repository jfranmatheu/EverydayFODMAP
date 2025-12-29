import React from 'react';
import { View, Text, Pressable, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  UserProfile, 
  WeightLog, 
  calculateAge, 
  calculateBMI, 
  getBMICategory,
  BMI_CATEGORIES,
  GENDER_LABELS,
  Gender
} from '@/lib/types';
import Animated, { FadeInUp } from 'react-native-reanimated';

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
  profile: UserProfile | null;
  latestWeight: WeightLog | null;
  weightHistory: WeightLog[];
  weightPeriod: 'all' | '2y' | '1y' | '6m' | '3m' | '1m';
  onWeightPeriodChange: (period: 'all' | '2y' | '1y' | '6m' | '3m' | '1m') => void;
  onEditProfile: () => void;
  onAddWeight: () => void;
  style?: ViewStyle;
}

export function ProfileCard({
  profile,
  latestWeight,
  weightHistory,
  weightPeriod,
  onWeightPeriodChange,
  onEditProfile,
  onAddWeight,
  style,
}: ProfileCardProps) {
  const { colors } = useTheme();
  
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
          onPress={onEditProfile}
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
              onPress={onAddWeight}
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
                      onWeightPeriodChange(periods[nextIndex]);
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
          onPress={onEditProfile}
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
  );
}

