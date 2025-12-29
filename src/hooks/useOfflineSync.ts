import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BLEHealthData } from './useBluetooth';

interface OfflineHealthRecord {
  id: string;
  bpm: number | null;
  spo2: number | null;
  temperature: number | null;
  fall_status: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  distance: number | null;
  recorded_at: string;
  synced: boolean;
}

const STORAGE_KEY = 'offline_health_records';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingRecords, setPendingRecords] = useState<OfflineHealthRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load pending records from localStorage
  const loadPendingRecords = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records = JSON.parse(stored) as OfflineHealthRecord[];
        setPendingRecords(records.filter(r => !r.synced));
      }
    } catch (error) {
      console.error('Error loading offline records:', error);
    }
  }, []);

  // Save record to localStorage
  const saveOfflineRecord = useCallback((data: BLEHealthData) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const records: OfflineHealthRecord[] = stored ? JSON.parse(stored) : [];
      
      const newRecord: OfflineHealthRecord = {
        id: crypto.randomUUID(),
        bpm: data.bpm,
        spo2: data.spo2,
        temperature: data.temp,
        fall_status: data.fallStatus || 'normal',
        latitude: data.lat,
        longitude: data.lng,
        speed: data.speed,
        distance: data.distance,
        recorded_at: new Date().toISOString(),
        synced: false,
      };
      
      records.push(newRecord);
      
      // Keep only last 1000 records to prevent storage overflow
      const trimmedRecords = records.slice(-1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedRecords));
      
      setPendingRecords(prev => [...prev, newRecord]);
      
      console.log('Saved offline record:', newRecord);
      return newRecord;
    } catch (error) {
      console.error('Error saving offline record:', error);
      return null;
    }
  }, []);

  // Sync pending records to Supabase
  const syncPendingRecords = useCallback(async () => {
    if (!isOnline || isSyncing || pendingRecords.length === 0) return;

    setIsSyncing(true);
    console.log(`Syncing ${pendingRecords.length} pending records...`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No user logged in, skipping sync');
        setIsSyncing(false);
        return;
      }

      const recordsToSync = pendingRecords.map(record => ({
        user_id: user.id,
        bpm: record.bpm,
        spo2: record.spo2,
        temperature: record.temperature,
        fall_status: record.fall_status,
        latitude: record.latitude,
        longitude: record.longitude,
        speed: record.speed,
        distance: record.distance,
        recorded_at: record.recorded_at,
      }));

      const { error } = await supabase
        .from('health_records')
        .insert(recordsToSync);

      if (error) {
        console.error('Error syncing records:', error);
        toast.error('Lỗi đồng bộ dữ liệu');
      } else {
        // Mark records as synced
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const allRecords: OfflineHealthRecord[] = JSON.parse(stored);
          const syncedIds = new Set(pendingRecords.map(r => r.id));
          const updatedRecords = allRecords.map(r => 
            syncedIds.has(r.id) ? { ...r, synced: true } : r
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedRecords));
        }
        
        setPendingRecords([]);
        toast.success(`Đã đồng bộ ${recordsToSync.length} bản ghi lên cloud`);
        console.log(`Successfully synced ${recordsToSync.length} records`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Lỗi kết nối khi đồng bộ');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, pendingRecords]);

  // Clear all synced records from localStorage
  const clearSyncedRecords = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records: OfflineHealthRecord[] = JSON.parse(stored);
        const unsyncedRecords = records.filter(r => !r.synced);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(unsyncedRecords));
      }
    } catch (error) {
      console.error('Error clearing synced records:', error);
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Đã kết nối mạng - Đang đồng bộ dữ liệu...');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mất kết nối mạng - Dữ liệu sẽ được lưu offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending records on mount
  useEffect(() => {
    loadPendingRecords();
  }, [loadPendingRecords]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingRecords.length > 0) {
      syncPendingRecords();
    }
  }, [isOnline, pendingRecords.length, syncPendingRecords]);

  return {
    isOnline,
    pendingRecords,
    pendingCount: pendingRecords.length,
    isSyncing,
    saveOfflineRecord,
    syncPendingRecords,
    clearSyncedRecords,
  };
};
