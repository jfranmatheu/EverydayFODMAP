import { Card, DailyNutritionCard, ProfileCard, TodayActivitiesCard, TodayTreatmentsCard } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import {
  UserProfile,
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  FadeInDown
} from 'react-native-reanimated';

const CONTAINER_PADDING = 16;

// Activity color constant
const ACTIVITY_COLOR = '#FF9800';

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
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Tablet/Desktop threshold
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  
  // Profile state (only for DailyNutritionCard)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Stats
  const [activeTreatments, setActiveTreatments] = useState(0);
  const [scheduledActivities, setScheduledActivities] = useState(0);

  // Greeting removed - moved to header

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
    await Promise.all([
      loadProfile(), 
      loadRecentActivity(),
      loadStats(),
    ]);
  };

  const loadProfile = async () => {
    try {
      const db = await getDatabase();
      const profileData = await db.getFirstAsync(
        'SELECT * FROM user_profile WHERE id = 1'
      ) as UserProfile | null;
      
      console.log('[Home] Loaded profile:', profileData);
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadStats = async () => {
    try {
      const db = await getDatabase();
      
      // Count active treatments
      const treatmentsResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM treatments WHERE is_active = 1'
      ) as { count: number } | null;
      setActiveTreatments(treatmentsResult?.count || 0);
      
      // Count scheduled activities
      const activitiesResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM scheduled_activities WHERE is_active = 1'
      ) as { count: number } | null;
      setScheduledActivities(activitiesResult?.count || 0);
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
      const meals = await db.getAllAsync(
        'SELECT id, name, time, date FROM meals WHERE date = ? ORDER BY time DESC LIMIT 3',
        [today]
      ) as any[];
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
      const water = await db.getAllAsync(
        'SELECT id, glasses, time, date FROM water_intake WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
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
      const symptoms = await db.getAllAsync(
        'SELECT id, type, intensity, time, date FROM symptoms WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
      symptoms.forEach(s => activities.push({
        id: s.id,
        type: 'symptom',
        title: `${s.type} (${s.intensity}/10)`,
        time: s.time,
        date: s.date,
        color: colors.symptom,
        icon: 'pulse',
      }));

      // Get recent activity logs
      const activityLogs = await db.getAllAsync(
        `SELECT al.id, at.name, al.time, al.date, al.duration_minutes 
         FROM activity_logs al
         LEFT JOIN activity_types at ON al.activity_type_id = at.id
         WHERE al.date = ? ORDER BY al.time DESC LIMIT 2`,
        [today]
      ) as any[];
      activityLogs.forEach(a => activities.push({
        id: a.id,
        type: 'activity',
        title: `${a.name || 'Actividad'} (${a.duration_minutes} min)`,
        time: a.time,
        date: a.date,
        color: ACTIVITY_COLOR,
        icon: 'fitness',
      }));

      // Get recent treatments
      const treatments = await db.getAllAsync(
        'SELECT id, treatment_name, time, date FROM treatment_logs WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
      treatments.forEach(t => activities.push({
        id: t.id,
        type: 'treatment',
        title: t.treatment_name || 'Tratamiento',
        time: t.time,
        date: t.date,
        color: colors.treatment,
        icon: 'medkit',
      }));

      // Sort by time descending and take top 6
      activities.sort((a, b) => b.time.localeCompare(a.time));
      setRecentActivity(activities.slice(0, 6));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <>
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

        {/* Profile and Nutrition Row (Large Screens) */}
        {isLargeScreen ? (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
            <View style={{ flex: 1, display: 'flex' }}>
              {/* User Profile Card */}
              <Animated.View entering={FadeInDown.delay(150).springify()} style={{ flex: 1 }}>
                <ProfileCard style={{ flex: 1 }} />
              </Animated.View>
            </View>
            <View style={{ flex: 1, display: 'flex' }}>
              {/* Daily Nutrition Summary - Gamified */}
              <Animated.View entering={FadeInDown.delay(200).springify()} style={{ flex: 1 }}>
                <DailyNutritionCard profile={profile} style={{ flex: 1 }} onProfileUpdated={loadProfile} />
              </Animated.View>
            </View>
          </View>
        ) : (
          <>
            {/* User Profile Card */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <ProfileCard style={{ marginBottom: 16 }} />
            </Animated.View>

            {/* Daily Nutrition Summary - Gamified */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <DailyNutritionCard profile={profile} onProfileUpdated={loadProfile} />
            </Animated.View>
          </>
        )}

        {/* Treatments and Activities Row (Large Screens) */}
        {isLargeScreen ? (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              {/* Today's Treatments - Enhanced Gamified Card */}
              <Animated.View entering={FadeInDown.delay(250).springify()}>
                <TodayTreatmentsCard />
              </Animated.View>
            </View>
            <View style={{ flex: 1 }}>
              {/* Today's Activities - Enhanced Gamified Card */}
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <TodayActivitiesCard />
              </Animated.View>
            </View>
          </View>
        ) : (
          <>
            {/* Today's Treatments - Enhanced Gamified Card */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <TodayTreatmentsCard />
            </Animated.View>

            {/* Today's Activities - Enhanced Gamified Card */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <TodayActivitiesCard />
            </Animated.View>
          </>
        )}

        {/* Recent Activity */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: 12,
          }}>
            Actividad de hoy
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
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons 
                  name="leaf-outline" 
                  size={40} 
                  color={colors.textMuted} 
                  style={{ marginBottom: 10 }}
                />
                <Text style={{ 
                  fontSize: 14, 
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}>
                  Aún no hay registros de hoy{'\n'}¡Ve al Diario para añadir algo!
                </Text>
              </View>
            </Card>
          )}
        </Animated.View>

        {/* Tip Card */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={{ marginTop: 20 }}>
          <Card style={{ backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="bulb" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: '600', 
                  color: colors.primary,
                  marginBottom: 3,
                }}>
                  Consejo
                </Text>
                <Text style={{ 
                  fontSize: 12, 
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
    </>
  );
}

