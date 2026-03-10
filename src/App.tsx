import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthForm } from "@/components/AuthForm";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import Index from "./pages/Index";
import Leads from "./pages/Leads";
import Searches from "./pages/Searches";
import ExportPage from "./pages/Export";
import KanbanPage from "./pages/Kanban";
import Dashboard from "./pages/Dashboard";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import type { Session } from "@supabase/supabase-js";

const queryClient = new QueryClient();

function AuthenticatedLayout() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 ml-14 md:ml-16 lg:ml-56 p-4 md:p-6 lg:p-8 xl:px-12 2xl:px-16">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/searches" element={<Searches />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Copy protection
  useEffect(() => {
    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData("text/plain", "⚠️ Conteúdo protegido. Cópia não permitida.");
    };
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "u", "s", "a"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))) {
        e.preventDefault();
      }
      // Block PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        navigator.clipboard.writeText("").catch(() => {});
        toast.warning("⚠️ Captura de tela não permitida!", {
          description: "O conteúdo desta página é protegido.",
        });
      }
      // Block Win+Shift+S (Windows snipping tool)
      if ((e.metaKey || e.key === "Meta") && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toast.warning("⚠️ Captura de tela não permitida!", {
          description: "O conteúdo desta página é protegido.",
        });
      }
    };
    const blockDrag = (e: DragEvent) => e.preventDefault();

    document.addEventListener("copy", blockCopy);
    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("dragstart", blockDrag);

    return () => {
      document.removeEventListener("copy", blockCopy);
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("dragstart", blockDrag);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {session ? <AuthenticatedLayout /> : <AuthForm />}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
