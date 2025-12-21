import { Card } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

const CONTAINER_PADDING = 16;
const CARD_GAP = 8;

interface DashboardStats {
  todayMeals: number;
  todayWater: number;
  todaySymptoms: number;
  todayBowel: number;
  todayTreatments: number;
  todayActivities: number;
}

interface QuickAction {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  route: string;
  statKey: keyof DashboardStats;
  unit?: string;
}

interface RecentActivity {
  id: number;
  type: 'meal' | 'water' | 'symptom' | 'bowel' | 'treatment' | 'activity';
  title: string;
  time: string;
  date: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    todayMeals: 0,
    todayWater: 0,
    todaySymptoms: 0,
    todayBowel: 0,
    todayTreatments: 0,
    todayActivities: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 19) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadData();
      }
    }, [isReady])
  );

  const loadData = async () => {
    await Promise.all([loadStats(), loadRecentActivity()]);
  };

  const loadStats = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      
      const [mealsResult, waterResult, symptomsResult, bowelResult, treatmentsResult, activitiesResult] = await Promise.all([
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM meals WHERE date = ?', [today]),
        db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(glasses), 0) as total FROM water_intake WHERE date = ?', [today]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM symptoms WHERE date = ?', [today]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bowel_movements WHERE date = ?', [today]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM treatment_logs WHERE date = ?', [today]),
        db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM activity_logs WHERE date = ?', [today]),
      ]);

      setStats({
        todayMeals: mealsResult?.count || 0,
        todayWater: waterResult?.total || 0,
        todaySymptoms: symptomsResult?.count || 0,
        todayBowel: bowelResult?.count || 0,
        todayTreatments: treatmentsResult?.count || 0,
        todayActivities: activitiesResult?.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const activities: RecentActivity[] = [];

      // Get recent meals
      const meals = await db.getAllAsync<any>(
        'SELECT id, name, time, date FROM meals WHERE date = ? ORDER BY time DESC LIMIT 3',
        [today]
      );
      meals.forEach(m => activities.push({
        id: m.id,
        type: 'meal',
        title: m.name || 'Comida',
        time: m.time,
        date: m.date,
        color: colors.primary,
        icon: 'restaurant',
      }));

      // Get recent water
      const water = await db.getAllAsync<any>(
        'SELECT id, glasses, time, date FROM water_intake WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      );
      water.forEach(w => activities.push({
        id: w.id,
        type: 'water',
        title: `${w.glasses} vaso${w.glasses > 1 ? 's' : ''} de agua`,
        time: w.time,
        date: w.date,
        color: colors.water,
        icon: 'water',
      }));

      // Get recent symptoms
      const symptoms = await db.getAllAsync<any>(
        'SELECT id, type, intensity, time, date FROM symptoms WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      );
      symptoms.forEach(s => activities.push({
        id: s.id,
        type: 'symptom',
        title: `${s.type} (${s.intensity}/10)`,
        time: s.time,
        date: s.date,
        color: colors.symptom,
        icon: 'pulse',
      }));

      // Get recent bowel movements
      const bowel = await db.getAllAsync<any>(
        'SELECT id, bristol_type, time, date FROM bowel_movements WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      );
      bowel.forEach(b => activities.push({
        id: b.id,
        type: 'bowel',
        title: `Deposición (Bristol ${b.bristol_type})`,
        time: b.time,
        date: b.date,
        color: colors.bowel,
        icon: 'medical',
      }));

      // Get recent treatments
      const treatments = await db.getAllAsync<any>(
        'SELECT id, treatment_name, time, date FROM treatment_logs WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      );
      treatments.forEach(t => activities.push({
        id: t.id,
        type: 'treatment',
        title: t.treatment_name || 'Tratamiento',
        time: t.time,
        date: t.date,
        color: colors.treatment,
        icon: 'medkit',
      }));

      // Sort by time descending and take top 8
      activities.sort((a, b) => b.time.localeCompare(a.time));
      setRecentActivity(activities.slice(0, 8));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activityColor = '#FF9800';
  
  const quickActions: QuickAction[] = [
    { id: 'meal', icon: 'restaurant', label: 'Comidas', color: colors.primary, route: '/log?type=meal', statKey: 'todayMeals' },
    { id: 'water', icon: 'water', label: 'Agua', color: colors.water, route: '/log?type=water', statKey: 'todayWater', unit: 'vasos' },
    { id: 'activity', icon: 'fitness', label: 'Actividad', color: activityColor, route: '/log?type=activity', statKey: 'todayActivities' },
    { id: 'symptom', icon: 'pulse', label: 'Síntomas', color: colors.symptom, route: '/log?type=symptom', statKey: 'todaySymptoms' },
    { id: 'bowel', icon: 'medical', label: 'Deposición', color: colors.bowel, route: '/log?type=bowel', statKey: 'todayBowel' },
    { id: 'treatment', icon: 'medkit', label: 'Tratamiento', color: colors.treatment, route: '/log?type=treatment', statKey: 'todayTreatments' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: CONTAINER_PADDING, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <Text style={{ 
          fontSize: 28, 
          fontWeight: '700', 
          color: colors.text,
          marginBottom: 4,
        }}>
          {greeting} 👋
        </Text>
        <Text style={{ 
          fontSize: 15, 
          color: colors.textSecondary,
          marginBottom: 24,
        }}>
          ¿Cómo te sientes hoy?
        </Text>
      </Animated.View>

      {/* Stats + Quick Actions Combined */}
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: colors.text,
          marginBottom: 12,
        }}>
          Resumen del día
        </Text>
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap',
          marginHorizontal: -CARD_GAP / 2,
          marginBottom: 24,
        }}>
          {quickActions.map((action, index) => (
            <Animated.View 
              key={action.id}
              entering={FadeInRight.delay(300 + index * 50).springify()}
              style={{ 
                width: '33.33%',
                paddingHorizontal: CARD_GAP / 2,
                marginBottom: CARD_GAP,
              }}
            >
              <StatQuickActionCard 
                action={action} 
                value={stats[action.statKey]} 
                colors={colors} 
                router={router} 
              />
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Recent Activity */}
      <Animated.View entering={FadeInDown.delay(550).springify()}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: '600', 
          color: colors.text,
          marginBottom: 12,
        }}>
          Actividad reciente
        </Text>
        
        {recentActivity.length > 0 ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {recentActivity.map((activity, index) => (
              <View 
                key={`${activity.type}-${activity.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderBottomWidth: index < recentActivity.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: activity.color + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={activity.icon} size={18} color={activity.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    fontSize: 14, 
                    fontWeight: '500', 
                    color: colors.text,
                    marginBottom: 2,
                  }}>
                    {activity.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {activity.time}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons 
                name="leaf-outline" 
                size={48} 
                color={colors.textMuted} 
                style={{ marginBottom: 12 }}
              />
              <Text style={{ 
                fontSize: 15, 
                color: colors.textSecondary,
                textAlign: 'center',
              }}>
                Aún no hay registros de hoy{'\n'}¡Empieza añadiendo algo!
              </Text>
            </View>
          </Card>
        )}
      </Animated.View>

      {/* Tips Card */}
      <Animated.View entering={FadeInDown.delay(600).springify()} style={{ marginTop: 24 }}>
        <Card style={{ backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="bulb" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.primary,
                marginBottom: 4,
              }}>
                Consejo del día
              </Text>
              <Text style={{ 
                fontSize: 13, 
                color: colors.textSecondary,
                lineHeight: 18,
              }}>
                Registra tus comidas y síntomas regularmente para identificar qué alimentos pueden estar causando molestias.
              </Text>
            </View>
    </View>
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

function StatQuickActionCard({ 
  action, 
  value,
  colors, 
  router 
}: { 
  action: QuickAction; 
  value: number;
  colors: any; 
  router: any;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        onPress={() => router.push(action.route)}
        style={{
          backgroundColor: action.color + '12',
          borderRadius: 16,
          padding: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: action.color + '25',
          minHeight: 100,
          justifyContent: 'center',
        }}
      >
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: action.color + '20',
    alignItems: 'center',
    justifyContent: 'center',
          marginBottom: 6,
        }}>
          <Ionicons name={action.icon} size={20} color={action.color} />
        </View>
        <Text style={{ 
    fontSize: 20,
          fontWeight: '700', 
          color: action.color,
          marginBottom: 2,
        }}>
          {value}
        </Text>
        <Text style={{ 
          fontSize: 10, 
          fontWeight: '600', 
          color: action.color,
          opacity: 0.8,
          textAlign: 'center',
        }}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
