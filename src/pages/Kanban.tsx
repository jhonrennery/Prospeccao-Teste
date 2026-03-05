import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone, Globe, MapPin, Star, Mail, GripVertical,
  Kanban as KanbanIcon, DollarSign, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface KanbanItem {
  id: string;
  leadId: string | null;
  status: string;
  estimatedValue: number;
  place: {
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    category: string | null;
    google_maps_url: string | null;
  };
  email?: string | null;
}

const columns = [
  { id: "new", label: "Novo", color: "hsl(var(--info))" },
  { id: "contacted", label: "Contatado", color: "hsl(var(--warning))" },
  { id: "interested", label: "Interessado", color: "hsl(var(--primary))" },
  { id: "converted", label: "Convertido", color: "hsl(var(--success))" },
  { id: "lost", label: "Perdido", color: "hsl(var(--destructive))" },
];

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function KanbanPage() {
  const [items, setItems] = useState<KanbanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mapsDialog, setMapsDialog] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);

    const { data: places, error: pErr } = await supabase
      .from("places")
      .select("*, place_enrichment:place_enrichment(email)")
      .order("created_at", { ascending: false });

    const { data: leads, error: lErr } = await supabase
      .from("leads")
      .select("id, place_id, status, estimated_value");

    if (pErr || lErr) {
      toast.error("Erro ao carregar dados");
      setLoading(false);
      return;
    }

    const leadMap = new Map<string, { id: string; status: string; estimated_value: number }>();
    (leads || []).forEach((l: any) =>
      leadMap.set(l.place_id, { id: l.id, status: l.status, estimated_value: Number(l.estimated_value) || 0 })
    );

    const mapped: KanbanItem[] = (places || []).map((p: any) => {
      const lead = leadMap.get(p.id);
      return {
        id: p.id,
        leadId: lead?.id || null,
        status: lead?.status || "new",
        estimatedValue: lead?.estimated_value || 0,
        place: {
          name: p.name,
          address: p.address,
          phone: p.phone,
          website: p.website,
          rating: p.rating ? Number(p.rating) : null,
          category: p.category,
          google_maps_url: p.google_maps_url,
        },
        email: p.place_enrichment?.[0]?.email || null,
      };
    });

    setItems(mapped);
    setLoading(false);
  };

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newStatus = destination.droppableId;
    const item = items.find((i) => i.id === draggableId);
    if (!item || item.status === newStatus) return;

    const oldStatus = item.status;
    setItems((prev) => prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i)));

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      if (item.leadId) {
        const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", item.leadId);
        if (error) throw error;
      } else {
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({ place_id: item.id, user_id: userData.user.id, status: newStatus })
          .select()
          .single();
        if (error) throw error;
        setItems((prev) =>
          prev.map((i) => (i.id === draggableId ? { ...i, leadId: newLead.id, status: newStatus } : i))
        );
      }

      const col = columns.find((c) => c.id === newStatus);
      toast.success(`Movido para "${col?.label}"`);
    } catch (err: any) {
      setItems((prev) => prev.map((i) => (i.id === draggableId ? { ...i, status: oldStatus } : i)));
      toast.error(err.message || "Erro ao mover");
    }
  }, [items]);

  const handleSaveValue = async (item: KanbanItem) => {
    const numericValue = parseFloat(editValue.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
    setEditingValueId(null);

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, estimatedValue: numericValue } : i))
    );

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      if (item.leadId) {
        await supabase.from("leads").update({ estimated_value: numericValue }).eq("id", item.leadId);
      } else {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({ place_id: item.id, user_id: userData.user.id, status: item.status, estimated_value: numericValue })
          .select()
          .single();
        if (newLead) {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, leadId: newLead.id } : i))
          );
        }
      }
    } catch {
      toast.error("Erro ao salvar valor");
    }
  };

  const getColumnItems = (columnId: string) => items.filter((i) => i.status === columnId);
  const getColumnTotal = (columnId: string) =>
    items.filter((i) => i.status === columnId).reduce((sum, i) => sum + i.estimatedValue, 0);

  const totalPipeline = items.reduce((sum, i) => sum + i.estimatedValue, 0);
  const totalActive = items
    .filter((i) => i.status !== "lost")
    .reduce((sum, i) => sum + i.estimatedValue, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <KanbanIcon className="h-6 w-6 text-primary" /> Pipeline
          </h1>
        </div>
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <KanbanIcon className="h-6 w-6 text-primary" /> Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste os leads entre as colunas para avançar no funil
          </p>
        </div>

        {/* Summary cards */}
        <div className="flex gap-3">
          <div className="glass-card px-4 py-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pipeline ativo</div>
              <div className="font-display text-base font-bold text-foreground">{formatCurrency(totalActive)}</div>
            </div>
          </div>
          <div className="glass-card px-4 py-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total geral</div>
              <div className="font-display text-base font-bold text-foreground">{formatCurrency(totalPipeline)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {columns.map((col) => {
            const colItems = getColumnItems(col.id);
            const colTotal = getColumnTotal(col.id);
            return (
              <div key={col.id} className="flex-shrink-0 w-[260px] md:w-[280px] lg:w-[300px]">
                {/* Column Header */}
                <div className="mb-3 px-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                      {colItems.length}
                    </span>
                  </div>
                  {/* Column value */}
                  <div className="flex items-center gap-1.5 px-0.5">
                    <DollarSign className="h-3 w-3 text-primary" />
                    <span className="text-xs font-mono font-semibold text-primary">
                      {formatCurrency(colTotal)}
                    </span>
                  </div>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[300px] rounded-lg border border-border/60 p-2 space-y-2 transition-colors ${
                        snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-card/30"
                      }`}
                    >
                      {colItems.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`glass-card p-3 rounded-md transition-shadow ${
                                snapshot.isDragging ? "shadow-lg shadow-primary/10 ring-1 ring-primary/30" : ""
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div
                                    className={`font-medium text-sm truncate ${
                                      item.place.google_maps_url
                                        ? "text-foreground hover:text-primary cursor-pointer transition-colors"
                                        : "text-foreground"
                                    }`}
                                    onClick={() => {
                                      if (item.place.google_maps_url) {
                                        setMapsDialog({ name: item.place.name, url: item.place.google_maps_url });
                                      }
                                    }}
                                  >
                                    {item.place.name}
                                  </div>
                                  {item.place.category && (
                                    <Badge variant="secondary" className="text-[10px] mt-1">
                                      {item.place.category}
                                    </Badge>
                                  )}
                                  <div className="mt-2 space-y-1">
                                    {item.place.address && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.place.address}</span>
                                      </div>
                                    )}
                                    {item.place.phone && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        {item.place.phone}
                                      </div>
                                    )}
                                    {item.place.website && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Globe className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          {item.place.website.replace(/https?:\/\/(www\.)?/, "")}
                                        </span>
                                      </div>
                                    )}
                                    {item.email && (
                                      <div className="flex items-center gap-1 text-[11px] text-primary">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{item.email}</span>
                                      </div>
                                    )}
                                  </div>
                                  {item.place.rating != null && (
                                    <div className="flex items-center gap-1 mt-2">
                                      <Star className="h-3 w-3 text-warning fill-warning" />
                                      <span className="text-[11px] font-mono text-muted-foreground">
                                        {item.place.rating}
                                      </span>
                                    </div>
                                  )}

                                  {/* Value input */}
                                  <div className="mt-2 pt-2 border-t border-border/40">
                                    {editingValueId === item.id ? (
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3 text-primary shrink-0" />
                                        <Input
                                          autoFocus
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={() => handleSaveValue(item)}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveValue(item);
                                            if (e.key === "Escape") setEditingValueId(null);
                                          }}
                                          className="h-6 text-xs bg-secondary border-border px-2 py-0"
                                          placeholder="0,00"
                                        />
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingValueId(item.id);
                                          setEditValue(item.estimatedValue > 0 ? item.estimatedValue.toString() : "");
                                        }}
                                        className="flex items-center gap-1 text-[11px] hover:text-primary transition-colors w-full group"
                                      >
                                        <DollarSign className="h-3 w-3 text-primary shrink-0" />
                                        {item.estimatedValue > 0 ? (
                                          <span className="font-mono font-semibold text-primary">
                                            {formatCurrency(item.estimatedValue)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground/50 group-hover:text-muted-foreground">
                                            Definir valor
                                          </span>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colItems.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground/50 py-8">
                          Arraste leads aqui
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
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
    </>
  );
}
