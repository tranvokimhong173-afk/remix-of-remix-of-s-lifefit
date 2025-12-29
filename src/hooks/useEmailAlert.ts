import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export const useEmailAlert = (userId: string = 'device1') => {
  const lastEmailTimeRef = useRef<number>(0);
  const EMAIL_COOLDOWN = 60000; // 1 minute cooldown between emails

  const sendAlertEmail = useCallback(async (
    alertType: 'vital' | 'fall' | 'zone',
    title: string,
    message: string,
    vitals?: { bpm?: number; spo2?: number; temperature?: number },
    location?: { latitude: number; longitude: number }
  ) => {
    const now = Date.now();
    if (now - lastEmailTimeRef.current < EMAIL_COOLDOWN) {
      console.log('Email alert skipped - within cooldown period');
      return false;
    }

    try {
      // Get user profile to get email
      const profile = await getUserProfile(userId);
      if (!profile || !profile.email) {
        console.log('No email configured for user');
        return false;
      }

      console.log(`Sending ${alertType} alert email to ${profile.email}`);

      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: {
          recipientEmail: profile.email,
          recipientName: profile.name || 'Người dùng',
          alertType,
          alertDetails: {
            title,
            message,
            vitals,
            location,
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) {
        console.error('Error invoking edge function:', error);
        toast.error('Lỗi kết nối server gửi email');
        return false;
      }

      // Kiểm tra response từ edge function
      if (data && data.success === false) {
        console.error('Email send failed:', data.error, data.details);
        const errorMsg = data.error || 'Không rõ lỗi';
        // Thông báo chi tiết cho người dùng
        if (errorMsg.includes('verify') || errorMsg.includes('domain')) {
          toast.error('Email không gửi được', {
            description: 'Resend chưa xác minh domain. Liên hệ admin để cấu hình.',
          });
        } else {
          toast.error('Lỗi gửi email', { description: errorMsg });
        }
        return false;
      }

      lastEmailTimeRef.current = now;
      console.log('Alert email sent successfully:', data);
      toast.success('Đã gửi email cảnh báo!');
      return true;
    } catch (error: any) {
      console.error('Error in sendAlertEmail:', error);
      toast.error('Lỗi gửi email', { description: error?.message || 'Vui lòng thử lại' });
      return false;
    }
  }, [userId]);

  const checkVitalsAndSendEmail = useCallback(async (data: VitalData) => {
    const alerts: string[] = [];
    const abnormalVitals: { bpm?: number; spo2?: number; temperature?: number } = {};

    // Check heart rate
    if (data.bpm > 0) {
      if (data.bpm < VITAL_THRESHOLDS.bpm.min) {
        alerts.push(`Nhịp tim quá thấp: ${data.bpm} BPM (< ${VITAL_THRESHOLDS.bpm.min})`);
        abnormalVitals.bpm = data.bpm;
      } else if (data.bpm > VITAL_THRESHOLDS.bpm.max) {
        alerts.push(`Nhịp tim quá cao: ${data.bpm} BPM (> ${VITAL_THRESHOLDS.bpm.max})`);
        abnormalVitals.bpm = data.bpm;
      }
    }

    // Check temperature
    if (data.temp > 0) {
      if (data.temp < VITAL_THRESHOLDS.temp.min) {
        alerts.push(`Nhiệt độ quá thấp: ${data.temp}°C (< ${VITAL_THRESHOLDS.temp.min})`);
        abnormalVitals.temperature = data.temp;
      } else if (data.temp > VITAL_THRESHOLDS.temp.max) {
        alerts.push(`Nhiệt độ quá cao: ${data.temp}°C (> ${VITAL_THRESHOLDS.temp.max})`);
        abnormalVitals.temperature = data.temp;
      }
    }

    // Check SpO2
    if (data.spo2 > 0 && data.spo2 < VITAL_THRESHOLDS.spo2.min) {
      alerts.push(`Nồng độ oxy máu thấp: ${data.spo2}% (< ${VITAL_THRESHOLDS.spo2.min})`);
      abnormalVitals.spo2 = data.spo2;
    }

    // Check fall status
    if (data.fallStatus === 'fall') {
      const location = data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : undefined;

      await sendAlertEmail(
        'fall',
        'PHÁT HIỆN TÉ NGÃ!',
        'Hệ thống phát hiện té ngã. Vui lòng kiểm tra ngay lập tức!',
        { bpm: data.bpm, spo2: data.spo2, temperature: data.temp },
        location
      );
      return true;
    }

    // Send combined alert if any abnormal vitals
    if (alerts.length > 0) {
      const location = data.latitude && data.longitude
        ? { latitude: data.latitude, longitude: data.longitude }
        : undefined;

      await sendAlertEmail(
        'vital',
        'Cảnh báo chỉ số sinh tồn bất thường!',
        alerts.join('. '),
        abnormalVitals,
        location
      );
      return true;
    }

    return false;
  }, [sendAlertEmail]);

  const sendZoneAlert = useCallback(async (
    isOutside: boolean,
    location: { latitude: number; longitude: number }
  ) => {
    if (!isOutside) return false;

    await sendAlertEmail(
      'zone',
      'Cảnh báo rời khỏi vùng an toàn!',
      'Người dùng đã di chuyển ra khỏi vùng an toàn đã cấu hình.',
      undefined,
      location
    );
    return true;
  }, [sendAlertEmail]);

  return {
    sendAlertEmail,
    checkVitalsAndSendEmail,
    sendZoneAlert,
  };
};
