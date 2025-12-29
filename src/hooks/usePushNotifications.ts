import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { VITAL_THRESHOLDS } from './useAlertSound';

interface VitalData {
  bpm: number;
  temp: number;
  spo2: number;
  fallStatus?: string;
}

export const usePushNotifications = () => {
  const lastNotificationTimeRef = useRef<number>(0);
  const NOTIFICATION_COOLDOWN = 30000; // 30 seconds cooldown between notifications
  const isNativeRef = useRef(Capacitor.isNativePlatform());

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!isNativeRef.current) {
      console.log('Push notifications only available on native platforms');
      return;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      
      if (permResult.receive === 'granted') {
        // Register with FCM
        await PushNotifications.register();
        console.log('Push notifications registered successfully');
      } else {
        console.log('Push notification permission denied');
        toast.error('Vui lòng cấp quyền thông báo để nhận cảnh báo sức khỏe');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }, []);

  // Setup listeners
  useEffect(() => {
    if (!isNativeRef.current) return;

    // On registration success
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token: ' + token.value);
    });

    // On registration error
    const registrationErrorListener = PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    // On notification received while app is in foreground
    const notificationListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      toast.warning(notification.title || 'Cảnh báo sức khỏe', {
        description: notification.body
      });
    });

    // On notification action (when user taps notification)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
    });

    // Initialize
    initializePushNotifications();

    // Cleanup
    return () => {
      registrationListener.then(l => l.remove());
      registrationErrorListener.then(l => l.remove());
      notificationListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [initializePushNotifications]);

  // Send local notification for abnormal vitals
  const sendVitalAlert = useCallback(async (title: string, body: string) => {
    const now = Date.now();
    if (now - lastNotificationTimeRef.current < NOTIFICATION_COOLDOWN) {
      return; // Skip if within cooldown
    }
    lastNotificationTimeRef.current = now;

    // Always show toast for web and as fallback
    toast.error(title, {
      description: body,
      duration: 10000
    });

    if (isNativeRef.current) {
      try {
        // Schedule local notification
        await PushNotifications.createChannel({
          id: 'vital-alerts',
          name: 'Vital Alerts',
          description: 'Health vital sign alerts',
          importance: 5, // High importance
          visibility: 1,
          vibration: true,
          sound: 'default'
        });

        // Note: Local notifications require @capacitor/local-notifications
        // For now, we'll use toast as primary feedback
        console.log('Vital alert sent:', title, body);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
  }, []);

  // Check vitals and send notification if abnormal
  const checkVitalsAndNotify = useCallback((data: VitalData) => {
    const alerts: string[] = [];

    // Check heart rate
    if (data.bpm > 0) {
      if (data.bpm < VITAL_THRESHOLDS.bpm.min) {
        alerts.push(`Nhịp tim quá thấp: ${data.bpm} bpm (< ${VITAL_THRESHOLDS.bpm.min})`);
      } else if (data.bpm > VITAL_THRESHOLDS.bpm.max) {
        alerts.push(`Nhịp tim quá cao: ${data.bpm} bpm (> ${VITAL_THRESHOLDS.bpm.max})`);
      }
    }

    // Check temperature
    if (data.temp > 0) {
      if (data.temp < VITAL_THRESHOLDS.temp.min) {
        alerts.push(`Nhiệt độ quá thấp: ${data.temp}°C (< ${VITAL_THRESHOLDS.temp.min})`);
      } else if (data.temp > VITAL_THRESHOLDS.temp.max) {
        alerts.push(`Nhiệt độ quá cao: ${data.temp}°C (> ${VITAL_THRESHOLDS.temp.max})`);
      }
    }

    // Check SpO2
    if (data.spo2 > 0 && data.spo2 < VITAL_THRESHOLDS.spo2.min) {
      alerts.push(`Nồng độ oxy máu thấp: ${data.spo2}% (< ${VITAL_THRESHOLDS.spo2.min})`);
    }

    // Check fall status
    if (data.fallStatus === 'fall') {
      sendVitalAlert(
        '🚨 PHÁT HIỆN TÉ NGÃ!',
        'Hệ thống phát hiện té ngã. Vui lòng kiểm tra ngay!'
      );
      return true;
    }

    // Send combined alert if any abnormal vitals
    if (alerts.length > 0) {
      sendVitalAlert(
        '⚠️ Cảnh báo chỉ số sinh tồn bất thường!',
        alerts.join('\n')
      );
      return true;
    }

    return false;
  }, [sendVitalAlert]);

  return {
    initializePushNotifications,
    sendVitalAlert,
    checkVitalsAndNotify
  };
};
