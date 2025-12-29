import { useState, useEffect } from "react";
import { AlertTriangle, Shield, Activity } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { ScrollArea } from "./ui/scroll-area";

interface NotificationFeedProps {
  userId: string;
}

interface AlertData {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read?: boolean;
}

const NotificationFeed = ({ userId }: NotificationFeedProps) => {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [readAlerts, setReadAlerts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("readAlerts");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const unreadCount = alerts.filter(a => !readAlerts.has(a.id)).length;

  const markAllAsRead = () => {
    const allIds = new Set(alerts.map(a => a.id));
    setReadAlerts(allIds);
    localStorage.setItem("readAlerts", JSON.stringify([...allIds]));
  };

  useEffect(() => {
    // Listen to real-time updates from Firestore alerts collection
    const q = query(collection(firestore, "alerts"), orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as AlertData));
        setAlerts(data);
      },
      (error) => {
        console.error("Error listening to alerts:", error);
        // If Firestore is not enabled, disable the component
        if (error.code === "permission-denied") {
          setIsEnabled(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  if (!isEnabled) {
    return (
      <Alert className="border-warning bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Firestore chưa được kích hoạt</AlertTitle>
        <AlertDescription>
          Vui lòng kích hoạt Cloud Firestore API trong Firebase Console để sử dụng tính năng thông báo.
        </AlertDescription>
      </Alert>
    );
  }

  if (alerts.length === 0) {
    return (
      <Alert className="border-primary bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertTitle>Không có cảnh báo</AlertTitle>
        <AlertDescription>
          Tất cả các chỉ số sức khỏe của bạn đang ở mức bình thường.
        </AlertDescription>
      </Alert>
    );
  }

  const getAlertVariant = (type: string) => {
    switch (type) {
      case "critical":
      case "high":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "default";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical":
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <h2 className="text-xl font-bold text-foreground">Thông báo Sức khỏe</h2>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="text-sm text-primary hover:underline"
          >
            Đánh dấu đã đọc
          </button>
        )}
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-4">
          {/* Individual Alerts */}
          {alerts.map((alert) => {
            const isUnread = !readAlerts.has(alert.id);
            return (
              <Alert 
                key={alert.id} 
                variant={getAlertVariant(alert.type) as "default" | "destructive"}
                className={`relative ${
                  alert.type === "critical" || alert.type === "high"
                    ? "border-destructive bg-destructive/10"
                    : "border-warning bg-warning/10"
                }`}
              >
                {isUnread && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
                )}
                {getAlertIcon(alert.type)}
                <AlertTitle className="capitalize">{alert.type} Alert</AlertTitle>
                <AlertDescription className="mt-2">
                  {alert.message}
                  {alert.timestamp && (
                    <span className="block text-xs text-muted-foreground mt-2">
                      {new Date(alert.timestamp).toLocaleString("vi-VN")}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NotificationFeed;
