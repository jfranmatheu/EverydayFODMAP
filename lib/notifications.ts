import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from './database';
import { TreatmentDose } from './types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ============================================================
// PERMISSION HANDLING
// ============================================================

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web notifications (if supported)
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permission not granted');
    return false;
  }

  // For Android, we need to create a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('treatment-reminders', {
      name: 'Recordatorios de tratamiento',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9333EA',
    });

    await Notifications.setNotificationChannelAsync('activity-reminders', {
      name: 'Recordatorios de actividad',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FF9800',
    });
  }

  return true;
}

export async function checkNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if ('Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  }

  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ============================================================
// TREATMENT NOTIFICATIONS
// ============================================================

interface ScheduledNotification {
  id: string;
  treatmentId: number;
  doseIndex: number;
  time: string;
}

const NOTIFICATIONS_STORAGE_KEY = '@everyday_fodmap_notifications';

async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveScheduledNotifications(notifications: ScheduledNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving notifications:', error);
  }
}

export async function scheduleTreatmentNotifications(
  treatmentId: number,
  treatmentName: string,
  doses: TreatmentDose[],
  reminderMinutesBefore: number = 15,
  instructions?: string
): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('Web notifications for recurring events not fully supported');
    return;
  }

  // Cancel existing notifications for this treatment
  await cancelTreatmentNotifications(treatmentId);

  const hasPermission = await checkNotificationPermissions();
  if (!hasPermission) {
    console.log('No notification permission');
    return;
  }

  const scheduledNotifications: ScheduledNotification[] = [];

  for (let doseIndex = 0; doseIndex < doses.length; doseIndex++) {
    const dose = doses[doseIndex];
    const [hours, minutes] = dose.time.split(':').map(Number);

    // Calculate notification time (X minutes before dose)
    let notifyHour = hours;
    let notifyMinute = minutes - reminderMinutesBefore;

    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
      if (notifyHour < 0) notifyHour = 23;
    }

    // Schedule daily repeating notification
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${treatmentName}`,
        body: `Es hora de tomar ${dose.amount} ${dose.unit}${instructions ? `\n${instructions}` : ''}`,
        data: { 
          type: 'treatment',
          treatmentId,
          doseIndex,
          doseTime: dose.time,
        },
        sound: true,
        categoryIdentifier: 'treatment-reminder',
      },
      trigger: {
        hour: notifyHour,
        minute: notifyMinute,
        repeats: true,
        channelId: 'treatment-reminders',
      },
    });

    scheduledNotifications.push({
      id: identifier,
      treatmentId,
      doseIndex,
      time: dose.time,
    });
  }

  // Save notification IDs
  const existing = await getScheduledNotifications();
  const filtered = existing.filter(n => n.treatmentId !== treatmentId);
  await saveScheduledNotifications([...filtered, ...scheduledNotifications]);

  console.log(`Scheduled ${doses.length} notifications for treatment ${treatmentName}`);
}

export async function cancelTreatmentNotifications(treatmentId: number): Promise<void> {
  if (Platform.OS === 'web') return;

  const notifications = await getScheduledNotifications();
  const toCancel = notifications.filter(n => n.treatmentId === treatmentId);

  for (const notification of toCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notification.id);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  // Remove from storage
  const remaining = notifications.filter(n => n.treatmentId !== treatmentId);
  await saveScheduledNotifications(remaining);
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  await saveScheduledNotifications([]);
}

// ============================================================
// ACTIVITY NOTIFICATIONS
// ============================================================

export async function scheduleActivityNotification(
  activityId: number,
  activityName: string,
  reminderTime: string, // HH:MM format
  frequencyType: string,
  frequencyValue?: string
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const hasPermission = await checkNotificationPermissions();
  if (!hasPermission) return null;

  const [hours, minutes] = reminderTime.split(':').map(Number);

  let trigger: any;

  switch (frequencyType) {
    case 'daily':
      trigger = {
        hour: hours,
        minute: minutes,
        repeats: true,
        channelId: 'activity-reminders',
      };
      break;
    case 'weekly':
      // For weekly, schedule for each day of week (if frequencyValue contains days)
      // Simplified: just do daily for now
      trigger = {
        hour: hours,
        minute: minutes,
        repeats: true,
        channelId: 'activity-reminders',
      };
      break;
    case 'specific_days':
      // Would need to schedule multiple notifications for specific days
      // Simplified for now
      trigger = {
        hour: hours,
        minute: minutes,
        repeats: true,
        channelId: 'activity-reminders',
      };
      break;
    default:
      trigger = {
        hour: hours,
        minute: minutes,
        repeats: true,
        channelId: 'activity-reminders',
      };
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏃 ${activityName}`,
      body: `¡Es hora de tu actividad programada!`,
      data: { 
        type: 'activity',
        activityId,
      },
      sound: true,
    },
    trigger,
  });

  return identifier;
}

export async function cancelActivityNotification(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling activity notification:', error);
  }
}

// ============================================================
// NOTIFICATION LISTENERS
// ============================================================

export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
): () => void {
  // When notification is received while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  // When user interacts with notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response:', response);
    onNotificationResponse?.(response);
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}

// ============================================================
// SYNC NOTIFICATIONS WITH DATABASE
// ============================================================

export async function syncAllTreatmentNotifications(): Promise<void> {
  try {
    const db = await getDatabase();
    const treatments = await (db as any).getAllAsync(
      'SELECT * FROM treatments WHERE is_active = 1 AND reminder_enabled = 1'
    );

    for (const treatment of treatments) {
      if (treatment.doses) {
        try {
          const doses = typeof treatment.doses === 'string' 
            ? JSON.parse(treatment.doses) 
            : treatment.doses;
          
          if (Array.isArray(doses) && doses.length > 0) {
            await scheduleTreatmentNotifications(
              treatment.id,
              treatment.name,
              doses,
              treatment.reminder_minutes_before || 15,
              treatment.instructions
            );
          }
        } catch (e) {
          console.error('Error parsing doses for treatment:', treatment.id, e);
        }
      }
    }

    console.log('Synced all treatment notifications');
  } catch (error) {
    console.error('Error syncing treatment notifications:', error);
  }
}

// ============================================================
// ONE-TIME REMINDERS
// ============================================================

export async function scheduleOneTimeReminder(
  title: string,
  body: string,
  date: Date,
  data?: Record<string, any>
): Promise<string | null> {
  if (Platform.OS === 'web') {
    // For web, we can use setTimeout if the date is soon
    const delay = date.getTime() - Date.now();
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Less than 24 hours
      setTimeout(() => {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      }, delay);
    }
    return null;
  }

  const hasPermission = await checkNotificationPermissions();
  if (!hasPermission) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: date,
  });

  return identifier;
}

// ============================================================
// BADGE MANAGEMENT
// ============================================================

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS !== 'web') {
    await Notifications.setBadgeCountAsync(count);
  }
}

export async function clearBadge(): Promise<void> {
  if (Platform.OS !== 'web') {
    await Notifications.setBadgeCountAsync(0);
  }
}

// ============================================================
// DEBUG UTILITIES
// ============================================================

export async function getScheduledNotificationsList(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === 'web') return [];
  return await Notifications.getAllScheduledNotificationsAsync();
}

export async function testNotification(): Promise<void> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.log('No permission for notifications');
    return;
  }

  if (Platform.OS === 'web') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🧪 Test de notificación', {
        body: 'Las notificaciones están funcionando correctamente',
      });
    }
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧪 Test de notificación',
      body: 'Las notificaciones están funcionando correctamente',
    },
    trigger: { seconds: 2 },
  });
}


