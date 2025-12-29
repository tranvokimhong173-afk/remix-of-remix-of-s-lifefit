import { useState, useCallback, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient, BleDevice, dataViewToText } from '@capacitor-community/bluetooth-le';

// BLE Service và Characteristic UUIDs - phải khớp với ESP32
const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
const CHARACTERISTIC_UUID = '87654321-4321-4321-4321-cba987654321';

export interface BLEHealthData {
  bpm: number;
  spo2: number;
  temp: number;
  speed: number;
  distance: number;
  lat: number;
  lng: number;
  fallStatus: string;
}

export interface UseBluetoothReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isSupported: boolean;
  deviceName: string | null;
  lastData: BLEHealthData | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useBluetooth = (onDataReceived?: (data: BLEHealthData) => void): UseBluetoothReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastData, setLastData] = useState<BLEHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const deviceRef = useRef<BleDevice | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // Check BLE support
  useEffect(() => {
    const checkSupport = async () => {
      if (isNative) {
        try {
          await BleClient.initialize();
          setIsSupported(true);
        } catch (err) {
          console.error('BLE init error:', err);
          setIsSupported(false);
        }
      } else {
        // Web Bluetooth API check
        setIsSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator);
      }
    };
    checkSupport();
  }, [isNative]);

  // Parse BLE data
  const parseData = useCallback((jsonString: string) => {
    try {
      const data: BLEHealthData = JSON.parse(jsonString);
      setLastData(data);
      setError(null);
      if (onDataReceived) {
        onDataReceived(data);
      }
      console.log('BLE Data received:', data);
    } catch (err) {
      console.error('Error parsing BLE data:', err);
      setError('Lỗi đọc dữ liệu từ thiết bị');
    }
  }, [onDataReceived]);

  // Native Capacitor BLE connect
  const connectNative = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Request permissions on Android
      await BleClient.initialize();
      
      // Scan for devices
      const device = await BleClient.requestDevice({
        services: [SERVICE_UUID],
        namePrefix: 'S-Life'
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'S-Life Health Band');

      // Connect to device
      await BleClient.connect(device.deviceId, (deviceId) => {
        console.log('Device disconnected:', deviceId);
        setIsConnected(false);
        setDeviceName(null);
      });

      // Start notifications
      await BleClient.startNotifications(
        device.deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (value) => {
          const jsonString = dataViewToText(value);
          parseData(jsonString);
        }
      );

      setIsConnected(true);
      console.log('BLE Connected successfully (Native)!');

    } catch (err) {
      console.error('BLE Connection error:', err);
      if (err instanceof Error) {
        setError(err.message || 'Lỗi kết nối Bluetooth');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [parseData]);

  // Web Bluetooth connect
  const connectWeb = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [SERVICE_UUID] },
          { namePrefix: 'S-Life' }
        ],
        optionalServices: [SERVICE_UUID]
      });

      deviceRef.current = device;
      setDeviceName(device.name || 'S-Life Health Band');

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setDeviceName(null);
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error('Không thể kết nối GATT Server');

      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        if (value) {
          const decoder = new TextDecoder('utf-8');
          const jsonString = decoder.decode(value);
          parseData(jsonString);
        }
      });

      setIsConnected(true);
      console.log('BLE Connected successfully (Web)!');

    } catch (err) {
      console.error('BLE Connection error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          setError('Không tìm thấy thiết bị. Đảm bảo ESP32 đã bật.');
        } else {
          setError(err.message || 'Lỗi kết nối Bluetooth');
        }
      }
    } finally {
      setIsConnecting(false);
    }
  }, [parseData]);

  // Main connect function
  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('Bluetooth không được hỗ trợ trên thiết bị này.');
      return;
    }
    
    if (isNative) {
      await connectNative();
    } else {
      await connectWeb();
    }
  }, [isSupported, isNative, connectNative, connectWeb]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      if (isNative && deviceRef.current) {
        await BleClient.stopNotifications(
          deviceRef.current.deviceId,
          SERVICE_UUID,
          CHARACTERISTIC_UUID
        );
        await BleClient.disconnect(deviceRef.current.deviceId);
      } else if (deviceRef.current) {
        const device = deviceRef.current as any;
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }

    deviceRef.current = null;
    setIsConnected(false);
    setDeviceName(null);
    setLastData(null);
  }, [isNative]);

  return {
    isConnected,
    isConnecting,
    isSupported,
    deviceName,
    lastData,
    error,
    connect,
    disconnect
  };
};
