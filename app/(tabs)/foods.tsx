import { Card, FODMAPBadge } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import { FODMAPLevel, Food, FOOD_CATEGORIES } from '@/lib/types';
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

export default function FoodsScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [foods, setFoods] = useState<Food[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [foodTags, setFoodTags] = useState<Record<number, Tag[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

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
      
      // Load foods
      const foodsData = await db.getAllAsync('SELECT * FROM foods ORDER BY name ASC');
      setFoods(foodsData as Food[]);
      
      // Load tags
      const tagsData = await db.getAllAsync('SELECT * FROM tags ORDER BY name ASC');
      setTags(tagsData as Tag[]);
      
      // Load food-tag relationships
      const foodTagsData = await db.getAllAsync(`
        SELECT ft.food_id, t.id, t.name, t.color 
        FROM food_tags ft 
        JOIN tags t ON ft.tag_id = t.id
      `);
      
      const tagsByFood: Record<number, Tag[]> = {};
      (foodTagsData as any[]).forEach(row => {
        if (!tagsByFood[row.food_id]) tagsByFood[row.food_id] = [];
        tagsByFood[row.food_id].push({ id: row.id, name: row.name, color: row.color });
      });
      setFoodTags(tagsByFood);
      
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
    const matchesLevel = filterLevel === 'all' || item.fodmap_level === filterLevel;
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesTag = filterTag === null || (foodTags[item.id] || []).some(t => t.id === filterTag);
    return matchesSearch && matchesLevel && matchesCategory && matchesTag;
  });

  const categories = [
    { id: 'all', label: 'Todas', icon: 'apps-outline' },
    ...FOOD_CATEGORIES
  ];

  const activeFiltersCount = [
    filterLevel !== 'all',
    filterCategory !== 'all',
    filterTag !== null,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setFilterLevel('all');
    setFilterCategory('all');
    setFilterTag(null);
  };

  const handleTagPress = (tagId: number) => {
    setFilterTag(filterTag === tagId ? null : tagId);
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

  const FoodItemList = ({ item, index }: { item: Food; index: number }) => (
    <Animated.View 
      entering={FadeInRight.delay(index * 20).springify()}
      layout={Layout.springify()}
    >
      <Card 
        onPress={() => router.push(`/food/${item.id}`)}
        style={{ marginBottom: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {item.image_uri && (
            <Image 
              source={{ uri: item.image_uri }}
              style={{ 
                width: 50, 
                height: 50, 
                borderRadius: 8, 
                marginRight: 12,
                backgroundColor: colors.cardElevated,
              }}
            />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {item.category && (
                <Text style={{ fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' }}>
                  {FOOD_CATEGORIES.find(c => c.id === item.category)?.label || item.category}
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
              {(foodTags[item.id] || []).map(tag => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </View>
          </View>
          <FODMAPBadge level={item.fodmap_level} size="sm" />
        </View>
      </Card>
    </Animated.View>
  );

  const FoodItemGrid = ({ item, index }: { item: Food; index: number }) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 30).springify()}
      layout={Layout.springify()}
      style={{ width: '48%', marginBottom: 12 }}
    >
      <Card 
        onPress={() => router.push(`/food/${item.id}`)}
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {item.image_uri ? (
          <Image 
            source={{ uri: item.image_uri }}
            style={{ 
              width: '100%', 
              height: 100, 
              backgroundColor: colors.cardElevated,
            }}
          />
        ) : (
          <View style={{ 
            width: '100%', 
            height: 80, 
            backgroundColor: colors.cardElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name="nutrition-outline" size={32} color={colors.textMuted} />
          </View>
        )}
        <View style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
          {(foodTags[item.id] || []).length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(foodTags[item.id] || []).slice(0, 2).map(tag => (
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
        name="nutrition-outline" 
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
        No hay alimentos
      </Text>
      <Text style={{ 
        fontSize: 14, 
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: 32,
      }}>
        {searchQuery || activeFiltersCount > 0
          ? 'No se encontraron resultados para tu búsqueda'
          : 'Añade tu primer alimento para empezar'
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
              placeholder="Buscar alimentos..."
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
          {/* Category Filter Button */}
          <Pressable
            onPress={() => setShowCategoryFilter(!showCategoryFilter)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: filterCategory !== 'all' ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: filterCategory !== 'all' ? colors.primary : colors.border,
              gap: 4,
            }}
          >
            <Ionicons 
              name="funnel-outline" 
              size={14} 
              color={filterCategory !== 'all' ? '#FFF' : colors.textSecondary} 
            />
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: filterCategory !== 'all' ? '#FFFFFF' : colors.textSecondary,
            }}>
              {filterCategory === 'all' 
                ? 'Categoría' 
                : FOOD_CATEGORIES.find(c => c.id === filterCategory)?.label || filterCategory}
            </Text>
            <Ionicons 
              name={showCategoryFilter ? 'chevron-up' : 'chevron-down'} 
              size={12} 
              color={filterCategory !== 'all' ? '#FFF' : colors.textSecondary} 
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

      {/* Category Dropdown */}
      {showCategoryFilter && (
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
            {categories.map(cat => (
              <Pressable
                key={cat.id}
                onPress={() => {
                  setFilterCategory(cat.id);
                  setShowCategoryFilter(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  backgroundColor: filterCategory === cat.id ? colors.primary + '20' : colors.cardElevated,
                  borderWidth: 1,
                  borderColor: filterCategory === cat.id ? colors.primary : 'transparent',
                  gap: 6,
                }}
              >
                <Ionicons 
                  name={cat.icon as any} 
                  size={14} 
                  color={filterCategory === cat.id ? colors.primary : colors.textSecondary} 
                />
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: filterCategory === cat.id ? colors.primary : colors.textSecondary,
                }}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Results count */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {filteredFoods.length} alimento{filteredFoods.length !== 1 ? 's' : ''}
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
        {filteredFoods.length > 0 ? (
          viewMode === 'list' 
            ? filteredFoods.map((item, index) => (
                <FoodItemList key={item.id} item={item} index={index} />
              ))
            : filteredFoods.map((item, index) => (
                <FoodItemGrid key={item.id} item={item} index={index} />
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
          onPress={() => router.push('/food/new')}
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

