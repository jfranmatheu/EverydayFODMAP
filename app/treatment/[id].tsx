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
import { scheduleTreatmentNotifications, cancelTreatmentNotifications, requestNotificationPermissions } from '@/lib/notifications';
import { 
  Treatment, 
  TreatmentType, 
  TreatmentFrequency,
  TreatmentDose,
  DosageUnit,
  TREATMENT_TYPES, 
  TREATMENT_FREQUENCY_LABELS,
  DOSAGE_UNITS,
  DAY_LABELS,
} from '@/lib/types';

export default function TreatmentFormScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<TreatmentType>('medication');
  const [dosageAmount, setDosageAmount] = useState('');
  const [dosageUnit, setDosageUnit] = useState<DosageUnit>('mg');
  const [frequency, setFrequency] = useState<TreatmentFrequency>('once_daily');
  const [frequencyValue, setFrequencyValue] = useState('');
  const [doses, setDoses] = useState<TreatmentDose[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationAmount, setDurationAmount] = useState('');
  const [durationUnit, setDurationUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [isChronic, setIsChronic] = useState(false);

  // Duration unit labels
  const DURATION_UNITS = [
    { value: 'days' as const, label: 'Días' },
    { value: 'weeks' as const, label: 'Semanas' },
    { value: 'months' as const, label: 'Meses' },
  ];

  // Calculate end date from start date + duration
  const calculateEndDate = (): string | null => {
    if (!startDate || !durationAmount || isChronic) return null;
    
    const amount = parseInt(durationAmount);
    if (isNaN(amount) || amount <= 0) return null;
    
    const start = new Date(startDate + 'T12:00:00');
    
    switch (durationUnit) {
      case 'days':
        start.setDate(start.getDate() + amount);
        break;
      case 'weeks':
        start.setDate(start.getDate() + (amount * 7));
        break;
      case 'months':
        start.setMonth(start.getMonth() + amount);
        break;
    }
    
    return start.toISOString().split('T')[0];
  };
  const [specificDays, setSpecificDays] = useState<number[]>([]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState('15');
  const [instructions, setInstructions] = useState('');
  const [sideEffects, setSideEffects] = useState('');
  const [prescribingDoctor, setPrescribingDoctor] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadTreatment();
    }
  }, [id]);

  const loadTreatment = async () => {
    try {
      const db = await getDatabase();
      const treatment = await (db as any).getFirstAsync(
        'SELECT * FROM treatments WHERE id = ?',
        [parseInt(id!)]
      );
      
      if (treatment) {
        setName(treatment.name);
        setType(treatment.type || 'medication');
        setDosageAmount(treatment.dosage_amount?.toString() || '');
        setDosageUnit(treatment.dosage_unit || 'mg');
        setFrequency(treatment.frequency || 'once_daily');
        setFrequencyValue(treatment.frequency_value || '');
        setStartDate(treatment.start_date || new Date().toISOString().split('T')[0]);
        setIsChronic(!!treatment.is_chronic);
        
        // Parse duration from end_date if exists
        if (treatment.end_date && treatment.start_date && !treatment.is_chronic) {
          const start = new Date(treatment.start_date + 'T12:00:00');
          const end = new Date(treatment.end_date + 'T12:00:00');
          const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays % 30 === 0 && diffDays >= 30) {
            setDurationAmount(String(diffDays / 30));
            setDurationUnit('months');
          } else if (diffDays % 7 === 0 && diffDays >= 7) {
            setDurationAmount(String(diffDays / 7));
            setDurationUnit('weeks');
          } else {
            setDurationAmount(String(diffDays));
            setDurationUnit('days');
          }
        }
        setSpecificDays(treatment.specific_days ? treatment.specific_days.split(',').map(Number) : []);
        setReminderEnabled(!!treatment.reminder_enabled);
        setReminderMinutesBefore(treatment.reminder_minutes_before?.toString() || '15');
        setInstructions(treatment.instructions || '');
        setSideEffects(treatment.side_effects || '');
        setPrescribingDoctor(treatment.prescribing_doctor || '');
        setNotes(treatment.notes || '');
        
        if (treatment.doses) {
          try {
            const parsedDoses = typeof treatment.doses === 'string' 
              ? JSON.parse(treatment.doses) 
              : treatment.doses;
            setDoses(parsedDoses || []);
          } catch (e) {
            setDoses([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading treatment:', error);
    }
  };

  const addDose = () => {
    const newDose: TreatmentDose = {
      time: '08:00',
      amount: parseFloat(dosageAmount) || 1,
      unit: dosageUnit,
    };
    setDoses([...doses, newDose]);
  };

  const updateDose = (index: number, field: keyof TreatmentDose, value: any) => {
    const updated = [...doses];
    updated[index] = { ...updated[index], [field]: value };
    setDoses(updated);
  };

  const removeDose = (index: number) => {
    setDoses(doses.filter((_, i) => i !== index));
  };

  const toggleDay = (day: number) => {
    if (specificDays.includes(day)) {
      setSpecificDays(specificDays.filter(d => d !== day));
    } else {
      setSpecificDays([...specificDays, day].sort());
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor, introduce un nombre para el tratamiento');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        name: name.trim(),
        type,
        dosage_amount: parseFloat(dosageAmount) || null,
        dosage_unit: dosageUnit,
        frequency,
        frequency_value: frequencyValue || null,
        doses: doses.length > 0 ? JSON.stringify(doses) : null,
        start_date: startDate || null,
        end_date: isChronic ? null : calculateEndDate(),
        is_chronic: isChronic ? 1 : 0,
        specific_days: specificDays.length > 0 ? specificDays.join(',') : null,
        reminder_enabled: reminderEnabled ? 1 : 0,
        reminder_minutes_before: parseInt(reminderMinutesBefore) || 15,
        instructions: instructions.trim() || null,
        side_effects: sideEffects.trim() || null,
        prescribing_doctor: prescribingDoctor.trim() || null,
        notes: notes.trim() || null,
        is_active: 1,
      };

      let treatmentId: number;
      
      if (isNew) {
        treatmentId = await insertRow('treatments', data);
      } else {
        treatmentId = parseInt(id!);
        await updateRow('treatments', treatmentId, data);
      }

      // Schedule notifications if enabled
      if (reminderEnabled && doses.length > 0) {
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
          await scheduleTreatmentNotifications(
            treatmentId,
            name.trim(),
            doses,
            parseInt(reminderMinutesBefore) || 15,
            instructions.trim() || undefined
          );
        }
      } else {
        // Cancel any existing notifications
        await cancelTreatmentNotifications(treatmentId);
      }

      Alert.alert('¡Guardado!', 'Tratamiento guardado correctamente');
      router.back();
    } catch (error) {
      console.error('Error saving treatment:', error);
      Alert.alert('Error', 'No se pudo guardar el tratamiento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = async () => {
      try {
        const treatmentId = parseInt(id!);
        await cancelTreatmentNotifications(treatmentId);
        await deleteRow('treatments', treatmentId);
        router.back();
      } catch (error) {
        console.error('Error deleting treatment:', error);
        Alert.alert('Error', 'No se pudo eliminar el tratamiento');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro de que quieres eliminar este tratamiento?')) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Eliminar tratamiento',
        '¿Estás seguro de que quieres eliminar este tratamiento?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  // Generate preset doses based on frequency
  const generatePresetDoses = () => {
    const amount = parseFloat(dosageAmount) || 1;
    let newDoses: TreatmentDose[] = [];

    switch (frequency) {
      case 'once_daily':
        newDoses = [{ time: '08:00', amount, unit: dosageUnit }];
        break;
      case 'twice_daily':
        newDoses = [
          { time: '08:00', amount, unit: dosageUnit },
          { time: '20:00', amount, unit: dosageUnit },
        ];
        break;
      case 'three_times_daily':
        newDoses = [
          { time: '08:00', amount, unit: dosageUnit },
          { time: '14:00', amount, unit: dosageUnit },
          { time: '20:00', amount, unit: dosageUnit },
        ];
        break;
      case 'four_times_daily':
        newDoses = [
          { time: '08:00', amount, unit: dosageUnit },
          { time: '12:00', amount, unit: dosageUnit },
          { time: '16:00', amount, unit: dosageUnit },
          { time: '20:00', amount, unit: dosageUnit },
        ];
        break;
      case 'with_meals':
      case 'before_meals':
      case 'after_meals':
        newDoses = [
          { time: '08:00', amount, unit: dosageUnit, notes: 'Desayuno' },
          { time: '14:00', amount, unit: dosageUnit, notes: 'Almuerzo' },
          { time: '21:00', amount, unit: dosageUnit, notes: 'Cena' },
        ];
        break;
    }

    if (newDoses.length > 0) {
      setDoses(newDoses);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nuevo tratamiento' : 'Editar tratamiento',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Name */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Nombre del tratamiento *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Omeprazol, Probióticos..."
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

        {/* Type */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Tipo
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(TREATMENT_TYPES) as TreatmentType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 20,
                    backgroundColor: type === t ? colors.treatment : colors.cardElevated,
                    gap: 6,
                  }}
                >
                  <Ionicons 
                    name={TREATMENT_TYPES[t].icon as any} 
                    size={16} 
                    color={type === t ? '#FFFFFF' : colors.textSecondary} 
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: type === t ? '#FFFFFF' : colors.textSecondary,
                  }}>
                    {TREATMENT_TYPES[t].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Dosage */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Dosis por toma
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TextInput
                value={dosageAmount}
                onChangeText={setDosageAmount}
                placeholder="Cantidad"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  fontSize: 16,
                  color: colors.text,
                  padding: 12,
                  backgroundColor: colors.cardElevated,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              />
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
                style={{ flex: 2 }}
              >
                {DOSAGE_UNITS.map(unit => (
                  <Pressable
                    key={unit}
                    onPress={() => setDosageUnit(unit)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: dosageUnit === unit ? colors.treatment : colors.cardElevated,
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: dosageUnit === unit ? '#FFFFFF' : colors.textSecondary,
                    }}>
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Card>
        </Animated.View>

        {/* Frequency */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Frecuencia
            </Text>
            <View style={{ gap: 8 }}>
              {(Object.keys(TREATMENT_FREQUENCY_LABELS) as TreatmentFrequency[]).slice(0, 8).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    setFrequency(f);
                    // Auto-generate doses for common frequencies
                    setTimeout(generatePresetDoses, 100);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: frequency === f ? colors.treatment + '20' : colors.cardElevated,
                    borderWidth: 1,
                    borderColor: frequency === f ? colors.treatment : 'transparent',
                  }}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: frequency === f ? colors.treatment : colors.textMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    {frequency === f && (
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: colors.treatment,
                      }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: 14,
                    color: frequency === f ? colors.treatment : colors.text,
                    fontWeight: frequency === f ? '600' : '400',
                  }}>
                    {TREATMENT_FREQUENCY_LABELS[f]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Every X hours input */}
            {frequency === 'every_x_hours' && (
              <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: colors.textSecondary }}>Cada</Text>
                <TextInput
                  value={frequencyValue}
                  onChangeText={setFrequencyValue}
                  placeholder="8"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    width: 60,
                    fontSize: 16,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                />
                <Text style={{ color: colors.textSecondary }}>horas</Text>
              </View>
            )}

            {/* Weekly - day selection */}
            {frequency === 'weekly' && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                  Días de la semana:
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
                        backgroundColor: specificDays.includes(index) ? colors.treatment : colors.cardElevated,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: specificDays.includes(index) ? '#FFFFFF' : colors.textSecondary,
                      }}>
                        {day.slice(0, 2)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Doses Schedule */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                Horarios de toma
              </Text>
              <Pressable
                onPress={addDose}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: colors.treatment + '20',
                  gap: 4,
                }}
              >
                <Ionicons name="add" size={16} color={colors.treatment} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.treatment }}>
                  Añadir
                </Text>
              </Pressable>
            </View>

            {doses.length === 0 ? (
              <View style={{ 
                padding: 20, 
                backgroundColor: colors.cardElevated, 
                borderRadius: 10, 
                alignItems: 'center' 
              }}>
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  Sin horarios definidos.{'\n'}Pulsa "Añadir" para crear uno.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {doses.map((dose, index) => (
                  <View 
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TextInput
                        value={dose.time}
                        onChangeText={(v) => updateDose(index, 'time', v)}
                        placeholder="08:00"
                        placeholderTextColor={colors.textMuted}
                        style={{
                          fontSize: 18,
                          fontWeight: '700',
                          color: colors.text,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <TextInput
                        value={dose.amount?.toString() || ''}
                        onChangeText={(v) => updateDose(index, 'amount', parseFloat(v) || 0)}
                        placeholder="1"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        style={{
                          width: 50,
                          fontSize: 14,
                          color: colors.text,
                          textAlign: 'center',
                          padding: 6,
                          backgroundColor: colors.card,
                          borderRadius: 6,
                        }}
                      />
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {dose.unit}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeDose(index)}>
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Duration */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Duración
            </Text>
            
            {/* Chronic toggle */}
            <Pressable
              onPress={() => setIsChronic(!isChronic)}
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: isChronic ? 0 : 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons 
                  name={isChronic ? 'infinite' : 'time-outline'} 
                  size={20} 
                  color={isChronic ? colors.treatment : colors.textSecondary} 
                />
                <Text style={{ fontSize: 15, color: colors.text }}>
                  Tratamiento crónico / indefinido
                </Text>
              </View>
              <View style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                backgroundColor: isChronic ? colors.treatment : colors.cardElevated,
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
                  alignSelf: isChronic ? 'flex-end' : 'flex-start',
                }} />
              </View>
            </Pressable>

            {!isChronic && (
              <View style={{ gap: 16 }}>
                {/* Start date */}
                <View>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                    Fecha de inicio
                  </Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      fontSize: 14,
                      color: colors.text,
                      padding: 12,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 10,
                    }}
                  />
                </View>

                {/* Duration amount + unit */}
                <View>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                    Duración del tratamiento
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      value={durationAmount}
                      onChangeText={setDurationAmount}
                      placeholder="7"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        width: 70,
                        fontSize: 18,
                        fontWeight: '700',
                        color: colors.text,
                        padding: 12,
                        backgroundColor: colors.cardElevated,
                        borderRadius: 10,
                        textAlign: 'center',
                      }}
                    />
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                      {DURATION_UNITS.map(unit => (
                        <Pressable
                          key={unit.value}
                          onPress={() => setDurationUnit(unit.value)}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            borderRadius: 10,
                            backgroundColor: durationUnit === unit.value ? colors.treatment : colors.cardElevated,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: durationUnit === unit.value ? '#FFFFFF' : colors.textSecondary,
                          }}>
                            {unit.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Calculated end date preview */}
                {calculateEndDate() && (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 8,
                    padding: 12,
                    backgroundColor: colors.success + '15',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.success + '30',
                  }}>
                    <Ionicons name="calendar-outline" size={18} color={colors.success} />
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      Finaliza el{' '}
                      <Text style={{ fontWeight: '700', color: colors.success }}>
                        {new Date(calculateEndDate()! + 'T12:00:00').toLocaleDateString('es-ES', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Reminders */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => setReminderEnabled(!reminderEnabled)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons 
                  name={reminderEnabled ? 'notifications' : 'notifications-outline'} 
                  size={22} 
                  color={reminderEnabled ? colors.treatment : colors.textSecondary} 
                />
                <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>
                  Recordatorios
                </Text>
              </View>
              <View style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                backgroundColor: reminderEnabled ? colors.treatment : colors.cardElevated,
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
              <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: colors.textSecondary }}>Avisar</Text>
                <TextInput
                  value={reminderMinutesBefore}
                  onChangeText={setReminderMinutesBefore}
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    width: 60,
                    fontSize: 16,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                />
                <Text style={{ color: colors.textSecondary }}>minutos antes</Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Instructions */}
        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Instrucciones de uso
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Ej: Tomar con agua, evitar lácteos..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={{
                fontSize: 15,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                textAlignVertical: 'top',
                minHeight: 80,
              }}
            />
          </Card>
        </Animated.View>

        {/* Additional Info */}
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Información adicional
            </Text>
            
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  Médico prescriptor
                </Text>
                <TextInput
                  value={prescribingDoctor}
                  onChangeText={setPrescribingDoctor}
                  placeholder="Nombre del médico"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    fontSize: 14,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  Posibles efectos secundarios
                </Text>
                <TextInput
                  value={sideEffects}
                  onChangeText={setSideEffects}
                  placeholder="Efectos secundarios conocidos"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={{
                    fontSize: 14,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlignVertical: 'top',
                    minHeight: 60,
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  Notas personales
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Cualquier nota adicional..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={{
                    fontSize: 14,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlignVertical: 'top',
                    minHeight: 60,
                  }}
                />
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(550).springify()}>
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            {isNew ? 'Crear tratamiento' : 'Guardar cambios'}
          </Button>

          {!isNew && (
            <Button 
              onPress={handleDelete} 
              variant="outline"
              fullWidth 
              size="lg"
              style={{ marginTop: 12, borderColor: colors.error }}
            >
              <Text style={{ color: colors.error, fontWeight: '600' }}>
                Eliminar tratamiento
              </Text>
            </Button>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

