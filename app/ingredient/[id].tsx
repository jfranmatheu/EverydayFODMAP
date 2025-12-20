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
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, Button, FODMAPBadge } from '@/components/ui';
import { getDatabase, insertRow, updateRow, deleteRow, getRowById } from '@/lib/database';
import { FODMAPLevel, Ingredient } from '@/lib/types';

export default function IngredientScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [fodmapLevel, setFodmapLevel] = useState<FODMAPLevel>('low');
  const [servingSize, setServingSize] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      loadIngredient();
    }
  }, [id]);

  const loadIngredient = async () => {
    try {
      const ingredient = await getRowById<Ingredient>('ingredients', parseInt(id!));
      if (ingredient) {
        setName(ingredient.name);
        setFodmapLevel(ingredient.fodmap_level);
        setServingSize(ingredient.serving_size || '');
        setNotes(ingredient.notes || '');
      }
    } catch (error) {
      console.error('Error loading ingredient:', error);
      Alert.alert('Error', 'No se pudo cargar el ingrediente');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor, introduce un nombre');
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        fodmap_level: fodmapLevel,
        serving_size: servingSize.trim() || null,
        notes: notes.trim() || null,
      };

      if (isNew) {
        await insertRow('ingredients', data);
        Alert.alert('¡Guardado!', 'Ingrediente añadido correctamente');
      } else {
        await updateRow('ingredients', parseInt(id!), data);
        Alert.alert('¡Guardado!', 'Ingrediente actualizado correctamente');
      }
      router.back();
    } catch (error) {
      console.error('Error saving ingredient:', error);
      Alert.alert('Error', 'No se pudo guardar el ingrediente');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar ingrediente',
      '¿Estás seguro de que quieres eliminar este ingrediente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRow('ingredients', parseInt(id!));
              Alert.alert('Eliminado', 'Ingrediente eliminado correctamente');
              router.back();
            } catch (error) {
              console.error('Error deleting ingredient:', error);
              Alert.alert('Error', 'No se pudo eliminar el ingrediente');
            }
          },
        },
      ]
    );
  };

  const FODMAPOption = ({ level, label }: { level: FODMAPLevel; label: string }) => (
    <Pressable
      onPress={() => setFodmapLevel(level)}
      style={{
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: fodmapLevel === level 
          ? level === 'low' ? colors.fodmapLow + '20'
            : level === 'medium' ? colors.fodmapMedium + '20'
            : colors.fodmapHigh + '20'
          : colors.cardElevated,
        borderWidth: 2,
        borderColor: fodmapLevel === level
          ? level === 'low' ? colors.fodmapLow
            : level === 'medium' ? colors.fodmapMedium
            : colors.fodmapHigh
          : 'transparent',
        alignItems: 'center',
      }}
    >
      <FODMAPBadge level={level} size="sm" />
      <Text style={{
        fontSize: 12,
        fontWeight: '600',
        color: fodmapLevel === level ? colors.text : colors.textSecondary,
        marginTop: 6,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  if (initialLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>Cargando...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'Nuevo ingrediente' : 'Editar ingrediente',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Nombre *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Arroz, Pollo, Zanahoria..."
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

        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Nivel FODMAP
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <FODMAPOption level="low" label="Bajo" />
              <FODMAPOption level="medium" label="Medio" />
              <FODMAPOption level="high" label="Alto" />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Tamaño de porción
            </Text>
            <TextInput
              value={servingSize}
              onChangeText={setServingSize}
              placeholder="Ej: 100g, 1 taza, 1 unidad..."
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

        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Notas
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Información adicional..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              style={{
                fontSize: 15,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            {isNew ? 'Añadir ingrediente' : 'Guardar cambios'}
          </Button>

          {!isNew && (
            <Button
              onPress={handleDelete}
              variant="ghost"
              fullWidth
              size="lg"
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: colors.error, fontWeight: '600' }}>Eliminar ingrediente</Text>
            </Button>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

