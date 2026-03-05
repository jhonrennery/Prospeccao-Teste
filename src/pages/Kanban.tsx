import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { Phone, Globe, MapPin, Star, Mail, GripVertical, Kanban as KanbanIcon } from "lucide-react";
import { toast } from "sonner";

interface KanbanLead {
  id: string;
  status: string;
  place: {
    name: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    category: string | null;
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

export default function KanbanPage() {
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*, places(*), place_enrichment:place_enrichment(email)")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar leads");
    } else {
      const mapped: KanbanLead[] = (data || []).map((l: any) => ({
        id: l.id,
        status: l.status || "new",
        place: {
          name: l.places?.name || "—",
          address: l.places?.address,
          phone: l.places?.phone,
          website: l.places?.website,
          rating: l.places?.rating ? Number(l.places.rating) : null,
          category: l.places?.category,
        },
        email: l.place_enrichment?.[0]?.email || null,
      }));
      setLeads(mapped);
    }
    setLoading(false);
  };

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newStatus = destination.droppableId;
    const lead = leads.find((l) => l.id === draggableId);
    if (!lead || lead.status === newStatus) return;

    // Optimistic update
    setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: newStatus } : l)));

    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", draggableId);
    if (error) {
      // Revert
      setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: lead.status } : l)));
      toast.error("Erro ao mover lead");
    } else {
      const col = columns.find((c) => c.id === newStatus);
      toast.success(`Lead movido para "${col?.label}"`);
    }
  }, [leads]);

  const getColumnLeads = (columnId: string) => leads.filter((l) => l.status === columnId);

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
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <KanbanIcon className="h-6 w-6 text-primary" /> Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Arraste os leads entre as colunas para atualizar o status
        </p>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {columns.map((col) => {
            const colLeads = getColumnLeads(col.id);
            return (
              <div key={col.id} className="flex-shrink-0 w-[260px] md:w-[280px] lg:w-[300px]">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {colLeads.length}
                  </span>
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
                      {colLeads.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
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
                                  <div className="font-medium text-sm text-foreground truncate">
                                    {lead.place.name}
                                  </div>
                                  {lead.place.category && (
                                    <Badge variant="secondary" className="text-[10px] mt-1">
                                      {lead.place.category}
                                    </Badge>
                                  )}
                                  <div className="mt-2 space-y-1">
                                    {lead.place.address && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{lead.place.address}</span>
                                      </div>
                                    )}
                                    {lead.place.phone && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        {lead.place.phone}
                                      </div>
                                    )}
                                    {lead.place.website && (
                                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Globe className="h-3 w-3 shrink-0" />
                                        <span className="truncate">
                                          {lead.place.website.replace(/https?:\/\/(www\.)?/, "")}
                                        </span>
                                      </div>
                                    )}
                                    {lead.email && (
                                      <div className="flex items-center gap-1 text-[11px] text-primary">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{lead.email}</span>
                                      </div>
                                    )}
                                  </div>
                                  {lead.place.rating != null && (
                                    <div className="flex items-center gap-1 mt-2">
                                      <Star className="h-3 w-3 text-warning fill-warning" />
                                      <span className="text-[11px] font-mono text-muted-foreground">
                                        {lead.place.rating}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colLeads.length === 0 && (
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
  );
}
