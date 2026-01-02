import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { getUserProfile } from '@/services/userProfileService';
import { VITAL_THRESHOLDS } from './useAlertSound';
import { toast } from 'sonner';
import { getSmsMode } from './useSmsMode';

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

// Mở ứng dụng SMS với nội dung soạn sẵn
const openSmsApp = async (phoneNumber: string, message: string): Promise<boolean> => {
  try {
    // Encode message cho URL
    const encodedMessage = encodeURIComponent(message);
    
    // Tạo SMS URI - hoạt động trên cả Android và iOS
    const smsUri = `sms:${phoneNumber}?body=${encodedMessage}`;
    
    console.log('[SMS] Mở ứng dụng SMS với URI:', smsUri);
    
    // Sử dụng Capacitor Browser để mở link
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url: smsUri });
    
    toast.info('Đã mở ứng dụng SMS', {
      description: 'Nhấn Gửi để gửi tin nhắn cảnh báo.',
    });
    
    return true;
  } catch (error) {
    console.error('[SMS] Lỗi mở ứng dụng SMS:', error);
    
    // Fallback: dùng window.location
    try {
      const encodedMessage = encodeURIComponent(message);
      window.location.href = `sms:${phoneNumber}?body=${encodedMessage}`;
      toast.info('Đã mở ứng dụng SMS', {
        description: 'Nhấn Gửi để gửi tin nhắn cảnh báo.',
      });
      return true;
    } catch {
      toast.error('Không thể mở ứng dụng SMS');
      return false;
    }
  }
};

// Gửi SMS tự động sử dụng capacitor-sms-sender
const sendDirectSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  // Kiểm tra chế độ SMS
  const smsMode = getSmsMode();
  
  if (smsMode === 'compose') {
    console.log('[SMS] Chế độ: Mở ứng dụng SMS soạn sẵn');
    return await openSmsApp(phoneNumber, message);
  }

  // Chế độ auto - chỉ hoạt động trên Android native
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    console.log('[SMS] Chỉ hoạt động trên thiết bị Android native');
    toast.info('SMS tự động chỉ hoạt động trên Android. Đang mở ứng dụng SMS...');
    return await openSmsApp(phoneNumber, message);
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
            'Hãy cấp quyền "SMS" và "Trạng thái điện thoại" (READ_PHONE_STATE) cho ứng dụng trong Cài đặt.',
        });
        return false;
      }
    }

    const trySend = async (sim: number) => {
      const result = await SmsSender.send({
        id: smsIdCounter++,
        sim,
        phone: phoneNumber,
        text: message,
      });
      console.log('[SMS] Kết quả (sim=' + sim + '):', result);
      return result;
    };

    // Một số máy có index SIM khác nhau (0/1). Thử lần lượt để tăng tỷ lệ gửi thành công.
    const attemptResults: Array<{ sim: number; status: string }> = [];

    const first = await trySend(0);
    attemptResults.push({ sim: 0, status: first.status });

    if (first.status === 'SENT' || first.status === 'DELIVERED') {
      toast.success('Đã gửi SMS cảnh báo!', { description: `Trạng thái: ${first.status}` });
      return true;
    }

    if (first.status === 'FAILED') {
      const second = await trySend(1);
      attemptResults.push({ sim: 1, status: second.status });

      if (second.status === 'SENT' || second.status === 'DELIVERED') {
        toast.success('Đã gửi SMS cảnh báo!', { description: `Trạng thái: ${second.status}` });
        return true;
      }

      // Nếu vẫn FAILED, fallback sang mở ứng dụng SMS
      console.log('[SMS] Gửi tự động thất bại, fallback mở app SMS');
      toast.warning('Gửi SMS nền thất bại', {
        description: 'Đang mở ứng dụng SMS để gửi thủ công...',
      });
      return await openSmsApp(phoneNumber, message);
    }

    // Trạng thái khác (PENDING, etc.) - fallback mở app
    console.log('[SMS] Trạng thái không xác định, fallback mở app SMS');
    return await openSmsApp(phoneNumber, message);
  } catch (error: any) {
    console.error('[SMS] Lỗi:', error);

    toast.error('Không thể gửi SMS tự động', {
      description: 'Đang thử mở ứng dụng SMS...',
    });

    // Fallback mở ứng dụng SMS
    return await openSmsApp(phoneNumber, message);
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
