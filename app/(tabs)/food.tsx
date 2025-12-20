import { Card, FODMAPBadge } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { FODMAPLevel, Food, Recipe } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View
} from 'react-native';
import Animated, {
    FadeInDown,
    FadeInRight,
    Layout,
} from 'react-native-reanimated';

type TabType = 'foods' | 'recipes';
type FilterLevel = FODMAPLevel | 'all';

export default function FoodScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('foods');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      
      // Load foods (alimentos) from the foods table
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setFoods(foodsData as Food[]);
      
      // Load recipes
      const recipesData = await db.getAllAsync('SELECT * FROM recipes ORDER BY name ASC');
      setRecipes(recipesData as Recipe[]);
      
      console.log('[FoodScreen] Loaded:', foodsData.length, 'foods,', recipesData.length, 'recipes');
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredFoods = foods.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterLevel === 'all' || item.fodmap_level === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const filteredRecipes = recipes.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterLevel === 'all' || item.fodmap_level === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const FilterChip = ({ level, label }: { level: FilterLevel; label: string }) => (
    <Pressable
      onPress={() => setFilterLevel(level)}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: filterLevel === level 
          ? colors.primary 
          : colors.card,
        borderWidth: 1,
        borderColor: filterLevel === level 
          ? colors.primary 
          : colors.border,
      }}
    >
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: filterLevel === level ? '#FFFFFF' : colors.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <Pressable
      onPress={() => setActiveTab(tab)}
      style={{
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: activeTab === tab ? colors.primary : 'transparent',
      }}
    >
      <Text style={{
        fontSize: 15,
        fontWeight: '600',
        color: activeTab === tab ? colors.primary : colors.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const FoodItem = ({ item, index }: { item: Food; index: number }) => (
    <Animated.View 
      entering={FadeInRight.delay(index * 30).springify()}
      layout={Layout.springify()}
    >
      <Card 
        onPress={() => router.push(`/food/${item.id}`)}
        style={{ marginBottom: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '600', 
              color: colors.text,
              marginBottom: 4,
            }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {item.category && (
                <Text style={{ fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' }}>
                  {item.category}
                </Text>
              )}
              {item.serving_size && (
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  • {item.serving_size}
                </Text>
              )}
              {item.source === 'internal' && (
                <View style={{ 
                  backgroundColor: colors.primary + '20', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>
                    FODMAP
                  </Text>
                </View>
              )}
            </View>
          </View>
          <FODMAPBadge level={item.fodmap_level} />
        </View>
      </Card>
    </Animated.View>
  );

  const RecipeItem = ({ item, index }: { item: Recipe; index: number }) => (
    <Animated.View 
      entering={FadeInRight.delay(index * 30).springify()}
      layout={Layout.springify()}
    >
      <Card 
        onPress={() => router.push(`/recipe/${item.id}`)}
        style={{ marginBottom: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '600', 
              color: colors.text,
              marginBottom: 4,
            }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {item.prep_time != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {item.prep_time + (item.cook_time || 0)} min
                  </Text>
                </View>
              )}
              {item.servings && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    {item.servings}
                  </Text>
                </View>
              )}
              {item.source === 'internal' && (
                <View style={{ 
                  backgroundColor: colors.primary + '20', 
                  paddingHorizontal: 6, 
                  paddingVertical: 2, 
                  borderRadius: 4 
                }}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>
                    FODMAP
                  </Text>
                </View>
              )}
            </View>
          </View>
          <FODMAPBadge level={item.fodmap_level} />
        </View>
      </Card>
    </Animated.View>
  );

  const EmptyState = ({ type }: { type: 'foods' | 'recipes' }) => (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons 
        name={type === 'foods' ? 'nutrition-outline' : 'book-outline'} 
        size={64} 
        color={colors.textMuted} 
        style={{ marginBottom: 16 }}
      />
      <Text style={{ 
        fontSize: 17, 
        fontWeight: '600', 
        color: colors.textSecondary,
        marginBottom: 8,
      }}>
        No hay {type === 'foods' ? 'alimentos' : 'recetas'}
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: 32,
      }}>
        {searchQuery 
          ? 'No se encontraron resultados para tu búsqueda'
          : `Añade tu primer${type === 'foods' ? ' alimento' : 'a receta'} para empezar`
        }
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Bar */}
      <Animated.View 
        entering={FadeInDown.delay(100).springify()}
        style={{ paddingHorizontal: 16, paddingTop: 16 }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: 12,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            placeholder="Buscar alimentos o recetas..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 10,
              fontSize: 15,
              color: colors.text,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={{ 
        flexDirection: 'row', 
        marginHorizontal: 16,
        marginTop: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TabButton tab="foods" label="Alimentos" />
        <TabButton tab="recipes" label="Recetas" />
      </View>

      {/* Filters */}
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        >
          <FilterChip level="all" label="Todos" />
          <FilterChip level="low" label="🟢 Bajo" />
          <FilterChip level="medium" label="🟡 Medio" />
          <FilterChip level="high" label="🔴 Alto" />
        </ScrollView>
      </Animated.View>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'foods' ? (
          filteredFoods.length > 0 ? (
            filteredFoods.map((item, index) => (
              <FoodItem key={item.id} item={item} index={index} />
            ))
          ) : (
            <EmptyState type="foods" />
          )
        ) : (
          filteredRecipes.length > 0 ? (
            filteredRecipes.map((item, index) => (
              <RecipeItem key={item.id} item={item} index={index} />
            ))
          ) : (
            <EmptyState type="recipes" />
          )
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View 
        entering={FadeInDown.delay(300).springify()}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
        }}
      >
        <Pressable
          onPress={() => router.push(activeTab === 'foods' ? '/food/new' : '/recipe/new')}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
