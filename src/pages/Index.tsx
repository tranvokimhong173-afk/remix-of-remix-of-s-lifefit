import { Heart, Thermometer, Navigation as NavigationIcon, Route, Move, Droplet, Eye } from "lucide-react";
import { Info, BookOpen, Mail } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { getUserProfile, UserProfile } from "@/services/userProfileService";
import Header from "@/components/Header";
import HeartRateAlert from "@/components/HeartRateAlert";
import VitalCard from "@/components/VitalCard";
import VitalsHistory from "@/components/VitalsHistory";
import DataHistoryTable from "@/components/DataHistoryTable";
import MapSection from "@/components/MapSection";
import InfoSection from "@/components/InfoSection";
import NotificationFeed from "@/components/NotificationFeed";
import HealthReport from "@/components/HealthReport";
import ThresholdDetailsTable from "@/components/ThresholdDetailsTable";
import BLEConnection from "@/components/BLEConnection";
import { Button } from "@/components/ui/button";
import { useAlertSound } from "@/hooks/useAlertSound";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { BLEHealthData } from "@/hooks/useBluetooth";

const MAX_HISTORY_ITEMS = 20;

const Index = () => {
  // Fixed device ID
  const userId = "device1";

  // High contrast mode for elderly
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem("highContrastMode") === "true";
  });

  const toggleHighContrast = () => {
    const newValue = !highContrast;
    setHighContrast(newValue);
    localStorage.setItem("highContrastMode", String(newValue));
  };

  // Real-time data state
  const [rtData, setRtData] = useState<any>({
    bpm: 0,
    temp: 36.5,
    speed: 0.0,
    distance: 0.0,
    fallStatus: "normal",
    spo2: 0,
    lat: 10.970737,
    lng: 107.330054
  });

  // History data for charts and table
  const [vitalsHistory, setVitalsHistory] = useState<Array<{
    timestamp: string;
    heartRate: number;
    temperature: number;
    spo2: number;
  }>>([]);

  const [tableHistory, setTableHistory] = useState<Array<{
    timestamp: string;
    position: string;
    heartRate: number;
    speed: number;
    temperature: number;
    spo2: number;
  }>>([]);

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Alert sound hook with dynamic thresholds based on user profile
  const alertOptions = useMemo(() => ({ userProfile }), [userProfile]);
  const { checkVitalsAndAlert, playFallAlertSound, dynamicThresholds } = useAlertSound(alertOptions);

  // Push notifications hook
  const { checkVitalsAndNotify } = usePushNotifications();

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    };
    loadProfile();
  }, [userId]);

  // Handler cho dữ liệu BLE từ ESP32
  const handleBLEData = useCallback((data: BLEHealthData) => {
    // Cập nhật dữ liệu realtime từ BLE
    setRtData(prev => ({
      ...prev,
      bpm: data.bpm,
      temp: data.temp,
      spo2: data.spo2,
      speed: data.speed,
      distance: data.distance,
      lat: data.lat,
      lng: data.lng,
      fallStatus: data.fallStatus
    }));

    // Kiểm tra và phát cảnh báo
    checkVitalsAndAlert(data.bpm, data.temp, data.spo2);
    
    // Gửi push notification nếu bất thường
    checkVitalsAndNotify({
      bpm: data.bpm,
      temp: data.temp,
      spo2: data.spo2,
      fallStatus: data.fallStatus
    });

    // Phát cảnh báo té ngã
    if (data.fallStatus === "fall") {
      playFallAlertSound();
    }

    // Thêm vào lịch sử
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    
    setVitalsHistory(prev => {
      const newHistory = [...prev, {
        timestamp,
        heartRate: data.bpm,
        temperature: data.temp,
        spo2: data.spo2
      }];
      return newHistory.slice(-MAX_HISTORY_ITEMS);
    });

    setTableHistory(prev => {
      const newHistory = [{
        timestamp,
        position: `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`,
        heartRate: data.bpm,
        speed: data.speed,
        temperature: data.temp,
        spo2: data.spo2
      }, ...prev];
      return newHistory.slice(0, MAX_HISTORY_ITEMS);
    });
  }, [checkVitalsAndAlert, checkVitalsAndNotify, playFallAlertSound]);

  // Setup real-time listener for location (separate path)
  useEffect(() => {
    const locationRef = ref(database, `healthData/location`);
    
    const unsubscribe = onValue(locationRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const lat = data.latitude || 10.970737;
        const lng = data.longitude || 107.330054;
        
        setRtData(prev => ({
          ...prev,
          lat,
          lng
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // Setup real-time listener for health data
  useEffect(() => {
    const healthDataRef = ref(database, `healthData/device1`);
    
    const unsubscribe = onValue(healthDataRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Handle temp as object {ambient_C, object_C, timestamp} or number
        const tempValue = typeof data.temp === 'object' && data.temp !== null 
          ? (data.temp.object_C || data.temp.ambient_C || 36.5)
          : (data.temp || 36.5);
        // Get fall status from nested path
        const fallStatus = data.fall?.status || "normal";
        
        const newRtData = {
          bpm: data.bpm || 0,
          temp: tempValue,
          speed: data.speed || 0.0,
          distance: data.distance || 0.0,
          fallStatus: fallStatus,
          spo2: data.spo2 || 0
        };
        
        setRtData(prev => ({
          ...prev,
          ...newRtData
        }));

        // Check vitals and play alert sound if abnormal
        checkVitalsAndAlert(newRtData.bpm, newRtData.temp, newRtData.spo2);

        // Check vitals and send push notification if abnormal
        checkVitalsAndNotify({
          bpm: newRtData.bpm,
          temp: newRtData.temp,
          spo2: newRtData.spo2,
          fallStatus: fallStatus
        });

        // Play special fall alert if fall detected
        if (fallStatus === "fall") {
          playFallAlertSound();
        }

        // Add to history
        const timestamp = new Date().toLocaleTimeString("vi-VN");
        
        setVitalsHistory(prev => {
          const newHistory = [...prev, {
            timestamp,
            heartRate: newRtData.bpm,
            temperature: newRtData.temp,
            spo2: newRtData.spo2
          }];
          return newHistory.slice(-MAX_HISTORY_ITEMS);
        });

        setTableHistory(prev => {
          const newHistory = [{
            timestamp,
            position: `Đang cập nhật...`,
            heartRate: newRtData.bpm,
            speed: newRtData.speed,
            temperature: newRtData.temp,
            spo2: newRtData.spo2
          }, ...prev];
          return newHistory.slice(0, MAX_HISTORY_ITEMS);
        });

        // Auto-send to backend API
        if (userProfile) {
          try {
            const response = await fetch('https://health-ai-project-4w0w6wcbv-kim-hongs-projects.vercel.app/api/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId,
                currentData: newRtData,
                history: [],
                age: userProfile.age,
                underlyingConditions: userProfile.conditions
              })
            });
            
            if (response.ok) {
              console.log('Health data sent to backend successfully');
            }
          } catch (error) {
            console.error('Error sending health data to backend:', error);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [userId, userProfile, checkVitalsAndAlert, checkVitalsAndNotify, playFallAlertSound]);

  return (
    <div className="min-h-screen bg-background">
      <Header userId={userId} />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Alert Section */}
        <HeartRateAlert heartRate={rtData.bpm} />
        
        {/* Notification Feed */}
        <NotificationFeed userId={userId} />

        {/* BLE Connection Section */}
        <BLEConnection 
          onDataReceived={handleBLEData}
          highContrast={highContrast}
        />
        
        {/* Title with High Contrast Toggle */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Tổng quan chỉ số sinh tồn
            </h2>
          </div>
          <Button
            variant={highContrast ? "default" : "outline"}
            size="sm"
            onClick={toggleHighContrast}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {highContrast ? "Tắt High Contrast" : "Bật High Contrast"}
          </Button>
        </div>
        
        {/* Vitals Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${highContrast ? "p-4 rounded-2xl bg-black" : ""}`}>
          <VitalCard
            title="Nhịp tim"
            value={rtData.bpm}
            unit="bpm"
            icon={Heart}
            variant={rtData.bpm > 0 && (rtData.bpm < dynamicThresholds.bpm.min || rtData.bpm > dynamicThresholds.bpm.max) ? "warning" : "primary"}
            highContrast={highContrast}
            thresholdInfo={`Ngưỡng: ${dynamicThresholds.bpm.min}-${dynamicThresholds.bpm.max}`}
          />
          <VitalCard
            title="Nhiệt độ cơ thể"
            value={rtData.temp}
            unit="°C"
            icon={Thermometer}
            variant={rtData.temp > 0 && (rtData.temp < dynamicThresholds.temp.min || rtData.temp > dynamicThresholds.temp.max) ? "warning" : "primary"}
            highContrast={highContrast}
            thresholdInfo={`Ngưỡng: ${dynamicThresholds.temp.min.toFixed(1)}-${dynamicThresholds.temp.max.toFixed(1)}`}
          />
          <VitalCard
            title="Nồng độ Oxy (SpO2)"
            value={rtData.spo2}
            unit="%"
            icon={Droplet}
            variant={rtData.spo2 > 0 && rtData.spo2 < dynamicThresholds.spo2.min ? "warning" : "primary"}
            highContrast={highContrast}
            thresholdInfo={`Ngưỡng: ≥${dynamicThresholds.spo2.min}%`}
          />
          <VitalCard
            title="Chuyển động & Tư thế"
            value=""
            unit=""
            icon={Move}
            status={
              rtData.fallStatus === "fall" ? "Phát hiện té ngã!" : 
              rtData.fallStatus === "moving" ? "Đang di chuyển" : 
              rtData.fallStatus === "standing" ? "Đang đứng yên" :
              rtData.fallStatus
            }
            variant={rtData.fallStatus === "fall" ? "warning" : "primary"}
            highContrast={highContrast}
          />
        </div>

        {/* Threshold Details Table */}
        <ThresholdDetailsTable 
          userProfile={userProfile}
          thresholds={dynamicThresholds}
          currentVitals={{
            bpm: rtData.bpm,
            temp: rtData.temp,
            spo2: rtData.spo2,
            fallStatus: rtData.fallStatus
          }}
          history={vitalsHistory}
        />

        {/* Personalized Health Report */}
        <HealthReport rtData={rtData} userProfile={userProfile} />

        {/* Map Section */}
        <MapSection 
          position={`${rtData.lat}, ${rtData.lng}`}
          safeRadius={`${userProfile?.safeZone?.radiusMeters ?? 100} m`}
          lat={rtData.lat}
          lng={rtData.lng}
          safeCenterLat={userProfile?.safeZone?.centerLat}
          safeCenterLng={userProfile?.safeZone?.centerLng}
        />

        {/* Vitals History Chart */}
        <VitalsHistory data={vitalsHistory} />

        {/* Data History Table */}
        <DataHistoryTable data={tableHistory} />

        {/* Info Sections */}
        <div className="space-y-4" id="intro">
          <InfoSection type="intro" title="Giới thiệu" icon={Info}>
            <p>
              S-Life được phát triển dựa trên nền tảng công nghệ IoT (Internet of Things) và AI Learning. 
              Chúng tôi tạo ra một hệ thống khép kín, nơi dữ liệu thu thập liên tục từ thiết bị đeo được xử lý 
              bởi thuật toán AI mạnh mẽ. Mục tiêu là cung cấp một công cụ không chỉ ghi lại mà còn dự đoán và 
              ngăn ngừa các rủi ro sức khỏe.
            </p>
            <p className="mt-4">
              Với giao diện web thân thiện, bạn có thể dễ dàng quản lý sức khỏe của cả gia đình và tận dụng 
              triệt để các tiện ích định vị và cảnh báo khẩn cấp tích hợp. S-Life - Định hình lại cách chúng ta 
              chăm sóc sức khỏe.
            </p>
          </InfoSection>

          <InfoSection type="guide" title="Hướng dẫn" icon={BookOpen}>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-primary mb-2">Bước 1: Khởi động và Thiết lập Ứng dụng</h3>
                <p className="text-muted-foreground">
                  <strong>Sạc đầy pin:</strong> Sạc đầy vòng tay S-Life bằng cáp sạc đi kèm.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-primary mb-2">Bước 2: Theo dõi Sức khỏe Hàng ngày</h3>
                <p className="text-muted-foreground mb-2">
                  Sau khi kết nối, vòng tay S-Life sẽ tự động theo dõi các chỉ số của bạn.
                </p>
                <p className="text-muted-foreground">
                  <strong>Đeo đúng cách:</strong> Đảm bảo vòng tay được đeo vừa vặn, không quá chặt hoặc 
                  quá lỏng, cách cổ tay khoảng 1-2 cm để cảm biến hoạt động chính xác.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Đồng bộ dữ liệu:</strong> Dữ liệu sẽ tự động đồng bộ khi vòng tay ở gần điện thoại 
                  có bật Bluetooth. Mở ứng dụng để xem báo cáo chi tiết về:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                  <li><strong>Hoạt động:</strong> Số bước chân, quãng đường, calo tiêu thụ.</li>
                  <li><strong>Nhịp tim & Sinh học:</strong> Nhịp tim liên tục, chất lượng giấc ngủ.</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  <strong>Bài tập:</strong> Sử dụng chế độ tập luyện trong ứng dụng để theo dõi các hoạt động 
                  cụ thể (chạy bộ, đạp xe, v.v.).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-primary mb-2">Bước 3: Tận dụng Chatbot AI Tư vấn Sức khỏe</h3>
                <p className="text-muted-foreground mb-2">
                  S-Life Health không chỉ là một ứng dụng theo dõi, nó là một trợ lý thông minh.
                </p>
                <p className="text-muted-foreground">
                  <strong>Truy cập Chatbot:</strong> Tìm biểu tượng hoặc mục "Tư vấn AI" trong ứng dụng S-Life Health.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Đặt câu hỏi:</strong> Bạn có thể hỏi bất kỳ điều gì liên quan đến sức khỏe, ví dụ:
                </p>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-muted-foreground">
                  <li>"Làm sao để cải thiện chất lượng giấc ngủ đêm qua?"</li>
                  <li>"Hôm nay tôi nên ăn gì sau khi tập luyện?"</li>
                  <li>"Tôi có cần phải tăng cường hoạt động không?"</li>
                </ul>
                <p className="text-muted-foreground mt-2">
                  <strong>Lời khuyên Cá nhân hóa:</strong> Chatbot AI sẽ phân tích dữ liệu từ vòng tay và đưa ra 
                  các lời khuyên, kế hoạch hành động được cá nhân hóa dựa trên tình trạng sức khỏe thực tế của bạn.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-primary mb-2">Bước 4: Sử dụng Tính năng Định vị & An toàn</h3>
                <p className="text-muted-foreground">
                  Tính năng này giúp bạn và người thân yên tâm hơn.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Thiết lập Khu vực An toàn (Geofencing):</strong> Trong mục "Định vị" của ứng dụng, 
                  thiết lập các khu vực an toàn (ví dụ: nhà, trường học). Ứng dụng sẽ gửi cảnh báo khi người 
                  đeo vòng tay rời khỏi khu vực này.
                </p>
                <p className="text-muted-foreground mt-2">
                  <strong>Theo dõi Vị trí:</strong> Xem vị trí hiện tại của vòng tay trên bản đồ theo thời gian thực.
                </p>
              </div>
            </div>
          </InfoSection>

          <InfoSection type="contact" title="Liên hệ với Đội ngũ S-Life" icon={Mail}>
            <div className="space-y-3">
              <div>
                <strong className="text-foreground">Email Hỗ trợ:</strong>{" "}
                <a href="mailto:SLife.K12Project@gmail.com" className="text-primary hover:underline">
                  SLife.K12Project@gmail.com
                </a>
              </div>
              <div>
                <strong className="text-foreground">Đơn vị Phát triển:</strong>{" "}
                <span className="text-muted-foreground">H&H Team</span>
              </div>
              <div>
                <strong className="text-foreground">Địa chỉ:</strong>{" "}
                <span className="text-muted-foreground">Trường THPT Xuân Thọ</span>
              </div>
            </div>
          </InfoSection>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Được phát triển với <Heart className="inline h-4 w-4 text-destructive fill-destructive" /> bởi H&H Team
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            © 2024 S-Life. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Index;
