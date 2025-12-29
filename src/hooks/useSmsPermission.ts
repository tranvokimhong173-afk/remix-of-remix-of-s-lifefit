import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    cordova?: {
      plugins?: {
        permissions?: {
          checkPermission: (permission: string, successCallback: (status: { hasPermission: boolean }) => void, errorCallback: (error: any) => void) => void;
          requestPermission: (permission: string, successCallback: (status: { hasPermission: boolean }) => void, errorCallback: (error: any) => void) => void;
        };
      };
    };
  }
}

const SMS_PERMISSION = 'android.permission.SEND_SMS';

export const useSmsPermission = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkSmsPermission = useCallback(async (): Promise<boolean> => {
    // Chỉ chạy trên Android native
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      console.log('[SMS Permission] Không phải Android native, bỏ qua');
      setHasPermission(true);
      return true;
    }

    return new Promise((resolve) => {
      const permissions = window.cordova?.plugins?.permissions;
      
      if (!permissions) {
        console.log('[SMS Permission] Plugin permissions chưa sẵn sàng');
        resolve(false);
        return;
      }

      permissions.checkPermission(
        SMS_PERMISSION,
        (status) => {
          console.log('[SMS Permission] Check result:', status.hasPermission);
          setHasPermission(status.hasPermission);
          resolve(status.hasPermission);
        },
        (error) => {
          console.error('[SMS Permission] Check error:', error);
          setHasPermission(false);
          resolve(false);
        }
      );
    });
  }, []);

  const requestSmsPermission = useCallback(async (): Promise<boolean> => {
    // Chỉ chạy trên Android native
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      console.log('[SMS Permission] Không phải Android native, bỏ qua');
      return true;
    }

    setIsChecking(true);

    return new Promise((resolve) => {
      const permissions = window.cordova?.plugins?.permissions;
      
      if (!permissions) {
        console.log('[SMS Permission] Plugin permissions chưa sẵn sàng, thử lại sau 1s');
        // Thử lại sau 1 giây nếu plugin chưa load
        setTimeout(async () => {
          const retryPermissions = window.cordova?.plugins?.permissions;
          if (!retryPermissions) {
            console.error('[SMS Permission] Plugin vẫn chưa sẵn sàng');
            setIsChecking(false);
            resolve(false);
            return;
          }

          retryPermissions.requestPermission(
            SMS_PERMISSION,
            (status) => {
              console.log('[SMS Permission] Request result (retry):', status.hasPermission);
              setHasPermission(status.hasPermission);
              setIsChecking(false);
              resolve(status.hasPermission);
            },
            (error) => {
              console.error('[SMS Permission] Request error (retry):', error);
              setHasPermission(false);
              setIsChecking(false);
              resolve(false);
            }
          );
        }, 1000);
        return;
      }

      permissions.requestPermission(
        SMS_PERMISSION,
        (status) => {
          console.log('[SMS Permission] Request result:', status.hasPermission);
          setHasPermission(status.hasPermission);
          setIsChecking(false);
          resolve(status.hasPermission);
        },
        (error) => {
          console.error('[SMS Permission] Request error:', error);
          setHasPermission(false);
          setIsChecking(false);
          resolve(false);
        }
      );
    });
  }, []);

  // Tự động xin quyền khi component mount
  useEffect(() => {
    const initPermission = async () => {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        setHasPermission(true);
        return;
      }

      // Đợi device ready
      const checkAndRequest = async () => {
        const hasIt = await checkSmsPermission();
        if (!hasIt) {
          console.log('[SMS Permission] Chưa có quyền, đang xin...');
          await requestSmsPermission();
        }
      };

      // Đợi 500ms để đảm bảo Cordova plugins đã load
      setTimeout(checkAndRequest, 500);
    };

    initPermission();
  }, [checkSmsPermission, requestSmsPermission]);

  return {
    hasPermission,
    isChecking,
    checkSmsPermission,
    requestSmsPermission,
  };
};
