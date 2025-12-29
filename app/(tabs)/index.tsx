import { Card, DailyNutritionCard, ProfileCard, TodayActivitiesCard, TodayTreatmentsCard } from '@/components/ui';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase, insertRow } from '@/lib/database';
import {
  BMI_CATEGORIES,
  calculateAge,
  calculateBMI,
  calculateDailyCalories,
  Gender,
  GENDER_LABELS,
  getBMICategory,
  NutritionInfo,
  UserProfile,
  WeightLog
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
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown
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
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Tablet/Desktop threshold
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightLog[]>([]);
  
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddWeightModal, setShowAddWeightModal] = useState(false);
  const [showNutritionTargetsModal, setShowNutritionTargetsModal] = useState(false);
  
  // Stats
  const [activeTreatments, setActiveTreatments] = useState(0);
  const [scheduledActivities, setScheduledActivities] = useState(0);
  
  // Today's treatments and activities
  const [todayTreatments, setTodayTreatments] = useState<any[]>([]);
  const [todayActivities, setTodayActivities] = useState<any[]>([]);
  
  // Daily nutrition consumed
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayMacros, setTodayMacros] = useState({ protein: 0, carbs: 0, fat: 0 });
  const [todayWater, setTodayWater] = useState(0); // in liters
  
  // Edit profile form
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editGender, setEditGender] = useState<Gender | null>(null);
  const [editHeight, setEditHeight] = useState('');
  
  // Target nutrition form
  const [editTargetCalories, setEditTargetCalories] = useState('');
  const [editTargetProtein, setEditTargetProtein] = useState('');
  const [editTargetCarbs, setEditTargetCarbs] = useState('');
  const [editTargetFat, setEditTargetFat] = useState('');
  const [editTargetWater, setEditTargetWater] = useState('');
  
  // Add weight form
  const [newWeight, setNewWeight] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Weight chart period
  const [weightPeriod, setWeightPeriod] = useState<'all' | '2y' | '1y' | '6m' | '3m' | '1m'>('all');

  // Greeting removed - moved to header

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
      loadStats(),
      loadTodayNutrition(),
      loadTodayTreatmentsAndActivities()
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
        setEditTargetCalories(profileData.target_calories?.toString() || '');
        setEditTargetProtein(profileData.target_protein_pct?.toString() || '');
        setEditTargetCarbs(profileData.target_carbs_pct?.toString() || '');
        setEditTargetFat(profileData.target_fat_pct?.toString() || '');
        setEditTargetWater((profileData.target_water_l || 2.5).toString());
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
      
      // Load weight history (last 30 entries for timeline)
      const historyData = await db.getAllAsync(
        'SELECT * FROM weight_logs ORDER BY date DESC, time DESC LIMIT 30'
      ) as WeightLog[];
      
      // Reverse to show oldest first for chart
      setWeightHistory(historyData.reverse());
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

  const loadTodayNutrition = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      
      // Get all meal items for today
      const items = await db.getAllAsync(
        `SELECT mi.quantity, f.nutrition as food_nutrition, r.nutrition as recipe_nutrition
         FROM meal_items mi
         JOIN meals m ON mi.meal_id = m.id
         LEFT JOIN foods f ON mi.food_id = f.id
         LEFT JOIN recipes r ON mi.recipe_id = r.id
         WHERE m.date = ?`,
        [today]
      ) as any[];
      
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      
      for (const item of items) {
        const nutritionStr = item.food_nutrition || item.recipe_nutrition;
        if (nutritionStr) {
          try {
            const nutrition: NutritionInfo = typeof nutritionStr === 'string' 
              ? JSON.parse(nutritionStr) 
              : nutritionStr;
            const qty = item.quantity || 1;
            totalCalories += (nutrition.calories || 0) * qty;
            totalProtein += (nutrition.protein_g || 0) * qty;
            totalCarbs += (nutrition.carbs_g || 0) * qty;
            totalFat += (nutrition.fat_g || 0) * qty;
          } catch (e) {
            // Skip invalid nutrition data
          }
        }
      }
      
      setTodayCalories(Math.round(totalCalories));
      setTodayMacros({
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
      });
      
      // Load today's water intake
      const waterIntake = await db.getAllAsync(
        'SELECT * FROM water_intake WHERE date = ?',
        [today]
      ) as any[];
      
      const totalWaterMl = waterIntake.reduce((sum, w) => sum + (w.amount_ml || 0), 0);
      setTodayWater(totalWaterMl / 1000); // Convert to liters
    } catch (error) {
      console.error('Error loading today nutrition:', error);
    }
  };

  const loadTodayTreatmentsAndActivities = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const dayOfWeek = new Date().getDay(); // 0 = Sunday
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDayName = dayNames[dayOfWeek];

      console.log('[Home] Loading treatments and activities for:', today, todayDayName);

      // Get ALL active treatments first (simpler query for web compatibility)
      const allTreatments = await db.getAllAsync(
        `SELECT * FROM treatments WHERE is_active = 1`,
        []
      ) as any[];

      console.log('[Home] All active treatments:', allTreatments.length);

      // Filter treatments that are valid for today
      const todayTreatments = allTreatments.filter(t => {
        // Chronic treatments are always valid
        if (t.is_chronic === 1) return true;
        
        // Check date range
        const hasStartDate = t.start_date && t.start_date !== '';
        const hasEndDate = t.end_date && t.end_date !== '';
        
        if (!hasStartDate) return true; // No start date = always valid
        if (t.start_date > today) return false; // Haven't started yet
        if (hasEndDate && t.end_date < today) return false; // Already ended
        
        return true;
      });

      console.log('[Home] Treatments valid for today:', todayTreatments.length);

      // Process treatments to get today's doses
      const processedTreatments: any[] = [];

      for (const treatment of todayTreatments) {
        console.log(`[Home] Processing treatment: ${treatment.name}`);
        
        // Check if today is a valid day for this treatment
        let isValidDay = true;
        if (treatment.specific_days && treatment.specific_days !== '') {
          try {
            // specific_days can be a JSON array or comma-separated string
            let daysArray: string[] = [];
            if (treatment.specific_days.startsWith('[')) {
              daysArray = JSON.parse(treatment.specific_days);
            } else {
              daysArray = treatment.specific_days.split(',').map((s: string) => s.trim());
            }
            isValidDay = daysArray.includes(todayDayName);
            console.log(`[Home]   -> Specific days: ${daysArray}, today: ${todayDayName}, valid: ${isValidDay}`);
          } catch (e) {
            // If parsing fails, assume it's valid
            console.log(`[Home]   -> Parse error for specific_days, assuming valid`);
            isValidDay = true;
          }
        } else {
          console.log(`[Home]   -> No specific_days restriction, valid for all days`);
        }

        if (!isValidDay) {
          console.log(`[Home]   -> Skipping, not valid for today`);
          continue;
        }

        // Parse doses from JSON
        let treatmentDoses: any[] = [];
        try {
          treatmentDoses = treatment.doses ? JSON.parse(treatment.doses) : [];
          console.log(`[Home]   -> Parsed doses from JSON:`, treatmentDoses);
        } catch (e) {
          console.log(`[Home]   -> Could not parse doses, using empty array`);
          treatmentDoses = [];
        }

        // Generate doses based on frequency if no specific doses
        if (treatmentDoses.length === 0) {
          const frequency = treatment.frequency || 'once_daily';
          treatmentDoses = generateDosesForFrequency(frequency, treatment.frequency_value);
          console.log(`[Home]   -> Generated doses from frequency "${frequency}":`, treatmentDoses);
        }

        // Get taken logs for today
        const takenLogs = await db.getAllAsync(
          'SELECT * FROM treatment_logs WHERE treatment_id = ? AND date = ?',
          [treatment.id, today]
        ) as any[];
        
        console.log(`[Home] Treatment ${treatment.name}: ${takenLogs.length} logs for today`);

        const takenMap = new Map();
        takenLogs.forEach(log => {
          if (log.scheduled_time) {
            takenMap.set(log.scheduled_time, log.taken === 1);
          } else if (log.dose_index !== undefined) {
            takenMap.set(log.dose_index.toString(), log.taken === 1);
          }
        });

        // Create dose entries for today
        treatmentDoses.forEach((dose, index) => {
          const doseTime = typeof dose === 'string' ? dose : dose.time;
          const isTaken = takenMap.get(doseTime) || takenMap.get(index.toString()) || false;

          processedTreatments.push({
            ...treatment,
            dose_time: doseTime,
            dose_index: index,
            dose_amount: typeof dose === 'object' ? dose.amount : treatment.dosage_amount,
            dose_unit: typeof dose === 'object' ? dose.unit : treatment.dosage_unit,
            is_taken: isTaken,
            dose_notes: typeof dose === 'object' ? dose.notes : null,
          });
        });
      }

      setTodayTreatments(processedTreatments);

      console.log('[Home] Processed treatments:', processedTreatments.length);

      // Get ALL scheduled activities (simpler query for web compatibility)
      const rawActivities = await db.getAllAsync(
        `SELECT * FROM scheduled_activities WHERE is_active = 1`,
        []
      ) as any[];

      console.log('[Home] All active scheduled activities:', rawActivities.length);

      // Get activity types for enrichment
      const activityTypes = await db.getAllAsync(
        `SELECT * FROM activity_types`,
        []
      ) as any[];

      // Filter activities valid for today and enrich with type info
      const allActivities = rawActivities.filter(sa => {
        // Check date range
        const hasStartDate = sa.start_date && sa.start_date !== '';
        const hasEndDate = sa.end_date && sa.end_date !== '';
        
        if (!hasStartDate) return true;
        if (sa.start_date > today) return false;
        if (hasEndDate && sa.end_date < today) return false;
        
        return true;
      }).map(sa => {
        // Enrich with activity type info
        const activityType = activityTypes.find((at: any) => at.id === sa.activity_type_id);
        return {
          ...sa,
          activity_name: activityType?.name || sa.name,
          icon: activityType?.icon || 'fitness',
          color: activityType?.color || '#FF9800',
        };
      });

      console.log('[Home] Activities valid for today:', allActivities.length);

      // Filter activities based on frequency
      const filteredActivities: any[] = [];

      for (const activity of allActivities) {
        let shouldInclude = false;

        console.log(`[Home] Checking activity "${activity.name}", frequency: ${activity.frequency_type}, value: ${activity.frequency_value}`);

        switch (activity.frequency_type) {
          case 'daily':
            shouldInclude = true;
            console.log(`[Home]   -> Daily: included`);
            break;

          case 'weekly':
            try {
              const frequencyValue = activity.frequency_value 
                ? (typeof activity.frequency_value === 'string' && activity.frequency_value.startsWith('[') 
                    ? JSON.parse(activity.frequency_value) 
                    : [activity.frequency_value])
                : [];
              shouldInclude = frequencyValue.includes(todayDayName);
              console.log(`[Home]   -> Weekly: ${frequencyValue} includes ${todayDayName}? ${shouldInclude}`);
            } catch (e) {
              console.log(`[Home]   -> Weekly: parse error`, e);
              shouldInclude = false;
            }
            break;

          case 'specific_days':
            try {
              const frequencyValue = activity.frequency_value 
                ? (typeof activity.frequency_value === 'string' && activity.frequency_value.startsWith('[') 
                    ? JSON.parse(activity.frequency_value) 
                    : activity.frequency_value.split(',').map((s: string) => s.trim()))
                : [];
              shouldInclude = frequencyValue.includes(todayDayName);
              console.log(`[Home]   -> Specific days: ${frequencyValue} includes ${todayDayName}? ${shouldInclude}`);
            } catch (e) {
              console.log(`[Home]   -> Specific days: parse error`, e);
              shouldInclude = false;
            }
            break;

          case 'interval':
            try {
              const intervalDays = parseInt(activity.frequency_value) || 1;
              const startDate = new Date(activity.start_date + 'T12:00:00');
              const todayDate = new Date(today + 'T12:00:00');
              const diffTime = Math.abs(todayDate.getTime() - startDate.getTime());
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              shouldInclude = diffDays % intervalDays === 0;
              console.log(`[Home]   -> Interval: every ${intervalDays} days, diff=${diffDays}, included? ${shouldInclude}`);
            } catch (e) {
              console.log(`[Home]   -> Interval: error`, e);
              shouldInclude = false;
            }
            break;

          case 'monthly':
            try {
              const dayOfMonth = parseInt(activity.frequency_value) || 1;
              const todayDate = new Date(today + 'T12:00:00');
              shouldInclude = todayDate.getDate() === dayOfMonth;
              console.log(`[Home]   -> Monthly: day ${dayOfMonth}, today is ${todayDate.getDate()}, included? ${shouldInclude}`);
            } catch (e) {
              console.log(`[Home]   -> Monthly: error`, e);
              shouldInclude = false;
            }
            break;

          default:
            // If no frequency_type, include it (legacy data)
            shouldInclude = true;
            console.log(`[Home]   -> Unknown frequency type, including by default`);
        }

        if (shouldInclude) {
          // Check if already completed today
          const activityLogs = await db.getAllAsync(
            'SELECT * FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
            [activity.id, today]
          ) as any[];

          filteredActivities.push({
            ...activity,
            completed_count: activityLogs.length,
          });
        }
      }

      console.log('[Home] Filtered activities for today:', filteredActivities.length);
      setTodayActivities(filteredActivities);
    } catch (error) {
      console.error('Error loading today treatments and activities:', error);
    }
  };

  // Helper function to generate doses based on frequency
  const generateDosesForFrequency = (frequency: string, frequencyValue?: string): any[] => {
    switch (frequency) {
      case 'once_daily':
        return ['08:00'];
      case 'twice_daily':
        return ['08:00', '20:00'];
      case 'three_times_daily':
        return ['08:00', '14:00', '20:00'];
      case 'four_times_daily':
        return ['08:00', '12:00', '16:00', '20:00'];
      case 'every_4_hours':
        return ['06:00', '10:00', '14:00', '18:00', '22:00'];
      case 'every_6_hours':
        return ['06:00', '12:00', '18:00', '00:00'];
      case 'every_8_hours':
        return ['06:00', '14:00', '22:00'];
      case 'every_12_hours':
        return ['08:00', '20:00'];
      case 'as_needed':
        return ['sin horario'];
      default:
        return ['08:00'];
    }
  };

  const handleMarkDose = async (treatment: any, taken: boolean) => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Check if already logged for this specific dose
      const existing = await db.getFirstAsync(
        'SELECT id FROM treatment_logs WHERE treatment_id = ? AND date = ? AND scheduled_time = ?',
        [treatment.id, today, treatment.dose_time]
      ) as any;

      if (existing) {
        // Update existing log
        await db.runAsync(
          'UPDATE treatment_logs SET taken = ?, time = ?, amount_taken = ?, unit = ? WHERE id = ?',
          [taken ? 1 : 0, timeStr, treatment.dose_amount, treatment.dose_unit, existing.id]
        );
      } else {
        // Create new log entry
        await db.runAsync(
          'INSERT INTO treatment_logs (treatment_id, treatment_name, scheduled_time, dose_index, date, time, taken, skipped, amount_taken, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            treatment.id,
            treatment.name,
            treatment.dose_time,
            treatment.dose_index,
            today,
            timeStr,
            taken ? 1 : 0,
            taken ? 0 : 1,
            treatment.dose_amount,
            treatment.dose_unit
          ]
        );
      }

      await loadTodayTreatmentsAndActivities();
    } catch (error) {
      console.error('Error marking dose:', error);
      Alert.alert('Error', 'No se pudo registrar la dosis');
    }
  };

  const handleMarkActivity = async (activity: any, completed: boolean) => {
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (completed) {
        // Check if already logged today
        const existing = await db.getFirstAsync(
          'SELECT id FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
          [activity.id, today]
        ) as any;

        if (!existing) {
          // Log the activity
          await db.runAsync(
            'INSERT INTO activity_logs (activity_type_id, duration_minutes, intensity, date, time, scheduled_activity_id) VALUES (?, ?, ?, ?, ?, ?)',
            [activity.activity_type_id, activity.duration_minutes || 30, 5, today, timeStr, activity.id]
          );
        }
      } else {
        // Remove the log
        await db.runAsync(
          'DELETE FROM activity_logs WHERE scheduled_activity_id = ? AND date = ?',
          [activity.id, today]
        );
      }

      await loadTodayTreatmentsAndActivities();
      await loadRecentActivity();
    } catch (error) {
      console.error('Error marking activity:', error);
      Alert.alert('Error', 'No se pudo registrar la actividad');
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
      const targetCalories = editTargetCalories ? parseInt(editTargetCalories) : null;
      const targetProtein = editTargetProtein ? parseInt(editTargetProtein) : null;
      const targetCarbs = editTargetCarbs ? parseInt(editTargetCarbs) : null;
      const targetFat = editTargetFat ? parseInt(editTargetFat) : null;
      
      console.log('[Home] Saving profile:', { birthDate, gender, heightCm, targetCalories });
      
      // Always try to update first, then insert if no changes
      const updateResult = await db.runAsync(
        `UPDATE user_profile SET birth_date = ?, gender = ?, height_cm = ?, target_calories = ?, target_protein_pct = ?, target_carbs_pct = ?, target_fat_pct = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
        [birthDate, gender, heightCm, targetCalories, targetProtein, targetCarbs, targetFat]
      );
      
      console.log('[Home] Update result:', updateResult);
      
      // If no rows updated, insert
      if (!profile) {
        await db.runAsync(
          `INSERT INTO user_profile (id, birth_date, gender, height_cm, target_calories, target_protein_pct, target_carbs_pct, target_fat_pct) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
          [birthDate, gender, heightCm, targetCalories, targetProtein, targetCarbs, targetFat]
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

        {/* Profile and Nutrition Row (Large Screens) */}
        {isLargeScreen ? (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
            <View style={{ flex: 1, display: 'flex' }}>
              {/* User Profile Card */}
              <Animated.View entering={FadeInDown.delay(150).springify()} style={{ flex: 1 }}>
                <ProfileCard
                  profile={profile}
                  latestWeight={latestWeight}
                  weightHistory={weightHistory}
                  weightPeriod={weightPeriod}
                  onWeightPeriodChange={setWeightPeriod}
                  onEditProfile={() => setShowEditProfileModal(true)}
                  onAddWeight={() => setShowAddWeightModal(true)}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </View>
            <View style={{ flex: 1, display: 'flex' }}>
              {/* Daily Nutrition Summary - Gamified */}
              <Animated.View entering={FadeInDown.delay(200).springify()} style={{ flex: 1 }}>
                <DailyNutritionCard
                  consumed={{
                    calories: todayCalories,
                    protein: todayMacros.protein,
                    carbs: todayMacros.carbs,
                    fat: todayMacros.fat,
                  }}
                  targets={{
                    calories: profile?.target_calories || 2000,
                    protein_pct: profile?.target_protein_pct || 20,
                    carbs_pct: profile?.target_carbs_pct || 50,
                    fat_pct: profile?.target_fat_pct || 30,
                  }}
                  water={todayWater}
                  waterTarget={profile?.target_water_l || 2.5}
                  onEditTargets={() => setShowNutritionTargetsModal(true)}
                  onWaterAdded={loadTodayNutrition}
                />
              </Animated.View>
            </View>
          </View>
        ) : (
          <>
            {/* User Profile Card */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <ProfileCard
                profile={profile}
                latestWeight={latestWeight}
                weightHistory={weightHistory}
                weightPeriod={weightPeriod}
                onWeightPeriodChange={setWeightPeriod}
                onEditProfile={() => setShowEditProfileModal(true)}
                onAddWeight={() => setShowAddWeightModal(true)}
                style={{ marginBottom: 16 }}
              />
            </Animated.View>

            {/* Daily Nutrition Summary - Gamified */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <DailyNutritionCard
                consumed={{
                  calories: todayCalories,
                  protein: todayMacros.protein,
                  carbs: todayMacros.carbs,
                  fat: todayMacros.fat,
                }}
                targets={{
                  calories: profile?.target_calories || 2000,
                  protein_pct: profile?.target_protein_pct || 20,
                  carbs_pct: profile?.target_carbs_pct || 50,
                  fat_pct: profile?.target_fat_pct || 30,
                }}
                water={todayWater}
                waterTarget={profile?.target_water_l || 2.5}
                onEditTargets={() => setShowNutritionTargetsModal(true)}
                onWaterAdded={loadTodayNutrition}
              />
            </Animated.View>
          </>
        )}

        {/* Treatments and Activities Row (Large Screens) */}
        {isLargeScreen ? (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              {/* Today's Treatments - Enhanced Gamified Card */}
              <Animated.View entering={FadeInDown.delay(250).springify()}>
                <TodayTreatmentsCard
                  treatments={todayTreatments}
                  onMarkDose={handleMarkDose}
                  onNavigate={() => router.push('/treatment' as any)}
                />
              </Animated.View>
            </View>
            <View style={{ flex: 1 }}>
              {/* Today's Activities - Enhanced Gamified Card */}
              <Animated.View entering={FadeInDown.delay(300).springify()}>
                <TodayActivitiesCard
                  activities={todayActivities}
                  onMarkComplete={handleMarkActivity}
                  onNavigate={() => router.push('/activity' as any)}
                />
              </Animated.View>
            </View>
          </View>
        ) : (
          <>
            {/* Today's Treatments - Enhanced Gamified Card */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <TodayTreatmentsCard
                treatments={todayTreatments}
                onMarkDose={handleMarkDose}
                onNavigate={() => router.push('/treatment' as any)}
              />
            </Animated.View>

            {/* Today's Activities - Enhanced Gamified Card */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <TodayActivitiesCard
                activities={todayActivities}
                onMarkComplete={handleMarkActivity}
                onNavigate={() => router.push('/activity' as any)}
              />
            </Animated.View>
          </>
        )}

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

      {/* Nutrition Targets Modal */}
      <Modal
        visible={showNutritionTargetsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNutritionTargetsModal(false)}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: colors.primary + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="flag" size={20} color={colors.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                  Objetivos Nutricionales
                </Text>
              </View>
              <Pressable onPress={() => setShowNutritionTargetsModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ padding: 16 }}>
              {/* Auto-calculate Button */}
              {profile?.height_cm && latestWeight && profile?.birth_date && profile?.gender && (
                <Pressable
                  onPress={() => {
                    const age = calculateAge(profile.birth_date!);
                    if (age) {
                      const recommended = calculateDailyCalories(
                        latestWeight.weight_kg,
                        profile.height_cm!,
                        age,
                        profile.gender!,
                        'moderate'
                      );
                      setEditTargetCalories(Math.round(recommended).toString());
                      Alert.alert(
                        'Calorías Calculadas',
                        `Basado en tu perfil (${latestWeight.weight_kg}kg, ${profile.height_cm}cm, ${age} años), tu ingesta diaria recomendada es de ${Math.round(recommended)} kcal para un nivel de actividad moderado.`,
                        [{ text: 'OK' }]
                      );
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: colors.primary + '15',
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: colors.primary + '30',
                  }}
                >
                  <Ionicons name="calculator" size={20} color={colors.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                    Calcular calorías recomendadas
                  </Text>
                </Pressable>
              )}
              
              {/* Calories Target */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                  Calorías diarias objetivo
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={editTargetCalories}
                    onChangeText={setEditTargetCalories}
                    placeholder="2000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.text,
                      padding: 14,
                      backgroundColor: colors.cardElevated,
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>kcal</Text>
                </View>
              </View>
              
              {/* Macros Percentages */}
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                Distribución de macronutrientes (%)
              </Text>
              
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#E91E63' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="fish" size={20} color="#E91E63" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Proteína
                    </Text>
                    <TextInput
                      value={editTargetProtein}
                      onChangeText={setEditTargetProtein}
                      placeholder="20"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#E91E63',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
                
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#FF9800' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="leaf" size={20} color="#FF9800" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Carbos
                    </Text>
                    <TextInput
                      value={editTargetCarbs}
                      onChangeText={setEditTargetCarbs}
                      placeholder="50"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#FF9800',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
                
                <View style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#2196F3' + '15',
                    borderRadius: 12,
                    padding: 14,
                    alignItems: 'center',
                  }}>
                    <Ionicons name="water" size={20} color="#2196F3" />
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, marginBottom: 8 }}>
                      Grasas
                    </Text>
                    <TextInput
                      value={editTargetFat}
                      onChangeText={setEditTargetFat}
                      placeholder="30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: '#2196F3',
                        textAlign: 'center',
                        minWidth: 50,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>%</Text>
                  </View>
                </View>
              </View>
              
              {/* Total check */}
              {(() => {
                const total = (parseInt(editTargetProtein) || 0) + (parseInt(editTargetCarbs) || 0) + (parseInt(editTargetFat) || 0);
                const isValid = total === 100;
                return (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: 12,
                    backgroundColor: isValid ? colors.fodmapLow + '15' : colors.fodmapHigh + '15',
                    borderRadius: 10,
                    marginBottom: 20,
                  }}>
                    <Ionicons 
                      name={isValid ? 'checkmark-circle' : 'warning'} 
                      size={18} 
                      color={isValid ? colors.fodmapLow : colors.fodmapHigh} 
                    />
                    <Text style={{ 
                      fontSize: 13, 
                      color: isValid ? colors.fodmapLow : colors.fodmapHigh,
                      fontWeight: '600',
                    }}>
                      Total: {total}% {!isValid && '(debe sumar 100%)'}
                    </Text>
                  </View>
                );
              })()}

              {/* Water Target */}
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ionicons name="water" size={18} color={colors.water} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                    Agua diaria objetivo
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={editTargetWater}
                    onChangeText={setEditTargetWater}
                    placeholder="2.5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      fontSize: 24,
                      fontWeight: '700',
                      color: colors.water,
                      padding: 14,
                      backgroundColor: colors.water + '15',
                      borderRadius: 12,
                      textAlign: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 16, color: colors.textSecondary, fontWeight: '600' }}>L</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, textAlign: 'center' }}>
                  Recomendación: 2.5L diarios
                </Text>
              </View>

              {/* Save Button */}
              <Pressable
                onPress={async () => {
                  try {
                    const db = await getDatabase();
                    await db.runAsync(
                      `UPDATE user_profile SET 
                        target_calories = ?, 
                        target_protein_pct = ?, 
                        target_carbs_pct = ?, 
                        target_fat_pct = ?,
                        target_water_l = ?,
                        updated_at = CURRENT_TIMESTAMP
                      WHERE id = 1`,
                      [
                        parseInt(editTargetCalories) || 2000,
                        parseInt(editTargetProtein) || 20,
                        parseInt(editTargetCarbs) || 50,
                        parseInt(editTargetFat) || 30,
                        parseFloat(editTargetWater) || 2.5,
                      ]
                    );
                    await loadProfile();
                    setShowNutritionTargetsModal(false);
                    Alert.alert('¡Guardado!', 'Objetivos nutricionales actualizados');
                  } catch (error) {
                    console.error('Error saving targets:', error);
                    Alert.alert('Error', 'No se pudieron guardar los objetivos');
                  }
                }}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 30,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                  Guardar Objetivos
                </Text>
              </Pressable>
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

