import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VitalCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "primary";
  status?: string;
  highContrast?: boolean;
  thresholdInfo?: string;
}

const VitalCard = ({ title, value, unit, icon: Icon, variant = "default", status, highContrast = false, thresholdInfo }: VitalCardProps) => {
  return (
    <div className={cn(
      "relative rounded-2xl border-2 p-5 transition-all duration-300 hover:shadow-card-hover",
      highContrast ? "bg-black border-white" : [
        variant === "default" && "border-border bg-card",
        variant === "warning" && "border-destructive/50 bg-card",
        variant === "primary" && "border-primary/50 bg-card"
      ]
    )}>
      {/* Header with icon and title */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "rounded-xl p-2.5 flex-shrink-0",
          highContrast ? "bg-white" : [
            variant === "default" && "bg-muted",
            variant === "warning" && "bg-destructive/10",
            variant === "primary" && "bg-primary/10"
          ]
        )}>
          <Icon className={cn(
            "h-6 w-6",
            highContrast ? "text-black" : [
              variant === "default" && "text-muted-foreground",
              variant === "warning" && "text-destructive",
              variant === "primary" && "text-primary"
            ]
          )} />
        </div>
        
        {/* Title - LARGER for elderly */}
        <h3 className={cn(
          "text-lg md:text-xl font-bold leading-tight",
          highContrast ? "text-white" : [
            variant === "warning" && "text-destructive",
            variant === "primary" && "text-primary",
            variant === "default" && "text-foreground"
          ]
        )}>
          {title}
        </h3>
      </div>
      
      {/* Value display */}
      <div>
        {status ? (
          <div className={cn(
            "text-2xl md:text-3xl font-bold",
            highContrast ? "text-yellow-300" : "text-primary"
          )}>
            {status}
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-3xl md:text-4xl font-bold",
              highContrast ? "text-yellow-300" : [
                variant === "warning" && "text-destructive",
                variant === "primary" && "text-primary",
                variant === "default" && "text-foreground"
              ]
            )}>
              {value}
            </span>
            <span className={cn(
              "text-lg font-semibold",
              highContrast ? "text-white" : "text-muted-foreground"
            )}>
              {unit}
            </span>
          </div>
        )}
      </div>

      {/* Threshold info */}
      {thresholdInfo && (
        <div className={cn(
          "mt-2 text-xs",
          highContrast ? "text-gray-300" : "text-muted-foreground"
        )}>
          {thresholdInfo}
        </div>
      )}

      {/* Warning indicator */}
      {variant === "warning" && !highContrast && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-semibold text-destructive">Cần chú ý</span>
        </div>
      )}
    </div>
  );
};

export default VitalCard;
