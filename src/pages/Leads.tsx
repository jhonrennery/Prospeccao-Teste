import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Phone, Mail, Globe, MapPin, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  status: string;
  tags: string[];
  notes: string | null;
  created_at: string;
  place: {
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    category: string | null;
    email?: string | null;
  };
}

const statusOptions = [
  { value: "new", label: "Novo", color: "bg-info/20 text-info" },
  { value: "contacted", label: "Contatado", color: "bg-warning/20 text-warning" },
  { value: "interested", label: "Interessado", color: "bg-primary/20 text-primary" },
  { value: "converted", label: "Convertido", color: "bg-success/20 text-success" },
  { value: "lost", label: "Perdido", color: "bg-destructive/20 text-destructive" },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*, places(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar leads");
    } else {
      const mapped: Lead[] = (data || []).map((l: any) => ({
        id: l.id,
        status: l.status,
        tags: l.tags || [],
        notes: l.notes,
        created_at: l.created_at,
        place: {
          name: l.places?.name || "—",
          address: l.places?.address,
          phone: l.places?.phone,
          website: l.places?.website,
          rating: l.places?.rating ? Number(l.places.rating) : null,
          category: l.places?.category,
        },
      }));
      setLeads(mapped);
    }
    setLoading(false);
  };

  const updateStatus = async (leadId: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
      toast.success("Status atualizado");
    }
  };

  const deleteLead = async (leadId: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) {
      toast.error("Erro ao remover lead");
    } else {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      toast.success("Lead removido");
    }
  };

  const filtered = filterStatus === "all" ? leads : leads.filter((l) => l.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} leads no total</p>
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-secondary">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum lead encontrado. Faça uma prospecção primeiro!
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => {
            const statusInfo = statusOptions.find((s) => s.value === lead.status);
            return (
              <div key={lead.id} className="glass-card p-4 flex items-center justify-between animate-slide-in">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{lead.place.name}</span>
                    {lead.place.category && (
                      <Badge variant="secondary" className="text-[10px]">{lead.place.category}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    {lead.place.address && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {lead.place.address}</span>
                    )}
                    {lead.place.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.place.phone}</span>
                    )}
                    {lead.place.website && (
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {lead.place.website.replace(/https?:\/\/(www\.)?/, "")}</span>
                    )}
                    {lead.place.rating != null && (
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-warning" /> {lead.place.rating}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <Badge className={statusInfo?.color || ""}>
                        {statusInfo?.label || lead.status}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteLead(lead.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
