import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button } from '@/components/ui';
import { getDatabase, deleteRow } from '@/lib/database';
import { Treatment, TREATMENT_TYPES, TREATMENT_FREQUENCY_LABELS } from '@/lib/types';

export default function TreatmentsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [filter, setFilter] = useState<'active' | 'all' | 'chronic'>('active');

  useFocusEffect(
    useCallback(() => {
      loadTreatments();
    }, [filter])
  );

  const loadTreatments = async () => {
    try {
      const db = await getDatabase();
      let query = 'SELECT * FROM treatments';
      const params: any[] = [];
      
      if (filter === 'active') {
        query += ' WHERE is_active = 1';
      } else if (filter === 'chronic') {
        query += ' WHERE is_chronic = 1 AND is_active = 1';
      }
      
      query += ' ORDER BY name ASC';
      
      const result = await (db as any).getAllAsync(query, params);
      setTreatments(result || []);
    } catch (error) {
      console.error('Error loading treatments:', error);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const confirmDelete = () => {
      deleteRow('treatments', id)
        .then(() => {
          loadTreatments();
        })
        .catch(error => {
          console.error('Error deleting treatment:', error);
          Alert.alert('Error', 'No se pudo eliminar el tratamiento');
        });
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${name}"?`)) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        'Eliminar tratamiento',
        `¿Estás seguro de que quieres eliminar "${name}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const toggleActive = async (treatment: Treatment) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE treatments SET is_active = ? WHERE id = ?',
        [treatment.is_active ? 0 : 1, treatment.id]
      );
      loadTreatments();
    } catch (error) {
      console.error('Error toggling treatment:', error);
    }
  };

  const getDosesSummary = (treatment: Treatment): string => {
    if (treatment.doses) {
      try {
        const doses = typeof treatment.doses === 'string' 
          ? JSON.parse(treatment.doses) 
          : treatment.doses;
        if (Array.isArray(doses) && doses.length > 0) {
          return `${doses.length} dosis/día`;
        }
      } catch (e) {}
    }
    
    if (treatment.dosage_amount && treatment.dosage_unit) {
      return `${treatment.dosage_amount} ${treatment.dosage_unit}`;
    }
    
    return '';
  };

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <Pressable
      onPress={() => setFilter(value)}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: filter === value ? colors.treatment : colors.cardElevated,
      }}
    >
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: filter === value ? '#FFFFFF' : colors.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mis tratamientos',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/treatment/new')}
              style={{ marginRight: 16 }}
            >
              <Ionicons name="add-circle" size={28} color={colors.treatment} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {/* Filters */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            <FilterButton value="active" label="Activos" />
            <FilterButton value="chronic" label="Crónicos" />
            <FilterButton value="all" label="Todos" />
          </View>
        </Animated.View>

        {/* Treatments List */}
        {treatments.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Ionicons name="medkit-outline" size={64} color={colors.textMuted} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>
                  No hay tratamientos {filter === 'active' ? 'activos' : filter === 'chronic' ? 'crónicos' : ''}
                </Text>
                <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center' }}>
                  Añade un tratamiento para llevar un seguimiento
                </Text>
              </View>
            </Card>
          </Animated.View>
        ) : (
          treatments.map((treatment, index) => (
            <Animated.View 
              key={treatment.id}
              entering={FadeInRight.delay(150 + index * 50).springify()}
            >
              <Pressable
                onPress={() => router.push(`/treatment/${treatment.id}`)}
                style={{ marginBottom: 12 }}
              >
                <Card style={{ opacity: treatment.is_active ? 1 : 0.6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {/* Icon */}
                    <View style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: colors.treatment + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                    }}>
                      <Ionicons 
                        name={TREATMENT_TYPES[treatment.type as keyof typeof TREATMENT_TYPES]?.icon as any || 'medkit'} 
                        size={24} 
                        color={colors.treatment} 
                      />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: '600', 
                          color: colors.text,
                          flex: 1,
                        }}>
                          {treatment.name}
                        </Text>
                        {treatment.is_chronic && (
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                            backgroundColor: colors.primary + '20',
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: colors.primary }}>
                              CRÓNICO
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        {TREATMENT_TYPES[treatment.type as keyof typeof TREATMENT_TYPES]?.label || 'Otro'}
                        {getDosesSummary(treatment) && ` · ${getDosesSummary(treatment)}`}
                      </Text>

                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                        {TREATMENT_FREQUENCY_LABELS[treatment.frequency as keyof typeof TREATMENT_FREQUENCY_LABELS] || treatment.frequency}
                      </Text>

                      {treatment.instructions && (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                          {treatment.instructions}
                        </Text>
                      )}
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleActive(treatment);
                        }}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: colors.cardElevated,
                        }}
                      >
                        <Ionicons 
                          name={treatment.is_active ? 'pause' : 'play'} 
                          size={18} 
                          color={treatment.is_active ? colors.warning : colors.success} 
                        />
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDelete(treatment.id, treatment.name);
                        }}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: colors.cardElevated,
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Reminder indicator */}
                  {treatment.reminder_enabled && (
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      marginTop: 12,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                      gap: 6,
                    }}>
                      <Ionicons name="notifications" size={14} color={colors.treatment} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        Recordatorios activados
                      </Text>
                    </View>
                  )}
                </Card>
              </Pressable>
            </Animated.View>
          ))
        )}

        {/* Add Button */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Button 
            onPress={() => router.push('/treatment/new')}
            fullWidth 
            size="lg"
            style={{ marginTop: 12 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                Añadir tratamiento
              </Text>
            </View>
          </Button>
        </Animated.View>
      </ScrollView>
    </>
  );
}


