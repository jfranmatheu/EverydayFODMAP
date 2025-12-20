import { Card } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { BRISTOL_SCALE, DAY_LABELS, MEAL_TYPE_LABELS } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown
} from 'react-native-reanimated';

type ViewMode = 'month' | 'week' | 'day';

interface DayEvents {
  meals: number;
  water: number;
  symptoms: number;
  bowelMovements: number;
  treatments: number;
  activities: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [monthData, setMonthData] = useState<Record<string, DayEvents>>({});
  const [dayDetails, setDayDetails] = useState<any>(null);

  const activityColor = '#FF9800';

  useEffect(() => {
    if (isReady) {
      loadMonthData();
    }
  }, [isReady, currentDate]);

  useEffect(() => {
    if (isReady && selectedDate) {
      loadDayDetails();
    }
  }, [isReady, selectedDate]);

  const loadMonthData = async () => {
    try {
      const db = await getDatabase();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const data: Record<string, DayEvents> = {};

      // Get meals count per day
      const meals = await db.getAllAsync<{ date: string; count: number }>(
        `SELECT date, COUNT(*) as count FROM meals WHERE date BETWEEN ? AND ? GROUP BY date`,
        [startDate, endDate]
      );
      meals.forEach(m => {
        if (!data[m.date]) data[m.date] = { meals: 0, water: 0, symptoms: 0, bowelMovements: 0, treatments: 0, activities: 0 };
        data[m.date].meals = m.count;
      });

      // Get water per day
      const water = await db.getAllAsync<{ date: string; total: number }>(
        `SELECT date, SUM(glasses) as total FROM water_intake WHERE date BETWEEN ? AND ? GROUP BY date`,
        [startDate, endDate]
      );
      water.forEach(w => {
        if (!data[w.date]) data[w.date] = { meals: 0, water: 0, symptoms: 0, bowelMovements: 0, treatments: 0, activities: 0 };
        data[w.date].water = w.total;
      });

      // Get symptoms per day
      const symptoms = await db.getAllAsync<{ date: string; count: number }>(
        `SELECT date, COUNT(*) as count FROM symptoms WHERE date BETWEEN ? AND ? GROUP BY date`,
        [startDate, endDate]
      );
      symptoms.forEach(s => {
        if (!data[s.date]) data[s.date] = { meals: 0, water: 0, symptoms: 0, bowelMovements: 0, treatments: 0, activities: 0 };
        data[s.date].symptoms = s.count;
      });

      // Get bowel movements per day
      const bowel = await db.getAllAsync<{ date: string; count: number }>(
        `SELECT date, COUNT(*) as count FROM bowel_movements WHERE date BETWEEN ? AND ? GROUP BY date`,
        [startDate, endDate]
      );
      bowel.forEach(b => {
        if (!data[b.date]) data[b.date] = { meals: 0, water: 0, symptoms: 0, bowelMovements: 0, treatments: 0, activities: 0 };
        data[b.date].bowelMovements = b.count;
      });

      // Get activities per day
      const activities = await db.getAllAsync<{ date: string; count: number }>(
        `SELECT date, COUNT(*) as count FROM activity_logs WHERE date BETWEEN ? AND ? GROUP BY date`,
        [startDate, endDate]
      );
      activities.forEach(a => {
        if (!data[a.date]) data[a.date] = { meals: 0, water: 0, symptoms: 0, bowelMovements: 0, treatments: 0, activities: 0 };
        data[a.date].activities = a.count;
      });

      setMonthData(data);
    } catch (error) {
      console.error('Error loading month data:', error);
    }
  };

  const loadDayDetails = async () => {
    try {
      const db = await getDatabase();

      const meals = await db.getAllAsync(
        'SELECT * FROM meals WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const water = await db.getAllAsync(
        'SELECT * FROM water_intake WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const symptoms = await db.getAllAsync(
        'SELECT * FROM symptoms WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const bowelMovements = await db.getAllAsync(
        'SELECT * FROM bowel_movements WHERE date = ? ORDER BY time',
        [selectedDate]
      );

      const treatments = await db.getAllAsync(
        `SELECT tl.*, t.name, t.dosage FROM treatment_logs tl 
         JOIN treatments t ON tl.treatment_id = t.id 
         WHERE tl.date = ? ORDER BY tl.time`,
        [selectedDate]
      );

      const activities = await db.getAllAsync(
        `SELECT al.*, at.name as type_name, at.icon, at.color 
         FROM activity_logs al
         JOIN activity_types at ON al.activity_type_id = at.id
         WHERE al.date = ? ORDER BY al.time`,
        [selectedDate]
      );

      setDayDetails({ meals, water, symptoms, bowelMovements, treatments, activities });
    } catch (error) {
      console.error('Error loading day details:', error);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const getWeekDays = () => {
    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const dayOfWeek = selectedDateObj.getDay();
    const weekStart = new Date(selectedDateObj);
    weekStart.setDate(selectedDateObj.getDate() - dayOfWeek);
    
    const days: { date: string; day: number; dayName: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        day: date.getDate(),
        dayName: DAY_LABELS[i].slice(0, 3),
      });
    }
    return days;
  };

