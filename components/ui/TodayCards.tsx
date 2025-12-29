import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { useTheme } from '@/contexts/ThemeContext';

const ACTIVITY_COLOR = '#FF9800';

interface TodayTreatmentsCardProps {
  treatments: any[];
  onMarkDose: (treatment: any, taken: boolean) => void;
  onNavigate: () => void;
}

export function TodayTreatmentsCard({
  treatments,
  onMarkDose,
  onNavigate,
}: TodayTreatmentsCardProps) {
  const { colors } = useTheme();
  
  const totalDoses = treatments.length;
  const takenDoses = treatments.filter(t => t.is_taken).length;
  const progress = totalDoses > 0 ? takenDoses / totalDoses : 0;
  const allComplete = totalDoses > 0 && takenDoses === totalDoses;

  const treatmentColor = colors.treatment;

  // Group treatments by name to show per-treatment progress
  const groupedTreatments = treatments.reduce((acc, treatment) => {
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
    }}>
      {/* Header */}
      <Pressable
        onPress={onNavigate}
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
                    onPress={() => onMarkDose(dose, !dose.is_taken)}
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
          onPress={onNavigate}
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
  activities: any[];
  onMarkComplete: (activity: any, completed: boolean) => void;
  onNavigate: () => void;
}

export function TodayActivitiesCard({
  activities,
  onMarkComplete,
  onNavigate,
}: TodayActivitiesCardProps) {
  const { colors } = useTheme();
  
  const totalActivities = activities.length;
  const completedActivities = activities.filter(a => a.completed_count > 0).length;
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
    }}>
      {/* Header */}
      <Pressable
        onPress={onNavigate}
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
          {activities.map((activity) => {
            const isCompleted = activity.completed_count > 0;
            const actColor = activity.color || ACTIVITY_COLOR;

            return (
              <Pressable
                key={activity.id}
                onPress={() => onMarkComplete(activity, !isCompleted)}
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
          onPress={onNavigate}
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

