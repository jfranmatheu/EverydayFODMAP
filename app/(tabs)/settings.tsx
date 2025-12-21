import { Button, Card } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { getDatabase } from '@/lib/database';
import {
  cancelAllNotifications,
  checkNotificationPermissions,
  getScheduledNotificationsList,
  requestNotificationPermissions,
  syncAllTreatmentNotifications,
  testNotification
} from '@/lib/notifications';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';

type ThemeOption = 'light' | 'dark' | 'auto';

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode } = useTheme();
  const [notifications, setNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [externalRecipes, setExternalRecipes] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    checkNotificationPermissions().then(hasPermission => {
      setNotifications(hasPermission);
    });
    loadScheduledNotifications();
  }, []);

  const loadScheduledNotifications = async () => {
    const scheduled = await getScheduledNotificationsList();
    setNotificationCount(scheduled.length);
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      setNotifications(granted);
      if (granted) {
        // Sync all treatment notifications
        await syncAllTreatmentNotifications();
        await loadScheduledNotifications();
        Alert.alert('Activado', 'Las notificaciones están activadas. Se sincronizarán los recordatorios de tratamientos.');
      } else {
        Alert.alert('Permiso denegado', 'No se pudo activar las notificaciones. Por favor, actívalas desde la configuración del dispositivo.');
      }
    } else {
      await cancelAllNotifications();
      setNotificationCount(0);
      setNotifications(false);
      Alert.alert('Desactivado', 'Se han cancelado todas las notificaciones programadas.');
    }
  };

  const handleTestNotification = async () => {
    await testNotification();
  };

  const handleSyncNotifications = async () => {
    await syncAllTreatmentNotifications();
    await loadScheduledNotifications();
    Alert.alert('Sincronizado', 'Se han reprogramado las notificaciones de todos los tratamientos activos.');
  };

  const themeOptions: { id: ThemeOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'light', label: 'Claro', icon: 'sunny' },
    { id: 'dark', label: 'Oscuro', icon: 'moon' },
    { id: 'auto', label: 'Auto', icon: 'phone-portrait' },
  ];

  const handleExportData = async () => {
    setExporting(true);
    try {
      const db = await getDatabase();
      
      // Gather only USER data (exclude internal/downloaded data)
      const data = {
        // Only user-created foods (source = 'user')
        foods: await db.getAllAsync("SELECT * FROM foods WHERE source = 'user'"),
        food_components: await db.getAllAsync("SELECT fc.* FROM food_components fc INNER JOIN foods f ON fc.parent_food_id = f.id WHERE f.source = 'user'"),
        // Only user-created recipes (source = 'user')
        recipes: await db.getAllAsync("SELECT * FROM recipes WHERE source = 'user' OR source IS NULL"),
        recipe_steps: await db.getAllAsync("SELECT rs.* FROM recipe_steps rs INNER JOIN recipes r ON rs.recipe_id = r.id WHERE r.source = 'user' OR r.source IS NULL"),
        recipe_ingredients: await db.getAllAsync("SELECT ri.* FROM recipe_ingredients ri INNER JOIN recipes r ON ri.recipe_id = r.id WHERE r.source = 'user' OR r.source IS NULL"),
        // User logs (always user data)
        meals: await db.getAllAsync('SELECT * FROM meals'),
        meal_items: await db.getAllAsync('SELECT * FROM meal_items'),
        water_intake: await db.getAllAsync('SELECT * FROM water_intake'),
        symptoms: await db.getAllAsync('SELECT * FROM symptoms'),
        bowel_movements: await db.getAllAsync('SELECT * FROM bowel_movements'),
        // Treatments and logs (user data)
        treatments: await db.getAllAsync('SELECT * FROM treatments'),
        treatment_logs: await db.getAllAsync('SELECT * FROM treatment_logs'),
        // User activity logs
        activity_logs: await db.getAllAsync('SELECT * FROM activity_logs'),
        // User-created activity types only
        activity_types: await db.getAllAsync("SELECT * FROM activity_types WHERE is_custom = 1"),
        // User tags and folders
        tags: await db.getAllAsync('SELECT * FROM tags'),
        folders: await db.getAllAsync('SELECT * FROM folders'),
        // Scheduled activities (user data)
        scheduled_activities: await db.getAllAsync('SELECT * FROM scheduled_activities'),
        scheduled_activity_logs: await db.getAllAsync('SELECT * FROM scheduled_activity_logs'),
        // Metadata
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        dataType: 'user_only', // Flag to indicate this is user data only
      };

      const jsonString = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        // Web: Download as file
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fodmap-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        Alert.alert('Éxito', 'Datos exportados correctamente. El archivo se ha descargado.');
      } else {
        // Native: Use expo-file-system and expo-sharing (would need to be installed)
        console.log('Export data:', jsonString);
        Alert.alert('Exportar datos', 'Función de descarga disponible en la versión nativa.');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'No se pudieron exportar los datos');
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!importData.trim()) {
      Alert.alert('Error', 'Por favor, pega los datos JSON a importar');
      return;
    }

    setImporting(true);
    try {
      const data = JSON.parse(importData);
      const db = await getDatabase();

      // Validate data structure
      if (!data.version && !data.exportDate) {
        throw new Error('Formato de datos no válido');
      }

      let importedCount = 0;

      // Import foods (alimentos)
      if (data.foods && Array.isArray(data.foods)) {
        for (const item of data.foods) {
          await db.runAsync(
            `INSERT OR REPLACE INTO foods (id, name, fodmap_level, category, serving_size, notes, source, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.name, item.fodmap_level, item.category, item.serving_size, item.notes, item.source || 'user', item.created_at]
          );
          importedCount++;
        }
      }

      // Import recipes
      if (data.recipes && Array.isArray(data.recipes)) {
        for (const item of data.recipes) {
          await db.runAsync(
            `INSERT OR REPLACE INTO recipes (id, name, description, instructions, prep_time, cook_time, servings, fodmap_level, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.name, item.description, item.instructions, item.prep_time, item.cook_time, item.servings, item.fodmap_level, item.created_at]
          );
          importedCount++;
        }
      }

      // Import meals
      if (data.meals && Array.isArray(data.meals)) {
        for (const item of data.meals) {
          await db.runAsync(
            `INSERT OR REPLACE INTO meals (id, name, meal_type, date, time, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.name, item.meal_type, item.date, item.time, item.notes, item.created_at]
          );
          importedCount++;
        }
      }

      // Import water intake
      if (data.water_intake && Array.isArray(data.water_intake)) {
        for (const item of data.water_intake) {
          await db.runAsync(
            `INSERT OR REPLACE INTO water_intake (id, glasses, amount_ml, date, time, created_at) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [item.id, item.glasses, item.amount_ml, item.date, item.time, item.created_at]
          );
          importedCount++;
        }
      }

      // Import symptoms
      if (data.symptoms && Array.isArray(data.symptoms)) {
        for (const item of data.symptoms) {
          await db.runAsync(
            `INSERT OR REPLACE INTO symptoms (id, type, intensity, date, time, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.type, item.intensity, item.date, item.time, item.notes, item.created_at]
          );
          importedCount++;
        }
      }

      // Import bowel movements
      if (data.bowel_movements && Array.isArray(data.bowel_movements)) {
        for (const item of data.bowel_movements) {
          await db.runAsync(
            `INSERT OR REPLACE INTO bowel_movements (id, bristol_type, urgency, pain, discomfort, date, time, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.bristol_type, item.urgency, item.pain, item.discomfort, item.date, item.time, item.notes, item.created_at]
          );
          importedCount++;
        }
      }

      // Import treatments
      if (data.treatments && Array.isArray(data.treatments)) {
        for (const item of data.treatments) {
          await db.runAsync(
            `INSERT OR REPLACE INTO treatments (id, name, dosage, frequency, time_of_day, notes, is_active, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.name, item.dosage, item.frequency, item.time_of_day, item.notes, item.is_active, item.created_at]
          );
          importedCount++;
        }
      }

      // Import treatment logs
      if (data.treatment_logs && Array.isArray(data.treatment_logs)) {
        for (const item of data.treatment_logs) {
          await db.runAsync(
            `INSERT OR REPLACE INTO treatment_logs (id, treatment_id, treatment_name, date, time, taken, notes, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.treatment_id, item.treatment_name, item.date, item.time, item.taken, item.notes, item.created_at]
          );
          importedCount++;
        }
      }

      setShowImportModal(false);
      setImportData('');
      Alert.alert('Éxito', `Se importaron ${importedCount} registros correctamente`);
    } catch (error) {
      console.error('Error importing data:', error);
      Alert.alert('Error', 'No se pudieron importar los datos. Verifica que el formato JSON sea correcto.');
    } finally {
      setImporting(false);
    }
  };

  const handleFileImport = () => {
    if (Platform.OS === 'web') {
      // Create file input for web
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result as string;
            setImportData(content);
            setShowImportModal(true);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    } else {
      // For native, show modal to paste data
      setShowImportModal(true);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Eliminar todos los datos',
      '¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              
              // For web, clear the mock storage
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                localStorage.removeItem('everyday_fodmap_webdb');
                (window as any).__webStorage = {};
              }
              
              await db.runAsync('DELETE FROM treatment_logs');
              await db.runAsync('DELETE FROM treatments');
              await db.runAsync('DELETE FROM bowel_movements');
              await db.runAsync('DELETE FROM symptoms');
              await db.runAsync('DELETE FROM meal_items');
              await db.runAsync('DELETE FROM meals');
              await db.runAsync('DELETE FROM water_intake');
              await db.runAsync('DELETE FROM activity_logs');
              await db.runAsync('DELETE FROM recipe_ingredients');
              await db.runAsync('DELETE FROM recipe_steps');
              await db.runAsync('DELETE FROM recipe_tags');
              await db.runAsync('DELETE FROM recipes');
              await db.runAsync('DELETE FROM food_tags');
              await db.runAsync('DELETE FROM food_components');
              await db.runAsync("DELETE FROM foods WHERE source = 'user'"); // Keep internal FODMAP data
              await db.runAsync('DELETE FROM tags');
              await db.runAsync('DELETE FROM folders');
              
              Alert.alert('Éxito', 'Todos los datos han sido eliminados');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'No se pudieron eliminar los datos');
            }
          }
        },
      ]
    );
  };

  const SettingRow = ({ 
    icon, 
    label, 
    subtitle,
    color = colors.primary,
    onPress,
    rightElement,
    loading,
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string;
    subtitle?: string;
    color?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    loading?: boolean;
  }) => (
    <Pressable 
      onPress={onPress}
      disabled={!onPress || loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: color + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
      }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text }}>
          {label}
        </Text>
        {subtitle && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ))}
    </Pressable>
  );

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        {/* Theme */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: colors.textSecondary,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Apariencia
          </Text>
          <Card style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: colors.text, marginBottom: 12 }}>
              Tema
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {themeOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => setThemeMode(option.id)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: themeMode === option.id ? colors.primary : colors.cardElevated,
                  }}
                >
                  <Ionicons 
                    name={option.icon} 
                    size={18} 
                    color={themeMode === option.id ? '#FFFFFF' : colors.textSecondary} 
                  />
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: themeMode === option.id ? '#FFFFFF' : colors.textSecondary,
                  }}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Notifications */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: colors.textSecondary,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Notificaciones
          </Text>
          <Card style={{ marginBottom: 20 }}>
            <SettingRow 
              icon="notifications"
              label="Notificaciones"
              subtitle={notifications 
                ? `Activadas · ${notificationCount} recordatorio${notificationCount !== 1 ? 's' : ''} programado${notificationCount !== 1 ? 's' : ''}`
                : 'Recibe recordatorios para tratamientos'
              }
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: colors.border, true: colors.primary + '60' }}
                  thumbColor={notifications ? colors.primary : colors.textMuted}
                />
              }
            />
            
            {notifications && (
              <>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
                
                <Pressable
                  onPress={handleSyncNotifications}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    gap: 12,
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.primary + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="sync" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                      Sincronizar recordatorios
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Reprograma las notificaciones de tratamientos
                    </Text>
                  </View>
                </Pressable>
                
                <Pressable
                  onPress={handleTestNotification}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    gap: 12,
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.success + '15',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="flask" size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text }}>
                      Probar notificación
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>
                      Envía una notificación de prueba
                    </Text>
                  </View>
                </Pressable>
              </>
            )}
          </Card>
        </Animated.View>

        {/* Data */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: colors.textSecondary,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Datos
          </Text>
          <Card style={{ marginBottom: 20 }}>
            <SettingRow 
              icon="cloud-download"
              label="Recetas externas"
              subtitle="Descargar bases de datos de recetas"
              rightElement={
                <Switch
                  value={externalRecipes}
                  onValueChange={setExternalRecipes}
                  trackColor={{ false: colors.border, true: colors.primary + '60' }}
                  thumbColor={externalRecipes ? colors.primary : colors.textMuted}
                />
              }
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <SettingRow 
              icon="download"
              label="Exportar datos"
              subtitle="Guardar todos los datos en formato JSON"
              onPress={handleExportData}
              loading={exporting}
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <SettingRow 
              icon="push"
              label="Importar datos"
              subtitle="Restaurar datos desde un archivo JSON"
              onPress={handleFileImport}
            />
          </Card>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: colors.error,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Zona de peligro
          </Text>
          <Card style={{ borderColor: colors.error + '30' }}>
            <SettingRow 
              icon="trash"
              label="Eliminar todos los datos"
              subtitle="Esta acción no se puede deshacer"
              color={colors.error}
              onPress={handleClearData}
            />
          </Card>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={{ marginTop: 20 }}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: colors.textSecondary,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Acerca de
          </Text>
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Ionicons name="leaf" size={32} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Everyday FODMAP
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                Versión 1.0.0
              </Text>
              <Text style={{ 
                fontSize: 12, 
                color: colors.textMuted, 
                marginTop: 16,
                textAlign: 'center',
                paddingHorizontal: 24,
              }}>
                Una app para gestionar tu dieta FODMAP, registrar síntomas y encontrar correlaciones.
              </Text>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                Importar datos
              </Text>
              <Pressable onPress={() => { setShowImportModal(false); setImportData(''); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>
              Pega el contenido del archivo JSON exportado:
            </Text>

            <TextInput
              value={importData}
              onChangeText={setImportData}
              placeholder='{"version": "1.0.0", ...}'
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={10}
              style={{
                fontSize: 13,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                color: colors.text,
                padding: 12,
                backgroundColor: colors.cardElevated,
                borderRadius: 10,
                minHeight: 200,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button 
                variant="outline" 
                onPress={() => { setShowImportModal(false); setImportData(''); }}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button 
                onPress={handleImportData}
                loading={importing}
                style={{ flex: 1 }}
              >
                Importar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
