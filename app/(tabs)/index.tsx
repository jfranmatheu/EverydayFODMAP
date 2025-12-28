import { Card } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase, insertRow } from '@/lib/database';
import {
  BMI_CATEGORIES,
  calculateAge,
  calculateBMI,
  Gender,
  GENDER_LABELS,
  getBMICategory,
  UserProfile,
  WeightLog,
} from '@/lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

const CONTAINER_PADDING = 16;

// Activity color constant
const ACTIVITY_COLOR = '#FF9800';

interface RecentActivity {
  id: number;
  type: 'meal' | 'water' | 'symptom' | 'bowel' | 'treatment' | 'activity';
  title: string;
  time: string;
  date: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const { isReady } = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [greeting, setGreeting] = useState('');
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddWeightModal, setShowAddWeightModal] = useState(false);
  
  // Stats
  const [activeTreatments, setActiveTreatments] = useState(0);
  const [scheduledActivities, setScheduledActivities] = useState(0);
  
  // Edit profile form
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<Gender | null>(null);
  const [editHeight, setEditHeight] = useState('');
  
  // Add weight form
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 19) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  useEffect(() => {
    if (isReady) {
      loadData();
    }
  }, [isReady]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) {
        loadData();
      }
    }, [isReady])
  );

  const loadData = async () => {
    await Promise.all([
      loadProfile(), 
      loadLatestWeight(), 
      loadRecentActivity(),
      loadStats()
    ]);
  };

  const loadProfile = async () => {
    try {
      const db = await getDatabase();
      const profileData = await db.getFirstAsync(
        'SELECT * FROM user_profile WHERE id = 1'
      ) as UserProfile | null;
      
      console.log('[Home] Loaded profile:', profileData);
      setProfile(profileData);
      
      if (profileData) {
        setEditBirthDate(profileData.birth_date || '');
        setEditGender(profileData.gender as Gender | null);
        setEditHeight(profileData.height_cm?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadLatestWeight = async () => {
    try {
      const db = await getDatabase();
      const weightData = await db.getFirstAsync(
        'SELECT * FROM weight_logs ORDER BY date DESC, time DESC LIMIT 1'
      ) as WeightLog | null;
      
      console.log('[Home] Loaded weight:', weightData);
      setLatestWeight(weightData);
    } catch (error) {
      console.error('Error loading weight:', error);
    }
  };

  const loadStats = async () => {
    try {
      const db = await getDatabase();
      
      // Count active treatments
      const treatmentsResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM treatments WHERE is_active = 1'
      ) as { count: number } | null;
      setActiveTreatments(treatmentsResult?.count || 0);
      
      // Count scheduled activities
      const activitiesResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM scheduled_activities WHERE is_active = 1'
      ) as { count: number } | null;
      setScheduledActivities(activitiesResult?.count || 0);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const activities: RecentActivity[] = [];

      // Get recent meals
      const meals = await db.getAllAsync(
        'SELECT id, name, time, date FROM meals WHERE date = ? ORDER BY time DESC LIMIT 3',
        [today]
      ) as any[];
      meals.forEach(m => activities.push({
        id: m.id,
        type: 'meal',
        title: m.name || 'Comida',
        time: m.time,
        date: m.date,
        color: colors.primary,
        icon: 'restaurant',
      }));

      // Get recent water
      const water = await db.getAllAsync(
        'SELECT id, glasses, time, date FROM water_intake WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
      water.forEach(w => activities.push({
        id: w.id,
        type: 'water',
        title: `${w.glasses} vaso${w.glasses > 1 ? 's' : ''} de agua`,
        time: w.time,
        date: w.date,
        color: colors.water,
        icon: 'water',
      }));

      // Get recent symptoms
      const symptoms = await db.getAllAsync(
        'SELECT id, type, intensity, time, date FROM symptoms WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
      symptoms.forEach(s => activities.push({
        id: s.id,
        type: 'symptom',
        title: `${s.type} (${s.intensity}/10)`,
        time: s.time,
        date: s.date,
        color: colors.symptom,
        icon: 'pulse',
      }));

      // Get recent activity logs
      const activityLogs = await db.getAllAsync(
        `SELECT al.id, at.name, al.time, al.date, al.duration_minutes 
         FROM activity_logs al
         LEFT JOIN activity_types at ON al.activity_type_id = at.id
         WHERE al.date = ? ORDER BY al.time DESC LIMIT 2`,
        [today]
      ) as any[];
      activityLogs.forEach(a => activities.push({
        id: a.id,
        type: 'activity',
        title: `${a.name || 'Actividad'} (${a.duration_minutes} min)`,
        time: a.time,
        date: a.date,
        color: ACTIVITY_COLOR,
        icon: 'fitness',
      }));

      // Get recent treatments
      const treatments = await db.getAllAsync(
        'SELECT id, treatment_name, time, date FROM treatment_logs WHERE date = ? ORDER BY time DESC LIMIT 2',
        [today]
      ) as any[];
      treatments.forEach(t => activities.push({
        id: t.id,
        type: 'treatment',
        title: t.treatment_name || 'Tratamiento',
        time: t.time,
        date: t.date,
        color: colors.treatment,
        icon: 'medkit',
      }));

      // Sort by time descending and take top 6
      activities.sort((a, b) => b.time.localeCompare(a.time));
      setRecentActivity(activities.slice(0, 6));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const db = await getDatabase();
      
      // Validate date format
      if (editBirthDate && !/^\d{4}-\d{2}-\d{2}$/.test(editBirthDate)) {
        Alert.alert('Error', 'Formato de fecha incorrecto. Usa AAAA-MM-DD');
        setSaving(false);
        return;
      }
      
      const birthDate = editBirthDate || null;
      const gender = editGender || null;
      const heightCm = editHeight ? parseFloat(editHeight) : null;
      
      console.log('[Home] Saving profile:', { birthDate, gender, heightCm });
      
      // Always try to update first, then insert if no changes
      const updateResult = await db.runAsync(
        `UPDATE user_profile SET birth_date = ?, gender = ?, height_cm = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [birthDate, gender, heightCm]
      );
      
      console.log('[Home] Update result:', updateResult);
      
      // If no rows updated, insert
      if (!profile) {
        await db.runAsync(
          `INSERT INTO user_profile (id, birth_date, gender, height_cm) VALUES (1, ?, ?, ?)`,
          [birthDate, gender, heightCm]
        );
        console.log('[Home] Inserted new profile');
      }
      
      await loadProfile();
      setShowEditProfileModal(false);
      Alert.alert('¡Guardado!', 'Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'No se pudo guardar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleAddWeight = async () => {
    const weightValue = parseFloat(newWeight);
    if (!newWeight || isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      Alert.alert('Error', 'Por favor, introduce un peso válido (1-500 kg)');
      return;
    }
    
    setSaving(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      await insertRow('weight_logs', {
        weight_kg: weightValue,
        date: dateStr,
        time: timeStr,
      });
      
      await loadLatestWeight();
      setShowAddWeightModal(false);
      setNewWeight('');
      Alert.alert('¡Guardado!', `Peso de ${weightValue.toFixed(1)} kg registrado`);
    } catch (error) {
      console.error('Error saving weight:', error);
      Alert.alert('Error', 'No se pudo guardar el peso');
    } finally {
      setSaving(false);
    }
  };

  // Calculate BMI if we have weight and height
  const bmi = latestWeight && profile?.height_cm 
    ? calculateBMI(latestWeight.weight_kg, profile.height_cm)
    : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;
  const bmiInfo = bmiCategory ? BMI_CATEGORIES[bmiCategory] : null;
  
  // Calculate age if we have birth date
  const age = profile?.birth_date ? calculateAge(profile.birth_date) : null;

  const hasProfileData = profile?.birth_date || profile?.gender || profile?.height_cm || latestWeight;

  // Quick action card component
  const QuickActionCard = ({ 
    icon, 
    title, 
    subtitle, 
    color, 
    count,
    onPress 
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    title: string; 
    subtitle: string;
    color: string;
    count?: number;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: color + '20',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        {count !== undefined && count > 0 && (
          <View style={{
            backgroundColor: color,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 10,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>{count}</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
        {subtitle}
      </Text>
      <Ionicons 
        name="chevron-forward" 
        size={16} 
        color={colors.textMuted} 
        style={{ position: 'absolute', right: 12, top: '50%', marginTop: -8 }}
      />
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: CONTAINER_PADDING, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header with Settings Button */}
        <Animated.View 
          entering={FadeInDown.delay(100).springify()}
          style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: 20,
          }}
        >
          <View>
            <Text style={{ 
              fontSize: 28, 
              fontWeight: '700', 
              color: colors.text,
              marginBottom: 4,
            }}>
              {greeting} 👋
            </Text>
            <Text style={{ 
              fontSize: 15, 
              color: colors.textSecondary,
            }}>
              ¿Cómo te sientes hoy?
            </Text>
          </View>
          
          <Pressable
            onPress={() => router.push('/settings')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </Animated.View>

        {/* User Profile Card */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={{ 
            padding: 0, 
            overflow: 'hidden',
            marginBottom: 16,
          }}>
            {/* Profile Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
                    Mi Perfil
                  </Text>
                  {profile?.gender && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons 
                        name={profile.gender === 'male' ? 'male' : profile.gender === 'female' ? 'female' : 'male-female'} 
                        size={12} 
                        color={colors.textMuted} 
                      />
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        {GENDER_LABELS[profile.gender]}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <Pressable
                onPress={() => setShowEditProfileModal(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: colors.cardElevated,
                }}
              >
                <Ionicons name="pencil" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>Editar</Text>
              </Pressable>
            </View>

            {/* Profile Content */}
            {hasProfileData ? (
              <View style={{ padding: 16 }}>
                {/* Stats Row */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-around',
                  marginBottom: 16,
                }}>
                  {/* Age */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                      EDAD
                    </Text>
                    <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                      {age ?? '—'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      años
                    </Text>
                  </View>
                  
                  {/* Height */}
                  <View style={{ 
                    alignItems: 'center', 
                    flex: 1,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: colors.border,
                  }}>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                      ALTURA
                    </Text>
                    <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                      {profile?.height_cm ?? '—'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      cm
                    </Text>
                  </View>
                  
                  {/* Weight */}
                  <Pressable 
                    onPress={() => setShowAddWeightModal(true)}
                    style={{ alignItems: 'center', flex: 1 }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4, letterSpacing: 0.5 }}>
                      PESO
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>
                        {latestWeight?.weight_kg.toFixed(1) ?? '—'}
                      </Text>
                      <Ionicons name="add-circle" size={18} color={colors.fodmapLow} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      kg
                    </Text>
                  </Pressable>
                </View>

                {/* BMI Card - ALWAYS SHOW IF POSSIBLE */}
                {bmi !== null && bmiInfo ? (
                  <Animated.View 
                    entering={FadeInUp.delay(200).springify()}
                    style={{
                      backgroundColor: bmiInfo.color + '12',
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 2,
                      borderColor: bmiInfo.color + '40',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: '500' }}>
                          Índice de Masa Corporal (IMC)
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                          <Text style={{ 
                            fontSize: 40, 
                            fontWeight: '800', 
                            color: bmiInfo.color,
                          }}>
                            {bmi.toFixed(1)}
                          </Text>
                          <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '500' }}>
                            kg/m²
                          </Text>
                        </View>
                      </View>
                      
                      <View style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 24,
                        backgroundColor: bmiInfo.color,
                      }}>
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: '700', 
                          color: '#FFFFFF',
                        }}>
                          {bmiInfo.label}
                        </Text>
                      </View>
                    </View>
                    
                    {/* BMI Scale Visualization */}
                    <View style={{ marginTop: 20 }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        height: 10, 
                        borderRadius: 5,
                        overflow: 'hidden',
                      }}>
                        <View style={{ flex: 1, backgroundColor: BMI_CATEGORIES.underweight.color }} />
                        <View style={{ flex: 1.5, backgroundColor: BMI_CATEGORIES.normal.color }} />
                        <View style={{ flex: 1, backgroundColor: BMI_CATEGORIES.overweight.color }} />
                        <View style={{ flex: 1.5, backgroundColor: BMI_CATEGORIES.obese.color }} />
                      </View>
                      {/* Indicator */}
                      <View style={{ 
                        position: 'absolute',
                        top: -2,
                        left: `${Math.min(Math.max((bmi - 15) / 25 * 100, 2), 98)}%`,
                        marginLeft: -8,
                      }}>
                        <View style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: '#FFFFFF',
                          borderWidth: 3,
                          borderColor: bmiInfo.color,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 3,
                          elevation: 4,
                        }} />
                      </View>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between',
                      marginTop: 8,
                      paddingHorizontal: 4,
                    }}>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>15</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>18.5</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>25</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>30</Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>40</Text>
                    </View>
                  </Animated.View>
                ) : (
                  // Prompt to add data for BMI
                  <View style={{
                    backgroundColor: colors.cardElevated,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="analytics-outline" size={24} color={colors.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                      {!profile?.height_cm && !latestWeight 
                        ? 'Añade tu altura y peso para calcular tu IMC'
                        : !profile?.height_cm 
                        ? 'Añade tu altura para calcular tu IMC'
                        : 'Añade tu peso para calcular tu IMC'}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* Empty State */
              <Pressable 
                onPress={() => setShowEditProfileModal(true)}
                style={{ padding: 32, alignItems: 'center' }}
              >
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary + '15',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="person-add" size={28} color={colors.primary} />
                </View>
                <Text style={{ 
                  fontSize: 15, 
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: 4,
                }}>
                  Configura tu perfil
                </Text>
                <Text style={{ 
                  fontSize: 13, 
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}>
                  Añade tu información para calcular tu IMC y seguir tu progreso
                </Text>
              </Pressable>
            )}
          </Card>
        </Animated.View>

        {/* Quick Actions - Activities & Treatments */}
        <Animated.View 
          entering={FadeInDown.delay(250).springify()}
          style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}
        >
          <QuickActionCard
            icon="fitness"
            title="Actividades"
            subtitle={scheduledActivities > 0 ? `${scheduledActivities} programada${scheduledActivities > 1 ? 's' : ''}` : 'Configura rutinas'}
            color={ACTIVITY_COLOR}
            count={scheduledActivities}
            onPress={() => router.push('/activity/')}
          />
          <QuickActionCard
            icon="medkit"
            title="Tratamientos"
            subtitle={activeTreatments > 0 ? `${activeTreatments} activo${activeTreatments > 1 ? 's' : ''}` : 'Gestiona medicación'}
            color={colors.treatment}
            count={activeTreatments}
            onPress={() => router.push('/treatment/')}
          />
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '600', 
            color: colors.text,
            marginBottom: 12,
          }}>
            Actividad de hoy
          </Text>
          
          {recentActivity.length > 0 ? (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {recentActivity.map((activity, index) => (
                <View 
                  key={`${activity.type}-${activity.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    borderBottomWidth: index < recentActivity.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: activity.color + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name={activity.icon} size={18} color={activity.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '500', 
                      color: colors.text,
                      marginBottom: 2,
                    }}>
                      {activity.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      {activity.time}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Ionicons 
                  name="leaf-outline" 
                  size={40} 
                  color={colors.textMuted} 
                  style={{ marginBottom: 10 }}
                />
                <Text style={{ 
                  fontSize: 14, 
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}>
                  Aún no hay registros de hoy{'\n'}¡Ve al Diario para añadir algo!
                </Text>
              </View>
            </Card>
          )}
        </Animated.View>

        {/* Tip Card */}
        <Animated.View entering={FadeInDown.delay(450).springify()} style={{ marginTop: 20 }}>
          <Card style={{ backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="bulb" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  fontSize: 13, 
                  fontWeight: '600', 
                  color: colors.primary,
                  marginBottom: 3,
                }}>
                  Consejo
                </Text>
                <Text style={{ 
                  fontSize: 12, 
                  color: colors.textSecondary,
                  lineHeight: 18,
                }}>
                  Registra tus comidas y síntomas regularmente para identificar qué alimentos pueden estar causando molestias.
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '85%',
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
                Editar Perfil
              </Text>
              <Pressable onPress={() => setShowEditProfileModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 20, paddingBottom: 32 }}>
                {/* Birth Date */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Fecha de nacimiento
                  </Text>
                  <TextInput
                    value={editBirthDate}
                    onChangeText={setEditBirthDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      fontSize: 16,
                      color: colors.text,
                      padding: 14,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                    }}
                  />
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                    Ejemplo: 1990-05-15
                  </Text>
                </View>

                {/* Gender */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Sexo
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['male', 'female', 'other'] as Gender[]).map((gender) => (
                      <Pressable
                        key={gender}
                        onPress={() => setEditGender(gender)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 14,
                          borderRadius: 12,
                          backgroundColor: editGender === gender ? colors.primary : colors.cardElevated,
                          borderWidth: 2,
                          borderColor: editGender === gender ? colors.primary : 'transparent',
                        }}
                      >
                        <Ionicons 
                          name={gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'male-female'} 
                          size={18} 
                          color={editGender === gender ? '#FFFFFF' : colors.textSecondary} 
                        />
                        <Text style={{
                          fontSize: 13,
                          fontWeight: '600',
                          color: editGender === gender ? '#FFFFFF' : colors.textSecondary,
                        }}>
                          {GENDER_LABELS[gender]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Height */}
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Altura (cm)
                  </Text>
                  <TextInput
                    value={editHeight}
                    onChangeText={setEditHeight}
                    placeholder="170"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.text,
                      padding: 16,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                </View>

                {/* Save Button */}
                <Pressable
                  onPress={handleSaveProfile}
                  disabled={saving}
                  style={{
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                    {saving ? 'Guardando...' : 'Guardar Perfil'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Weight Modal - Improved */}
      <Modal
        visible={showAddWeightModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddWeightModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: colors.card, 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
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
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Registrar Peso
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <Pressable onPress={() => setShowAddWeightModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={{ padding: 20 }}>
              {/* Weight Display */}
              <View style={{
                backgroundColor: colors.cardElevated,
                borderRadius: 20,
                padding: 24,
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8, letterSpacing: 1 }}>
                  PESO ACTUAL
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <TextInput
                    value={newWeight}
                    onChangeText={setNewWeight}
                    placeholder="0.0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={{
                      fontSize: 56,
                      fontWeight: '800',
                      color: colors.fodmapLow,
                      textAlign: 'center',
                      minWidth: 150,
                    }}
                  />
                  <Text style={{ fontSize: 24, fontWeight: '600', color: colors.textSecondary, marginLeft: 4 }}>
                    kg
                  </Text>
                </View>
                
                {/* Previous weight comparison */}
                {latestWeight && (
                  <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginTop: 12,
                    backgroundColor: colors.background,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                  }}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Último: {latestWeight.weight_kg.toFixed(1)} kg
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Weight Buttons */}
              {latestWeight && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                    <Pressable
                      key={delta}
                      onPress={() => {
                        const base = newWeight ? parseFloat(newWeight) : latestWeight.weight_kg;
                        if (!isNaN(base)) {
                          setNewWeight((base + delta).toFixed(1));
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        backgroundColor: delta > 0 ? colors.fodmapHigh + '15' : colors.fodmapLow + '15',
                        borderRadius: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ 
                        fontSize: 14, 
                        fontWeight: '600', 
                        color: delta > 0 ? colors.fodmapHigh : colors.fodmapLow 
                      }}>
                        {delta > 0 ? '+' : ''}{delta}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Save Button */}
              <Pressable
                onPress={handleAddWeight}
                disabled={saving || !newWeight}
                style={{
                  backgroundColor: colors.fodmapLow,
                  paddingVertical: 18,
                  borderRadius: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                  opacity: saving || !newWeight ? 0.6 : 1,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                  {saving ? 'Guardando...' : 'Guardar Peso'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
