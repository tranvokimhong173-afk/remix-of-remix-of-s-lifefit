import { UserProfile } from "@/services/userProfileService";

export interface VitalThresholds {
  bpm: { min: number; max: number };
  temp: { min: number; max: number };
  spo2: { min: number; max: number };
}

// Ngưỡng mặc định cho người trưởng thành khỏe mạnh (18-60 tuổi)
const DEFAULT_THRESHOLDS: VitalThresholds = {
  bpm: { min: 60, max: 100 },
  temp: { min: 35.5, max: 37.5 },
  spo2: { min: 95, max: 100 },
};

/**
 * Tính toán ngưỡng nguy hiểm dựa trên độ tuổi và bệnh nền
 * 
 * Thuật toán:
 * 1. Độ tuổi ảnh hưởng đến ngưỡng nhịp tim:
 *    - Trẻ em (<12): nhịp tim cao hơn bình thường
 *    - Thanh thiếu niên (12-18): gần với người trưởng thành
 *    - Người trưởng thành (18-60): ngưỡng chuẩn
 *    - Người cao tuổi (>60): nhịp tim có thể thấp hơn, SpO2 có thể thấp hơn chút
 * 
 * 2. Bệnh nền ảnh hưởng:
 *    - Tim mạch: mở rộng ngưỡng nhịp tim, hạ ngưỡng SpO2 cảnh báo
 *    - Tiểu đường: không ảnh hưởng trực tiếp nhưng kết hợp với các bệnh khác
 *    - Huyết áp cao: siết chặt ngưỡng nhịp tim tối đa
 *    - Hô hấp: hạ ngưỡng SpO2 cảnh báo
 */
export function calculateVitalThresholds(profile: UserProfile | null): VitalThresholds {
  // Nếu không có profile, trả về ngưỡng mặc định
  if (!profile) {
    return DEFAULT_THRESHOLDS;
  }

  const { age, conditions } = profile;
  
  // Khởi tạo với ngưỡng mặc định
  let thresholds: VitalThresholds = JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS));

  // =====================
  // ĐIỀU CHỈNH THEO ĐỘ TUỔI
  // =====================
  
  if (age < 6) {
    // Trẻ sơ sinh và trẻ nhỏ (0-5 tuổi)
    // Nhịp tim bình thường: 80-140 bpm
    thresholds.bpm = { min: 80, max: 140 };
    thresholds.temp = { min: 36.0, max: 37.8 };
    thresholds.spo2 = { min: 94, max: 100 };
  } else if (age < 12) {
    // Trẻ em (6-11 tuổi)
    // Nhịp tim bình thường: 70-120 bpm
    thresholds.bpm = { min: 70, max: 120 };
    thresholds.temp = { min: 35.8, max: 37.5 };
    thresholds.spo2 = { min: 95, max: 100 };
  } else if (age < 18) {
    // Thanh thiếu niên (12-17 tuổi)
    // Nhịp tim bình thường: 60-110 bpm
    thresholds.bpm = { min: 60, max: 110 };
    thresholds.temp = { min: 35.5, max: 37.5 };
    thresholds.spo2 = { min: 95, max: 100 };
  } else if (age <= 60) {
    // Người trưởng thành (18-60 tuổi)
    // Giữ nguyên ngưỡng mặc định
    thresholds.bpm = { min: 60, max: 100 };
    thresholds.temp = { min: 35.5, max: 37.5 };
    thresholds.spo2 = { min: 95, max: 100 };
  } else if (age <= 75) {
    // Người cao tuổi (61-75 tuổi)
    // Nhịp tim có thể chậm hơn, SpO2 có thể thấp hơn một chút
    thresholds.bpm = { min: 55, max: 95 };
    thresholds.temp = { min: 35.3, max: 37.5 };
    thresholds.spo2 = { min: 93, max: 100 };
  } else {
    // Người rất cao tuổi (>75 tuổi)
    // Ngưỡng linh hoạt hơn nhưng vẫn cần theo dõi chặt
    thresholds.bpm = { min: 50, max: 90 };
    thresholds.temp = { min: 35.0, max: 37.5 };
    thresholds.spo2 = { min: 92, max: 100 };
  }

  // =====================
  // ĐIỀU CHỈNH THEO BỆNH NỀN
  // =====================

  // Bệnh tim mạch
  if (conditions.cardiovascular) {
    // Người có bệnh tim: nhịp tim có thể không ổn định
    // Mở rộng ngưỡng bình thường nhưng tăng độ nhạy cho SpO2
    thresholds.bpm.min = Math.max(45, thresholds.bpm.min - 10);
    thresholds.bpm.max = Math.min(130, thresholds.bpm.max + 15);
    // SpO2 quan trọng hơn với bệnh tim
    thresholds.spo2.min = Math.max(90, thresholds.spo2.min - 2);
  }

  // Huyết áp cao
  if (conditions.hypertension) {
    // Người huyết áp cao: nhịp tim cao là dấu hiệu nguy hiểm
    // Siết chặt ngưỡng tối đa
    thresholds.bpm.max = Math.min(thresholds.bpm.max, 95);
    // Nhiệt độ cao cũng cần cảnh báo sớm hơn
    thresholds.temp.max = Math.min(thresholds.temp.max, 37.3);
  }

  // Bệnh hô hấp mãn tính (COPD, hen suyễn, etc.)
  if (conditions.respiratory) {
    // SpO2 có thể thấp hơn bình thường nhưng vẫn cần theo dõi
    // Hạ ngưỡng cảnh báo để phù hợp
    thresholds.spo2.min = Math.max(88, thresholds.spo2.min - 4);
  }

  // Tiểu đường
  if (conditions.diabetes) {
    // Tiểu đường không ảnh hưởng trực tiếp nhiều đến các chỉ số này
    // Nhưng kết hợp với các bệnh khác có thể tăng rủi ro
    // Siết chặt nhẹ ngưỡng nhiệt độ (dễ nhiễm trùng)
    thresholds.temp.max = Math.min(thresholds.temp.max, 37.4);
  }

  // Kết hợp nhiều bệnh nền - tăng độ nhạy cảnh báo
  const conditionCount = Object.values(conditions).filter(Boolean).length;
  if (conditionCount >= 2) {
    // Có từ 2 bệnh nền trở lên: siết chặt thêm ngưỡng
    thresholds.spo2.min = Math.min(thresholds.spo2.min + 1, 95);
  }
  if (conditionCount >= 3) {
    // Có từ 3 bệnh nền trở lên: rất cần theo dõi
    thresholds.bpm.max = Math.min(thresholds.bpm.max - 5, 100);
    thresholds.temp.max = Math.min(thresholds.temp.max - 0.2, 37.3);
  }

  return thresholds;
}

