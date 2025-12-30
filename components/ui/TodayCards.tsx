import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useTheme } from '@/contexts/ThemeContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { getDatabase } from '@/lib/database';
import { useFocusEffect, useRouter } from 'expo-router';

const ACTIVITY_COLOR = '#FF9800';

// Helper function to generate doses based on frequency
const generateDosesForFrequency = (frequency: string, frequencyValue?: string): any[] => {
  switch (frequency) {
    case 'once_daily':
      return ['08:00'];
    case 'twice_daily':
      return ['08:00', '20:00'];
    case 'three_times_daily':
      return ['08:00', '14:00', '20:00'];
    case 'four_times_daily':
      return ['08:00', '12:00', '16:00', '20:00'];
    case 'every_4_hours':
      return ['06:00', '10:00', '14:00', '18:00', '22:00'];
    case 'every_6_hours':
      return ['06:00', '12:00', '18:00', '00:00'];
    case 'every_8_hours':
      return ['06:00', '14:00', '22:00'];
    case 'every_12_hours':
      return ['08:00', '20:00'];
    case 'as_needed':
      return ['sin horario'];
    default:
      return ['08:00'];
  }
};

interface TodayTreatmentsCardProps {
  style?: any;
}

export function TodayTreatmentsCard({ style }: TodayTreatmentsCardProps) {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  
  // Internal state
  const [todayTreatments, setTodayTreatments] = useState<any[]>([]);
  
  // Load treatments
  const loadTodayTreatments = useCallback(async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay(); // 0 = Sunday
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDayName = dayNames[dayOfWeek];

      console.log('[TodayTreatmentsCard] Loading treatments for:', today, todayDayName);

      // Get ALL active treatments first (simpler query for web compatibility)
      const allTreatments = await db.getAllAsync(
        `SELECT * FROM treatments WHERE is_active = 1`,
        []
      ) as any[];

      console.log('[TodayTreatmentsCard] All active treatments:', allTreatments.length);

      // Filter treatments that are valid for today
      const todayTreatments = allTreatments.filter(t => {
        // Chronic treatments are always valid
        if (t.is_chronic === 1) return true;
        
        // Check date range
        const hasStartDate = t.start_date && t.start_date !== '';
        const hasEndDate = t.end_date && t.end_date !== '';
        
        if (!hasStartDate) return true; // No start date = always valid
        if (t.start_date > today) return false; // Haven't started yet
        if (hasEndDate && t.end_date < today) return false; // Already ended
        
        return true;
      });

      console.log('[TodayTreatmentsCard] Treatments valid for today:', todayTreatments.length);

      // Process treatments to get today's doses
      const processedTreatments: any[] = [];

      for (const treatment of todayTreatments) {
        console.log(`[TodayTreatmentsCard] Processing treatment: ${treatment.name}`);
        
        // Check if today is a valid day for this treatment
        let isValidDay = true;
        if (treatment.specific_days && treatment.specific_days !== '') {
          try {
            // specific_days can be a JSON array or comma-separated string
            let daysArray: string[] = [];
            if (treatment.specific_days.startsWith('[')) {
              daysArray = JSON.parse(treatment.specific_days);
            } else {
              daysArray = treatment.specific_days.split(',').map((s: string) => s.trim());
            }
            isValidDay = daysArray.includes(todayDayName);
            console.log(`[TodayTreatmentsCard]   -> Specific days: ${daysArray}, today: ${todayDayName}, valid: ${isValidDay}`);
          } catch (e) {
            // If parsing fails, assume it's valid
            console.log(`[TodayTreatmentsCard]   -> Parse error for specific_days, assuming valid`);
            isValidDay = true;
          }
        } else {
          console.log(`[TodayTreatmentsCard]   -> No specific_days restriction, valid for all days`);
        }

        if (!isValidDay) {
          console.log(`[TodayTreatmentsCard]   -> Skipping, not valid for today`);
          continue;
        }

        // Parse doses from JSON
        let treatmentDoses: any[] = [];
        try {
          treatmentDoses = treatment.doses ? JSON.parse(treatment.doses) : [];
          console.log(`[TodayTreatmentsCard]   -> Parsed doses from JSON:`, treatmentDoses);
        } catch (e) {
          console.log(`[TodayTreatmentsCard]   -> Could not parse doses, using empty array`);
          treatmentDoses = [];
        }

        // Generate doses based on frequency if no specific doses
        if (treatmentDoses.length === 0) {
          const frequency = treatment.frequency || 'once_daily';
          treatmentDoses = generateDosesForFrequency(frequency, treatment.frequency_value);
          console.log(`[TodayTreatmentsCard]   -> Generated doses from frequency "${frequency}":`, treatmentDoses);
        }

        // Get taken logs for today
        const takenLogs = await db.getAllAsync(
          'SELECT * FROM treatment_logs WHERE treatment_id = ? AND date = ?',
          [treatment.id, today]
        ) as any[];
        
        console.log(`[TodayTreatmentsCard] Treatment ${treatment.name}: ${takenLogs.length} logs for today`);

        const takenMap = new Map();
        takenLogs.forEach(log => {
          if (log.scheduled_time) {
            takenMap.set(log.scheduled_time, log.taken === 1);
          } else if (log.dose_index !== undefined) {
            takenMap.set(log.dose_index.toString(), log.taken === 1);
          }
        });

        // Create dose entries for today
        treatmentDoses.forEach((dose, index) => {
          const doseTime = typeof dose === 'string' ? dose : dose.time;
          const isTaken = takenMap.get(doseTime) || takenMap.get(index.toString()) || false;

          processedTreatments.push({
            ...treatment,
            dose_time: doseTime,
            dose_index: index,
            dose_amount: typeof dose === 'object' ? dose.amount : treatment.dosage_amount,
            dose_unit: typeof dose === 'object' ? dose.unit : treatment.dosage_unit,
            is_taken: isTaken,
            dose_notes: typeof dose === 'object' ? dose.notes : null,
          });
        });
      }

      setTodayTreatments(processedTreatments);
      console.log('[TodayTreatmentsCard] Processed treatments:', processedTreatments.length);
    } catch (error) {
      console.error('Error loading today treatments:', error);
    }
  }, []);
  
  useEffect(() => {
    if (isReady) {
      loadTodayTreatments();
    }
  }, [isReady, loadTodayTreatments]);
  
  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadTodayTreatments();
      }
    }, [isReady, loadTodayTreatments])
  );
  
  // Handler
  const handleMarkDose = async (treatment: any, taken: boolean) => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Check if already logged for this specific dose
      const existing = await db.getFirstAsync(
        'SELECT id FROM treatment_logs WHERE treatment_id = ? AND date = ? AND scheduled_time = ?',
        [treatment.id, today, treatment.dose_time]
      ) as any;

      if (existing) {
        // Update existing log
        await db.runAsync(
          'UPDATE treatment_logs SET taken = ?, time = ?, amount_taken = ?, unit = ? WHERE id = ?',
          [taken ? 1 : 0, timeStr, treatment.dose_amount, treatment.dose_unit, existing.id]
        );
      } else {
        // Create new log entry
        await db.runAsync(
          'INSERT INTO treatment_logs (treatment_id, treatment_name, scheduled_time, dose_index, date, time, taken, skipped, amount_taken, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            treatment.id,
            treatment.name,
            treatment.dose_time,
            treatment.dose_index,
            today,
            timeStr,
            taken ? 1 : 0,
            taken ? 0 : 1,
            treatment.dose_amount,
            treatment.dose_unit
          ]
        );
      }

      await loadTodayTreatments();
    } catch (error) {
      console.error('Error marking dose:', error);
      Alert.alert('Error', 'No se pudo registrar la dosis');
    }
  };
  
  const totalDoses = todayTreatments.length;
  const takenDoses = todayTreatments.filter(t => t.is_taken).length;
  const progress = totalDoses > 0 ? takenDoses / totalDoses : 0;
  const allComplete = totalDoses > 0 && takenDoses === totalDoses;

  const treatmentColor = colors.treatment;

  // Group treatments by name to show per-treatment progress
  const groupedTreatments = todayTreatments.reduce((acc, treatment) => {
    const key = treatment.name;
    if (!acc[key]) {
      acc[key] = {
        ...treatment,
        doses: []
      };
    }
    acc[key].doses.push(treatment);
    return acc;
  }, {} as any);

  const treatmentList = Object.values(groupedTreatments);
  
  return (
    <Card style={{
      marginBottom: 16,
      padding: 0,
      overflow: 'hidden',
      borderWidth: allComplete ? 2 : 1,
      borderColor: allComplete ? colors.fodmapLow : colors.border,
      backgroundColor: allComplete ? colors.fodmapLow + '05' : colors.card,
      ...style,
    }}>
      {/* Header */}
      <Pressable
        onPress={() => router.push('/treatment')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          backgroundColor: allComplete ? colors.fodmapLow + '15' : treatmentColor + '10',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Progress Indicator */}
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: allComplete ? colors.fodmapLow : treatmentColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            {allComplete ? (
              <Ionicons name="checkmark-circle" size={32} color={colors.fodmapLow} />
            ) : totalDoses === 0 ? (
              <Ionicons name="medkit-outline" size={24} color={colors.textMuted} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: treatmentColor }}>
                  {takenDoses}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: -2 }}>
                  /{totalDoses}
                </Text>
              </View>
            )}
          </View>

          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              💊 Medicación de Hoy
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {allComplete
                ? '¡Todas las dosis tomadas!'
                : totalDoses === 0
                ? 'Sin tratamientos programados'
                : `${takenDoses} de ${totalDoses} dosis tomadas`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {totalDoses > 0 && !allComplete && (
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: treatmentColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </Pressable>

      {/* Progress Bar */}
      {totalDoses > 0 && (
        <View style={{
          height: 6,
          backgroundColor: colors.cardElevated,
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <View style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: allComplete ? colors.fodmapLow : treatmentColor,
            borderRadius: 3,
          }} />
        </View>
      )}

      {/* Treatments List - Grouped by treatment name */}
      {totalDoses > 0 && !allComplete && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
          {treatmentList.map((treatment: any) => (
            <View key={treatment.name} style={{
              backgroundColor: colors.cardElevated,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              {/* Treatment Header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                  {treatment.name}
                </Text>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor: treatmentColor + '15',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: treatmentColor }}>
                    {treatment.doses.filter((d: any) => d.is_taken).length}/{treatment.doses.length}
                  </Text>
                </View>
              </View>

              {/* Doses */}
              <View style={{ gap: 8 }}>
                {treatment.doses.map((dose: any, index: number) => (
                  <Pressable
                    key={`${dose.dose_time}-${index}`}
                    onPress={() => handleMarkDose(dose, !dose.is_taken)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 10,
                      backgroundColor: dose.is_taken
                        ? colors.fodmapLow + '12'
                        : colors.background,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: dose.is_taken ? colors.fodmapLow + '40' : colors.border + '40',
                    }}
                  >
                    {/* Checkbox */}
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: dose.is_taken ? colors.fodmapLow : colors.background,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: dose.is_taken ? 0 : 2,
                      borderColor: colors.border,
                      marginRight: 12,
                    }}>
                      {dose.is_taken && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>

                    {/* Dose Info */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: treatmentColor + '15',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          gap: 3,
                        }}>
                          <Ionicons name="time" size={10} color={treatmentColor} />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: treatmentColor }}>
                            {dose.dose_time === 'sin horario' ? 'Cualquier hora' : dose.dose_time}
                          </Text>
                        </View>
                        {dose.dose_amount && (
                          <Text style={{ fontSize: 12, color: colors.textMuted }}>
                            {dose.dose_amount} {dose.dose_unit || ''}
                          </Text>
                        )}
                      </View>

                      {!dose.is_taken && (
                        <View style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          backgroundColor: treatmentColor,
                          borderRadius: 8,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                            TOMAR
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {totalDoses === 0 && (
        <Pressable
          onPress={() => router.push('/treatment')}
          style={{
            padding: 24,
            alignItems: 'center',
            backgroundColor: colors.cardElevated + '30',
          }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.cardElevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Ionicons name="medkit-outline" size={24} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 }}>
            No tienes tratamientos programados para hoy
          </Text>
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
            Configurar medicación →
          </Text>
        </Pressable>
      )}

      {/* Celebration */}
      {allComplete && totalDoses > 0 && (
        <View style={{
          padding: 20,
          alignItems: 'center',
          backgroundColor: colors.fodmapLow + '15',
        }}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🎉</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.fodmapLow, marginBottom: 4 }}>
            ¡Todas las dosis tomadas!
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
            Excelente trabajo cuidando tu salud. ¡Sigue así! 💪
          </Text>
        </View>
      )}
    </Card>
  );
}

interface TodayActivitiesCardProps {
  style?: any;
}

export function TodayActivitiesCard({ style }: TodayActivitiesCardProps) {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  
  // Internal state
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  
  // Load activities
  const loadTodayActivities = useCallback(async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay(); // 0 = Sunday
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDayName = dayNames[dayOfWeek];

      console.log('[TodayActivitiesCard] Loading activities for:', today, todayDayName);

      // Get ALL scheduled activities (simpler query for web compatibility)
      const rawActivities = await db.getAllAsync(
        `SELECT * FROM scheduled_activities WHERE is_active = 1`,
        []
      ) as any[];

      console.log('[TodayActivitiesCard] All active scheduled activities:', rawActivities.length);

      // Get activity types for enrichment
      const activityTypes = await db.getAllAsync(
        `SELECT * FROM activity_types`,
        []
      ) as any[];

      // Filter activities valid for today and enrich with type info
      const allActivities = rawActivities.filter(sa => {
        // Check date range
        const hasStartDate = sa.start_date && sa.start_date !== '';
        const hasEndDate = sa.end_date && sa.end_date !== '';
        
        if (!hasStartDate) return true;
        if (sa.start_date > today) return false;
        if (hasEndDate && sa.end_date < today) return false;
        
        return true;
      }).map(sa => {
        // Enrich with activity type info
        const activityType = activityTypes.find((at: any) => at.id === sa.activity_type_id);
        return {
          ...sa,
          activity_name: activityType?.name || sa.name,
          icon: activityType?.icon || 'fitness',
          color: activityType?.color || '#FF9800',
        };
      });

      console.log('[TodayActivitiesCard] Activities valid for today:', allActivities.length);

      // Filter activities based on frequency
      const filteredActivities: any[] = [];

      for (const activity of allActivities) {
        let shouldInclude = false;

        console.log(`[TodayActivitiesCard] Checking activity "${activity.name}", frequency: ${activity.frequency_type}, value: ${activity.frequency_value}`);

        switch (activity.frequency_type) {
          case 'daily':
            shouldInclude = true;
            console.log(`[TodayActivitiesCard]   -> Daily: included`);
            break;

          case 'weekly':
            try {
              const frequencyValue = activity.frequency_value 
                ? (typeof activity.frequency_value === 'string' && activity.frequency_value.startsWith('[') 
                    ? JSON.parse(activity.frequency_value) 
                    : [activity.frequency_value])
                : [];
              shouldInclude = frequencyValue.includes(todayDayName);
              console.log(`[TodayActivitiesCard]   -> Weekly: ${frequencyValue} includes ${todayDayName}? ${shouldInclude}`);
            } catch (e) {
              console.log(`[TodayActivitiesCard]   -> Weekly: parse error`, e);
              shouldInclude = false;
            }
            break;

          case 'specific_days':
            try {
              const frequencyValue = activity.frequency_value 
                ? (typeof activity.frequency_value === 'string' && activity.frequency_value.startsWith('[') 
                    ? JSON.parse(activity.frequency_value) 
                    : activity.frequency_value.split(',').map((s: string) => s.trim()))
                : [];
              shouldInclude = frequencyValue.includes(todayDayName);
              console.log(`[TodayActivitiesCard]   -> Specific days: ${frequencyValue} includes ${todayDayName}? ${shouldInclude}`);
            } catch (e) {
              console.log(`[TodayActivitiesCard]   -> Specific days: parse error`, e);
              shouldInclude = false;
            }
            break;

          case 'interval':
            try {
              const intervalDays = parseInt(activity.frequency_value) || 1;
              const startDate = new Date(activity.start_date + 'T12:00:00');
              const todayDate = new Date(today + 'T12:00:00');
              const diffTime = Math.abs(todayDate.getTime() - startDate.getTime());
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              shouldInclude = diffDays % intervalDays === 0;
              console.log(`[TodayActivitiesCard]   -> Interval: every ${intervalDays} days, diff=${diffDays}, included? ${shouldInclude}`);
            } catch (e) {
              console.log(`[TodayActivitiesCard]   -> Interval: error`, e);
              shouldInclude = false;
            }
            break;

          case 'monthly':
            try {
              const dayOfMonth = parseInt(activity.frequency_value) || 1;
              const todayDate = new Date(today + 'T12:00:00');
              shouldInclude = todayDate.getDate() === dayOfMonth;
              console.log(`[TodayActivitiesCard]   -> Monthly: day ${dayOfMonth}, today is ${todayDate.getDate()}, included? ${shouldInclude}`);
            } catch (e) {
              console.log(`[TodayActivitiesCard]   -> Monthly: error`, e);
              shouldInclude = false;
            }
            break;

          default:
            // If no frequency_type, include it (legacy data)
            shouldInclude = true;
            console.log(`[TodayActivitiesCard]   -> Unknown frequency type, including by default`);
        }

        if (shouldInclude) {
          // Check if already completed today
          const activityLogs = await db.getAllAsync(
            'SELECT * FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
            [activity.id, today]
          ) as any[];

          filteredActivities.push({
            ...activity,
            completed_count: activityLogs.length,
          });
        }
      }

      console.log('[TodayActivitiesCard] Filtered activities for today:', filteredActivities.length);
      setTodayActivities(filteredActivities);
    } catch (error) {
      console.error('Error loading today activities:', error);
    }
  }, []);
  
  useEffect(() => {
    if (isReady) {
      loadTodayActivities();
    }
  }, [isReady, loadTodayActivities]);
  
  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadTodayActivities();
      }
    }, [isReady, loadTodayActivities])
  );
  
  // Handler
  const handleMarkActivity = async (activity: any, completed: boolean) => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (completed) {
        // Check if already logged today
        const existing = await db.getFirstAsync(
          'SELECT id FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
          [activity.id, today]
        ) as any;

        if (!existing) {
          // Log the activity
          await db.runAsync(
            'INSERT INTO activity_logs (activity_type_id, duration_minutes, intensity, date, time, scheduled_activity_id) VALUES (?, ?, ?, ?, ?, ?)',
            [activity.activity_type_id, activity.duration_minutes || 30, 5, today, timeStr, activity.id]
          );
        }
      } else {
        // Remove the log
        await db.runAsync(
          'DELETE FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
          [activity.id, today]
        );
      }

      await loadTodayActivities();
    } catch (error) {
      console.error('Error marking activity:', error);
      Alert.alert('Error', 'No se pudo registrar la actividad');
    }
  };
  
  const totalActivities = todayActivities.length;
  const completedActivities = todayActivities.filter(a => a.completed_count > 0).length;
  const progress = totalActivities > 0 ? completedActivities / totalActivities : 0;
  const allComplete = totalActivities > 0 && completedActivities === totalActivities;
  
  return (
    <Card style={{
      marginBottom: 16,
      padding: 0,
      overflow: 'hidden',
      borderWidth: allComplete ? 2 : 1,
      borderColor: allComplete ? colors.fodmapLow : colors.border,
      backgroundColor: allComplete ? colors.fodmapLow + '05' : colors.card,
      ...style,
    }}>
      {/* Header */}
      <Pressable
        onPress={() => router.push('/activity')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          backgroundColor: allComplete ? colors.fodmapLow + '15' : ACTIVITY_COLOR + '10',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Progress Indicator */}
          <View style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: allComplete ? colors.fodmapLow : ACTIVITY_COLOR,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}>
            {allComplete ? (
              <Ionicons name="trophy" size={28} color={colors.fodmapLow} />
            ) : totalActivities === 0 ? (
              <Ionicons name="fitness-outline" size={24} color={colors.textMuted} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: ACTIVITY_COLOR }}>
                  {completedActivities}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: -2 }}>
                  /{totalActivities}
                </Text>
              </View>
            )}
          </View>

          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
              🏃 Entrenamiento
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {allComplete
                ? '¡Todas las actividades completadas!'
                : totalActivities === 0
                ? 'Sin actividades programadas'
                : `${completedActivities} de ${totalActivities} completadas`}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {totalActivities > 0 && !allComplete && (
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
              backgroundColor: ACTIVITY_COLOR,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 2,
            }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </Pressable>

      {/* Progress Bar */}
      {totalActivities > 0 && (
        <View style={{
          height: 6,
          backgroundColor: colors.cardElevated,
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <View style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: allComplete ? colors.fodmapLow : ACTIVITY_COLOR,
            borderRadius: 3,
          }} />
        </View>
      )}

      {/* Activities List */}
      {totalActivities > 0 && !allComplete && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
          {todayActivities.map((activity) => {
            const isCompleted = activity.completed_count > 0;
            const actColor = activity.color || ACTIVITY_COLOR;

            return (
              <Pressable
                key={activity.id}
                onPress={() => handleMarkActivity(activity, !isCompleted)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  backgroundColor: isCompleted
                    ? colors.fodmapLow + '12'
                    : colors.cardElevated,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: isCompleted ? colors.fodmapLow + '40' : colors.border,
                }}
              >
                {/* Activity Icon */}
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: isCompleted ? colors.fodmapLow + '20' : actColor + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                  borderWidth: 2,
                  borderColor: isCompleted ? colors.fodmapLow + '40' : 'transparent',
                }}>
                  {isCompleted ? (
                    <Ionicons name="checkmark-circle" size={26} color={colors.fodmapLow} />
                  ) : (
                    <Ionicons name={(activity.icon || 'fitness') as any} size={24} color={actColor} />
                  )}
                </View>

                {/* Activity Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: isCompleted ? colors.textMuted : colors.text,
                    textDecorationLine: isCompleted ? 'line-through' : 'none',
                  }}>
                    {activity.name || activity.activity_name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: actColor + '15',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      gap: 4,
                    }}>
                      <Ionicons name="stopwatch" size={12} color={actColor} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: actColor }}>
                        {activity.duration_minutes} min
                      </Text>
                    </View>
                    {activity.reminder_time && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          {activity.reminder_time}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action Button */}
                {!isCompleted && (
                  <View style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: actColor,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                      ✓ Hecho
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Empty State */}
      {totalActivities === 0 && (
        <Pressable
          onPress={() => router.push('/activity')}
          style={{
            padding: 24,
            alignItems: 'center',
            backgroundColor: colors.cardElevated + '30',
          }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.cardElevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}>
            <Ionicons name="fitness-outline" size={24} color={colors.textMuted} />
          </View>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 4 }}>
            No tienes actividades programadas para hoy
          </Text>
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
            Programar entrenamiento →
          </Text>
        </Pressable>
      )}

      {/* Celebration */}
      {allComplete && totalActivities > 0 && (
        <View style={{
          padding: 20,
          alignItems: 'center',
          backgroundColor: colors.fodmapLow + '15',
        }}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>🏆</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.fodmapLow, marginBottom: 4 }}>
            ¡Entrenamiento completado!
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
            ¡Felicitaciones! Has completado todas tus actividades del día. 💪
          </Text>
        </View>
      )}
    </Card>
  );
}
