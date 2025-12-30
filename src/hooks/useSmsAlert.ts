import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { getUserProfile } from '@/services/userProfileService';
import { VITAL_THRESHOLDS } from './useAlertSound';
import { toast } from 'sonner';

interface VitalData {
  bpm: number;
  temp: number;
  spo2: number;
  fallStatus?: string;
  latitude?: number;
  longitude?: number;
}

// Kiểm tra kết nối internet
const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
};

// ID tự tăng cho mỗi SMS
let smsIdCounter = 1;

// Gửi SMS tự động sử dụng capacitor-sms-sender
const sendDirectSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[SMS] Chỉ hoạt động trên thiết bị native');
    toast.info('SMS chỉ hoạt động trên ứng dụng Android');
    return false;
  }

  try {
    console.log('[SMS] Gửi tự động đến:', phoneNumber);

    // Import plugin động
    const { SmsSender } = await import('capacitor-sms-sender');

    // Kiểm tra và yêu cầu quyền (plugin cần cả SEND_SMS + READ_PHONE_STATE)
    const permissions = await SmsSender.checkPermissions();
    const hasSendSms = permissions.send_sms === 'granted';
    const hasReadPhoneState = permissions.read_phone_state === 'granted';

    if (!hasSendSms || !hasReadPhoneState) {
      console.log('[SMS] Thiếu quyền, đang yêu cầu...', permissions);
      const requested = await SmsSender.requestPermissions();

      const grantedSendSms = requested.send_sms === 'granted';
      const grantedReadPhoneState = requested.read_phone_state === 'granted';

      if (!grantedSendSms || !grantedReadPhoneState) {
        toast.error('Cần cấp quyền để gửi SMS tự động', {
          description:
            'Hãy cấp quyền “SMS” và “Trạng thái điện thoại” (READ_PHONE_STATE) cho ứng dụng trong Cài đặt.',
        });
        return false;
      }
    }

    // Gửi SMS trực tiếp không cần mở app
    const result = await SmsSender.send({
      id: smsIdCounter++,
      sim: 0, // SIM đầu tiên
      phone: phoneNumber,
      text: message,
    });

    console.log('[SMS] Kết quả:', result);
    
    // Kiểm tra status: PENDING, SENT, DELIVERED = thành công, FAILED = thất bại
    if (result.status === 'SENT' || result.status === 'DELIVERED' || result.status === 'PENDING') {
      toast.success('Đã gửi SMS cảnh báo!', {
        description: `Trạng thái: ${result.status}`,
      });
      return true;
    } else {
      throw new Error(`Trạng thái SMS: ${result.status}`);
    }
  } catch (error: any) {
    console.error('[SMS] Lỗi:', error);

    // Không fallback sang mở app nhắn tin vì bạn cần "tự động gửi".
    // Nếu tới đây mà vẫn không gửi được, thường là do:
    // - Thiếu quyền ở mức hệ điều hành/OEM chặn gửi SMS nền
    // - Plugin không tương thích phiên bản Android/ROM
    // - Thiết bị không có SIM/không cho phép SMS
    const errorMsg = typeof error === 'string' ? error : (error?.message ?? 'Lỗi không xác định');

    toast.error('Không thể gửi SMS tự động', {
      description:
        `${errorMsg}` +
        (errorMsg.toLowerCase().includes('permission')
          ? ' (Hãy cấp quyền “SMS” và “Trạng thái điện thoại”).'
          : ' (Kiểm tra SIM/SMS hoặc thiết bị đang chặn gửi SMS nền).'),
    });

    return false;
  }
};

// Format tin nhắn SMS ngắn gọn
const formatSmsMessage = (
  alertType: 'vital' | 'fall' | 'zone',
  title: string,
  details: string,
  vitals?: { bpm?: number; spo2?: number; temperature?: number },
  location?: { latitude: number; longitude: number }
): string => {
  let message = `⚠️ S-LIFE CẢNH BÁO\n${title}\n`;
  
  if (vitals) {
    if (vitals.bpm) message += `Nhịp tim: ${vitals.bpm} BPM\n`;
    if (vitals.spo2) message += `SpO2: ${vitals.spo2}%\n`;
    if (vitals.temperature) message += `Nhiệt độ: ${vitals.temperature}°C\n`;
  }
  
  if (details) {
    message += `${details}\n`;
  }
  
  if (location) {
    message += `📍 https://maps.google.com/?q=${location.latitude},${location.longitude}\n`;
  }
  
  message += `⏰ ${new Date().toLocaleString('vi-VN')}`;
  
  return message;
};