/**
 * Kiểm tra xem chỉ số có bất thường không dựa trên ngưỡng đã tính
 */
export function checkVitalStatus(
  value: number,
  thresholds: { min: number; max: number },
  type: 'bpm' | 'temp' | 'spo2'
): 'normal' | 'warning' | 'danger' {
  // Bỏ qua giá trị không hợp lệ
  if (value <= 0) return 'normal';

  // Với SpO2, chỉ check min
  if (type === 'spo2') {
    if (value < thresholds.min - 3) return 'danger';
    if (value < thresholds.min) return 'warning';
    return 'normal';
  }

  // Với BPM và temp, check cả min và max
  const margin = type === 'bpm' ? 15 : 0.5; // Margin cho mức nguy hiểm

  if (value < thresholds.min - margin || value > thresholds.max + margin) {
    return 'danger';
  }
  if (value < thresholds.min || value > thresholds.max) {
    return 'warning';
  }
  return 'normal';
}

/**
 * Lấy mô tả ngưỡng để hiển thị cho người dùng
 */
export function getThresholdDescription(thresholds: VitalThresholds): {
  bpm: string;
  temp: string;
  spo2: string;
} {
  return {
    bpm: `${thresholds.bpm.min} - ${thresholds.bpm.max} bpm`,
    temp: `${thresholds.temp.min.toFixed(1)} - ${thresholds.temp.max.toFixed(1)}°C`,
    spo2: `≥ ${thresholds.spo2.min}%`,
  };
}

/**
 * Lấy nhãn mức độ rủi ro
 */
export function getRiskLevel(profile: UserProfile | null): 'low' | 'medium' | 'high' {
  if (!profile) return 'low';

  const { age, conditions } = profile;
  const conditionCount = Object.values(conditions).filter(Boolean).length;

  // Rủi ro cao: người rất cao tuổi hoặc có nhiều bệnh nền
  if (age > 75 || conditionCount >= 3) return 'high';
  if (age > 60 || conditionCount >= 2) return 'medium';
  if (conditionCount >= 1) return 'medium';
  
  return 'low';
}
