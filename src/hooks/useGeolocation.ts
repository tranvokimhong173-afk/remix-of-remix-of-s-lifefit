import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position, WatchPositionCallback } from '@capacitor/geolocation';
import { toast } from 'sonner';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  isLoading: boolean;
  isWatching: boolean;
}

const initialState: GeolocationState = {
  latitude: null,
  longitude: null,
  accuracy: null,
  altitude: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null,
  timestamp: null,
  error: null,
  isLoading: true,
  isWatching: false
};

export const useGeolocation = (enableHighAccuracy: boolean = true) => {
  const [state, setState] = useState<GeolocationState>(initialState);
  const watchIdRef = useRef<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (isNative) {
        const permission = await Geolocation.requestPermissions();
        if (permission.location === 'granted' || permission.coarseLocation === 'granted') {
          return true;
        }
        toast.error('Vui lòng cấp quyền vị trí để sử dụng tính năng này');
        return false;
      } else {
        // Web browser
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'granted' || permission.state === 'prompt') {
          return true;
        }
        toast.error('Vui lòng cấp quyền vị trí trong cài đặt trình duyệt');
        return false;
      }
    } catch (error) {
      console.error('Error requesting geolocation permissions:', error);
      return false;
    }
  }, [isNative]);

  // Get current position
  const getCurrentPosition = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Không có quyền truy cập vị trí'
        }));
        return;
      }

      if (isNative) {
        const position: Position = await Geolocation.getCurrentPosition({
          enableHighAccuracy,
          timeout: 10000
        });

        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          timestamp: position.timestamp,
          error: null,
          isLoading: false,
          isWatching: state.isWatching
        });
      } else {
        // Web browser fallback
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setState({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
              error: null,
              isLoading: false,
              isWatching: state.isWatching
            });
          },
          (error) => {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: error.message
            }));
          },
          { enableHighAccuracy, timeout: 10000 }
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      console.error('Error getting current position:', error);
    }
  }, [enableHighAccuracy, isNative, requestPermissions, state.isWatching]);

  // Start watching position
  const startWatching = useCallback(async () => {
    if (watchIdRef.current) {
      console.log('Already watching position');
      return;
    }

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setState(prev => ({
          ...prev,
          error: 'Không có quyền truy cập vị trí'
        }));
        return;
      }

      setState(prev => ({ ...prev, isWatching: true, error: null }));

      if (isNative) {
        const callback: WatchPositionCallback = (position, err) => {
          if (err) {
            setState(prev => ({
              ...prev,
              error: err.message
            }));
            return;
          }

          if (position) {
            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
              error: null,
              isLoading: false
            }));
          }
        };

        watchIdRef.current = await Geolocation.watchPosition(
          { enableHighAccuracy },
          callback
        );
      } else {
        // Web browser fallback
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            setState(prev => ({
              ...prev,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp,
              error: null,
              isLoading: false
            }));
          },
          (error) => {
            setState(prev => ({
              ...prev,
              error: error.message
            }));
          },
          { enableHighAccuracy, timeout: 10000 }
        );
        watchIdRef.current = watchId.toString();
      }

      console.log('Started watching position');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      setState(prev => ({
        ...prev,
        isWatching: false,
        error: errorMessage
      }));
      console.error('Error starting position watch:', error);
    }
  }, [enableHighAccuracy, isNative, requestPermissions]);

  // Stop watching position
  const stopWatching = useCallback(async () => {
    if (!watchIdRef.current) {
      return;
    }

    try {
      if (isNative) {
        await Geolocation.clearWatch({ id: watchIdRef.current });
      } else {
        navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
      }

      watchIdRef.current = null;
      setState(prev => ({ ...prev, isWatching: false }));
      console.log('Stopped watching position');
    } catch (error) {
      console.error('Error stopping position watch:', error);
    }
  }, [isNative]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        if (isNative) {
          Geolocation.clearWatch({ id: watchIdRef.current });
        } else {
          navigator.geolocation.clearWatch(parseInt(watchIdRef.current));
        }
      }
    };
  }, [isNative]);

  // Auto-start watching on mount
  useEffect(() => {
    startWatching();
    return () => {
      stopWatching();
    };
  }, []);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    requestPermissions
  };
};
