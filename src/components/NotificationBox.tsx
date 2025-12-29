import { useState, useEffect, useRef } from "react";
import { Bell, Trash2 } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Badge } from "./ui/badge";

interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface NotificationBoxProps {
  userId: string;
}

type FilterType = "all" | "critical" | "warning" | "info";

const NotificationBox = ({ userId }: NotificationBoxProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [readAlerts, setReadAlerts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("readBellAlerts");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const prevCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifications.filter(n => !readAlerts.has(n.id)).length;

  const getSeverity = (type: string): FilterType => {
    const lower = type.toLowerCase();
    if (lower.includes("critical") || lower.includes("heart") || lower.includes("emergency")) return "critical";
    if (lower.includes("warning") || lower.includes("high") || lower.includes("low")) return "warning";
    return "info";
  };

  const filteredNotifications = notifications.filter(n => 
    filter === "all" ? true : getSeverity(n.type) === filter
  );

  // Play alert sound when new notification arrives
  useEffect(() => {
    if (notifications.length > prevCountRef.current && prevCountRef.current > 0) {
      playAlertSound();
      toast({
        title: "Cảnh báo sức khỏe mới",
        description: "Bạn có thông báo sức khỏe mới cần xem",
        variant: "destructive",
      });
    }
    prevCountRef.current = notifications.length;
  }, [notifications.length]);

  const playAlertSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVAUCkKL0++8hF03JHq34NapYC0MMXzI6cKOcDgSLnTB5cqhYjQVL3K/5M6kZDYWL3K95M+mZjcXLnC75c+oaDgYLm65");
    }
    audioRef.current.play().catch(console.error);
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(firestore, "alerts", notificationId));
      toast({
        title: "Đã xóa thông báo",
        description: "Thông báo đã được xóa thành công",
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa thông báo",
        variant: "destructive",
      });
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const deletePromises = notifications.map(n => deleteDoc(doc(firestore, "alerts", n.id)));
      await Promise.all(deletePromises);
      toast({
        title: "Đã xóa tất cả",
        description: "Tất cả thông báo đã được xóa",
      });
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xóa tất cả thông báo",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadAlerts(allIds);
    localStorage.setItem("readBellAlerts", JSON.stringify([...allIds]));
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
        } as Notification));
        setNotifications(data);
      },
      (error) => {
        console.error("Error listening to alerts:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString("vi-VN");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Thông báo</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-primary hover:underline"
                >
                  Đánh dấu đã đọc
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={deleteAllNotifications}
                  className="text-xs text-destructive hover:underline"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(["all", "critical", "warning", "info"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === f 
                  ? f === "critical" ? "bg-destructive text-destructive-foreground"
                    : f === "warning" ? "bg-yellow-500 text-white"
                    : f === "info" ? "bg-blue-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? "Tất cả" : f === "critical" ? "Nghiêm trọng" : f === "warning" ? "Cảnh báo" : "Thông tin"}
            </button>
          ))}
        </div>
        
        <ScrollArea className="h-[calc(100vh-12rem)] mt-4">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Không có thông báo nào</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Không có thông báo {filter !== "all" ? "trong danh mục này" : ""}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => {
                const isUnread = !readAlerts.has(notification.id);
                const severity = getSeverity(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isUnread 
                        ? severity === "critical" ? "bg-destructive/10 border-destructive/30"
                          : severity === "warning" ? "bg-yellow-500/10 border-yellow-500/30"
                          : "bg-blue-500/10 border-blue-500/30"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-sm capitalize">{notification.type} Alert</h4>
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <div className="h-2 w-2 rounded-full bg-destructive flex-shrink-0 animate-pulse" />
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Xóa thông báo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationBox;
