import { Card, FODMAPBadge } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { FODMAPLevel, Recipe, MEAL_TYPE_LABELS, DIFFICULTY_LABELS, MealType, RecipeDifficulty } from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image,
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

type ViewMode = 'list' | 'grid';
type FilterLevel = FODMAPLevel | 'all';

interface Tag {
  id: number;
  name: string;
  color: string;
}

export default function RecipesScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [filterMealType, setFilterMealType] = useState<MealType | 'all'>('all');
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [recipeTags, setRecipeTags] = useState<Record<number, Tag[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showMealTypeFilter, setShowMealTypeFilter] = useState(false);

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
      
      // Load recipes
      const recipesData = await db.getAllAsync('SELECT * FROM recipes WHERE is_hidden != 1 OR is_hidden IS NULL ORDER BY name ASC');
      setRecipes(recipesData as Recipe[]);
      
      // Load tags
      const tagsData = await db.getAllAsync('SELECT * FROM tags ORDER BY name ASC');
      setTags(tagsData as Tag[]);
      
      // Load recipe-tag relationships
      const recipeTagsData = await db.getAllAsync(`
        SELECT rt.recipe_id, t.id, t.name, t.color 
        FROM recipe_tags rt 
        JOIN tags t ON rt.tag_id = t.id
      `);
      
      const tagsByRecipe: Record<number, Tag[]> = {};
      (recipeTagsData as any[]).forEach(row => {
        if (!tagsByRecipe[row.recipe_id]) tagsByRecipe[row.recipe_id] = [];
        tagsByRecipe[row.recipe_id].push({ id: row.id, name: row.name, color: row.color });
      });
      setRecipeTags(tagsByRecipe);
      
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredRecipes = recipes.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'all' || item.fodmap_level === filterLevel;
    const matchesMealType = filterMealType === 'all' || 
      (item.meal_types && JSON.parse(item.meal_types as string || '[]').includes(filterMealType));
    const matchesTag = filterTag === null || (recipeTags[item.id] || []).some(t => t.id === filterTag);
    return matchesSearch && matchesLevel && matchesMealType && matchesTag;
  });

  const mealTypes: { id: MealType | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'Todos', icon: 'apps-outline' },
    { id: 'breakfast', label: MEAL_TYPE_LABELS.breakfast, icon: 'sunny-outline' },
    { id: 'lunch', label: MEAL_TYPE_LABELS.lunch, icon: 'restaurant-outline' },
    { id: 'dinner', label: MEAL_TYPE_LABELS.dinner, icon: 'moon-outline' },
    { id: 'snack', label: MEAL_TYPE_LABELS.snack, icon: 'cafe-outline' },
  ];

  const activeFiltersCount = [
    filterLevel !== 'all',
    filterMealType !== 'all',
    filterTag !== null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterLevel('all');
    setFilterMealType('all');
    setFilterTag(null);
  };

  const handleTagPress = (tagId: number) => {
    setFilterTag(filterTag === tagId ? null : tagId);
  };

  const getTotalTime = (recipe: Recipe) => {
    return (recipe.prep_time || 0) + (recipe.cook_time || 0);
  };

  const FilterChip = ({ level, label }: { level: FilterLevel; label: string }) => (
    <Pressable
      onPress={() => setFilterLevel(level)}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
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
        fontSize: 12,
        fontWeight: '600',
        color: filterLevel === level ? '#FFFFFF' : colors.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const TagChip = ({ tag, isFilter = false }: { tag: Tag; isFilter?: boolean }) => (
    <Pressable
      onPress={() => handleTagPress(tag.id)}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: (isFilter && filterTag === tag.id) 
          ? tag.color 
          : tag.color + '25',
        borderWidth: 1,
        borderColor: tag.color,
      }}
    >
      <Text style={{
        fontSize: 11,
        fontWeight: '600',
        color: (isFilter && filterTag === tag.id) ? '#FFFFFF' : tag.color,
      }}>
        {tag.name}
      </Text>
    </Pressable>
  );

  const RecipeItemList = ({ item, index }: { item: Recipe; index: number }) => (
    <Animated.View 
      entering={FadeInRight.delay(index * 20).springify()}
      layout={Layout.springify()}
    >
      <Card 
        onPress={() => router.push(`/recipe/${item.id}`)}
        style={{ marginBottom: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.image_uri ? (
            <Image 
              source={{ uri: item.image_uri }}
              style={{ 
                width: 60, 
                height: 60, 
                borderRadius: 10, 
                marginRight: 12,
                backgroundColor: colors.cardElevated,
              }}
            />
          ) : (
            <View style={{ 
              width: 60, 
              height: 60, 
              borderRadius: 10, 
              marginRight: 12,
              backgroundColor: colors.cardElevated,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="book-outline" size={24} color={colors.textMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 15, 
              fontWeight: '600', 
              color: colors.text,
              marginBottom: 4,
            }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {getTotalTime(item) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {getTotalTime(item)} min
                  </Text>
                </View>
              )}
              {item.servings && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {item.servings}
                  </Text>
                </View>
              )}
              {item.difficulty && (
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  {DIFFICULTY_LABELS[item.difficulty as RecipeDifficulty]}
                </Text>
              )}
              {item.source === 'internal' && (
                <View style={{ 
                  backgroundColor: colors.primary + '20', 
                  paddingHorizontal: 5, 
                  paddingVertical: 1, 
                  borderRadius: 4 
                }}>
                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '700' }}>
                    FODMAP
                  </Text>
                </View>
              )}
            </View>
            {(recipeTags[item.id] || []).length > 0 && (
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {(recipeTags[item.id] || []).map(tag => (
                  <TagChip key={tag.id} tag={tag} />
                ))}
              </View>
            )}
          </View>
          <FODMAPBadge level={item.fodmap_level} size="sm" />
        </View>
      </Card>
    </Animated.View>
  );

  const RecipeItemGrid = ({ item, index }: { item: Recipe; index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 30).springify()}
      layout={Layout.springify()}
      style={{ width: '48%', marginBottom: 12 }}
    >
      <Card 
        onPress={() => router.push(`/recipe/${item.id}`)}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {item.image_uri ? (
          <Image 
            source={{ uri: item.image_uri }}
            style={{ 
              width: '100%', 
              height: 110, 
              backgroundColor: colors.cardElevated,
            }}
          />
        ) : (
          <View style={{ 
            width: '100%', 
            height: 90, 
            backgroundColor: colors.cardElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="book-outline" size={36} color={colors.textMuted} />
          </View>
        )}
        <View style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <Text 
              numberOfLines={2}
              style={{ 
                fontSize: 13, 
                fontWeight: '600', 
                color: colors.text,
                flex: 1,
                marginRight: 6,
              }}
            >
              {item.name}
            </Text>
            <FODMAPBadge level={item.fodmap_level} size="sm" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {getTotalTime(item) > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>
                  {getTotalTime(item)}m
                </Text>
              </View>
            )}
            {item.servings && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="people-outline" size={10} color={colors.textMuted} />
                <Text style={{ fontSize: 10, color: colors.textMuted }}>
                  {item.servings}
                </Text>
              </View>
            )}
          </View>
          {(recipeTags[item.id] || []).length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(recipeTags[item.id] || []).slice(0, 2).map(tag => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </View>
          )}
        </View>
      </Card>
    </Animated.View>
  );

  const EmptyState = () => (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Ionicons 
        name="book-outline" 
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
        No hay recetas
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: 32,
      }}>
        {searchQuery || activeFiltersCount > 0
          ? 'No se encontraron resultados para tu búsqueda'
          : 'Añade tu primera receta para empezar'
        }
      </Text>
      {activeFiltersCount > 0 && (
        <Pressable 
          onPress={clearFilters}
          style={{ marginTop: 16 }}
        >
          <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>
            Limpiar filtros
          </Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Search Bar & View Toggle */}
      <Animated.View 
        entering={FadeInDown.delay(50).springify()}
        style={{ paddingHorizontal: 16, paddingTop: 12 }}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderRadius: 12,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Buscar recetas..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 8,
                fontSize: 14,
                color: colors.text,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          
          {/* View Mode Toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 4 }}>
            <Pressable
              onPress={() => setViewMode('list')}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: viewMode === 'list' ? colors.primary : 'transparent',
              }}
            >
              <Ionicons 
                name="list" 
                size={18} 
                color={viewMode === 'list' ? '#FFF' : colors.textSecondary} 
              />
            </Pressable>
            <Pressable
              onPress={() => setViewMode('grid')}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: viewMode === 'grid' ? colors.primary : 'transparent',
              }}
            >
              <Ionicons 
                name="grid" 
                size={18} 
                color={viewMode === 'grid' ? '#FFF' : colors.textSecondary} 
              />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Filter Bar */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        >
          {/* Meal Type Filter Button */}
          <Pressable
            onPress={() => setShowMealTypeFilter(!showMealTypeFilter)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: filterMealType !== 'all' ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: filterMealType !== 'all' ? colors.primary : colors.border,
              gap: 4,
            }}
          >
            <Ionicons 
              name="restaurant-outline" 
              size={14} 
              color={filterMealType !== 'all' ? '#FFF' : colors.textSecondary} 
            />
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: filterMealType !== 'all' ? '#FFFFFF' : colors.textSecondary,
            }}>
              {filterMealType === 'all' 
                ? 'Tipo' 
                : MEAL_TYPE_LABELS[filterMealType]}
            </Text>
            <Ionicons 
              name={showMealTypeFilter ? 'chevron-up' : 'chevron-down'} 
              size={12} 
              color={filterMealType !== 'all' ? '#FFF' : colors.textSecondary} 
            />
          </Pressable>

          {/* FODMAP Level Filters */}
          <FilterChip level="all" label="Todos" />
          <FilterChip level="low" label="🟢 Bajo" />
          <FilterChip level="medium" label="🟡 Medio" />
          <FilterChip level="high" label="🔴 Alto" />

          {/* Tag Filters */}
          {tags.map(tag => (
            <TagChip key={tag.id} tag={tag} isFilter />
          ))}

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Pressable
              onPress={clearFilters}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                gap: 4,
              }}
            >
              <Ionicons name="close-circle" size={14} color={colors.error} />
              <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>
                Limpiar ({activeFiltersCount})
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </Animated.View>

      {/* Meal Type Dropdown */}
      {showMealTypeFilter && (
        <Animated.View 
          entering={FadeInDown.springify()}
          style={{ 
            marginHorizontal: 16, 
            marginBottom: 8,
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 8,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {mealTypes.map(type => (
              <Pressable
                key={type.id}
                onPress={() => {
                  setFilterMealType(type.id);
                  setShowMealTypeFilter(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: filterMealType === type.id ? colors.primary + '20' : colors.cardElevated,
                  borderWidth: 1,
                  borderColor: filterMealType === type.id ? colors.primary : 'transparent',
                  gap: 6,
                }}
              >
                <Ionicons 
                  name={type.icon as any} 
                  size={14} 
                  color={filterMealType === type.id ? colors.primary : colors.textSecondary} 
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: filterMealType === type.id ? colors.primary : colors.textSecondary,
                }}>
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Results count */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {filteredRecipes.length} receta{filteredRecipes.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List/Grid */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          padding: 16, 
          paddingTop: 0,
          ...(viewMode === 'grid' && { 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'space-between' 
          }),
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {filteredRecipes.length > 0 ? (
          viewMode === 'list' 
            ? filteredRecipes.map((item, index) => (
                <RecipeItemList key={item.id} item={item} index={index} />
              ))
            : filteredRecipes.map((item, index) => (
                <RecipeItemGrid key={item.id} item={item} index={index} />
              ))
        ) : (
          <EmptyState />
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View 
        entering={FadeInDown.delay(200).springify()}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
        }}
      >
        <Pressable
          onPress={() => router.push('/recipe/new')}
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

