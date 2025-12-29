import { Activity, AlertTriangle, CheckCircle, Heart, Shield, TrendingUp, Thermometer, Droplet, Stethoscope, Pill, Apple, Footprints } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserProfile } from "@/services/userProfileService";
import { VITAL_THRESHOLDS } from "@/hooks/useAlertSound";

interface HealthReportProps {
  rtData: {
    bpm: number;
    temp: number;
    spo2: number;
    speed: number;
    distance: number;
    fallStatus: string;
  };
  userProfile: UserProfile | null;
}

interface RiskItem {
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  recommendation: string;
}

interface ConditionRecommendation {
  condition: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  tips: {
    category: string;
    items: string[];
  }[];
}

const HealthReport = ({ rtData, userProfile }: HealthReportProps) => {
  // Calculate overall health score (0-100)
  const calculateHealthScore = () => {
    let score = 100;
    
    // BPM scoring
    if (rtData.bpm < VITAL_THRESHOLDS.bpm.min || rtData.bpm > VITAL_THRESHOLDS.bpm.max) {
      score -= 25;
    } else if (rtData.bpm < 65 || rtData.bpm > 90) {
      score -= 10;
    }
    
    // Temperature scoring
    if (rtData.temp < VITAL_THRESHOLDS.temp.min || rtData.temp > VITAL_THRESHOLDS.temp.max) {
      score -= 25;
    } else if (rtData.temp < 36.3 || rtData.temp > 37.2) {
      score -= 10;
    }
    
    // SpO2 scoring
    if (rtData.spo2 > 0 && rtData.spo2 < VITAL_THRESHOLDS.spo2.min) {
      score -= 30;
    } else if (rtData.spo2 > 0 && rtData.spo2 < 95) {
      score -= 15;
    }
    
    // Fall status
    if (rtData.fallStatus === "fall") {
      score -= 40;
    }
    
    return Math.max(0, score);
  };

  // Generate condition-specific recommendations
  const getConditionRecommendations = (): ConditionRecommendation[] => {
    const recommendations: ConditionRecommendation[] = [];
    const conditions = userProfile?.conditions;

    if (conditions?.cardiovascular) {
      recommendations.push({
        condition: "Bệnh tim mạch",
        icon: <Heart className="h-5 w-5" />,
        color: "text-red-500",
        bgColor: "bg-red-500/10 border-red-500/30",
        tips: [
          {
            category: "Theo dõi",
            items: [
              "Kiểm tra nhịp tim thường xuyên, đặc biệt khi vận động",
              "Ghi nhận các triệu chứng như đau ngực, khó thở",
              "Theo dõi huyết áp hàng ngày vào cùng thời điểm"
            ]
          },
          {
            category: "Lối sống",
            items: [
              "Tập thể dục nhẹ nhàng 30 phút/ngày (đi bộ, yoga)",
              "Tránh căng thẳng, tập thiền hoặc hít thở sâu",
              "Ngủ đủ 7-8 tiếng mỗi đêm"
            ]
          },
          {
            category: "Dinh dưỡng",
            items: [
              "Hạn chế muối (dưới 2g/ngày) và chất béo bão hòa",
              "Ăn nhiều cá, rau xanh, trái cây",
              "Tránh rượu bia và thuốc lá"
            ]
          }
        ]
      });
    }

    if (conditions?.diabetes) {
      recommendations.push({
        condition: "Tiểu đường",
        icon: <Droplet className="h-5 w-5" />,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 border-blue-500/30",
        tips: [
          {
            category: "Theo dõi",
            items: [
              "Đo đường huyết trước và sau bữa ăn",
              "Kiểm tra bàn chân hàng ngày để phát hiện vết thương",
              "Khám mắt định kỳ mỗi 6 tháng"
            ]
          },
          {
            category: "Lối sống",
            items: [
              "Đi bộ 20-30 phút sau mỗi bữa ăn",
              "Duy trì cân nặng ổn định",
              "Không bỏ bữa, ăn đúng giờ"
            ]
          },
          {
            category: "Dinh dưỡng",
            items: [
              "Ưu tiên thực phẩm có chỉ số đường huyết thấp",
              "Chia nhỏ bữa ăn (5-6 bữa nhỏ/ngày)",
              "Hạn chế đồ ngọt, nước ngọt, tinh bột trắng"
            ]
          }
        ]
      });
    }

    if (conditions?.hypertension) {
      recommendations.push({
        condition: "Cao huyết áp",
        icon: <Activity className="h-5 w-5" />,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10 border-orange-500/30",
        tips: [
          {
            category: "Theo dõi",
            items: [
              "Đo huyết áp 2 lần/ngày (sáng và tối)",
              "Ghi chép nhật ký huyết áp để theo dõi xu hướng",
              "Theo dõi các triệu chứng như đau đầu, chóng mặt"
            ]
          },
          {
            category: "Lối sống",
            items: [
              "Giảm cân nếu thừa cân (mỗi 1kg giảm được 1mmHg)",
              "Tập thể dục đều đặn 150 phút/tuần",
              "Tránh stress, nghỉ ngơi đầy đủ"
            ]
          },
          {
            category: "Dinh dưỡng",
            items: [
              "Giảm muối xuống dưới 5g/ngày",
              "Ăn nhiều kali (chuối, khoai lang, rau xanh)",
              "Hạn chế caffeine và rượu bia"
            ]
          }
        ]
      });
    }

    if (conditions?.respiratory) {
      recommendations.push({
        condition: "Bệnh hô hấp mạn tính",
        icon: <Stethoscope className="h-5 w-5" />,
        color: "text-teal-500",
        bgColor: "bg-teal-500/10 border-teal-500/30",
        tips: [
          {
            category: "Theo dõi",
            items: [
              "Theo dõi SpO2 thường xuyên, đặc biệt khi khó thở",
              "Ghi nhận các cơn khó thở và yếu tố kích hoạt",
              "Kiểm tra chức năng phổi định kỳ"
            ]
          },
          {
            category: "Lối sống",
            items: [
              "Tránh khói thuốc và không khí ô nhiễm",
              "Tập thở bụng và kỹ thuật thở môi",
              "Giữ ấm cơ thể trong thời tiết lạnh"
            ]
          },
          {
            category: "Dinh dưỡng",
            items: [
              "Uống đủ 2-2.5 lít nước mỗi ngày",
              "Ăn nhiều thực phẩm giàu vitamin C và E",
              "Tránh thức ăn gây đầy bụng, khó tiêu"
            ]
          }
        ]
      });
    }

    return recommendations;
  };

  // Generate risk alerts based on vitals and user profile
  const generateRiskAlerts = (): RiskItem[] => {
    const alerts: RiskItem[] = [];
    const age = userProfile?.age || 0;
    const conditions = userProfile?.conditions;

    // Heart rate analysis
    if (rtData.bpm > 0) {
      if (rtData.bpm < VITAL_THRESHOLDS.bpm.min) {
        alerts.push({
          type: "critical",
          title: "Nhịp tim quá thấp",
          description: `Nhịp tim ${rtData.bpm} bpm thấp hơn ngưỡng an toàn (${VITAL_THRESHOLDS.bpm.min} bpm)`,
          recommendation: "Nghỉ ngơi và theo dõi. Nếu kèm chóng mặt, hãy liên hệ bác sĩ ngay."
        });
      } else if (rtData.bpm > VITAL_THRESHOLDS.bpm.max) {
        alerts.push({
          type: "critical",
          title: "Nhịp tim quá cao",
          description: `Nhịp tim ${rtData.bpm} bpm cao hơn ngưỡng an toàn (${VITAL_THRESHOLDS.bpm.max} bpm)`,
          recommendation: conditions?.cardiovascular 
            ? "Ngừng hoạt động ngay, nghỉ ngơi và uống thuốc theo toa. Liên hệ bác sĩ nếu không giảm."
            : "Hít thở sâu, nghỉ ngơi trong 10-15 phút. Uống nước và thư giãn."
        });
      }
    }

    // Temperature analysis
    if (rtData.temp > VITAL_THRESHOLDS.temp.max) {
      alerts.push({
        type: "warning",
        title: "Nhiệt độ cơ thể cao",
        description: `Nhiệt độ ${rtData.temp}°C cao hơn bình thường (${VITAL_THRESHOLDS.temp.max}°C)`,
        recommendation: "Uống nhiều nước, nghỉ ngơi ở nơi mát mẻ. Nếu sốt kéo dài hơn 2 giờ, dùng thuốc hạ sốt."
      });
    } else if (rtData.temp < VITAL_THRESHOLDS.temp.min) {
      alerts.push({
        type: "warning",
        title: "Nhiệt độ cơ thể thấp",
        description: `Nhiệt độ ${rtData.temp}°C thấp hơn bình thường (${VITAL_THRESHOLDS.temp.min}°C)`,
        recommendation: "Di chuyển đến nơi ấm áp, mặc thêm áo. Uống nước ấm và hoạt động nhẹ."
      });
    }

    // SpO2 analysis
    if (rtData.spo2 > 0 && rtData.spo2 < VITAL_THRESHOLDS.spo2.min) {
      alerts.push({
        type: "critical",
        title: "Nồng độ oxy trong máu thấp",
        description: `SpO2 ${rtData.spo2}% thấp hơn ngưỡng an toàn (${VITAL_THRESHOLDS.spo2.min}%)`,
        recommendation: conditions?.respiratory
          ? "Sử dụng thiết bị hỗ trợ thở nếu có. Liên hệ bác sĩ ngay lập tức."
          : "Ngồi thẳng, hít thở sâu và chậm. Nếu không cải thiện trong 5 phút, gọi cấp cứu."
      });
    }

    // Fall detection
    if (rtData.fallStatus === "fall") {
      alerts.push({
        type: "critical",
        title: "Phát hiện té ngã",
        description: "Hệ thống đã phát hiện một sự kiện té ngã",
        recommendation: age >= 60 
          ? "Kiểm tra xem có bị thương không. Nếu đau hoặc không thể đứng dậy, hãy gọi người thân hoặc cấp cứu ngay."
          : "Kiểm tra cơ thể và đứng dậy từ từ nếu không bị thương."
      });
    }

    return alerts;
  };

  const healthScore = calculateHealthScore();
  const riskAlerts = generateRiskAlerts();
  const conditionRecommendations = getConditionRecommendations();

  const getScoreColor = () => {
    if (healthScore >= 80) return "text-green-500";
    if (healthScore >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = () => {
    if (healthScore >= 80) return "Tốt";
    if (healthScore >= 60) return "Trung bình";
    return "Cần chú ý";
  };

  const getRiskBadge = (type: "critical" | "warning" | "info") => {
    switch (type) {
      case "critical":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Nghiêm trọng</Badge>;
      case "warning":
        return <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"><AlertTriangle className="h-3 w-3" /> Cảnh báo</Badge>;
      case "info":
        return <Badge variant="outline" className="gap-1"><CheckCircle className="h-3 w-3" /> Lưu ý</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Theo dõi":
        return <Activity className="h-4 w-4" />;
      case "Lối sống":
        return <Footprints className="h-4 w-4" />;
      case "Dinh dưỡng":
        return <Apple className="h-4 w-4" />;
      default:
        return <Pill className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
          <Activity className="h-5 w-5 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Báo cáo sức khỏe cá nhân hóa
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <Card className="lg:col-span-1 bg-gradient-to-br from-card to-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Điểm sức khỏe tổng hợp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-4">
              <div className={`text-6xl font-bold ${getScoreColor()}`}>
                {healthScore}
              </div>
              <div className={`text-lg font-medium mt-2 ${getScoreColor()}`}>
                {getScoreLabel()}
              </div>
              <Progress value={healthScore} className="w-full mt-4 h-3" />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-2 rounded-lg bg-background/50">
                <Heart className="h-4 w-4 mx-auto text-red-500 mb-1" />
                <div className="text-sm font-semibold">{rtData.bpm}</div>
                <div className="text-xs text-muted-foreground">bpm</div>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <Thermometer className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                <div className="text-sm font-semibold">{rtData.temp.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">°C</div>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <Droplet className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                <div className="text-sm font-semibold">{rtData.spo2}</div>
                <div className="text-xs text-muted-foreground">%</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Cảnh báo rủi ro hiện tại
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium text-green-600 dark:text-green-400">
                  Các chỉ số sức khỏe đều trong ngưỡng bình thường
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tiếp tục duy trì lối sống lành mạnh!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {riskAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.type === "critical" 
                        ? "border-l-red-500 bg-red-500/10" 
                        : alert.type === "warning"
                        ? "border-l-yellow-500 bg-yellow-500/10"
                        : "border-l-blue-500 bg-blue-500/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold">{alert.title}</h4>
                      {getRiskBadge(alert.type)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {alert.description}
                    </p>
                    <div className="flex items-start gap-2 mt-3 p-2 rounded bg-background/50">
                      <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        {alert.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Condition-Specific Recommendations */}
      {conditionRecommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shadow">
              <Pill className="h-4 w-4 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Khuyến nghị theo bệnh lý
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {conditionRecommendations.map((rec, index) => (
              <Card key={index} className={`border ${rec.bgColor}`}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-lg flex items-center gap-2 ${rec.color}`}>
                    {rec.icon}
                    {rec.condition}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rec.tips.map((tipGroup, tipIndex) => (
                    <div key={tipIndex}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1 rounded ${rec.bgColor}`}>
                          {getCategoryIcon(tipGroup.category)}
                        </div>
                        <h4 className="font-medium text-sm">{tipGroup.category}</h4>
                      </div>
                      <ul className="space-y-1.5 ml-7">
                        {tipGroup.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* User Profile Summary */}
      {userProfile && (
        <Card className="bg-gradient-to-r from-muted/30 to-muted/10">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium text-muted-foreground">Hồ sơ:</span>
              <Badge variant="outline">{userProfile.name}</Badge>
              <Badge variant="outline">{userProfile.age} tuổi</Badge>
              <Badge variant="outline">{userProfile.gender === "male" ? "Nam" : userProfile.gender === "female" ? "Nữ" : "Khác"}</Badge>
              {userProfile.conditions?.cardiovascular && <Badge variant="secondary" className="bg-red-500/20 text-red-600 dark:text-red-400">Tim mạch</Badge>}
              {userProfile.conditions?.diabetes && <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 dark:text-blue-400">Tiểu đường</Badge>}
              {userProfile.conditions?.hypertension && <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 dark:text-orange-400">Huyết áp cao</Badge>}
              {userProfile.conditions?.respiratory && <Badge variant="secondary" className="bg-teal-500/20 text-teal-600 dark:text-teal-400">Hô hấp</Badge>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HealthReport;
