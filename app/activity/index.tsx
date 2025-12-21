import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { Card, Button } from '@/components/ui';
import { getDatabase } from '@/lib/database';
import { ScheduledActivity, ActivityType, DAY_LABELS, FREQUENCY_TYPE_LABELS } from '@/lib/types';

interface ScheduledActivityWithType extends ScheduledActivity {
  type_name: string;
  icon: string;
  color: string;
  todayStatus?: 'completed' | 'skipped' | 'partial' | 'pending';
  completedCount?: number;
  totalCount?: number;
}

interface RecentLog {
  id: number;
  type_name: string;
  icon: string;
  color: string;
  duration_minutes: number;
  intensity: number;
  distance_km?: number;
  calories?: number;
  date: string;
  time: string;
}

export default function TrainingScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivityWithType[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

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
        LEFT JOIN activity_types at ON sa.activity_type_id = at.id
        ORDER BY sa.is_active DESC, sa.created_at DESC
      `);

      // Check today's status for each scheduled activity
      const scheduledWithStatus = await Promise.all(
        (scheduled || []).map(async (activity: any) => {
          const log = await db.getFirstAsync<any>(
            'SELECT * FROM scheduled_activity_logs WHERE scheduled_activity_id = ? AND date = ?',
            [activity.id, today]
          );
          
          // Get completion stats for this week
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const stats = await db.getFirstAsync<any>(
            `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
             FROM scheduled_activity_logs 
             WHERE scheduled_activity_id = ? AND date >= ?`,
            [activity.id, weekStart.toISOString().split('T')[0]]
          );
          
          return {
            ...activity,
            todayStatus: log?.status || 'pending',
            completedCount: stats?.completed || 0,
            totalCount: stats?.total || 0,
          };
        })
      );

      setScheduledActivities(scheduledWithStatus);

      // Load recent activity logs
      const logs = await db.getAllAsync<any>(`
        SELECT al.*, at.name as type_name, at.icon, at.color
        FROM activity_logs al
        LEFT JOIN activity_types at ON al.activity_type_id = at.id
        ORDER BY al.date DESC, al.time DESC
        LIMIT 15
      `);
      setRecentLogs(logs || []);
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

  const handleDeleteActivity = async (activityId: number, name: string) => {
    Alert.alert(
      'Eliminar entrenamiento',
      `¿Estás seguro de que quieres eliminar "${name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM scheduled_activity_logs WHERE scheduled_activity_id = ?', [activityId]);
              await db.runAsync('DELETE FROM scheduled_activities WHERE id = ?', [activityId]);
              loadData();
            } catch (error) {
              console.error('Error deleting:', error);
            }
          },
        },
      ]
    );
  };

  const getFrequencyDescription = (activity: ScheduledActivityWithType) => {
    if (!activity.frequency_type) return '';
    
    switch (activity.frequency_type) {
      case 'daily':
        return 'Todos los días';
      case 'weekly':
        return 'Semanal';
      case 'specific_days':
        if (activity.frequency_value) {
          try {
            const days = activity.frequency_value.split(',').map(d => {
              const idx = parseInt(d);
              return DAY_LABELS[idx]?.slice(0, 3) || d;
            });
            return days.join(', ');
          } catch {
            return 'Días específicos';
          }
        }
        return 'Días específicos';
      case 'interval':
        return `Cada ${activity.frequency_value || '?'} días`;
      case 'monthly':
        return 'Mensual';
      default:
        return '';
    }
  };

  const filteredActivities = filter === 'active' 
    ? scheduledActivities.filter(a => a.is_active)
    : scheduledActivities;

  const todayActivities = filteredActivities.filter(a => a.is_active && a.todayStatus === 'pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Entrenamientos',
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
        {/* Header Actions */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
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
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                Registrar actividad
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
                backgroundColor: activityColor + '15',
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: activityColor,
              }}
            >
              <Ionicons name="calendar" size={20} color={activityColor} />
              <Text style={{ color: activityColor, fontWeight: '700', fontSize: 14 }}>
                Nuevo programa
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Today's Pending Activities */}
        {todayActivities.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 12 
            }}>
              <Ionicons name="today" size={20} color={activityColor} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                Hoy pendiente ({todayActivities.length})
              </Text>
            </View>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {todayActivities.map((activity, index) => (
                <Animated.View 
                  key={activity.id}
                  entering={FadeInRight.delay(200 + index * 50).springify()}
                >
                  <Card style={{ 
                    borderLeftWidth: 4,
                    borderLeftColor: activity.color || activityColor,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: (activity.color || activityColor) + '20',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 14,
                      }}>
                        <Ionicons 
                          name={(activity.icon || 'fitness') as any} 
                          size={24} 
                          color={activity.color || activityColor} 
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                          {activity.name}
                        </Text>
                        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                          {activity.duration_minutes} min · {activity.type_name || 'Actividad'}
                        </Text>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => handleMarkStatus(activity.id, 'completed')}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: colors.success + '20',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="checkmark" size={22} color={colors.success} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleMarkStatus(activity.id, 'skipped')}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: colors.error + '15',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="close" size={22} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Scheduled Programs */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            alignItems: 'center', 
            marginBottom: 12 
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              Mis programas
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['active', 'all'] as const).map(f => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: filter === f ? activityColor : colors.cardElevated,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: filter === f ? '#FFFFFF' : colors.textSecondary,
                  }}>
                    {f === 'active' ? 'Activos' : 'Todos'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {filteredActivities.length > 0 ? (
            <View style={{ gap: 10, marginBottom: 24 }}>
              {filteredActivities.map((activity, index) => {
                const isCompleted = activity.todayStatus === 'completed';
                const isSkipped = activity.todayStatus === 'skipped';
                const isInactive = !activity.is_active;

                return (
                  <Animated.View 
                    key={activity.id}
                    entering={FadeInRight.delay(250 + index * 40).springify()}
                  >
                    <Card style={{ 
                      opacity: isInactive ? 0.5 : 1,
                      borderLeftWidth: 3,
                      borderLeftColor: isCompleted ? colors.success 
                        : isSkipped ? colors.error 
                        : activity.color || activityColor,
                    }}>
                      <Pressable
                        onPress={() => router.push(`/activity/schedule?id=${activity.id}`)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: (activity.color || activityColor) + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Ionicons 
                            name={(activity.icon || 'fitness') as any} 
                            size={22} 
                            color={activity.color || activityColor} 
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ 
                              fontSize: 15, 
                              fontWeight: '600', 
                              color: colors.text,
                              textDecorationLine: isSkipped ? 'line-through' : 'none',
                            }}>
                              {activity.name}
                            </Text>
                            {isCompleted && (
                              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                            )}
                            {isSkipped && (
                              <Ionicons name="close-circle" size={16} color={colors.error} />
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              {activity.duration_minutes} min
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textMuted }}>·</Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              {getFrequencyDescription(activity)}
                            </Text>
                            {isInactive && (
                              <>
                                <Text style={{ fontSize: 12, color: colors.textMuted }}>·</Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                                  PAUSADO
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                        <Pressable
                          onPress={() => handleDeleteActivity(activity.id, activity.name)}
                          hitSlop={8}
                          style={{ padding: 8 }}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                        </Pressable>
                      </Pressable>
                    </Card>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 32, marginBottom: 24 }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: activityColor + '15',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Ionicons name="calendar-outline" size={32} color={activityColor} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>
                No hay programas de entrenamiento
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }}>
                Crea un programa para planificar tus entrenamientos recurrentes
              </Text>
              <Button 
                onPress={() => router.push('/activity/schedule')}
                style={{ marginTop: 20 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
                    Crear programa
                  </Text>
                </View>
              </Button>
            </Card>
          )}
        </Animated.View>

        {/* Recent History */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '700', 
            color: colors.text,
            marginBottom: 12,
          }}>
            Historial reciente
          </Text>
          {recentLogs.length > 0 ? (
            <View style={{ gap: 8 }}>
              {recentLogs.map((log, index) => (
                <Animated.View 
                  key={log.id}
                  entering={FadeInRight.delay(350 + index * 25).springify()}
                >
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    gap: 12,
                  }}>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: (log.color || activityColor) + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ionicons 
                        name={(log.icon || 'fitness') as any} 
                        size={18} 
                        color={log.color || activityColor} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        {log.type_name || 'Actividad'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {new Date(log.date + 'T12:00:00').toLocaleDateString('es-ES', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short' 
                        })} · {log.time?.slice(0, 5)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {log.duration_minutes} min
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {log.distance_km && (
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            {log.distance_km} km
                          </Text>
                        )}
                        <View style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                          backgroundColor: log.intensity <= 3 ? colors.fodmapLow 
                            : log.intensity <= 6 ? activityColor 
                            : colors.fodmapHigh,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                            {log.intensity}/10
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={{
              alignItems: 'center',
              padding: 24,
              backgroundColor: colors.card,
              borderRadius: 12,
            }}>
              <Ionicons name="fitness-outline" size={40} color={colors.textMuted} />
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                No hay actividades registradas
              </Text>
              <Pressable 
                onPress={() => router.push('/log?type=activity')}
                style={{ marginTop: 12 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: activityColor }}>
                  Registrar primera actividad →
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}
