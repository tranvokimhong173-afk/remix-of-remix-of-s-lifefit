import { Settings, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import NotificationBox from "./NotificationBox";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  userId: string;
}

const Header = ({ userId }: HeaderProps) => {
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            S-Life: Người Bạn Đồng Hành AI 24/7 Cho Sức Khỏe Của Bạn.
          </h1>
          
          <nav className="hidden md:flex items-center gap-2">
            <a href="#intro" className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3">
              Giới thiệu
            </a>
            <a href="#guide" className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3">
              Hướng dẫn
            </a>
            <a href="#contact" className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3">
              Liên hệ
            </a>
            <NotificationBox userId={userId} />
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Đăng xuất">
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>

          <div className="md:hidden flex items-center gap-2">
            <NotificationBox userId={userId} />
            <Link to="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Đăng xuất">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
