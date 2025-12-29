import { Heart, Thermometer, Droplet, Info, AlertTriangle, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProfile } from "@/services/userProfileService";
import { VitalThresholds, getRiskLevel } from "@/utils/vitalThresholds";

interface ThresholdDetailsTableProps {
  userProfile: UserProfile | null;
  thresholds: VitalThresholds;
  currentVitals?: {
    bpm: number;
    temp: number;
    spo2: number;
    fallStatus: string;
  };
  history?: Array<{
    timestamp: string;
    heartRate: number;
    temperature: number;
    spo2: number;
  }>;
}

// Ngưỡng mặc định để so sánh
const DEFAULT_THRESHOLDS: VitalThresholds = {
  bpm: { min: 60, max: 100 },
  temp: { min: 35.5, max: 37.5 },
  spo2: { min: 95, max: 100 },
};

const ThresholdDetailsTable = ({ userProfile, thresholds, currentVitals, history = [] }: ThresholdDetailsTableProps) => {
  const riskLevel = getRiskLevel(userProfile);


  // Tạo danh sách lý do điều chỉnh
  const getAdjustmentReasons = (): string[] => {
    const reasons: string[] = [];
    
    if (!userProfile) {
      reasons.push("Sử dụng ngưỡng mặc định (chưa có hồ sơ người dùng)");
      return reasons;
    }

    const { age, conditions } = userProfile;

    // Lý do theo độ tuổi
    if (age < 6) {
      reasons.push(`Trẻ nhỏ (${age} tuổi): Nhịp tim cao hơn, nhiệt độ linh hoạt hơn`);
    } else if (age < 12) {
      reasons.push(`Trẻ em (${age} tuổi): Nhịp tim cao hơn người trưởng thành`);
    } else if (age < 18) {
      reasons.push(`Thanh thiếu niên (${age} tuổi): Nhịp tim gần với người trưởng thành`);
    } else if (age <= 60) {
      reasons.push(`Người trưởng thành (${age} tuổi): Sử dụng ngưỡng chuẩn`);
    } else if (age <= 75) {
      reasons.push(`Người cao tuổi (${age} tuổi): Nhịp tim có thể chậm hơn, SpO2 linh hoạt hơn`);
    } else {
      reasons.push(`Người rất cao tuổi (${age} tuổi): Ngưỡng linh hoạt, cần theo dõi chặt`);
    }

    // Lý do theo bệnh nền
    if (conditions.cardiovascular) {
      reasons.push("Bệnh tim mạch: Mở rộng ngưỡng nhịp tim, tăng độ nhạy SpO2");
    }
    if (conditions.hypertension) {
      reasons.push("Huyết áp cao: Siết chặt ngưỡng nhịp tim tối đa");
    }
    if (conditions.respiratory) {
      reasons.push("Bệnh hô hấp: Hạ ngưỡng SpO2 cảnh báo để phù hợp");
    }
    if (conditions.diabetes) {
      reasons.push("Tiểu đường: Siết chặt ngưỡng nhiệt độ (dễ nhiễm trùng)");
    }

    // Kết hợp nhiều bệnh
    const conditionCount = Object.values(conditions).filter(Boolean).length;
    if (conditionCount >= 3) {
      reasons.push("Nhiều bệnh nền (≥3): Tăng độ nhạy cảnh báo toàn diện");
    } else if (conditionCount >= 2) {
      reasons.push("Nhiều bệnh nền (≥2): Siết chặt thêm ngưỡng SpO2");
    }

    return reasons;
  };

  // Kiểm tra sự khác biệt so với ngưỡng mặc định
  const getDifference = (current: number, defaultVal: number): { value: number; isChanged: boolean } => {
    const diff = current - defaultVal;
    return { value: diff, isChanged: Math.abs(diff) > 0.01 };
  };

  const bpmMinDiff = getDifference(thresholds.bpm.min, DEFAULT_THRESHOLDS.bpm.min);
  const bpmMaxDiff = getDifference(thresholds.bpm.max, DEFAULT_THRESHOLDS.bpm.max);
  const tempMinDiff = getDifference(thresholds.temp.min, DEFAULT_THRESHOLDS.temp.min);
  const tempMaxDiff = getDifference(thresholds.temp.max, DEFAULT_THRESHOLDS.temp.max);
  const spo2MinDiff = getDifference(thresholds.spo2.min, DEFAULT_THRESHOLDS.spo2.min);

  const formatDiff = (diff: { value: number; isChanged: boolean }, decimals = 0): string => {
    if (!diff.isChanged) return "";
    const sign = diff.value > 0 ? "+" : "";
    return `(${sign}${diff.value.toFixed(decimals)})`;
  };

  const riskConfig = {
    low: { color: "bg-green-500/10 text-green-600 border-green-500/20", label: "Thấp", icon: Shield },
    medium: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", label: "Trung bình", icon: AlertTriangle },
    high: { color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Cao", icon: AlertTriangle },
  };

  const currentRisk = riskConfig[riskLevel];
  const RiskIcon = currentRisk.icon;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            Chi tiết Ngưỡng Cảnh báo
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mức độ rủi ro:</span>
              <Badge variant="outline" className={`${currentRisk.color} gap-1`}>
                <RiskIcon className="h-3 w-3" />
                {currentRisk.label}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Thông tin người dùng */}
        {userProfile ? (
          <div className="flex flex-wrap gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tên:</span>
              <span className="font-medium">{userProfile.name || "Chưa cập nhật"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tuổi:</span>
              <span className="font-medium">{userProfile.age} tuổi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Giới tính:</span>
              <span className="font-medium">
                {userProfile.gender === "male" ? "Nam" : userProfile.gender === "female" ? "Nữ" : "Khác"}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-700">
            <p className="text-sm">
              ⚠️ Chưa có hồ sơ người dùng. Đang sử dụng ngưỡng mặc định cho người trưởng thành khỏe mạnh (18-60 tuổi).
            </p>
          </div>
        )}

        {/* Bảng ngưỡng chi tiết */}
        <TooltipProvider>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[200px]">Chỉ số</TableHead>
                  <TableHead>Ngưỡng Min</TableHead>
                  <TableHead>Ngưỡng Max</TableHead>
                  <TableHead>Ngưỡng mặc định</TableHead>
                  <TableHead className="text-right">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Nhịp tim */}
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Heart className="h-4 w-4 text-blue-500" />
                      </div>
                      Nhịp tim
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={bpmMinDiff.isChanged ? "text-primary font-semibold" : ""}>
                      {thresholds.bpm.min} bpm
                    </span>
                    {bpmMinDiff.isChanged && (
                      <span className="text-xs text-muted-foreground ml-1">{formatDiff(bpmMinDiff)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={bpmMaxDiff.isChanged ? "text-primary font-semibold" : ""}>
                      {thresholds.bpm.max} bpm
                    </span>
                    {bpmMaxDiff.isChanged && (
                      <span className="text-xs text-muted-foreground ml-1">{formatDiff(bpmMaxDiff)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DEFAULT_THRESHOLDS.bpm.min} - {DEFAULT_THRESHOLDS.bpm.max} bpm
                  </TableCell>
                  <TableCell className="text-right">
                    {bpmMinDiff.isChanged || bpmMaxDiff.isChanged ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Đã điều chỉnh
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Mặc định
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>

                {/* Nhiệt độ */}
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Thermometer className="h-4 w-4 text-orange-500" />
                      </div>
                      Nhiệt độ
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={tempMinDiff.isChanged ? "text-primary font-semibold" : ""}>
                      {thresholds.temp.min.toFixed(1)}°C
                    </span>
                    {tempMinDiff.isChanged && (
                      <span className="text-xs text-muted-foreground ml-1">{formatDiff(tempMinDiff, 1)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={tempMaxDiff.isChanged ? "text-primary font-semibold" : ""}>
                      {thresholds.temp.max.toFixed(1)}°C
                    </span>
                    {tempMaxDiff.isChanged && (
                      <span className="text-xs text-muted-foreground ml-1">{formatDiff(tempMaxDiff, 1)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DEFAULT_THRESHOLDS.temp.min.toFixed(1)} - {DEFAULT_THRESHOLDS.temp.max.toFixed(1)}°C
                  </TableCell>
                  <TableCell className="text-right">
                    {tempMinDiff.isChanged || tempMaxDiff.isChanged ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Đã điều chỉnh
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Mặc định
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>

                {/* SpO2 */}
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Droplet className="h-4 w-4 text-blue-500" />
                      </div>
                      SpO2
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={spo2MinDiff.isChanged ? "text-primary font-semibold" : ""}>
                      ≥ {thresholds.spo2.min}%
                    </span>
                    {spo2MinDiff.isChanged && (
                      <span className="text-xs text-muted-foreground ml-1">{formatDiff(spo2MinDiff)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">100%</TableCell>
                  <TableCell className="text-muted-foreground">
                    ≥ {DEFAULT_THRESHOLDS.spo2.min}%
                  </TableCell>
                  <TableCell className="text-right">
                    {spo2MinDiff.isChanged ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        Đã điều chỉnh
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Mặc định
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>

        {/* Lý do điều chỉnh */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Lý do điều chỉnh ngưỡng
          </h4>
          <ul className="space-y-2">
            {getAdjustmentReasons().map((reason, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Bệnh nền hiện tại */}
        {userProfile && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Bệnh nền được ghi nhận</h4>
            <div className="flex flex-wrap gap-2">
              {userProfile.conditions.cardiovascular && (
                <Badge variant="secondary">Bệnh tim mạch</Badge>
              )}
              {userProfile.conditions.hypertension && (
                <Badge variant="secondary">Huyết áp cao</Badge>
              )}
              {userProfile.conditions.respiratory && (
                <Badge variant="secondary">Bệnh hô hấp</Badge>
              )}
              {userProfile.conditions.diabetes && (
                <Badge variant="secondary">Tiểu đường</Badge>
              )}
              {!userProfile.conditions.cardiovascular && 
               !userProfile.conditions.hypertension && 
               !userProfile.conditions.respiratory && 
               !userProfile.conditions.diabetes && (
                <span className="text-sm text-muted-foreground">Không có bệnh nền được ghi nhận</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ThresholdDetailsTable;
