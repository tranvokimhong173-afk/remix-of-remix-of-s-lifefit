import { Heart } from "lucide-react";

interface HeartRateAlertProps {
  heartRate: number;
}

const HeartRateAlert = ({ heartRate }: HeartRateAlertProps) => {
  const isNormal = heartRate >= 60 && heartRate <= 100;
  
  if (isNormal && heartRate > 0) return null;
  
  return (
    <div className="w-full border-2 border-destructive rounded-xl p-4 bg-destructive/5">
      <div className="flex items-start gap-3">
        <Heart className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-destructive mb-1">Cảnh báo nhịp tim</h3>
          <p className="text-sm text-muted-foreground">
            Nhịp tim dưới giới hạn an toàn ({heartRate} bpm)
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeartRateAlert;
