import { useState } from "react";
import { Search, MapPin, Star, Globe, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export interface SearchParams {
  segment: string;
  location: string;
  radius_km: number;
  minimum_rating: number;
  has_website: boolean;
  max_results: number;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [params, setParams] = useState<SearchParams>({
    segment: "",
    location: "",
    radius_km: 10,
    minimum_rating: 0,
    has_website: false,
    max_results: 50,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.segment.trim() || !params.location.trim()) return;
    onSearch(params);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6 animate-slide-in">
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">Nova Prospecção</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Segmento</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex: Restaurantes, Dentistas..."
              value={params.segment}
              onChange={(e) => setParams((p) => ({ ...p, segment: e.target.value }))}
              className="pl-10 bg-secondary border-border"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wider">Localização</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ex: São Paulo, SP"
              value={params.location}
              onChange={(e) => setParams((p) => ({ ...p, location: e.target.value }))}
              className="pl-10 bg-secondary border-border"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Raio</Label>
            <span className="text-xs font-mono text-primary">{params.radius_km} km</span>
          </div>
          <Slider
            value={[params.radius_km]}
            onValueChange={([v]) => setParams((p) => ({ ...p, radius_km: v }))}
            min={1}
            max={50}
            step={1}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
              <Star className="h-3 w-3" /> Avaliação mínima
            </Label>
            <span className="text-xs font-mono text-primary">{params.minimum_rating}</span>
          </div>
          <Slider
            value={[params.minimum_rating]}
            onValueChange={([v]) => setParams((p) => ({ ...p, minimum_rating: v }))}
            min={0}
            max={5}
            step={0.5}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
              <Hash className="h-3 w-3" /> Máx. resultados
            </Label>
            <span className="text-xs font-mono text-primary">{params.max_results}</span>
          </div>
          <Slider
            value={[params.max_results]}
            onValueChange={([v]) => setParams((p) => ({ ...p, max_results: v }))}
            min={10}
            max={200}
            step={10}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={params.has_website}
            onCheckedChange={(v) => setParams((p) => ({ ...p, has_website: v }))}
          />
          <Label className="text-sm text-muted-foreground flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" /> Apenas com website
          </Label>
        </div>

        <Button type="submit" disabled={isLoading || !params.segment.trim() || !params.location.trim()}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Buscando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Iniciar Prospecção
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
