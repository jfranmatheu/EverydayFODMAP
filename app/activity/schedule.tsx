import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button } from '@/components/ui';
import { getDatabase, insertRow, updateRow, deleteRow } from '@/lib/database';
import { ActivityType, FrequencyType, DAY_LABELS, FREQUENCY_TYPE_LABELS } from '@/lib/types';

export default function ScheduleActivityScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isNew = !id || id === 'new';
  
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!isNew);

  const activityColor = '#FF9800';

  useEffect(() => {
    loadActivityTypes();
    if (!isNew) {
      loadActivity();
    }
  }, [id]);

  const loadActivityTypes = async () => {
    try {
      const db = await getDatabase();
      const types = await db.getAllAsync<ActivityType>(
        'SELECT * FROM activity_types ORDER BY usage_count DESC, name ASC'
      );
      setActivityTypes(types || []);
    } catch (error) {
      console.error('Error loading activity types:', error);
    }
  };

  const loadActivity = async () => {
    try {
      const db = await getDatabase();
      const activity = await db.getFirstAsync<any>(
        'SELECT * FROM scheduled_activities WHERE id = ?',
        [parseInt(id!)]
      );
      
      if (activity) {
        setName(activity.name || '');
        setDescription(activity.description || '');
        setDuration(activity.duration_minutes?.toString() || '30');
        setFrequencyType(activity.frequency_type || 'daily');
        setReminderEnabled(!!activity.reminder_enabled);
        setReminderTime(activity.reminder_time || '08:00');
        setIsActive(!!activity.is_active);
        
        if (activity.frequency_value) {
          if (activity.frequency_type === 'specific_days') {
            setSelectedDays(activity.frequency_value.split(',').map(Number));
          } else if (activity.frequency_type === 'interval') {
            setIntervalDays(activity.frequency_value);
          }
        }

        // Find the activity type
        const type = activityTypes.find(t => t.id === activity.activity_type_id);
        if (type) {
          setSelectedType(type);
        } else {
          // Load it separately if not in list yet
          const typeData = await db.getFirstAsync<ActivityType>(
            'SELECT * FROM activity_types WHERE id = ?',
            [activity.activity_type_id]
          );
          if (typeData) setSelectedType(typeData);
        }
      }
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoadingData(false);
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
      Alert.alert('Error', 'Por favor, introduce un nombre para el programa');
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

      const data = {
        activity_type_id: selectedType.id,
        name: name.trim(),
        description: description.trim() || null,
        duration_minutes: parseInt(duration) || 30,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        start_date: new Date().toISOString().split('T')[0],
        reminder_enabled: reminderEnabled ? 1 : 0,
        reminder_time: reminderEnabled ? reminderTime : null,
        is_active: isActive ? 1 : 0,
      };

      if (isNew) {
        await insertRow('scheduled_activities', data);
        Alert.alert('¡Guardado!', 'Programa de entrenamiento creado');
      } else {
        await updateRow('scheduled_activities', parseInt(id!), data);
        Alert.alert('¡Guardado!', 'Programa actualizado');
      }
      
      router.back();
    } catch (error) {
      console.error('Error saving scheduled activity:', error);
      Alert.alert('Error', 'No se pudo guardar el programa');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const doDelete = async () => {
      try {
        const db = await getDatabase();
        await db.runAsync('DELETE FROM scheduled_activity_logs WHERE scheduled_activity_id = ?', [parseInt(id!)]);
        await deleteRow('scheduled_activities', parseInt(id!));
        router.back();
      } catch (error) {
        console.error('Error deleting:', error);
        Alert.alert('Error', 'No se pudo eliminar el programa');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${name}"?`)) {
        await doDelete();
      }
    } else {
      Alert.alert(
        'Eliminar programa',
        `¿Estás seguro de que quieres eliminar "${name}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  if (loadingData) {
    return (
      <>
        <Stack.Screen options={{ title: 'Cargando...' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <Text style={{ color: colors.textSecondary }}>Cargando...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nuevo programa' : 'Editar programa',
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
              Tipo de actividad
            </Text>
            {activityTypes.length > 0 ? (
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
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      backgroundColor: selectedType?.id === type.id ? type.color : colors.cardElevated,
                      borderWidth: 1,
                      borderColor: selectedType?.id === type.id ? type.color : colors.border,
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
                      color: selectedType?.id === type.id ? '#FFFFFF' : colors.text,
                    }}>
                      {type.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Cargando tipos de actividad...
              </Text>
            )}
          </Card>
        </Animated.View>

        {/* Name & Description */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Nombre del programa
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej: Caminata matutina, Sesión de yoga..."
                placeholderTextColor={colors.textMuted}
                style={{
                  fontSize: 16,
                  color: colors.text,
                  padding: 14,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                }}
              />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Descripción (opcional)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Detalles del entrenamiento..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                style={{
                  fontSize: 15,
                  color: colors.text,
                  padding: 14,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 12,
                  minHeight: 60,
                  textAlignVertical: 'top',
                }}
              />
            </View>
          </Card>
        </Animated.View>

        {/* Duration */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Duración objetivo (minutos)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[15, 30, 45, 60, 90].map(min => (
                <Pressable
                  key={min}
                  onPress={() => setDuration(min.toString())}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: duration === min.toString() ? activityColor : colors.cardElevated,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: duration === min.toString() ? '#FFFFFF' : colors.text,
                  }}>
                    {min}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              placeholder="Otro"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={{
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                marginTop: 10,
                textAlign: 'center',
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
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: frequencyType === type ? activityColor + '15' : colors.cardElevated,
                    borderWidth: 2,
                    borderColor: frequencyType === type ? activityColor : 'transparent',
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: frequencyType === type ? activityColor : colors.textMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {frequencyType === type && (
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: activityColor,
                      }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 15,
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
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
                  Selecciona los días:
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {DAY_LABELS.map((day, index) => (
                    <Pressable
                      key={index}
                      onPress={() => toggleDay(index)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: selectedDays.includes(index) ? activityColor : colors.cardElevated,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '700',
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TextInput
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    placeholder="2"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      fontSize: 18,
                      fontWeight: '700',
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      width: 70,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 15, color: colors.textSecondary }}>
                    días
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Reminder */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setReminderEnabled(!reminderEnabled)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: reminderEnabled ? activityColor + '20' : colors.cardElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons 
                    name={reminderEnabled ? 'notifications' : 'notifications-outline'} 
                    size={20} 
                    color={reminderEnabled ? activityColor : colors.textMuted} 
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>
                    Recordatorio
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Recibe una notificación diaria
                  </Text>
                </View>
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
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                  Hora del recordatorio:
                </Text>
                <TextInput
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="08:00"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    width: 100,
                    textAlign: 'center',
                  }}
                />
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Active toggle (only for editing) */}
        {!isNew && (
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <Card style={{ marginBottom: 24 }}>
              <Pressable
                onPress={() => setIsActive(!isActive)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons 
                    name={isActive ? 'play-circle' : 'pause-circle'} 
                    size={24} 
                    color={isActive ? colors.success : colors.textMuted} 
                  />
                  <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>
                    Programa activo
                  </Text>
                </View>
                <View style={{
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: isActive ? colors.success : colors.cardElevated,
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                }}>
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#FFFFFF',
                    alignSelf: isActive ? 'flex-end' : 'flex-start',
                  }} />
                </View>
              </Pressable>
            </Card>
          </Animated.View>
        )}

        {/* Save Button */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                {isNew ? 'Crear programa' : 'Guardar cambios'}
              </Text>
            </View>
          </Button>
        </Animated.View>

        {/* Delete Button (only for editing) */}
        {!isNew && (
          <Animated.View entering={FadeInDown.delay(450).springify()}>
            <Pressable
              onPress={handleDelete}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 16,
                padding: 14,
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.error }}>
                Eliminar programa
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}
