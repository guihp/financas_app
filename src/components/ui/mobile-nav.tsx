import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, TrendingUp, CreditCard, BarChart3, Tag, Calendar, Settings, Shield, LogOut } from "lucide-react";

interface MobileNavProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isSuperAdmin: boolean;
  onNavigateToSuperAdmin: () => void;
  onLogout: () => void;
  userEmail: string;
}

export const MobileNav = ({ 
  currentView, 
  setCurrentView, 
  isSuperAdmin, 
  onNavigateToSuperAdmin, 
  onLogout,
  userEmail 
}: MobileNavProps) => {
  const [open, setOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Início", icon: TrendingUp },
    { id: "transactions", label: "Transações", icon: CreditCard },
    { id: "statistics", label: "Estatísticas", icon: BarChart3 },
    { id: "categories", label: "Categorias", icon: Tag },
    { id: "appointments", label: "Agendamentos", icon: Calendar },
    { id: "change-password", label: "Nova Senha", icon: Settings },
  ];

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Menu</h2>
            <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentView === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleNavClick(item.id)}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              );
            })}
            
            {isSuperAdmin && (
              <Button
                variant="ghost"
                className="w-full justify-start border border-orange-500/20 bg-orange-500/10"
                onClick={() => {
                  onNavigateToSuperAdmin();
                  setOpen(false);
                }}
              >
                <Shield className="w-4 h-4 mr-3 text-orange-500" />
                <span className="text-orange-500 font-medium">Super Admin</span>
              </Button>
            )}
          </nav>
          
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sair
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};