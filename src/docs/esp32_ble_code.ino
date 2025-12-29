/*
 * ESP32-S3 BLE Health Monitor - Gửi dữ liệu offline qua Bluetooth
 * Hỗ trợ: BPM, SpO2, Nhiệt độ, Tốc độ, Khoảng cách, GPS, Trạng thái té ngã
 * 
 * HƯỚNG DẪN:
 * 1. Cài đặt Arduino IDE và ESP32 board support
 * 2. Copy code này vào Arduino IDE
 * 3. Chọn board: ESP32S3 Dev Module
 * 4. Upload code lên ESP32-S3
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// BLE Service và Characteristic UUIDs
#define SERVICE_UUID           "12345678-1234-1234-1234-123456789abc"
#define CHARACTERISTIC_UUID    "87654321-4321-4321-4321-cba987654321"

BLEServer* pServer = NULL;
BLECharacteristic* pCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Dữ liệu sức khỏe (thay thế bằng dữ liệu từ cảm biến thực tế)
struct HealthData {
  int bpm;           // Nhịp tim
  int spo2;          // SpO2
  float temp;        // Nhiệt độ
  float speed;       // Tốc độ (km/h)
  float distance;    // Khoảng cách (m)
  float latitude;    // Vĩ độ GPS
  float longitude;   // Kinh độ GPS
  String fallStatus; // Trạng thái té ngã: "normal", "fall", "moving", "standing"
};

HealthData healthData;

// Callback khi có thiết bị kết nối/ngắt kết nối
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Device connected!");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Device disconnected!");
    }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting ESP32-S3 BLE Health Monitor...");

  // Khởi tạo dữ liệu mẫu (thay bằng đọc từ cảm biến thực)
  healthData.bpm = 75;
  healthData.spo2 = 98;
  healthData.temp = 36.5;
  healthData.speed = 0.0;
  healthData.distance = 0.0;
  healthData.latitude = 10.970737;
  healthData.longitude = 107.330054;
  healthData.fallStatus = "normal";

  // Khởi tạo BLE
  BLEDevice::init("S-Life Health Band");
  
  // Tạo BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // Tạo BLE Service
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Tạo BLE Characteristic với Notify
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  // Thêm descriptor để hỗ trợ notifications
  pCharacteristic->addDescriptor(new BLE2902());

  // Start service
  pService->start();

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("BLE Server started! Waiting for connections...");
}

// Tạo JSON string từ dữ liệu sức khỏe
String createJsonPayload() {
  String json = "{";
  json += "\"bpm\":" + String(healthData.bpm) + ",";
  json += "\"spo2\":" + String(healthData.spo2) + ",";
  json += "\"temp\":" + String(healthData.temp, 1) + ",";
  json += "\"speed\":" + String(healthData.speed, 2) + ",";
  json += "\"distance\":" + String(healthData.distance, 2) + ",";
  json += "\"lat\":" + String(healthData.latitude, 6) + ",";
  json += "\"lng\":" + String(healthData.longitude, 6) + ",";
  json += "\"fallStatus\":\"" + healthData.fallStatus + "\"";
  json += "}";
  return json;
}

void loop() {
  // Nếu có thiết bị kết nối, gửi dữ liệu
  if (deviceConnected) {
    // Cập nhật dữ liệu từ cảm biến (thay thế bằng code đọc cảm biến thực)
    updateSensorData();
    
    // Tạo JSON payload
    String jsonPayload = createJsonPayload();
    
    // Gửi qua BLE
    pCharacteristic->setValue(jsonPayload.c_str());
    pCharacteristic->notify();
    
    Serial.println("Sent: " + jsonPayload);
    
    delay(1000); // Gửi mỗi 1 giây
  }

  // Xử lý kết nối lại
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("Start advertising again...");
    oldDeviceConnected = deviceConnected;
  }
  
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }
}

// Hàm cập nhật dữ liệu từ cảm biến (thay thế bằng code thực tế)
void updateSensorData() {
  // ========== THAY THẾ ĐOẠN NÀY BẰNG CODE ĐỌC CẢM BIẾN THỰC ==========
  
  // Ví dụ: Đọc từ MAX30102 cho BPM và SpO2
  // healthData.bpm = readHeartRate();
  // healthData.spo2 = readSpO2();
  
  // Ví dụ: Đọc từ MLX90614 cho nhiệt độ
  // healthData.temp = readTemperature();
  
  // Ví dụ: Đọc từ MPU6050 cho phát hiện té ngã
  // healthData.fallStatus = detectFall();
  
  // Ví dụ: Đọc từ GPS module
  // healthData.latitude = readGPSLat();
  // healthData.longitude = readGPSLng();
  
  // Dữ liệu mẫu ngẫu nhiên để test
  healthData.bpm = random(60, 100);
  healthData.spo2 = random(95, 100);
  healthData.temp = 36.0 + (random(0, 20) / 10.0);
  healthData.speed = random(0, 50) / 10.0;
  healthData.distance += healthData.speed * 0.28; // Cập nhật khoảng cách
  
  // Ngẫu nhiên trạng thái để test
  int statusRandom = random(0, 100);
  if (statusRandom < 5) {
    healthData.fallStatus = "fall";
  } else if (statusRandom < 30) {
    healthData.fallStatus = "moving";
  } else if (statusRandom < 60) {
    healthData.fallStatus = "standing";
  } else {
    healthData.fallStatus = "normal";
  }
}

/*
 * ========== HƯỚNG DẪN TÍCH HỢP CẢM BIẾN ==========
 * 
 * 1. MAX30102 (Nhịp tim & SpO2):
 *    - Thêm library: MAX30105 by SparkFun
 *    - Kết nối: SDA->GPIO21, SCL->GPIO22
 *    
 * 2. MLX90614 (Nhiệt độ không tiếp xúc):
 *    - Thêm library: Adafruit MLX90614
 *    - Kết nối: SDA->GPIO21, SCL->GPIO22
 *    
 * 3. MPU6050 (Gia tốc kế - Phát hiện té ngã):
 *    - Thêm library: Adafruit MPU6050
 *    - Kết nối: SDA->GPIO21, SCL->GPIO22
 *    
 * 4. NEO-6M GPS:
 *    - Thêm library: TinyGPS++
 *    - Kết nối: TX->GPIO16, RX->GPIO17
 *    
 * ========== SERVICE & CHARACTERISTIC UUID ==========
 * Service UUID:        12345678-1234-1234-1234-123456789abc
 * Characteristic UUID: 87654321-4321-4321-4321-cba987654321
 * 
 * Web App sẽ sử dụng các UUID này để kết nối và nhận dữ liệu.
 */
