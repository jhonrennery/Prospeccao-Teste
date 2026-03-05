import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Calendar, MapPin, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SearchJob {
  id: string;
  segment: string;
  location: string;
  radius_km: number;
  status: string;
  total_found: number;
  created_at: string;
}

export default function Searches() {
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("search_jobs")
        .select("*")
        .order("created_at", { ascending: false });
      setJobs((data || []) as SearchJob[]);
      setLoading(false);
    };
    load();
  }, []);

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-primary/20 text-primary">Concluída</Badge>;
      case "running": return <Badge className="bg-warning/20 text-warning animate-pulse-glow">Rodando</Badge>;
      case "failed": return <Badge className="bg-destructive/20 text-destructive">Falhou</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Histórico de Buscas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{jobs.length} buscas realizadas</p>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : jobs.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhuma busca realizada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="glass-card p-4 flex items-center justify-between animate-slide-in">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-foreground">{job.segment}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location} ({job.radius_km}km)</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-foreground">{job.total_found} resultados</span>
                {statusBadge(job.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
