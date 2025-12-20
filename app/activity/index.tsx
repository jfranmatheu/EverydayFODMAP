import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Card, Button } from '@/components/ui';
import { getDatabase } from '@/lib/database';
import { ScheduledActivity, ActivityType, ScheduledActivityLog, DAY_LABELS, FREQUENCY_TYPE_LABELS } from '@/lib/types';

interface ScheduledActivityWithType extends ScheduledActivity {
  activity_type: ActivityType;
  todayStatus?: 'completed' | 'skipped' | 'partial' | 'pending';
}

export default function ActivityScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivityWithType[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const activityColor = '#FF9800';

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadData();
      }
    }, [isReady])
  );

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];

      // Load scheduled activities with their types
      const scheduled = await db.getAllAsync<any>(`
        SELECT sa.*, at.name as type_name, at.icon, at.color 
        FROM scheduled_activities sa
        JOIN activity_types at ON sa.activity_type_id = at.id
        WHERE sa.is_active = 1
        ORDER BY sa.created_at DESC
      `);

      // Check today's status for each scheduled activity
      const scheduledWithStatus = await Promise.all(
        scheduled.map(async (activity: any) => {
          const log = await db.getFirstAsync<ScheduledActivityLog>(
            'SELECT * FROM scheduled_activity_logs WHERE scheduled_activity_id = ? AND date = ?',
            [activity.id, today]
          );
          return {
            ...activity,
            activity_type: {
              id: activity.activity_type_id,
              name: activity.type_name,
              icon: activity.icon,
              color: activity.color,
            },
            todayStatus: log?.status || 'pending',
          };
        })
      );

      setScheduledActivities(scheduledWithStatus);

      // Load recent activity logs
      const logs = await db.getAllAsync<any>(`
        SELECT al.*, at.name as type_name, at.icon, at.color
        FROM activity_logs al
        JOIN activity_types at ON al.activity_type_id = at.id
        ORDER BY al.date DESC, al.time DESC
        LIMIT 10
      `);
      setRecentLogs(logs);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkStatus = async (activityId: number, status: 'completed' | 'skipped') => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];

      // Check if log exists
      const existing = await db.getFirstAsync(
        'SELECT id FROM scheduled_activity_logs WHERE scheduled_activity_id = ? AND date = ?',
        [activityId, today]
      );

      if (existing) {
        await db.runAsync(
          'UPDATE scheduled_activity_logs SET status = ? WHERE scheduled_activity_id = ? AND date = ?',
          [status, activityId, today]
        );
      } else {
        await db.runAsync(
          'INSERT INTO scheduled_activity_logs (scheduled_activity_id, date, status) VALUES (?, ?, ?)',
          [activityId, today, status]
        );
      }

      loadData();
    } catch (error) {
      console.error('Error marking status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return { name: 'checkmark-circle', color: colors.success };
      case 'skipped':
        return { name: 'close-circle', color: colors.error };
      case 'partial':
        return { name: 'ellipse-outline', color: colors.warning };
      default:
        return { name: 'ellipse-outline', color: colors.textMuted };
    }
  };

  const getFrequencyDescription = (activity: ScheduledActivityWithType) => {
    switch (activity.frequency_type) {
      case 'daily':
        return 'Todos los días';
      case 'weekly':
        return 'Una vez por semana';
      case 'specific_days':
        if (activity.frequency_value) {
          const days = activity.frequency_value.split(',').map(d => DAY_LABELS[parseInt(d)].slice(0, 3));
          return days.join(', ');
        }
        return 'Días específicos';
      case 'interval':
        return `Cada ${activity.frequency_value} días`;
      case 'monthly':
        return 'Una vez al mes';
      default:
        return '';
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Actividades',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activityColor} />
        }
      >
        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <Pressable
              onPress={() => router.push('/log?type=activity')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: activityColor,
                paddingVertical: 14,
                borderRadius: 12,
              }}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>
                Registrar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/activity/schedule')}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: activityColor + '20',
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: activityColor,
              }}
            >
              <Ionicons name="calendar" size={20} color={activityColor} />
              <Text style={{ color: activityColor, fontWeight: '600', fontSize: 15 }}>
                Programar
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Today's Scheduled Activities */}
        {scheduledActivities.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '600', 
              color: colors.text,
              marginBottom: 12,
            }}>
              Actividades de hoy
            </Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {scheduledActivities.map((activity, index) => {
                const statusIcon = getStatusIcon(activity.todayStatus || 'pending');
                const isCompleted = activity.todayStatus === 'completed';
                const isSkipped = activity.todayStatus === 'skipped';

                return (
                  <Animated.View 
                    key={activity.id}
                    entering={FadeInRight.delay(200 + index * 50).springify()}
                  >
                    <Card style={{ 
                      opacity: isSkipped ? 0.5 : 1,
                      borderLeftWidth: 4,
                      borderLeftColor: activity.activity_type.color,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: activity.activity_type.color + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Ionicons 
                            name={activity.activity_type.icon as any} 
                            size={22} 
                            color={activity.activity_type.color} 
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ 
                            fontSize: 15, 
                            fontWeight: '600', 
                            color: colors.text,
                            textDecorationLine: isSkipped ? 'line-through' : 'none',
                          }}>
                            {activity.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            {activity.duration_minutes} min · {getFrequencyDescription(activity)}
                          </Text>
                        </View>
                        
                        {/* Status / Actions */}
                        {activity.todayStatus === 'pending' ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() => handleMarkStatus(activity.id, 'completed')}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: colors.success + '20',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="checkmark" size={20} color={colors.success} />
                            </Pressable>
                            <Pressable
                              onPress={() => handleMarkStatus(activity.id, 'skipped')}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: colors.error + '20',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="close" size={20} color={colors.error} />
                            </Pressable>
                          </View>
                        ) : (
                          <Ionicons 
                            name={statusIcon.name as any} 
                            size={28} 
                            color={statusIcon.color} 
                          />
                        )}
                      </View>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Recent Activity Logs */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: 12,
          }}>
            Historial reciente
          </Text>
          {recentLogs.length > 0 ? (
            <View style={{ gap: 10 }}>
              {recentLogs.map((log, index) => (
                <Animated.View 
                  key={log.id}
                  entering={FadeInRight.delay(300 + index * 30).springify()}
                >
                  <Card>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: log.color + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}>
                        <Ionicons name={log.icon as any} size={20} color={log.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                          {log.type_name}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                          {log.date} · {log.duration_minutes} min
                          {log.distance_km ? ` · ${log.distance_km} km` : ''}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: activityColor + '20',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: activityColor }}>
                          {log.intensity}/10
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="fitness-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>
                  No hay actividades registradas aún
                </Text>
                <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
                  Registra tu primera actividad para empezar
                </Text>
              </View>
            </Card>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

