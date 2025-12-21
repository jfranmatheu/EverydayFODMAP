import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';

// OpenFoodFacts API base URL - Using public API endpoints that work from browser
const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OFF_API_V0 = 'https://world.openfoodfacts.org/api/v0';

// Helper functions to call OpenFoodFacts API directly
const offAPI = {
  async search(params: any) {
    // Use the search.pl endpoint which works better from browser
    const queryParams = new URLSearchParams();
    queryParams.append('action', 'process');
    queryParams.append('json', '1');
    queryParams.append('page_size', params.page_size || '24');
    queryParams.append('page', params.page || '1');
    
    if (params.search_terms) {
      queryParams.append('search_terms', params.search_terms);
    }
    if (params.brands) {
      queryParams.append('brands_tags', params.brands);
    }
    if (params.categories) {
      queryParams.append('categories_tags', params.categories);
    }
    if (params.countries) {
      queryParams.append('countries_tags', params.countries);
    }
    if (params.additives) {
      queryParams.append('additives_tags', params.additives);
    }
    if (params.allergens) {
      queryParams.append('allergens_tags', params.allergens);
    }
    if (params.stores) {
      queryParams.append('stores_tags', params.stores);
    }

    const response = await fetch(`${OFF_API_BASE}/cgi/search.pl?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getProductV3(code: string) {
    const response = await fetch(`${OFF_API_V0}/product/${code}.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  async getBrands() {
    // Use the taxonomy endpoint
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/brands.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    // Extract keys from the taxonomy object
    return { tags: Object.keys(data).slice(0, 50) };
  },

  async getCategories() {
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/categories.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    return { tags: Object.keys(data).slice(0, 50) };
  },

  async getCountries() {
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/countries.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    return { tags: Object.keys(data).slice(0, 50) };
  },

  async getAdditives() {
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/additives.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    // Filter only 'en:' tags and remove the prefix
    const enTags = Object.keys(data)
      .filter(key => key.startsWith('en:'))
      .map(key => key.replace(/^en:/, ''))
      .slice(0, 50);
    return { tags: enTags };
  },

  async getAllergens() {
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/allergens.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    // Filter only 'en:' tags and remove the prefix
    const enTags = Object.keys(data)
      .filter(key => key.startsWith('en:'))
      .map(key => key.replace(/^en:/, ''))
      .slice(0, 50);
    return { tags: enTags };
  },

  async getStores() {
    const response = await fetch(`${OFF_API_BASE}/data/taxonomies/stores.json`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { tags: [] };
    }
    
    const data = await response.json();
    return { tags: Object.keys(data).slice(0, 50) };
  },
};

interface Product {
  code: string;
  product_name?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  brands?: string;
  categories?: string;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  nova_group?: number;
}

interface ProductDetails {
  code: string;
  product_name?: string;
  image_url?: string;
  image_front_url?: string;
  brands?: string;
  categories?: string;
  categories_tags?: string[];
  nutriments?: any;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  nova_group?: number;
  ingredients_text?: string;
  ingredients?: any[];
  additives_tags?: string[];
  allergens_tags?: string[];
  stores?: string;
  countries?: string;
  packaging?: string;
  quantity?: string;
  serving_size?: string;
}

type FilterType = 'brand' | 'category' | 'country' | 'additive' | 'allergen' | 'store';

export default function OpenFoodFactsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedAdditive, setSelectedAdditive] = useState<string | null>(null);
  const [selectedAllergen, setSelectedAllergen] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  
  // Filter options
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [additives, setAdditives] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Product details modal
  const [selectedProduct, setSelectedProduct] = useState<ProductDetails | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      // Load all filter options in parallel
      const [brandsData, categoriesData, countriesData, additivesData, allergensData, storesData] = await Promise.all([
        offAPI.getBrands().catch(() => ({ tags: [] })),
        offAPI.getCategories().catch(() => ({ tags: [] })),
        offAPI.getCountries().catch(() => ({ tags: [] })),
        offAPI.getAdditives().catch(() => ({ tags: [] })),
        offAPI.getAllergens().catch(() => ({ tags: [] })),
        offAPI.getStores().catch(() => ({ tags: [] })),
      ]);

      setBrands((brandsData as any).tags?.slice(0, 50) || []);
      setCategories((categoriesData as any).tags?.slice(0, 50) || []);
      setCountries((countriesData as any).tags?.slice(0, 50) || []);
      setAdditives((additivesData as any).tags?.slice(0, 50) || []);
      setAllergens((allergensData as any).tags?.slice(0, 50) || []);
      setStores((storesData as any).tags?.slice(0, 50) || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoadingFilters(false);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim() && !selectedBrand && !selectedCategory && !selectedCountry && 
        !selectedAdditive && !selectedAllergen && !selectedStore) {
      Alert.alert('Búsqueda vacía', 'Por favor, introduce un término de búsqueda o selecciona un filtro');
      return;
    }

    setLoading(true);
    try {
      // Build search parameters
      const searchParams: any = {
        page_size: 24,
        page: 1,
      };

      if (searchQuery.trim()) {
        searchParams.search_terms = searchQuery.trim();
      }

      if (selectedBrand) {
        searchParams.brands = selectedBrand;
      }
      if (selectedCategory) {
        searchParams.categories = selectedCategory;
      }
      if (selectedCountry) {
        searchParams.countries = selectedCountry;
      }
      if (selectedAdditive) {
        searchParams.additives = selectedAdditive;
      }
      if (selectedAllergen) {
        searchParams.allergens = selectedAllergen;
      }
      if (selectedStore) {
        searchParams.stores = selectedStore;
      }

      const result = await offAPI.search(searchParams);
      // Search.pl returns products in 'products' array
      const productsList = (result as any).products || [];
      setProducts(productsList);
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'No se pudo realizar la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  const loadProductDetails = async (code: string) => {
    setLoadingProduct(true);
    try {
      const result = await offAPI.getProductV3(code);
      const product = (result as any).product || result;
      setSelectedProduct(product as ProductDetails);
      setShowProductModal(true);
    } catch (error) {
      console.error('Error loading product details:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles del producto');
    } finally {
      setLoadingProduct(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await performSearch();
    setRefreshing(false);
  };

  const clearFilters = () => {
    setSelectedBrand(null);
    setSelectedCategory(null);
    setSelectedCountry(null);
    setSelectedAdditive(null);
    setSelectedAllergen(null);
    setSelectedStore(null);
    setSearchQuery('');
    setProducts([]);
  };

  const hasActiveFilters = selectedBrand || selectedCategory || selectedCountry || 
    selectedAdditive || selectedAllergen || selectedStore || searchQuery.trim();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'OpenFoodFacts',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Search Bar */}
        <View style={{ padding: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar productos..."
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontSize: 16,
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 12,
              }}
              onSubmitEditing={performSearch}
            />
            <Pressable
              onPress={performSearch}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="search" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Filter Toggle */}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              onPress={() => setShowFilters(!showFilters)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: showFilters ? colors.primary : colors.cardElevated,
              }}
            >
              <Ionicons 
                name="filter" 
                size={16} 
                color={showFilters ? '#FFFFFF' : colors.textSecondary} 
              />
              <Text style={{
                fontSize: 13,
                fontWeight: '600',
                color: showFilters ? '#FFFFFF' : colors.textSecondary,
              }}>
                Filtros
              </Text>
              {hasActiveFilters && (
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#FFFFFF',
                  marginLeft: 4,
                }} />
              )}
            </Pressable>
            {hasActiveFilters && (
              <Pressable
                onPress={clearFilters}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: colors.cardElevated,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                  Limpiar
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={{ 
              backgroundColor: colors.card, 
              borderBottomWidth: 1, 
              borderBottomColor: colors.border,
              maxHeight: 200,
            }}
            contentContainerStyle={{ padding: 12, gap: 12 }}
          >
            {/* Brand Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Marca
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  brands.map((brand) => (
                    <Pressable
                      key={brand}
                      onPress={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedBrand === brand ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedBrand === brand ? '#FFFFFF' : colors.text,
                      }}>
                        {brand}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Category Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Categoría
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  categories.map((category) => (
                    <Pressable
                      key={category}
                      onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedCategory === category ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedCategory === category ? '#FFFFFF' : colors.text,
                      }}>
                        {category}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Country Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                País
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  countries.map((country) => (
                    <Pressable
                      key={country}
                      onPress={() => setSelectedCountry(selectedCountry === country ? null : country)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedCountry === country ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedCountry === country ? '#FFFFFF' : colors.text,
                      }}>
                        {country}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Additive Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Aditivo
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  additives.map((additive) => (
                    <Pressable
                      key={additive}
                      onPress={() => setSelectedAdditive(selectedAdditive === additive ? null : additive)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedAdditive === additive ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedAdditive === additive ? '#FFFFFF' : colors.text,
                      }}>
                        {additive}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Allergen Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Alérgeno
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  allergens.map((allergen) => (
                    <Pressable
                      key={allergen}
                      onPress={() => setSelectedAllergen(selectedAllergen === allergen ? null : allergen)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedAllergen === allergen ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedAllergen === allergen ? '#FFFFFF' : colors.text,
                      }}>
                        {allergen}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>

            {/* Store Filter */}
            <View style={{ minWidth: 150 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                Tienda
              </Text>
              <ScrollView style={{ maxHeight: 120 }}>
                {loadingFilters ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  stores.map((store) => (
                    <Pressable
                      key={store}
                      onPress={() => setSelectedStore(selectedStore === store ? null : store)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: selectedStore === store ? colors.primary : 'transparent',
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{
                        fontSize: 12,
                        color: selectedStore === store ? '#FFFFFF' : colors.text,
                      }}>
                        {store}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        )}

        {/* Products Grid */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {loading && products.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ marginTop: 16, color: colors.textSecondary }}>
                Buscando productos...
              </Text>
            </View>
          ) : products.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={64} color={colors.textMuted} />
              <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: colors.text }}>
                No hay productos
              </Text>
              <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: 'center' }}>
                Realiza una búsqueda para ver productos de OpenFoodFacts
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {products.map((product) => (
                <Pressable
                  key={product.code}
                  onPress={() => loadProductDetails(product.code)}
                  style={{
                    width: '47%',
                    backgroundColor: colors.card,
                    borderRadius: 12,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.cardElevated }}>
                    {product.image_front_small_url || product.image_front_url || product.image_url ? (
                      <Image
                        source={{ uri: product.image_front_small_url || product.image_front_url || product.image_url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: 10 }}>
                    <Text 
                      style={{ 
                        fontSize: 13, 
                        fontWeight: '600', 
                        color: colors.text,
                        marginBottom: 4,
                      }}
                      numberOfLines={2}
                    >
                      {product.product_name || 'Producto sin nombre'}
                    </Text>
                    {product.brands ? (
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
                        {product.brands}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {product.nutriscore_grade && (
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: product.nutriscore_grade === 'a' ? '#00A86B' :
                            product.nutriscore_grade === 'b' ? '#85BB2F' :
                            product.nutriscore_grade === 'c' ? '#F3C300' :
                            product.nutriscore_grade === 'd' ? '#EE8100' : '#E63E11',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                            {product.nutriscore_grade.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {product.nova_group && (
                        <View style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: product.nova_group === 1 ? '#00A86B' :
                            product.nova_group === 2 ? '#85BB2F' :
                            product.nova_group === 3 ? '#F3C300' : '#E63E11',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#FFFFFF' }}>
                            {product.nova_group}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Product Details Modal */}
        <Modal
          visible={showProductModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowProductModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ 
              backgroundColor: colors.card, 
              borderTopLeftRadius: 24, 
              borderTopRightRadius: 24,
              maxHeight: '90%',
            }}>
              {/* Modal Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Detalles del producto
                </Text>
                <Pressable onPress={() => setShowProductModal(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                {loadingProduct ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : selectedProduct ? (
                  <View style={{ gap: 16 }}>
                    {/* Product Image */}
                    {selectedProduct.image_front_url || selectedProduct.image_url ? (
                      <View style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.cardElevated, borderRadius: 12, overflow: 'hidden' }}>
                        <Image
                          source={{ uri: selectedProduct.image_front_url || selectedProduct.image_url }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="contain"
                        />
                      </View>
                    ) : null}

                    {/* Product Name */}
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                        {selectedProduct.product_name || 'Producto sin nombre'}
                      </Text>
                      {selectedProduct.brands && (
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                          Marca: {selectedProduct.brands}
                        </Text>
                      )}
                    </View>

                    {/* Scores */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {selectedProduct.nutriscore_grade && (
                        <View style={{ flex: 1, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                            Nutri-Score
                          </Text>
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: selectedProduct.nutriscore_grade === 'a' ? '#00A86B' :
                              selectedProduct.nutriscore_grade === 'b' ? '#85BB2F' :
                              selectedProduct.nutriscore_grade === 'c' ? '#F3C300' :
                              selectedProduct.nutriscore_grade === 'd' ? '#EE8100' : '#E63E11',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                              {selectedProduct.nutriscore_grade.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      )}
                      {selectedProduct.nova_group && (
                        <View style={{ flex: 1, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                            NOVA
                          </Text>
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: selectedProduct.nova_group === 1 ? '#00A86B' :
                              selectedProduct.nova_group === 2 ? '#85BB2F' :
                              selectedProduct.nova_group === 3 ? '#F3C300' : '#E63E11',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                              {selectedProduct.nova_group}
                            </Text>
                          </View>
                        </View>
                      )}
                      {selectedProduct.ecoscore_grade && (
                        <View style={{ flex: 1, padding: 12, backgroundColor: colors.cardElevated, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                            Eco-Score
                          </Text>
                          <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: selectedProduct.ecoscore_grade === 'a' ? '#00A86B' :
                              selectedProduct.ecoscore_grade === 'b' ? '#85BB2F' :
                              selectedProduct.ecoscore_grade === 'c' ? '#F3C300' :
                              selectedProduct.ecoscore_grade === 'd' ? '#EE8100' : '#E63E11',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                              {selectedProduct.ecoscore_grade.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Categories */}
                    {selectedProduct.categories && (
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                          Categorías
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {selectedProduct.categories.split(',').map((category, index) => {
                            const trimmedCategory = category.trim();
                            if (!trimmedCategory) return null;
                            return (
                              <View
                                key={index}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 12,
                                  backgroundColor: colors.cardElevated,
                                }}
                              >
                                <Text style={{ fontSize: 12, color: colors.text }}>
                                  {trimmedCategory}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Ingredients */}
                    {selectedProduct.ingredients_text && (
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                          Ingredientes
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
                          {selectedProduct.ingredients_text}
                        </Text>
                      </View>
                    )}

                    {/* Additives */}
                    {selectedProduct.additives_tags && selectedProduct.additives_tags.length > 0 && (
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                          Aditivos
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {selectedProduct.additives_tags
                            .filter((additive: string) => additive.startsWith('en:'))
                            .map((additive: string, index: number) => {
                              const cleanAdditive = additive.replace(/^en:/, '');
                              return (
                                <View
                                  key={index}
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    backgroundColor: colors.cardElevated,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, color: colors.text }}>
                                    {cleanAdditive}
                                  </Text>
                                </View>
                              );
                            })}
                        </View>
                      </View>
                    )}

                    {/* Allergens */}
                    {selectedProduct.allergens_tags && selectedProduct.allergens_tags.length > 0 && (
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                          Alérgenos
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {selectedProduct.allergens_tags
                            .filter((allergen: string) => allergen.startsWith('en:'))
                            .map((allergen: string, index: number) => {
                              const cleanAllergen = allergen.replace(/^en:/, '');
                              return (
                                <View
                                  key={index}
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    backgroundColor: '#FFE5E5',
                                  }}
                                >
                                  <Text style={{ fontSize: 12, color: '#D32F2F' }}>
                                    {cleanAllergen}
                                  </Text>
                                </View>
                              );
                            })}
                        </View>
                      </View>
                    )}

                    {/* Nutrition Info */}
                    {selectedProduct.nutriments && (
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                          Información nutricional
                        </Text>
                        <View style={{ gap: 8 }}>
                          {selectedProduct.nutriments.energy_kcal ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 14, color: colors.text }}>Calorías</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                {selectedProduct.nutriments.energy_kcal} kcal
                              </Text>
                            </View>
                          ) : null}
                          {selectedProduct.nutriments.proteins ? (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 14, color: colors.text }}>Proteínas</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                {selectedProduct.nutriments.proteins} g
                              </Text>
                            </View>
                          ) : null}
                          {selectedProduct.nutriments.carbohydrates ? (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 14, color: colors.text }}>Carbohidratos</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                  {selectedProduct.nutriments.carbohydrates} g
                                </Text>
                              </View>
                              {selectedProduct.nutriments.sugars !== undefined && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16 }}>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>· Azúcares</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                                    {selectedProduct.nutriments.sugars} g
                                  </Text>
                                </View>
                              )}
                              {selectedProduct.nutriments.fiber !== undefined && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16 }}>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>· Fibra</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                                    {selectedProduct.nutriments.fiber} g
                                  </Text>
                                </View>
                              )}
                            </>
                          ) : null}
                          {selectedProduct.nutriments.fat ? (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 14, color: colors.text }}>Grasas</Text>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                  {selectedProduct.nutriments.fat} g
                                </Text>
                              </View>
                              {selectedProduct.nutriments['saturated-fat'] !== undefined && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16 }}>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>· Grasas saturadas</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                                    {selectedProduct.nutriments['saturated-fat']} g
                                  </Text>
                                </View>
                              )}
                              {selectedProduct.nutriments['monounsaturated-fat'] !== undefined && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16 }}>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>· Grasas monoinsaturadas</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                                    {selectedProduct.nutriments['monounsaturated-fat']} g
                                  </Text>
                                </View>
                              )}
                              {selectedProduct.nutriments['polyunsaturated-fat'] !== undefined && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 16 }}>
                                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>· Grasas poliinsaturadas</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>
                                    {selectedProduct.nutriments['polyunsaturated-fat']} g
                                  </Text>
                                </View>
                              )}
                            </>
                          ) : null}
                          {selectedProduct.nutriments.salt !== undefined && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 14, color: colors.text }}>Sal</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                {selectedProduct.nutriments.salt} g
                              </Text>
                            </View>
                          )}
                          {selectedProduct.nutriments.sodium !== undefined && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 14, color: colors.text }}>Sodio</Text>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                                {selectedProduct.nutriments.sodium} g
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Additional Info */}
                    <View style={{ gap: 8 }}>
                      {selectedProduct.quantity && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Cantidad</Text>
                          <Text style={{ fontSize: 14, color: colors.text }}>{selectedProduct.quantity}</Text>
                        </View>
                      )}
                      {selectedProduct.serving_size && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Tamaño porción</Text>
                          <Text style={{ fontSize: 14, color: colors.text }}>{selectedProduct.serving_size}</Text>
                        </View>
                      )}
                      {selectedProduct.stores && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Tiendas</Text>
                          <Text style={{ fontSize: 14, color: colors.text }}>{selectedProduct.stores}</Text>
                        </View>
                      )}
                      {selectedProduct.countries && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Países</Text>
                          <Text style={{ fontSize: 14, color: colors.text }}>{selectedProduct.countries}</Text>
                        </View>
                      )}
                      {selectedProduct.packaging && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 14, color: colors.textSecondary }}>Envase</Text>
                          <Text style={{ fontSize: 14, color: colors.text }}>{selectedProduct.packaging}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

