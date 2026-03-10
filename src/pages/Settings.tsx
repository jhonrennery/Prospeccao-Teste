import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Settings, User, Bell, Shield, Palette, LogOut, Save, Mail, Eye,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [defaultMaxResults, setDefaultMaxResults] = useState("50");
  const [copyProtection, setCopyProtection] = useState(true);
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const [watermark, setWatermark] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser({ email: data.user.email || "", id: data.user.id });
        setDisplayName(data.user.user_metadata?.display_name || "");

        // Check admin role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!roleData);
      }
    });

    // Load saved preferences from localStorage
    const prefs = localStorage.getItem("prospect_settings");
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        setNotifyEmail(parsed.notifyEmail ?? true);
        setDarkMode(parsed.darkMode ?? false);
        setAutoEnrich(parsed.autoEnrich ?? true);
        setDefaultMaxResults(parsed.defaultMaxResults ?? "50");
        setCopyProtection(parsed.copyProtection ?? true);
        setScreenshotProtection(parsed.screenshotProtection ?? true);
        setWatermark(parsed.watermark ?? true);
      } catch {}
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: { display_name: displayName },
    });

    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      localStorage.setItem(
        "prospect_settings",
        JSON.stringify({
          notifyEmail, darkMode, autoEnrich, defaultMaxResults,
          copyProtection, screenshotProtection, watermark,
        })
      );
      toast.success("Configurações salvas! Recarregue a página para aplicar as proteções.");
    }

    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      toast.error("Erro ao enviar email de redefinição");
    } else {
      toast.success("Email de redefinição de senha enviado!");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seu perfil e preferências
        </p>
      </div>

      {/* Profile */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground">Perfil</h2>
        </div>
        <Separator />
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
            <div className="flex items-center gap-2 text-sm text-foreground bg-secondary rounded-md px-3 py-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {user?.email || "—"}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nome de exibição</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
              className="bg-secondary border-border"
            />
          </div>
        </div>
      </section>

      {/* Prospection defaults */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground">Prospecção</h2>
        </div>
        <Separator />
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Máximo de resultados padrão
            </Label>
            <Input
              type="number"
              value={defaultMaxResults}
              onChange={(e) => setDefaultMaxResults(e.target.value)}
              min={10}
              max={200}
              className="bg-secondary border-border w-32"
            />
            <p className="text-[11px] text-muted-foreground">
              Quantidade padrão de resultados por busca (10-200)
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Enriquecimento automático</p>
              <p className="text-[11px] text-muted-foreground">
                Buscar emails automaticamente após prospecção
              </p>
            </div>
            <Switch checked={autoEnrich} onCheckedChange={setAutoEnrich} />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground">Notificações</h2>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Notificações por email</p>
            <p className="text-[11px] text-muted-foreground">
              Receber atualizações sobre prospecções concluídas
            </p>
          </div>
          <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
        </div>
      </section>

      {/* Protection Settings - Admin Only */}
      {isAdmin && (
        <section className="glass-card p-5 space-y-4 border border-primary/20">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">Proteções</h2>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Proteção contra cópia</p>
                <p className="text-[11px] text-muted-foreground">
                  Bloqueia Ctrl+C, clique direito, seleção de texto e arrastar
                </p>
              </div>
              <Switch checked={copyProtection} onCheckedChange={setCopyProtection} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Bloqueio de captura de tela</p>
                <p className="text-[11px] text-muted-foreground">
                  Bloqueia Print Screen e Win+Shift+S com alerta
                </p>
              </div>
              <Switch checked={screenshotProtection} onCheckedChange={setScreenshotProtection} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Marca d'água</p>
                <p className="text-[11px] text-muted-foreground">
                  Exibe texto diagonal sutil sobre toda a interface
                </p>
              </div>
              <Switch checked={watermark} onCheckedChange={setWatermark} />
            </div>
          </div>
        </section>
      )}

      {/* Security */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground">Segurança</h2>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Redefinir senha</p>
            <p className="text-[11px] text-muted-foreground">
              Enviaremos um link de redefinição para seu email
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePasswordReset} className="text-xs">
            Enviar email
          </Button>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="destructive" size="sm" onClick={handleLogout} className="text-xs">
          <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sair da conta
        </Button>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}