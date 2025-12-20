import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button } from '@/components/ui';
import { getDatabase, insertRow } from '@/lib/database';
import { ActivityType, FrequencyType, DAY_LABELS, FREQUENCY_TYPE_LABELS } from '@/lib/types';

export default function ScheduleActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [loading, setLoading] = useState(false);

  const activityColor = '#FF9800';

  useEffect(() => {
    loadActivityTypes();
  }, []);

  const loadActivityTypes = async () => {
    try {
      const db = await getDatabase();
      const types = await db.getAllAsync<ActivityType>(
        'SELECT * FROM activity_types ORDER BY usage_count DESC, name ASC'
      );
      setActivityTypes(types);
    } catch (error) {
      console.error('Error loading activity types:', error);
    }
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Por favor, selecciona un tipo de actividad');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Por favor, introduce un nombre para la actividad');
      return;
    }

    if (frequencyType === 'specific_days' && selectedDays.length === 0) {
      Alert.alert('Error', 'Por favor, selecciona al menos un día');
      return;
    }

    setLoading(true);
    try {
      let frequencyValue: string | null = null;
      
      if (frequencyType === 'specific_days') {
        frequencyValue = selectedDays.sort((a, b) => a - b).join(',');
      } else if (frequencyType === 'interval') {
        frequencyValue = intervalDays;
      }

      await insertRow('scheduled_activities', {
        activity_type_id: selectedType.id,
        name: name.trim(),
        duration_minutes: parseInt(duration) || 30,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        start_date: new Date().toISOString().split('T')[0],
        reminder_enabled: reminderEnabled ? 1 : 0,
        reminder_time: reminderEnabled ? reminderTime : null,
        is_active: 1,
      });

      Alert.alert('¡Guardado!', 'Actividad programada correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving scheduled activity:', error);
      Alert.alert('Error', 'No se pudo guardar la actividad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Programar actividad',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* Activity Type */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Tipo de actividad *
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {activityTypes.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => {
                    setSelectedType(type);
                    if (!name) setName(type.name);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: selectedType?.id === type.id ? type.color : colors.cardElevated,
                    gap: 6,
                  }}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={16} 
                    color={selectedType?.id === type.id ? '#FFFFFF' : type.color} 
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: selectedType?.id === type.id ? '#FFFFFF' : colors.textSecondary,
                  }}>
                    {type.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Name */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Nombre de la actividad *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Caminata matutina"
              placeholderTextColor={colors.textMuted}
              style={{
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
              }}
            />
          </Card>
        </Animated.View>

        {/* Duration */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Duración objetivo (minutos)
            </Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
              }}
            />
          </Card>
        </Animated.View>

        {/* Frequency */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Frecuencia
            </Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(FREQUENCY_TYPE_LABELS) as FrequencyType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setFrequencyType(type)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: frequencyType === type ? activityColor + '20' : colors.cardElevated,
                    borderWidth: 1,
                    borderColor: frequencyType === type ? activityColor : 'transparent',
                  }}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: frequencyType === type ? activityColor : colors.textMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {frequencyType === type && (
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: activityColor,
                      }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 14,
                    color: frequencyType === type ? activityColor : colors.text,
                    fontWeight: frequencyType === type ? '600' : '400',
                  }}>
                    {FREQUENCY_TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Specific Days Selection */}
            {frequencyType === 'specific_days' && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                  Selecciona los días:
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {DAY_LABELS.map((day, index) => (
                    <Pressable
                      key={index}
                      onPress={() => toggleDay(index)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 8,
                        backgroundColor: selectedDays.includes(index) ? activityColor : colors.cardElevated,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: selectedDays.includes(index) ? '#FFFFFF' : colors.textSecondary,
                      }}>
                        {day.slice(0, 2)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Interval Days Input */}
            {frequencyType === 'interval' && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                  Cada cuántos días:
                </Text>
                <TextInput
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                  placeholder="2"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    fontSize: 16,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    width: 80,
                  }}
                />
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Reminder */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={{ marginBottom: 24 }}>
            <Pressable
              onPress={() => setReminderEnabled(!reminderEnabled)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons 
                  name={reminderEnabled ? 'notifications' : 'notifications-outline'} 
                  size={22} 
                  color={reminderEnabled ? activityColor : colors.textSecondary} 
                />
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>
                  Recordatorio
                </Text>
              </View>
              <View style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                backgroundColor: reminderEnabled ? activityColor : colors.cardElevated,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
                  alignSelf: reminderEnabled ? 'flex-end' : 'flex-start',
                }} />
              </View>
            </Pressable>

            {reminderEnabled && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                  Hora del recordatorio:
                </Text>
                <TextInput
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    fontSize: 16,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    width: 100,
                  }}
                />
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Save Button */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            Programar actividad
          </Button>
        </Animated.View>
      </ScrollView>
    </>
  );
}

