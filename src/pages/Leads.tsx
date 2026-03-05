import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Phone, Globe, MapPin, Star, Trash2,
  Search, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  status: string;
  tags: string[];
  notes: string | null;
  estimated_value: number | null;
  created_at: string;
  place: {
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    category: string | null;
    google_maps_url: string | null;
  };
}

const statusOptions = [
  { value: "new", label: "Novo", color: "bg-info/15 text-info border-info/30" },
  { value: "contacted", label: "Contatado", color: "bg-warning/15 text-warning border-warning/30" },
  { value: "interested", label: "Interessado", color: "bg-primary/15 text-primary border-primary/30" },
  { value: "converted", label: "Convertido", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { value: "lost", label: "Perdido", color: "bg-destructive/15 text-destructive border-destructive/30" },
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapsDialog, setMapsDialog] = useState<{ name: string; url: string } | null>(null);

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
        estimated_value: l.estimated_value,
        created_at: l.created_at,
        place: {
          name: l.places?.name || "—",
          address: l.places?.address,
          phone: l.places?.phone,
          website: l.places?.website,
          rating: l.places?.rating ? Number(l.places.rating) : null,
          category: l.places?.category,
          google_maps_url: l.places?.google_maps_url,
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

  const filtered = leads
    .filter((l) => filterStatus === "all" || l.status === filterStatus)
    .filter((l) =>
      !searchQuery ||
      l.place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.place.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.place.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const statusCounts = statusOptions.map((s) => ({
    ...s,
    count: leads.filter((l) => l.status === s.value).length,
  }));

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Leads
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{leads.length} leads no total</p>
      </div>

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({leads.length})
          </button>
          {statusCounts.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s.value
                  ? s.color
                  : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {s.label} ({s.count})
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary border-border"
          />
        </div>
      </div>

      {/* Lead cards */}
      {loading ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          {leads.length === 0
            ? "Nenhum lead encontrado. Faça uma prospecção primeiro!"
            : "Nenhum lead corresponde aos filtros."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lead) => {
            const statusInfo = statusOptions.find((s) => s.value === lead.status);
            return (
              <div
                key={lead.id}
                className="glass-card p-4 group hover:border-primary/20 transition-colors animate-slide-in"
              >
                {/* Top row: name + category + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`font-semibold text-sm leading-tight ${
                          lead.place.google_maps_url
                            ? "text-foreground hover:text-primary cursor-pointer transition-colors"
                            : "text-foreground"
                        }`}
                        onClick={() => {
                          if (lead.place.google_maps_url) {
                            setMapsDialog({ name: lead.place.name, url: lead.place.google_maps_url });
                          }
                        }}
                      >
                        {lead.place.name}
                      </h3>
                      {lead.place.category && (
                        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                          {lead.place.category}
                        </Badge>
                      )}
                      {lead.place.rating != null && (
                        <span className="flex items-center gap-0.5 text-[11px] text-warning font-medium">
                          <Star className="h-3 w-3 fill-warning" /> {lead.place.rating}
                        </span>
                      )}
                    </div>

                    {/* Info row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {lead.place.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[280px]">{lead.place.address}</span>
                        </span>
                      )}
                      {lead.place.phone && (
                        <a
                          href={`tel:${lead.place.phone}`}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Phone className="h-3 w-3 shrink-0" /> {lead.place.phone}
                        </a>
                      )}
                      {lead.place.website && (
                        <a
                          href={lead.place.website.startsWith("http") ? lead.place.website : `https://${lead.place.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          <Globe className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {lead.place.website.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                          </span>
                          <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </div>

                    {lead.estimated_value != null && lead.estimated_value > 0 && (
                      <div className="mt-2 text-xs font-medium text-primary">
                        {lead.estimated_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    )}
                  </div>

                  {/* Right side: status + actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                      <SelectTrigger className="h-7 w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0">
                        <Badge className={`${statusInfo?.color || ""} border text-[11px] font-medium cursor-pointer`}>
                          {statusInfo?.label || lead.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteLead(lead.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

      <AlertDialog open={!!mapsDialog} onOpenChange={(open) => !open && setMapsDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Visitar no Google Meu Negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja abrir a página do Google Meu Negócio de <strong>{mapsDialog?.name}</strong> em uma nova aba?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (mapsDialog?.url) window.open(mapsDialog.url, "_blank", "noopener,noreferrer");
                setMapsDialog(null);
              }}
            >
              Abrir Google Meu Negócio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
