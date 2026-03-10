import { useState } from "react";
import { ExternalLink, Phone, Mail, Star, Globe, MapPin, Plus, Check, Loader2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  total_reviews?: number;
  category?: string;
  google_maps_url?: string;
  email?: string;
  enrichment_status?: "pending" | "enriched" | "not_found";
  is_lead?: boolean;
}

interface ResultsTableProps {
  results: PlaceResult[];
  onAddToLeads: (ids: string[]) => void;
  onEnrich: (ids: string[]) => void;
  isEnriching: boolean;
}

export function ResultsTable({ results, onAddToLeads, onEnrich, isEnriching }: ResultsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (results.length === 0) return null;

  return (
    <div className="glass-card animate-slide-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 border-b border-border px-3 md:px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{results.length}</span> resultados
          </span>
          {selected.size > 0 && (
            <span className="text-sm text-primary font-mono">{selected.size} selecionados</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || isEnriching}
            onClick={() => onEnrich(Array.from(selected))}
          >
            {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
            Enriquecer
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => onAddToLeads(Array.from(selected))}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar a Leads
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 w-10">
                <Checkbox checked={selected.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Empresa</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Contato</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Avaliação</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {results.map((place) => (
              <tr
                key={place.id}
                className={cn(
                  "border-b border-border/50 transition-colors hover:bg-secondary/50",
                  selected.has(place.id) && "bg-primary/5"
                )}
              >
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(place.id)} onCheckedChange={() => toggle(place.id)} />
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium text-foreground">{place.name}</div>
                    {place.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {place.address}
                      </div>
                    )}
                    {place.category && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">{place.category}</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {place.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {place.phone}
                      </div>
                    )}
                    {place.website && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        <a href={place.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate max-w-[120px] md:max-w-[180px] lg:max-w-[240px]">
                          {place.website.replace(/https?:\/\/(www\.)?/, "")}
                        </a>
                      </div>
                    )}
                    {place.email && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Mail className="h-3 w-3" />
                        {place.email}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {place.rating != null && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-warning fill-warning" />
                      <span className="font-mono text-sm">{place.rating}</span>
                      {place.total_reviews != null && (
                        <span className="text-xs text-muted-foreground">({place.total_reviews})</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {place.is_lead ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      <Check className="h-3 w-3 mr-1" /> Lead
                    </Badge>
                  ) : place.enrichment_status === "enriched" ? (
                    <Badge className="bg-info/20 text-info border-info/30">Enriquecido</Badge>
                  ) : place.enrichment_status === "pending" ? (
                    <Badge variant="secondary">Pendente</Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {place.google_maps_url && (
                    <a href={place.google_maps_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
