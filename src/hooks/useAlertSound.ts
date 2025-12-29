import { useRef, useCallback, useMemo } from 'react';
import { UserProfile } from '@/services/userProfileService';
import { calculateVitalThresholds, VitalThresholds } from '@/utils/vitalThresholds';

// Default thresholds for backward compatibility
export const VITAL_THRESHOLDS = {
  bpm: { min: 60, max: 100 },
  temp: { min: 35.5, max: 37.5 },
  spo2: { min: 95, max: 100 },
};

interface UseAlertSoundOptions {
  userProfile?: UserProfile | null;
}

export const useAlertSound = (options: UseAlertSoundOptions = {}) => {
  const { userProfile } = options;
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastAlertTimeRef = useRef<number>(0);
  const lastFallAlertTimeRef = useRef<number>(0);
  const cooldownMs = 5000; // 5 seconds cooldown between alerts
  const fallCooldownMs = 3000; // 3 seconds cooldown for fall alerts

  // Tính toán ngưỡng động dựa trên profile người dùng
  const dynamicThresholds = useMemo<VitalThresholds>(() => {
    return calculateVitalThresholds(userProfile ?? null);
  }, [userProfile]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }, []);

  const playAlertSound = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTimeRef.current < cooldownMs) {
      return; // Still in cooldown
    }
    lastAlertTimeRef.current = now;

    try {
      const ctx = getAudioContext();

      // Create oscillator for alert beep
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Alert sound pattern: 3 beeps
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note

      // Envelope for beeps
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      
      // Beep 1
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      
      // Beep 2
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.25);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      
      // Beep 3
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.45);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.6);
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  }, [getAudioContext]);

  // Special urgent alarm for fall detection
  const playFallAlertSound = useCallback(() => {
    const now = Date.now();
    if (now - lastFallAlertTimeRef.current < fallCooldownMs) {
      return; // Still in cooldown
    }
    lastFallAlertTimeRef.current = now;

    try {
      const ctx = getAudioContext();

      // Create two oscillators for urgent siren effect
      const oscillator1 = ctx.createOscillator();
      const oscillator2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Siren pattern - alternating high/low tones
      oscillator1.type = 'square';
      oscillator2.type = 'square';
      
      // Frequency modulation for siren effect
      oscillator1.frequency.setValueAtTime(1200, ctx.currentTime);
      oscillator1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
      oscillator1.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.4);
      oscillator1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.6);
      oscillator1.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.8);
      oscillator1.frequency.linearRampToValueAtTime(800, ctx.currentTime + 1.0);

      oscillator2.frequency.setValueAtTime(600, ctx.currentTime);
      oscillator2.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.2);
      oscillator2.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.4);
      oscillator2.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.6);
      oscillator2.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.8);
      oscillator2.frequency.linearRampToValueAtTime(400, ctx.currentTime + 1.0);

      // Volume envelope
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime + 0.95);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);

      oscillator1.start(ctx.currentTime);
      oscillator2.start(ctx.currentTime);
      oscillator1.stop(ctx.currentTime + 1.0);
      oscillator2.stop(ctx.currentTime + 1.0);
    } catch (error) {
      console.error('Error playing fall alert sound:', error);
    }
  }, [getAudioContext]);

  const checkVitalsAndAlert = useCallback((bpm: number, temp: number, spo2: number) => {
    const thresholds = dynamicThresholds;
    
    const isBpmAbnormal = bpm > 0 && (bpm < thresholds.bpm.min || bpm > thresholds.bpm.max);
    const isTempAbnormal = temp > 0 && (temp < thresholds.temp.min || temp > thresholds.temp.max);
    const isSpo2Abnormal = spo2 > 0 && spo2 < thresholds.spo2.min;

    if (isBpmAbnormal || isTempAbnormal || isSpo2Abnormal) {
      playAlertSound();
      return true;
    }
    return false;
  }, [playAlertSound, dynamicThresholds]);

  return { 
    playAlertSound, 
    playFallAlertSound, 
    checkVitalsAndAlert, 
    dynamicThresholds,
    VITAL_THRESHOLDS: dynamicThresholds // Alias for backward compatibility
  };
};
