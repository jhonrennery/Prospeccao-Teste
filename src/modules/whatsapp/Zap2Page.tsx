import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageSquare, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getZap2BaseUrl, getZap2HealthUrl } from "@/modules/whatsapp/zap2-config";

type ModuleStatus = "checking" | "ready" | "offline";

export function Zap2Page() {
  const location = useLocation();
  const baseUrl = useMemo(() => getZap2BaseUrl(), []);
  const iframeUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    params.set("embedded", "1");
    const queryString = params.toString();

    if (!queryString) {
      return baseUrl;
    }

    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${queryString}`;
  }, [baseUrl, location.search]);
  const [status, setStatus] = useState<ModuleStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [iframeFailed, setIframeFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const checkModule = async () => {
      setStatus("checking");
      setError(null);
      setIframeFailed(false);

      try {
        const response = await fetch(getZap2HealthUrl(), {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Zap2 respondeu com status ${response.status}.`);
        }

        if (!active) return;
        setStatus("ready");
      } catch (moduleError) {
        if (!active) return;
        setStatus("offline");
        setError(moduleError instanceof Error ? moduleError.message : "Nao foi possivel carregar o modulo Zap2.");
      }
    };

    checkModule();

    return () => {
      active = false;
    };
  }, []);

  if (status === "ready") {
    if (iframeFailed) {
      return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                WhatsApp by Zap2
              </CardTitle>
              <CardDescription>
                O modulo respondeu no healthcheck, mas o iframe nao conseguiu abrir a interface.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Isso costuma acontecer quando o navegador manteve um redirect antigo em cache.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => window.location.reload()} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recarregar pagina
                </Button>
                <Button asChild variant="outline">
                  <a href={iframeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir modulo direto
                  </a>
                </Button>
              </div>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                URL do iframe: <span className="font-mono text-foreground">{iframeUrl}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-hidden bg-[#0f171c]">
        <iframe
          title="Zap2 WhatsApp"
          src={iframeUrl}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; microphone"
          onError={() => {
            setIframeFailed(true);
            setError("O iframe do Zap2 falhou ao carregar.");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center p-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            WhatsApp by Zap2
          </CardTitle>
          <CardDescription>
            O app principal agora usa o modulo isolado do Zap2 para a operacao de WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {status === "checking"
              ? "Verificando disponibilidade do modulo..."
              : error || "O modulo Zap2 nao respondeu ao healthcheck."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.location.reload()} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
            <Button asChild variant="outline">
              <a href={iframeUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir modulo direto
              </a>
            </Button>
          </div>
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            URL configurada do modulo: <span className="font-mono text-foreground">{iframeUrl}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Zap2Page;
