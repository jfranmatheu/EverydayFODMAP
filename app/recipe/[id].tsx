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
import { FODMAPLevel, Recipe } from '@/lib/types';

export default function RecipeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('1');
  const [fodmapLevel, setFodmapLevel] = useState<FODMAPLevel>('low');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && id) {
      loadRecipe();
    }
  }, [id]);

  const loadRecipe = async () => {
    try {
      const recipe = await getRowById<Recipe>('recipes', parseInt(id!));
      if (recipe) {
        setName(recipe.name);
        setDescription(recipe.description || '');
        setInstructions(recipe.instructions || '');
        setPrepTime(recipe.prep_time?.toString() || '');
        setCookTime(recipe.cook_time?.toString() || '');
        setServings(recipe.servings?.toString() || '1');
        setFodmapLevel(recipe.fodmap_level);
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
      Alert.alert('Error', 'No se pudo cargar la receta');
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
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        prep_time: prepTime ? parseInt(prepTime) : null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        servings: servings ? parseInt(servings) : 1,
        fodmap_level: fodmapLevel,
      };

      if (isNew) {
        await insertRow('recipes', data);
        Alert.alert('¡Guardado!', 'Receta añadida correctamente');
      } else {
        await updateRow('recipes', parseInt(id!), data);
        Alert.alert('¡Guardado!', 'Receta actualizada correctamente');
      }
      router.back();
    } catch (error) {
      console.error('Error saving recipe:', error);
      Alert.alert('Error', 'No se pudo guardar la receta');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar receta',
      '¿Estás seguro de que quieres eliminar esta receta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRow('recipes', parseInt(id!));
              Alert.alert('Eliminado', 'Receta eliminada correctamente');
              router.back();
            } catch (error) {
              console.error('Error deleting recipe:', error);
              Alert.alert('Error', 'No se pudo eliminar la receta');
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
          title: isNew ? 'Nueva receta' : 'Editar receta',
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
              placeholder="Ej: Ensalada mediterránea..."
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
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Descripción
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Breve descripción de la receta..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={2}
              style={{
                fontSize: 15,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
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

        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Card style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
              Tiempos y porciones
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                  Prep. (min)
                </Text>
                <TextInput
                  value={prepTime}
                  onChangeText={setPrepTime}
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                  Cocción (min)
                </Text>
                <TextInput
                  value={cookTime}
                  onChangeText={setCookTime}
                  placeholder="30"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                  Porciones
                </Text>
                <TextInput
                  value={servings}
                  onChangeText={setServings}
                  placeholder="4"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={{
                    fontSize: 15,
                    color: colors.text,
                    padding: 12,
                    backgroundColor: colors.cardElevated,
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                />
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
              Instrucciones
            </Text>
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="Pasos para preparar la receta..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              style={{
                fontSize: 15,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                minHeight: 150,
                textAlignVertical: 'top',
              }}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Button onPress={handleSave} loading={loading} fullWidth size="lg">
            {isNew ? 'Añadir receta' : 'Guardar cambios'}
          </Button>

          {!isNew && (
            <Button
              onPress={handleDelete}
              variant="ghost"
              fullWidth
              size="lg"
              style={{ marginTop: 12 }}
            >
              <Text style={{ color: colors.error, fontWeight: '600' }}>Eliminar receta</Text>
            </Button>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

