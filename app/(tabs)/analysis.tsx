import { Card } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeInDown
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WeeklyStats {
  meals: number;
  water: number;
  symptoms: number;
  bowel: number;
  avgSymptomIntensity: number;
}

interface SymptomCorrelation {
  food: string;
  symptomCount: number;
  avgIntensity: number;
  occurrences: number;
}

interface DailyTrend {
  date: string;
  dayName: string;
  symptoms: number;
  meals: number;
  water: number;
}

type TimeRange = '7d' | '14d' | '30d';

export default function AnalysisScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    meals: 0,
    water: 0,
    symptoms: 0,
    bowel: 0,
    avgSymptomIntensity: 0,
  });
  const [correlations, setCorrelations] = useState<SymptomCorrelation[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [topSymptoms, setTopSymptoms] = useState<{ type: string; count: number; avgIntensity: number }[]>([]);
  const [bristolAvg, setBristolAvg] = useState<number>(0);

  useEffect(() => {
    if (isReady) {
      loadAnalysis();
    }
  }, [isReady, timeRange]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadAnalysis();
      }
    }, [isReady, timeRange])
  );

  const getDaysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  const getDayName = (dateStr: string): string => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  const loadAnalysis = async () => {
    try {
      const db = await getDatabase();
      const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
      const startDate = getDaysAgo(days);
      const today = new Date().toISOString().split('T')[0];

      // Weekly/Period stats
      const [mealsResult, waterResult, symptomsResult, bowelResult, avgIntensityResult] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals WHERE date >= ?', [startDate]),
        db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(glasses), 0) as total FROM water_intake WHERE date >= ?', [startDate]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM symptoms WHERE date >= ?', [startDate]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bowel_movements WHERE date >= ?', [startDate]),
        db.getFirstAsync<{ avg: number }>('SELECT COALESCE(AVG(intensity), 0) as avg FROM symptoms WHERE date >= ?', [startDate]),
      ]);

      setWeeklyStats({
        meals: mealsResult?.count || 0,
        water: waterResult?.total || 0,
        symptoms: symptomsResult?.count || 0,
        bowel: bowelResult?.count || 0,
        avgSymptomIntensity: avgIntensityResult?.avg || 0,
      });

      // Bristol average
      const bristolResult = await db.getFirstAsync<{ avg: number }>(
        'SELECT COALESCE(AVG(bristol_type), 0) as avg FROM bowel_movements WHERE date >= ?',
        [startDate]
      );
      setBristolAvg(bristolResult?.avg || 0);

      // Top symptoms
      const topSymptomsResult = await db.getAllAsync<{ type: string; count: number; avg_intensity: number }>(
        `SELECT type, COUNT(*) as count, AVG(intensity) as avg_intensity 
         FROM symptoms WHERE date >= ? 
         GROUP BY type ORDER BY count DESC LIMIT 5`,
        [startDate]
      );
      setTopSymptoms(topSymptomsResult.map(s => ({
        type: s.type,
        count: s.count || 0,
        avgIntensity: s.avg_intensity || 0,
      })));

      // Daily trends (last 7 days for chart)
      const trends: DailyTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = getDaysAgo(i);
        const dayMeals = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM meals WHERE date = ?', [date]
        );
        const daySymptoms = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM symptoms WHERE date = ?', [date]
        );
        const dayWater = await db.getFirstAsync<{ total: number }>(
          'SELECT COALESCE(SUM(glasses), 0) as total FROM water_intake WHERE date = ?', [date]
        );
        
        trends.push({
          date,
          dayName: getDayName(date),
          meals: dayMeals?.count || 0,
          symptoms: daySymptoms?.count || 0,
          water: dayWater?.total || 0,
        });
      }
      setDailyTrends(trends);

      // Food-symptom correlations (simplified analysis)
      // Look for meals that occurred within 4 hours before symptoms
      const correlationsResult = await db.getAllAsync<{ name: string; symptom_count: number }>(
        `SELECT m.name, COUNT(s.id) as symptom_count
         FROM meals m
         LEFT JOIN symptoms s ON m.date = s.date 
           AND s.time > m.time 
         WHERE m.date >= ? AND s.id IS NOT NULL
         GROUP BY m.name
         HAVING symptom_count > 0
         ORDER BY symptom_count DESC
         LIMIT 10`,
        [startDate]
      );
      
      setCorrelations(correlationsResult.map(c => ({
        food: c.name,
        symptomCount: c.symptom_count,
        avgIntensity: 0,
        occurrences: 1,
      })));

    } catch (error) {
      console.error('Error loading analysis:', error);
    }
  };

  const timeRangeOptions: { id: TimeRange; label: string }[] = [
    { id: '7d', label: '7 días' },
    { id: '14d', label: '14 días' },
    { id: '30d', label: '30 días' },
  ];

  const maxTrendValue = Math.max(...dailyTrends.map(d => Math.max(d.symptoms, d.meals, d.water)), 1);

  const StatBox = ({ icon, label, value, color, subtitle }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string; 
    value: string | number;
    color: string;
    subtitle?: string;
  }) => (
    <View style={{ 
      flex: 1, 
      backgroundColor: color + '10', 
      borderRadius: 12, 
      padding: 14,
      borderWidth: 1,
      borderColor: color + '20',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: color }}>{value}</Text>
      {subtitle && (
        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{subtitle}</Text>
      )}
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Time Range Selector */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {timeRangeOptions.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setTimeRange(option.id)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: timeRange === option.id ? colors.primary : colors.card,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: timeRange === option.id ? colors.primary : colors.border,
              }}
            >
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: timeRange === option.id ? '#FFFFFF' : colors.textSecondary,
              }}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Summary Stats */}
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: colors.text,
          marginBottom: 12,
        }}>
          Resumen del período
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatBox 
            icon="restaurant" 
            label="Comidas" 
            value={weeklyStats.meals} 
            color={colors.primary}
          />
          <StatBox 
            icon="water" 
            label="Agua" 
            value={weeklyStats.water} 
            color={colors.water}
            subtitle="vasos"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <StatBox 
            icon="pulse" 
            label="Síntomas" 
            value={weeklyStats.symptoms} 
            color={colors.symptom}
            subtitle={`Intensidad media: ${(weeklyStats.avgSymptomIntensity || 0).toFixed(1)}`}
          />
          <StatBox 
            icon="medical" 
            label="Deposiciones" 
            value={weeklyStats.bowel} 
            color={colors.bowel}
            subtitle={bristolAvg > 0 ? `Bristol medio: ${(bristolAvg || 0).toFixed(1)}` : undefined}
          />
        </View>
      </Animated.View>

      {/* Daily Trend Chart */}
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: colors.text,
          marginBottom: 12,
        }}>
          Tendencia semanal
        </Text>
        <Card style={{ marginBottom: 20 }}>
          {/* Legend */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Comidas</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.symptom }} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Síntomas</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.water }} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Agua</Text>
            </View>
          </View>
          
          {/* Chart */}
          <View style={{ height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            {dailyTrends.map((day, index) => (
              <View key={day.date} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 }}>
                  {/* Meals bar */}
                  <View style={{
                    width: 8,
                    height: Math.max((day.meals / maxTrendValue) * 80, 4),
                    backgroundColor: colors.primary,
                    borderRadius: 4,
                  }} />
                  {/* Symptoms bar */}
                  <View style={{
                    width: 8,
                    height: Math.max((day.symptoms / maxTrendValue) * 80, 4),
                    backgroundColor: colors.symptom,
                    borderRadius: 4,
                  }} />
                  {/* Water bar */}
                  <View style={{
                    width: 8,
                    height: Math.max((day.water / maxTrendValue) * 80, 4),
                    backgroundColor: colors.water,
                    borderRadius: 4,
                  }} />
                </View>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 8 }}>
                  {day.dayName}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>

      {/* Top Symptoms */}
      {topSymptoms.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: 12,
          }}>
            Síntomas más frecuentes
          </Text>
          <Card style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            {topSymptoms.map((symptom, index) => (
              <View 
                key={symptom.type}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderBottomWidth: index < topSymptoms.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.symptom + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.symptom }}>
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                    {symptom.type}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Intensidad media: {(symptom.avgIntensity || 0).toFixed(1)}/10
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.symptom + '20',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.symptom }}>
                    {symptom.count}×
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Animated.View>
      )}

      {/* Food Correlations */}
      <Animated.View entering={FadeInDown.delay(300).springify()}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: colors.text,
          marginBottom: 12,
        }}>
          Posibles correlaciones
        </Text>
        {correlations.length > 0 ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {correlations.slice(0, 5).map((correlation, index) => (
              <View 
                key={correlation.food}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderBottomWidth: index < Math.min(correlations.length, 5) - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.fodmapHigh + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="alert-circle" size={18} color={colors.fodmapHigh} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                    {correlation.food}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Síntomas registrados el mismo día
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.fodmapHigh + '20',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fodmapHigh }}>
                    {correlation.symptomCount} sínt.
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons 
                name="analytics-outline" 
                size={48} 
                color={colors.textMuted} 
                style={{ marginBottom: 12 }}
              />
              <Text style={{ 
                fontSize: 15, 
                color: colors.textSecondary,
                textAlign: 'center',
              }}>
                Registra más comidas y síntomas{'\n'}para ver correlaciones
              </Text>
            </View>
          </Card>
        )}
      </Animated.View>

      {/* Info Card */}
      <Animated.View entering={FadeInDown.delay(350).springify()} style={{ marginTop: 20 }}>
        <Card style={{ backgroundColor: colors.water + '10', borderColor: colors.water + '30' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Ionicons name="information-circle" size={24} color={colors.water} />
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 13, 
                color: colors.textSecondary,
                lineHeight: 18,
              }}>
                Las correlaciones son orientativas. Consulta con un profesional de salud para interpretar los resultados y ajustar tu dieta FODMAP.
              </Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

