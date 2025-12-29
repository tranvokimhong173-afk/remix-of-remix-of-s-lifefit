import { useCallback, useRef } from 'react';
import { useEmailAlert } from './useEmailAlert';
import { useSmsAlert } from './useSmsAlert';
import { toast } from 'sonner';

interface VitalData {
  bpm: number;
  temp: number;
  spo2: number;
  fallStatus?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Hook kết hợp Email và SMS với fallback tự động
 * - Có internet: Gửi email
 * - Không có internet: Gửi SMS
 */
export const useAlertWithFallback = (userId: string = 'device1') => {
  const { sendAlertEmail, checkVitalsAndSendEmail, sendZoneAlert: sendZoneEmail } = useEmailAlert(userId);
  const { 
    checkAndSendSmsIfOffline, 
    checkVitalsAndSendSms, 
    sendZoneSmsAlert,
    forceSendSms,
    checkNetworkStatus 
  } = useSmsAlert(userId);
  
  const lastAlertTimeRef = useRef<number>(0);
  const ALERT_COOLDOWN = 60000; // 1 phút cooldown

  const sendAlert = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN) {
      console.log('Alert bị bỏ qua - trong thời gian cooldown');
      return false;
    }

    try {
      // Kiểm tra kết nối mạng
      const hasInternet = await checkNetworkStatus();
      
      if (hasInternet) {
        // Có internet -> gửi email
        console.log('Có internet - Gửi email cảnh báo');
        const emailSent = await sendAlertEmail(alertType, title, message, vitals, location);
        if (emailSent) {
          lastAlertTimeRef.current = now;
          return true;
        }
      }
      
      // Không có internet hoặc email thất bại -> gửi SMS
      console.log('Chuyển sang SMS fallback');
      const smsSent = await forceSendSms(alertType, title, message, vitals, location);
      if (smsSent) {
        lastAlertTimeRef.current = now;
        toast.info('Không có mạng - Đã gửi SMS thay thế');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Lỗi gửi cảnh báo:', error);
      return false;
    }
  }, [sendAlertEmail, forceSendSms, checkNetworkStatus]);

  const checkVitalsAndAlert = useCallback(async (data: VitalData): Promise<boolean> => {
    try {
      const hasInternet = await checkNetworkStatus();
      
      if (hasInternet) {
        // Có internet -> kiểm tra và gửi email
        return await checkVitalsAndSendEmail(data);
      } else {
        // Không có internet -> kiểm tra và gửi SMS
        return await checkVitalsAndSendSms(data);
      }
    } catch (error) {
      console.error('Lỗi kiểm tra và gửi cảnh báo:', error);
      return false;
    }
  }, [checkVitalsAndSendEmail, checkVitalsAndSendSms, checkNetworkStatus]);

  const sendZoneAlert = useCallback(async (
    isOutside: boolean,
    location: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    if (!isOutside) return false;

    try {
      const hasInternet = await checkNetworkStatus();
      
      if (hasInternet) {
        return await sendZoneEmail(isOutside, location);
      } else {
        return await sendZoneSmsAlert(isOutside, location);
      }
    } catch (error) {
      console.error('Lỗi gửi cảnh báo vùng:', error);
      return false;
    }
  }, [sendZoneEmail, sendZoneSmsAlert, checkNetworkStatus]);

  return {
    sendAlert,
    checkVitalsAndAlert,
    sendZoneAlert,
    checkNetworkStatus,
  };
};