  const formatDateString = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const navigate = useCallback((direction: number) => {
    if (viewMode === 'month') {
      // Navigate month
      setCurrentDate(prev => {
        const newDate = new Date(prev);
        newDate.setMonth(newDate.getMonth() + direction);
        return newDate;
      });
    } else if (viewMode === 'week') {
      // Navigate week - move 7 days
      const currentSelectedDate = new Date(selectedDate + 'T12:00:00');
      currentSelectedDate.setDate(currentSelectedDate.getDate() + (direction * 7));
      const newDateStr = currentSelectedDate.toISOString().split('T')[0];
      setSelectedDate(newDateStr);
      setCurrentDate(currentSelectedDate);
    } else {
      // Navigate day - move 1 day
      const currentSelectedDate = new Date(selectedDate + 'T12:00:00');
      currentSelectedDate.setDate(currentSelectedDate.getDate() + direction);
      const newDateStr = currentSelectedDate.toISOString().split('T')[0];
      setSelectedDate(newDateStr);
      setCurrentDate(currentSelectedDate);
    }
  }, [viewMode, selectedDate]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now.toISOString().split('T')[0]);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const ViewModeButton = ({ mode, label }: { mode: ViewMode; label: string }) => (
    <Pressable
      onPress={() => setViewMode(mode)}
      style={{
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: viewMode === mode ? colors.primary : 'transparent',
      }}
    >
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: viewMode === mode ? '#FFFFFF' : colors.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const renderDayContent = () => {
    if (!dayDetails) return null;

    const allEmpty = 
      dayDetails.meals.length === 0 && 
      dayDetails.water.length === 0 && 
      dayDetails.symptoms.length === 0 && 
      dayDetails.bowelMovements.length === 0 &&
      dayDetails.treatments.length === 0 &&
      dayDetails.activities.length === 0;

    return (
      <View style={{ gap: 12 }}>
        {/* Activities */}
        {dayDetails.activities.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="fitness" size={18} color={activityColor} />
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.text,
                marginLeft: 8,
              }}>
                Actividades ({dayDetails.activities.length})
              </Text>
            </View>
            {dayDetails.activities.map((activity: any, index: number) => (
              <View key={activity.id} style={{ 
                paddingVertical: 8,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: activity.color + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={activity.icon as any} size={18} color={activity.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                    {activity.type_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {activity.time} · {activity.duration_minutes} min
                    {activity.distance_km ? ` · ${activity.distance_km} km` : ''}
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor: activityColor + '20',
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: activityColor }}>
                    {activity.intensity}/10
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Meals */}
        {dayDetails.meals.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="restaurant" size={18} color={colors.primary} />
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.text,
                marginLeft: 8,
              }}>
                Comidas ({dayDetails.meals.length})
              </Text>
            </View>
            {dayDetails.meals.map((meal: any, index: number) => (
              <View key={meal.id} style={{ 
                paddingVertical: 8,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                  {meal.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {meal.time} · {MEAL_TYPE_LABELS[meal.meal_type as keyof typeof MEAL_TYPE_LABELS]}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Water */}
        {dayDetails.water.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="water" size={18} color={colors.water} />
                <Text style={{ 
                  fontSize: 14, 
                  fontWeight: '600', 
                  color: colors.text,
                  marginLeft: 8,
                }}>
                  Agua
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.water }}>
                {dayDetails.water.reduce((acc: number, w: any) => acc + w.glasses, 0)} vasos
              </Text>
            </View>
          </Card>
        )}

        {/* Symptoms */}
        {dayDetails.symptoms.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="pulse" size={18} color={colors.symptom} />
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.text,
                marginLeft: 8,
              }}>
                Síntomas ({dayDetails.symptoms.length})
              </Text>
            </View>
            {dayDetails.symptoms.map((symptom: any, index: number) => (
              <View key={symptom.id} style={{ 
                paddingVertical: 8,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                    {symptom.type}
                  </Text>
                  <View style={{ 
                    paddingHorizontal: 8, 
                    paddingVertical: 2, 
                    borderRadius: 10,
                    backgroundColor: symptom.intensity <= 3 ? colors.fodmapLow + '20' 
                      : symptom.intensity <= 6 ? colors.fodmapMedium + '20' 
                      : colors.fodmapHigh + '20',
                  }}>
                    <Text style={{ 
                      fontSize: 12, 
                      fontWeight: '600',
                      color: symptom.intensity <= 3 ? colors.fodmapLow 
                        : symptom.intensity <= 6 ? colors.fodmapMedium 
                        : colors.fodmapHigh,
                    }}>
                      {symptom.intensity}/10
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {symptom.time}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Bowel Movements */}
        {dayDetails.bowelMovements.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="medical" size={18} color={colors.bowel} />
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.text,
                marginLeft: 8,
              }}>
                Deposiciones ({dayDetails.bowelMovements.length})
              </Text>
            </View>
            {dayDetails.bowelMovements.map((bm: any, index: number) => (
              <View key={bm.id} style={{ 
                paddingVertical: 8,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>
                  {BRISTOL_SCALE[bm.bristol_type as keyof typeof BRISTOL_SCALE].emoji}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                    {BRISTOL_SCALE[bm.bristol_type as keyof typeof BRISTOL_SCALE].name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {bm.time}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Treatments */}
        {dayDetails.treatments.length > 0 && (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="medkit" size={18} color={colors.treatment} />
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600', 
                color: colors.text,
                marginLeft: 8,
              }}>
                Tratamientos ({dayDetails.treatments.length})
              </Text>
            </View>
            {dayDetails.treatments.map((treatment: any, index: number) => (
              <View key={treatment.id} style={{ 
                paddingVertical: 8,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
                <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                  {treatment.name}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {treatment.time} {treatment.dosage ? `· ${treatment.dosage}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Empty state */}
        {allEmpty && (
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>
                No hay registros para este día
              </Text>
            </View>
          </Card>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* View Mode Selector */}
      <Animated.View 
        entering={FadeInDown.delay(50).springify()}
        style={{ 
          flexDirection: 'row',
          marginHorizontal: 16,
          marginTop: 16,
          padding: 4,
          backgroundColor: colors.card,
          borderRadius: 12,
          gap: 4,
        }}
      >
        <ViewModeButton mode="month" label="Mes" />
        <ViewModeButton mode="week" label="Semana" />
        <ViewModeButton mode="day" label="Día" />
      </Animated.View>

      {/* Navigation Header */}
      <View 
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity 
          onPress={() => navigate(-1)}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} activeOpacity={0.7}>
          <Text style={{ 
            fontSize: 18, 
            fontWeight: '700', 
            color: colors.text,
          }}>
            {viewMode === 'month' 
              ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : viewMode === 'week'
                ? `Semana del ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                : new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => navigate(1)}
          activeOpacity={0.7}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Month View */}
      {viewMode === 'month' && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          style={{ paddingHorizontal: 16 }}
        >
          <Card>
            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ 
                    fontSize: 12, 
                    fontWeight: '600', 
                    color: colors.textMuted,
                  }}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar days */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {getDaysInMonth().map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
                }

                const dateStr = formatDateString(day);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const hasEvents = monthData[dateStr];

                return (
                  <Pressable
                    key={day}
                    onPress={() => {
                      setSelectedDate(dateStr);
                      if (viewMode === 'month') setViewMode('day');
                    }}
                    style={{
                      width: '14.28%',
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + '20' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: isToday || isSelected ? '700' : '500',
                        color: isSelected ? '#FFFFFF' : isToday ? colors.primary : colors.text,
                      }}>
                        {day}
                      </Text>
                    </View>
                    
                    {/* Event indicators */}
                    {hasEvents && (
                      <View style={{ 
                        flexDirection: 'row', 
                        gap: 2, 
                        marginTop: 2,
                        height: 4,
                      }}>
                        {hasEvents.meals > 0 && (
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
                        )}
                        {hasEvents.activities > 0 && (
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: activityColor }} />
                        )}
                        {hasEvents.symptoms > 0 && (
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.symptom }} />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          style={{ paddingHorizontal: 16 }}
        >
          <Card>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {getWeekDays().map((dayInfo, index) => {
                const isToday = dayInfo.date === today;
                const isSelected = dayInfo.date === selectedDate;
                const hasEvents = monthData[dayInfo.date];

                return (
                  <Pressable
                    key={dayInfo.date}
                    onPress={() => setSelectedDate(dayInfo.date)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + '15' : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: isSelected ? '#FFFFFF' : colors.textMuted,
                      marginBottom: 4,
                    }}>
                      {dayInfo.dayName}
                    </Text>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: isSelected ? '#FFFFFF' : isToday ? colors.primary : colors.text,
                    }}>
                      {dayInfo.day}
                    </Text>
                    
                    {/* Event indicators */}
                    {hasEvents && (
                      <View style={{ 
                        flexDirection: 'row', 
                        gap: 2, 
                        marginTop: 6,
                      }}>
                        {hasEvents.meals > 0 && (
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSelected ? '#FFFFFF' : colors.primary }} />
                        )}
                        {hasEvents.activities > 0 && (
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSelected ? '#FFFFFF' : activityColor }} />
                        )}
                        {hasEvents.symptoms > 0 && (
                          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSelected ? '#FFFFFF' : colors.symptom }} />
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>
      )}

      {/* Day Details (shown in week and day views) */}
      {(viewMode === 'week' || viewMode === 'day') && (
        <Animated.View 
          entering={FadeInDown.delay(200).springify()}
          style={{ paddingHorizontal: 16, marginTop: 20 }}
        >
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: 12,
          }}>
            {selectedDate === today ? 'Hoy' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </Text>

          {renderDayContent()}
        </Animated.View>
      )}
    </ScrollView>
  );
}
