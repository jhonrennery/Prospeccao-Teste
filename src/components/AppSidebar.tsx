import { Search, Users, Download, BarChart3, Settings, Zap, Kanban, LayoutDashboard, MessageSquareMore, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Search, label: "Prospectar", path: "/" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: Kanban, label: "Pipeline", path: "/kanban" },
  { icon: MessageSquareMore, label: "WhatsApp", path: "/whatsapp" },
  { icon: BarChart3, label: "Buscas", path: "/searches" },
  { icon: Download, label: "Exportar", path: "/export" },
];

interface AppSidebarProps {
  onLogout: () => void | Promise<void>;
}

export function AppSidebar({ onLogout }: AppSidebarProps) {
  const location = useLocation();
  const isWhatsAppRoute = location.pathname === "/whatsapp";

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-14 flex-col items-center border-r border-border bg-sidebar py-4 md:w-16 md:py-6 lg:w-56",
        isWhatsAppRoute && "bg-sidebar/95 backdrop-blur-sm",
      )}
    >
      <div className="mb-8 flex items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="hidden font-display text-lg font-bold text-foreground lg:block">
          ProspectAI
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 w-full">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="flex w-full flex-col gap-2 px-2">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
            location.pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="hidden lg:block">Config</span>
        </NavLink>

        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden lg:block">Sair</span>
        </button>
      </div>
    </aside>
  );
}
