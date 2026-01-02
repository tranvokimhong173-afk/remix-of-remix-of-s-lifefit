import { useState, useEffect, useCallback } from 'react';

export type SmsMode = 'auto' | 'compose';

const SMS_MODE_KEY = 'sms_mode';

export const useSmsMode = () => {
  const [smsMode, setSmsMode] = useState<SmsMode>('auto');

  useEffect(() => {
    const saved = localStorage.getItem(SMS_MODE_KEY);
    if (saved === 'auto' || saved === 'compose') {
      setSmsMode(saved);
    }
  }, []);

  const updateSmsMode = useCallback((mode: SmsMode) => {
    setSmsMode(mode);
    localStorage.setItem(SMS_MODE_KEY, mode);
  }, []);

  return { smsMode, updateSmsMode };
};

export const getSmsMode = (): SmsMode => {
  const saved = localStorage.getItem(SMS_MODE_KEY);
  return saved === 'compose' ? 'compose' : 'auto';
};
