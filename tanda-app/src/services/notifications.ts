/**
 * Push Notifications Service
 * Handles payment reminders and tanda notifications
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { secureStorage } from './storage';

// Notification channel for Android
const CHANNEL_ID = 'tanda-payments';

// Storage keys
const KEYS = {
  PUSH_TOKEN: 'tanda_push_token',
  SCHEDULED_NOTIFICATIONS: 'tanda_scheduled_notifications',
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PaymentReminder {
  tandaId: string;
  tandaName: string;
  amount: number;
  dueDate: number;
  cycle: number;
}

export interface ScheduledNotification {
  id: string;
  tandaId: string;
  type: 'reminder_3d' | 'reminder_1d' | 'reminder_due' | 'overdue';
  scheduledFor: number;
}

class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;
  private expoPushToken: string | null = null;
  private scheduledNotifications: ScheduledNotification[] = [];

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize the notification service
   * Should be called when the app starts
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Skip on web
      if (Platform.OS === 'web') {
        console.log('[Notifications] Web platform - skipping initialization');
        this.isInitialized = true;
        return false;
      }

      // Check if physical device
      if (!Device.isDevice) {
        console.log('[Notifications] Not a physical device - notifications limited');
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission not granted');
        return false;
      }

      // Get push token
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: 'tanda-app', // Replace with your Expo project ID
        });
        this.expoPushToken = token.data;
        await secureStorage.set(KEYS.PUSH_TOKEN, this.expoPushToken);
        console.log('[Notifications] Push token:', this.expoPushToken);
      } catch (tokenError) {
        console.warn('[Notifications] Could not get push token:', tokenError);
      }

      // Setup Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Pagos de Tanda',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3b82f6',
          sound: 'default',
        });
      }

      // Load scheduled notifications from storage
      await this.loadScheduledNotifications();

      this.isInitialized = true;
      console.log('[Notifications] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[Notifications] Initialization error:', error);
      return false;
    }
  }

  /**
   * Load scheduled notifications from storage
   */
  private async loadScheduledNotifications(): Promise<void> {
    try {
      const data = await secureStorage.get(KEYS.SCHEDULED_NOTIFICATIONS);
      if (data) {
        this.scheduledNotifications = JSON.parse(data);
        // Clean up expired notifications
        const now = Date.now();
        this.scheduledNotifications = this.scheduledNotifications.filter(
          n => n.scheduledFor > now
        );
      }
    } catch (error) {
      console.error('[Notifications] Error loading scheduled notifications:', error);
      this.scheduledNotifications = [];
    }
  }

  /**
   * Save scheduled notifications to storage
   */
  private async saveScheduledNotifications(): Promise<void> {
    try {
      await secureStorage.set(
        KEYS.SCHEDULED_NOTIFICATIONS,
        JSON.stringify(this.scheduledNotifications)
      );
    } catch (error) {
      console.error('[Notifications] Error saving scheduled notifications:', error);
    }
  }

  /**
   * Schedule payment reminders for a tanda
   * - 3 days before due date
   * - 1 day before due date
   * - On due date
   */
  async schedulePaymentReminders(reminder: PaymentReminder): Promise<void> {
    if (Platform.OS === 'web') return;

    const { tandaId, tandaName, amount, dueDate, cycle } = reminder;

    // Cancel existing reminders for this tanda/cycle
    await this.cancelRemindersForTanda(tandaId, cycle);

    const now = Date.now();
    const threeDaysBefore = dueDate - (3 * 24 * 60 * 60 * 1000);
    const oneDayBefore = dueDate - (24 * 60 * 60 * 1000);

    const notifications: Array<{
      type: ScheduledNotification['type'];
      date: number;
      title: string;
      body: string;
    }> = [];

    // 3 days before
    if (threeDaysBefore > now) {
      notifications.push({
        type: 'reminder_3d',
        date: threeDaysBefore,
        title: `Recordatorio: Pago en 3 dias`,
        body: `Tu pago de €${amount.toFixed(2)} para "${tandaName}" vence en 3 dias.`,
      });
    }

    // 1 day before
    if (oneDayBefore > now) {
      notifications.push({
        type: 'reminder_1d',
        date: oneDayBefore,
        title: `Recordatorio: Pago manana`,
        body: `Tu pago de €${amount.toFixed(2)} para "${tandaName}" vence manana.`,
      });
    }

    // On due date (morning)
    const dueDateMorning = new Date(dueDate);
    dueDateMorning.setHours(9, 0, 0, 0);
    if (dueDateMorning.getTime() > now) {
      notifications.push({
        type: 'reminder_due',
        date: dueDateMorning.getTime(),
        title: `Pago pendiente hoy`,
        body: `Tu pago de €${amount.toFixed(2)} para "${tandaName}" vence hoy. Paga ahora para evitar penalizaciones.`,
      });
    }

    // Schedule each notification
    for (const notif of notifications) {
      try {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: notif.title,
            body: notif.body,
            data: {
              tandaId,
              cycle,
              type: notif.type,
            },
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(notif.date),
          },
        });

        this.scheduledNotifications.push({
          id: identifier,
          tandaId,
          type: notif.type,
          scheduledFor: notif.date,
        });

        console.log(`[Notifications] Scheduled ${notif.type} for ${new Date(notif.date).toISOString()}`);
      } catch (error) {
        console.error(`[Notifications] Error scheduling ${notif.type}:`, error);
      }
    }

    await this.saveScheduledNotifications();
  }

  /**
   * Send immediate overdue notification
   */
  async sendOverdueNotification(
    tandaId: string,
    tandaName: string,
    amount: number,
    daysOverdue: number
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Pago vencido - ${daysOverdue} dias`,
          body: `Tu pago de €${amount.toFixed(2)} para "${tandaName}" esta vencido. Tienes ${6 - daysOverdue} dias para pagar antes de ser expulsado.`,
          data: { tandaId, type: 'overdue' },
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: null, // Immediate
      });

      console.log(`[Notifications] Sent overdue notification for ${tandaId}`);
    } catch (error) {
      console.error('[Notifications] Error sending overdue notification:', error);
    }
  }

  /**
   * Send expulsion notification
   */
  async sendExpulsionNotification(
    tandaId: string,
    tandaName: string,
    penaltyPoints: number
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Expulsado de tanda`,
          body: `Has sido expulsado de "${tandaName}" por no completar tu pago. Tu puntuacion ha bajado ${penaltyPoints} puntos.`,
          data: { tandaId, type: 'expulsion' },
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: null, // Immediate
      });

      console.log(`[Notifications] Sent expulsion notification for ${tandaId}`);
    } catch (error) {
      console.error('[Notifications] Error sending expulsion notification:', error);
    }
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccessNotification(
    tandaName: string,
    amount: number
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Pago completado`,
          body: `Tu pago de €${amount.toFixed(2)} para "${tandaName}" fue registrado exitosamente.`,
          data: { type: 'payment_success' },
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[Notifications] Error sending success notification:', error);
    }
  }

  /**
   * Send payout received notification
   */
  async sendPayoutNotification(
    tandaName: string,
    amount: number
  ): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Has recibido tu pago!`,
          body: `Recibiste €${amount.toFixed(2)} de "${tandaName}". El dinero ya esta en tu cuenta.`,
          data: { type: 'payout' },
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[Notifications] Error sending payout notification:', error);
    }
  }

  /**
   * Cancel all reminders for a specific tanda
   */
  async cancelRemindersForTanda(tandaId: string, cycle?: number): Promise<void> {
    const toCancel = this.scheduledNotifications.filter(
      n => n.tandaId === tandaId && (cycle === undefined || true)
    );

    for (const notif of toCancel) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notif.id);
      } catch (error) {
        console.error(`[Notifications] Error canceling notification ${notif.id}:`, error);
      }
    }

    this.scheduledNotifications = this.scheduledNotifications.filter(
      n => n.tandaId !== tandaId
    );

    await this.saveScheduledNotifications();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications = [];
      await this.saveScheduledNotifications();
      console.log('[Notifications] All notifications cancelled');
    } catch (error) {
      console.error('[Notifications] Error canceling all notifications:', error);
    }
  }

  /**
   * Get the push token for backend registration
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Add notification response listener
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }
}

export const notificationService = NotificationService.getInstance();
