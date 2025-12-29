import { ChevronDown, Info, BookOpen, Mail } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

interface InfoSectionProps {
  type: "intro" | "guide" | "contact";
  title: string;
  icon: typeof Info | typeof BookOpen | typeof Mail;
  children: React.ReactNode;
}

const InfoSection = ({ type, title, icon: Icon, children }: InfoSectionProps) => {
  const [isOpen, setIsOpen] = useState(type === "contact");

  const getGradientColors = () => {
    switch (type) {
      case "intro": return "from-emerald-500 to-emerald-400";
      case "guide": return "from-amber-500 to-amber-400";
      case "contact": return "from-violet-500 to-violet-400";
      default: return "from-primary to-primary/60";
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${getGradientColors()} flex items-center justify-center shadow-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <h2 className={`text-xl font-bold bg-gradient-to-r ${getGradientColors()} bg-clip-text text-transparent`}>
              {title}
            </h2>
          </div>
          <ChevronDown 
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        
        <CollapsibleContent className="border-t border-border">
          <div className="p-6 space-y-4 text-sm text-foreground">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default InfoSection;
