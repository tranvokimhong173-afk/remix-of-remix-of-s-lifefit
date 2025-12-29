import { Bluetooth, BluetoothOff, Loader2, AlertCircle, Wifi, WifiOff, Cloud, CloudOff, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBluetooth, BLEHealthData } from "@/hooks/useBluetooth";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useEmailAlert } from "@/hooks/useEmailAlert";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";

interface BLEConnectionProps {
  onDataReceived: (data: BLEHealthData) => void;
  highContrast?: boolean;
}

const BLEConnection = ({ onDataReceived, highContrast = false }: BLEConnectionProps) => {
  const isNative = Capacitor.isNativePlatform();
  
  const {
    isOnline,
    pendingCount,
    isSyncing,
    saveOfflineRecord,
    syncPendingRecords,
  } = useOfflineSync();

  const { checkVitalsAndSendEmail } = useEmailAlert();

  const handleDataReceived = async (data: BLEHealthData) => {
    // Save to offline storage first
    saveOfflineRecord(data);
    
    // Check vitals and send email alert if abnormal
    await checkVitalsAndSendEmail({
      bpm: data.bpm,
      temp: data.temp,
      spo2: data.spo2,
      fallStatus: data.fallStatus,
      latitude: data.lat,
      longitude: data.lng,
    });
    
    // Then call parent callback
    onDataReceived(data);
  };

  const {
    isConnected,
    isConnecting,
    isSupported,
    deviceName,
    lastData,
    error,
    connect,
    disconnect
  } = useBluetooth(handleDataReceived);

  const handleManualSync = async () => {
    if (isOnline && pendingCount > 0) {
      await syncPendingRecords();
    }
  };

  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      highContrast ? "bg-black border-white" : "border-primary/20 bg-card",
      isConnected && !highContrast && "border-green-500/50 bg-green-50/30 dark:bg-green-950/20"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className={cn(
          "flex items-center gap-3 text-lg",
          highContrast ? "text-white" : "text-foreground"
        )}>
          <div className={cn(
            "p-2 rounded-xl",
            highContrast ? "bg-white" : isConnected ? "bg-green-100 dark:bg-green-900" : "bg-primary/10"
          )}>
            {isConnected ? (
              <Bluetooth className={cn(
                "h-5 w-5",
                highContrast ? "text-black" : "text-green-600 dark:text-green-400"
              )} />
            ) : (
              <BluetoothOff className={cn(
                "h-5 w-5",
                highContrast ? "text-black" : "text-muted-foreground"
              )} />
            )}
          </div>
          <span>Kết nối Bluetooth (BLE)</span>
          
          <div className="ml-auto flex items-center gap-2">
            {/* Network Status Badge */}
            <Badge variant={isOnline ? "outline" : "secondary"} className={cn(
              "text-xs",
              isOnline 
                ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300" 
                : "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300"
            )}>
              {isOnline ? (
                <><Wifi className="h-3 w-3 mr-1" /> Online</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
              )}
            </Badge>
            
            {/* Pending Sync Badge */}
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300">
                {isSyncing ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sync...</>
                ) : (
                  <><CloudOff className="h-3 w-3 mr-1" /> {pendingCount}</>
                )}
              </Badge>
            )}
            
            {/* Connection Status */}
            {isConnected && (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300">
                Đã kết nối
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Cảnh báo không hỗ trợ */}
        {!isSupported && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isNative 
                ? "Vui lòng cấp quyền Bluetooth cho ứng dụng trong cài đặt."
                : "Trình duyệt không hỗ trợ Web Bluetooth. Vui lòng sử dụng Chrome, Edge, hoặc Opera trên máy tính."
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Lỗi kết nối */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Offline Mode Indicator */}
        {!isOnline && (
          <Alert className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
            <WifiOff className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              <strong>Chế độ Offline:</strong> Dữ liệu sẽ được lưu cục bộ và tự động đồng bộ khi có mạng.
              {pendingCount > 0 && ` (${pendingCount} bản ghi chờ đồng bộ)`}
            </AlertDescription>
          </Alert>
        )}

        {/* Thông tin thiết bị */}
        {isConnected && deviceName && (
          <div className={cn(
            "p-3 rounded-lg",
            highContrast ? "bg-gray-800" : "bg-muted"
          )}>
            <p className={cn(
              "text-sm font-medium",
              highContrast ? "text-white" : "text-foreground"
            )}>
              Thiết bị: <span className="text-primary">{deviceName}</span>
            </p>
            {lastData && (
              <p className={cn(
                "text-xs mt-1",
                highContrast ? "text-gray-300" : "text-muted-foreground"
              )}>
                Dữ liệu mới nhất: BPM {lastData.bpm}, SpO2 {lastData.spo2}%, Temp {lastData.temp}°C
              </p>
            )}
          </div>
        )}

        {/* Hướng dẫn */}
        {!isConnected && (
          <div className={cn(
            "p-3 rounded-lg text-sm",
            highContrast ? "bg-gray-800 text-gray-300" : "bg-muted text-muted-foreground"
          )}>
            <p className="font-medium mb-2">Hướng dẫn kết nối vòng tay:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Đeo vòng tay S-Life Health Band và bật nguồn</li>
              <li>Vào Cài đặt điện thoại → Bật Bluetooth</li>
              <li>Quay lại app, nhấn "Kết nối BLE"</li>
              <li>Chọn thiết bị "S-Life Health Band" từ danh sách</li>
              <li>Chờ kết nối thành công và bắt đầu theo dõi</li>
            </ol>
          </div>
        )}

        {/* Nút kết nối/ngắt kết nối */}
        <div className="flex gap-3">
          {isConnected ? (
            <>
              <Button 
                variant="destructive" 
                onClick={disconnect}
                className="flex-1"
              >
                <BluetoothOff className="h-4 w-4 mr-2" />
                Ngắt kết nối
              </Button>
              {pendingCount > 0 && isOnline && (
                <Button 
                  variant="outline" 
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-4"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                </Button>
              )}
            </>
          ) : (
            <Button 
              onClick={connect} 
              disabled={!isSupported || isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Đang kết nối...
                </>
              ) : (
                <>
                  <Bluetooth className="h-4 w-4 mr-2" />
                  Kết nối BLE
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BLEConnection;