export const useSmsAlert = (userId: string = 'device1') => {
  const lastSmsTimeRef = useRef<number>(0);
  const SMS_COOLDOWN = 60000; // 1 phút cooldown giữa các SMS
  const isCheckingRef = useRef<boolean>(false);

  const sendSmsAlert = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    const now = Date.now();
    if (now - lastSmsTimeRef.current < SMS_COOLDOWN) {
      console.log('[SMS] Bị bỏ qua - trong thời gian cooldown');
      return false;
    }

    try {
      // Lấy thông tin profile để lấy số điện thoại khẩn cấp
      const profile = await getUserProfile(userId);
      if (!profile || !profile.emergencyContact) {
        console.log('[SMS] Chưa cấu hình số điện thoại khẩn cấp');
        toast.warning('Chưa cài đặt số điện thoại khẩn cấp', {
          description: 'Vào Cài đặt để thêm số điện thoại người thân.',
        });
        return false;
      }

      const smsMessage = formatSmsMessage(alertType, title, message, vitals, location);
      
      console.log(`[SMS] Đang gửi đến ${profile.emergencyContact}`);
      
      const success = await sendDirectSMS(profile.emergencyContact, smsMessage);
      
      if (success) {
        lastSmsTimeRef.current = now;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SMS] Lỗi trong sendSmsAlert:', error);
      return false;
    }
  }, [userId]);

  // Gửi SMS tự động khi vượt ngưỡng (không cần internet)
  const sendAutoSmsAlert = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    // Tránh gửi đồng thời
    if (isCheckingRef.current) return false;
    isCheckingRef.current = true;

    try {
      console.log('[SMS Auto] Gửi tự động không cần internet');
      const result = await sendSmsAlert(alertType, title, message, vitals, location);
      isCheckingRef.current = false;
      return result;
    } catch (error) {
      console.error('[SMS Auto] Lỗi:', error);
      isCheckingRef.current = false;
      return false;
    }
  }, [sendSmsAlert]);

  const checkAndSendSmsIfOffline = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    // Tránh kiểm tra đồng thời
    if (isCheckingRef.current) return false;
    isCheckingRef.current = true;

    try {
      const hasInternet = await checkNetworkStatus();
      
      if (!hasInternet) {
        console.log('[SMS] Không có internet - Gửi SMS tự động');
        const result = await sendSmsAlert(alertType, title, message, vitals, location);
        isCheckingRef.current = false;
        return result;
      }
      
      console.log('[SMS] Có internet - Sử dụng email/push notification');
      isCheckingRef.current = false;
      return false; // Trả về false để hook khác xử lý (email)
    } catch (error) {
      console.error('[SMS] Lỗi kiểm tra mạng:', error);
      isCheckingRef.current = false;
      return false;
    }
  }, [sendSmsAlert]);

  const checkVitalsAndSendSms = useCallback(async (data: VitalData): Promise<boolean> => {
    const alerts: string[] = [];
    const abnormalVitals: { bpm?: number; spo2?: number; temperature?: number } = {};

    // Kiểm tra nhịp tim
    if (data.bpm > 0) {
      if (data.bpm < VITAL_THRESHOLDS.bpm.min) {
        alerts.push(`Nhịp tim thấp: ${data.bpm} BPM`);
        abnormalVitals.bpm = data.bpm;
      } else if (data.bpm > VITAL_THRESHOLDS.bpm.max) {
        alerts.push(`Nhịp tim cao: ${data.bpm} BPM`);
        abnormalVitals.bpm = data.bpm;
      }
    }

    // Kiểm tra nhiệt độ
    if (data.temp > 0) {
      if (data.temp < VITAL_THRESHOLDS.temp.min) {
        alerts.push(`Nhiệt độ thấp: ${data.temp}°C`);
        abnormalVitals.temperature = data.temp;
      } else if (data.temp > VITAL_THRESHOLDS.temp.max) {
        alerts.push(`Nhiệt độ cao: ${data.temp}°C`);
        abnormalVitals.temperature = data.temp;
      }
    }

    // Kiểm tra SpO2
    if (data.spo2 > 0 && data.spo2 < VITAL_THRESHOLDS.spo2.min) {
      alerts.push(`SpO2 thấp: ${data.spo2}%`);
      abnormalVitals.spo2 = data.spo2;
    }

    // Kiểm tra té ngã - ưu tiên cao nhất
    if (data.fallStatus === 'fall') {
      const location = data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : undefined;

      // Gửi SMS tự động khi phát hiện té ngã
      return await sendAutoSmsAlert(
        'fall',
        'PHÁT HIỆN TÉ NGÃ!',
        'Cần kiểm tra ngay!',
        { bpm: data.bpm, spo2: data.spo2, temperature: data.temp },
        location
      );
    }

    // Gửi SMS tự động nếu có chỉ số bất thường
    if (alerts.length > 0) {
      const location = data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : undefined;

      return await sendAutoSmsAlert(
        'vital',
        'Chỉ số bất thường!',
        alerts.join('. '),
        abnormalVitals,
        location
      );
    }

    return false;
  }, [sendAutoSmsAlert]);

  const sendZoneSmsAlert = useCallback(async (
    isOutside: boolean,
    location: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    if (!isOutside) return false;

    return await sendAutoSmsAlert(
      'zone',
      'Rời khỏi vùng an toàn!',
      'Người dùng đã ra khỏi vùng an toàn.',
      undefined,
      location
    );
  }, [sendAutoSmsAlert]);

  // Gửi SMS trực tiếp (bỏ qua kiểm tra internet)
  const forceSendSms = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    return await sendSmsAlert(alertType, title, message, vitals, location);
  }, [sendSmsAlert]);

  return {
    sendSmsAlert,
    sendAutoSmsAlert,
    checkAndSendSmsIfOffline,
    checkVitalsAndSendSms,
    sendZoneSmsAlert,
    forceSendSms,
    checkNetworkStatus,
  };
};
