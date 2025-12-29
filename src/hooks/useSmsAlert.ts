import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SmsManager } from '@byteowls/capacitor-sms';
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

// Gửi SMS (native)
// Lưu ý: tuỳ thiết bị/phiên bản Android, việc "tự gửi" có thể bị chặn nếu app không phải default SMS app.
const sendNativeSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('SMS chỉ hoạt động trên thiết bị native');
    return false;
  }

  try {
    console.log('[SMS] Sending...', {
      to: phoneNumber,
      length: message.length,
      platform: Capacitor.getPlatform(),
    });

    await SmsManager.send({
      numbers: [phoneNumber],
      text: message,
    });

    console.log('[SMS] Sent request successfully');
    return true;
  } catch (error: any) {
    const raw = typeof error === 'string' ? error : (error?.message ?? JSON.stringify(error));
    // Các mã lỗi plugin có thể trả về: UNIMPLEMENTED, ERR_SERVICE_NOTFOUND, ERR_NO_NUMBERS, ERR_NO_TEXT, SEND_CANCELLED...
    console.error('[SMS] Failed:', error);

    // Hiển thị lý do rõ ràng hơn cho người dùng
    toast.error('Không thể gửi SMS', {
      description:
        raw?.includes('ERR_SERVICE_NOTFOUND')
          ? 'Thiết bị không hỗ trợ gửi SMS (không có SIM/không có dịch vụ SMS).'
          : raw?.includes('UNIMPLEMENTED')
            ? 'SMS không hỗ trợ trên bản web. Hãy test trên app Android đã cài.'
            : raw?.includes('ERR_NO_NUMBERS')
              ? 'Chưa có số nhận. Hãy nhập & lưu “Số điện thoại khẩn cấp” trong Cài đặt.'
              : raw?.includes('ERR_NO_TEXT')
                ? 'Nội dung SMS trống.'
                : 'Vui lòng kiểm tra SIM/SMS hoạt động và cấp quyền SMS cho ứng dụng.',
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
    message += `📍 Vị trí: https://maps.google.com/?q=${location.latitude},${location.longitude}`;
  }
  
  message += `\nThời gian: ${new Date().toLocaleString('vi-VN')}`;
  
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
      console.log('SMS bị bỏ qua - trong thời gian cooldown');
      return false;
    }

    try {
      // Lấy thông tin profile để lấy số điện thoại khẩn cấp
      const profile = await getUserProfile(userId);
      if (!profile || !profile.emergencyContact) {
        console.log('Chưa cấu hình số điện thoại khẩn cấp');
        return false;
      }

      const smsMessage = formatSmsMessage(alertType, title, message, vitals, location);
      
      console.log(`Đang gửi SMS cảnh báo đến ${profile.emergencyContact}`);
      
      const success = await sendNativeSMS(profile.emergencyContact, smsMessage);
      
      if (success) {
        lastSmsTimeRef.current = now;
        toast.success('Đã gửi SMS cảnh báo khẩn cấp!');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Lỗi trong sendSmsAlert:', error);
      return false;
    }
  }, [userId]);

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
        console.log('Không có internet - Chuyển sang gửi SMS');
        const result = await sendSmsAlert(alertType, title, message, vitals, location);
        isCheckingRef.current = false;
        return result;
      }
      
      console.log('Có internet - Sử dụng email/push notification');
      isCheckingRef.current = false;
      return false; // Trả về false để hook khác xử lý (email)
    } catch (error) {
      console.error('Lỗi kiểm tra mạng:', error);
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

      return await checkAndSendSmsIfOffline(
        'fall',
        'PHÁT HIỆN TÉ NGÃ!',
        'Cần kiểm tra ngay!',
        { bpm: data.bpm, spo2: data.spo2, temperature: data.temp },
        location
      );
    }

    // Gửi SMS nếu có chỉ số bất thường
    if (alerts.length > 0) {
      const location = data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : undefined;

      return await checkAndSendSmsIfOffline(
        'vital',
        'Chỉ số bất thường!',
        alerts.join('. '),
        abnormalVitals,
        location
      );
    }

    return false;
  }, [checkAndSendSmsIfOffline]);

  const sendZoneSmsAlert = useCallback(async (
    isOutside: boolean,
    location: { latitude: number; longitude: number }
  ): Promise<boolean> => {
    if (!isOutside) return false;

    return await checkAndSendSmsIfOffline(
      'zone',
      'Rời khỏi vùng an toàn!',
      'Người dùng đã ra khỏi vùng an toàn.',
      undefined,
      location
    );
  }, [checkAndSendSmsIfOffline]);

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
    checkAndSendSmsIfOffline,
    checkVitalsAndSendSms,
    sendZoneSmsAlert,
    forceSendSms,
    checkNetworkStatus,
  };
};
