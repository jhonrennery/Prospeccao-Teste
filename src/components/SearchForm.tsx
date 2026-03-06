import { useState, useMemo } from "react";
import {
  Search, MapPin, Star, Globe, Hash, SlidersHorizontal,
  ChevronDown, ChevronUp, MessageSquare, Phone, Mail,
  Filter, Languages, Tag, Building2, Navigation, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBrazilianLocations } from "@/hooks/useBrazilianLocations";

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export interface SearchParams {
  segment: string;
  location: string;
  state: string;
  city: string;
  neighborhood: string;
  cep: string;
  radius_km: number;
  minimum_rating: number;
  has_website: boolean;
  max_results: number;
  min_reviews: number;
  has_phone: boolean;
  has_email: boolean;
  exclude_already_prospected: boolean;
  sort_by: "relevance" | "rating" | "reviews";
  search_language: string;
  keywords_include: string;
  keywords_exclude: string;
  category_filter: string;
}

const brazilianStates = [
  { value: "", label: "Todos" },
  { value: "AC", label: "AC" }, { value: "AL", label: "AL" }, { value: "AP", label: "AP" },
  { value: "AM", label: "AM" }, { value: "BA", label: "BA" }, { value: "CE", label: "CE" },
  { value: "DF", label: "DF" }, { value: "ES", label: "ES" }, { value: "GO", label: "GO" },
  { value: "MA", label: "MA" }, { value: "MT", label: "MT" }, { value: "MS", label: "MS" },
  { value: "MG", label: "MG" }, { value: "PA", label: "PA" }, { value: "PB", label: "PB" },
  { value: "PR", label: "PR" }, { value: "PE", label: "PE" }, { value: "PI", label: "PI" },
  { value: "RJ", label: "RJ" }, { value: "RN", label: "RN" }, { value: "RS", label: "RS" },
  { value: "RO", label: "RO" }, { value: "RR", label: "RR" }, { value: "SC", label: "SC" },
  { value: "SP", label: "SP" }, { value: "SE", label: "SE" }, { value: "TO", label: "TO" },
];

const segmentCategories: Record<string, string[]> = {
  "Saúde": [
    "Dentistas", "Clínicas médicas", "Clínicas odontológicas", "Médicos", "Psicólogos",
    "Fisioterapeutas", "Nutricionistas", "Fonoaudiólogos", "Oftalmologistas", "Dermatologistas",
    "Ortopedistas", "Cardiologistas", "Ginecologistas", "Pediatras", "Urologistas",
    "Psiquiatras", "Veterinários", "Clínicas veterinárias", "Laboratórios de análises",
    "Clínicas de estética", "Farmácias", "Drogarias", "Óticas", "Hospitais",
    "Clínicas de reabilitação", "Acupunturistas", "Quiropratas", "Terapeutas ocupacionais",
    "Clínicas de fertilização", "Homeopatas", "Podólogos",
  ],
  "Alimentação": [
    "Restaurantes", "Padarias", "Confeitarias", "Pizzarias", "Lanchonetes",
    "Hamburguerias", "Churrascarias", "Sorveterias", "Cafeterias", "Bares",
    "Distribuidoras de bebidas", "Açaiterias", "Docerias", "Food trucks",
    "Restaurantes japoneses", "Restaurantes italianos", "Restaurantes árabes",
    "Casas de açaí", "Buffets", "Marmitarias", "Sushi bars", "Tapiocarias",
    "Pastelarias", "Casas de bolos", "Empórios", "Delicatessens",
  ],
  "Beleza e Estética": [
    "Salões de beleza", "Barbearias", "Clínicas de estética", "Estúdios de sobrancelha",
    "Estúdios de unhas", "Depilação", "Centros de bronzeamento", "Cabeleireiros",
    "Maquiadores", "Spas", "Estúdios de micropigmentação", "Estúdios de extensão de cílios",
    "Design de sobrancelhas", "Estúdios de tatuagem", "Estúdios de piercing",
  ],
  "Educação": [
    "Escolas", "Faculdades", "Cursos de idiomas", "Escolas de música", "Autoescolas",
    "Cursos profissionalizantes", "Creches", "Escolas infantis", "Pré-vestibulares",
    "Escolas de informática", "Escolas de dança", "Escolas de natação",
    "Cursos técnicos", "Reforço escolar", "Professores particulares",
    "Escolas de artes marciais", "Universidades", "Cursos online",
  ],
  "Jurídico": [
    "Advogados", "Escritórios de advocacia", "Advogados trabalhistas", "Advogados criminalistas",
    "Advogados de família", "Advogados tributaristas", "Advogados imobiliários",
    "Advogados previdenciários", "Advogados empresariais", "Cartórios",
    "Despachantes", "Mediadores", "Consultoria jurídica",
  ],
  "Contabilidade e Finanças": [
    "Contadores", "Escritórios de contabilidade", "Consultores financeiros",
    "Corretoras de seguros", "Assessoria de investimentos", "Cooperativas de crédito",
    "Correspondentes bancários", "Consultoria empresarial", "Auditores",
    "Peritos contábeis", "Administradoras de consórcios",
  ],
  "Construção e Imóveis": [
    "Imobiliárias", "Construtoras", "Arquitetos", "Engenheiros civis",
    "Lojas de materiais de construção", "Marmorarias", "Vidraçarias", "Serralheiras",
    "Pintores", "Eletricistas", "Encanadores", "Pedreiros", "Decoradores de interiores",
    "Paisagistas", "Corretores de imóveis", "Administradoras de condomínios",
    "Empresas de reformas", "Gesseiros", "Marcenarias", "Madeireiras",
  ],
  "Tecnologia": [
    "Assistência técnica de celulares", "Assistência técnica de computadores",
    "Lojas de informática", "Desenvolvimento de software", "Agências digitais",
    "Agências de marketing digital", "Consultoria em TI", "Web designers",
    "Provedores de internet", "Lojas de eletrônicos", "Empresas de segurança eletrônica",
    "Automação residencial", "Suporte técnico", "Data centers",
  ],
  "Automotivo": [
    "Oficinas mecânicas", "Auto elétricas", "Funilaria e pintura", "Autopeças",
    "Borracharias", "Lava-jatos", "Concessionárias", "Estacionamentos",
    "Locadoras de veículos", "Despachantes veiculares", "Seguros de automóveis",
    "Som automotivo", "Chaveiros automotivos", "Guincho", "Envelopamento veicular",
    "Centros automotivos", "Retíficas de motores",
  ],
  "Comércio e Varejo": [
    "Lojas de roupas", "Lojas de calçados", "Lojas de acessórios", "Joalherias",
    "Papelarias", "Livrarias", "Lojas de brinquedos", "Lojas de cosméticos",
    "Supermercados", "Minimercados", "Atacadistas", "Lojas de presentes",
    "Floriculturas", "Lojas de artigos esportivos", "Lojas de móveis",
    "Lojas de eletrodomésticos", "Lojas de artigos para festas", "Lojas de tecidos",
    "Lojas de artigos religiosos", "Sex shops", "Lojas de produtos naturais",
    "Tabacarias", "Antiquários", "Bazares", "Boutiques",
  ],
  "Serviços Gerais": [
    "Chaveiros", "Dedetizadoras", "Empresas de limpeza", "Lavanderias",
    "Empresas de mudanças", "Empresas de desentupimento", "Empresas de impermeabilização",
    "Jardinagem", "Motoboys", "Transportadoras", "Gráficas", "Copiadoras",
    "Costureiras e alfaiates", "Fotógrafos", "Vidraceiros", "Caçambas",
    "Serviços de portaria", "Empresas de segurança patrimonial",
  ],
  "Fitness e Esportes": [
    "Academias", "Estúdios de pilates", "Estúdios de yoga", "Crossfit",
    "Personal trainers", "Escolas de lutas", "Escolas de natação", "Campos de futebol",
    "Quadras esportivas", "Centros esportivos", "Lojas de suplementos",
    "Estúdios de funcional", "Escolas de tênis", "Clubes recreativos",
  ],
  "Turismo e Hospedagem": [
    "Hotéis", "Pousadas", "Hostels", "Agências de viagem", "Guias turísticos",
    "Resorts", "Casas de temporada", "Motéis", "Parques aquáticos",
    "Empresas de turismo", "Receptivos turísticos", "Campings",
  ],
  "Eventos e Entretenimento": [
    "Buffets", "Casas de festas", "DJs", "Bandas e músicos", "Decoradores de eventos",
    "Organizadores de eventos", "Cerimonialistas", "Locação de som e iluminação",
    "Locação de brinquedos", "Espaços para eventos", "Casas noturnas",
    "Cinemas", "Teatros", "Parques de diversão", "Escape rooms",
  ],
  "Pet e Animais": [
    "Pet shops", "Clínicas veterinárias", "Banho e tosa", "Hotéis para pets",
    "Adestradores", "Dog walkers", "Lojas de aquários", "Agropecuárias",
    "Criadores de cães", "Pet sitters",
  ],
  "Comunicação e Marketing": [
    "Agências de publicidade", "Assessoria de imprensa", "Produtoras de vídeo",
    "Estúdios de fotografia", "Agências de marketing", "Gráficas",
    "Empresas de comunicação visual", "Promotores de vendas", "Influenciadores digitais",
    "Estúdios de podcast", "Agências de social media",
  ],
  "Indústria": [
    "Metalúrgicas", "Indústrias alimentícias", "Fábricas de móveis", "Confecções",
    "Indústrias têxteis", "Indústrias químicas", "Indústrias de plásticos",
    "Indústrias de embalagens", "Tornearias", "Caldeirarias", "Fundições",
  ],
  "Agronegócio": [
    "Agropecuárias", "Lojas de insumos agrícolas", "Consultoria agrícola",
    "Veterinários rurais", "Cooperativas agrícolas", "Silos e armazéns",
    "Máquinas agrícolas", "Sementes e mudas", "Irrigação",
  ],
  "Religião e Espiritualidade": [
    "Igrejas", "Templos", "Centros espíritas", "Terreiros", "Sinagogas",
    "Mesquitas", "Lojas de artigos religiosos", "Terapeutas holísticos",
  ],
};

const segmentSuggestions = Object.entries(segmentCategories).flatMap(
  ([, items]) => items
);

const languageOptions = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [params, setParams] = useState<SearchParams>({
    segment: "",
    location: "",
    state: "",
    city: "",
    neighborhood: "",
    cep: "",
    radius_km: 10,
    minimum_rating: 0,
    has_website: false,
    max_results: 50,
    min_reviews: 0,
    has_phone: false,
    has_email: false,
    exclude_already_prospected: true,
    sort_by: "relevance",
    search_language: "pt",
    keywords_include: "",
    keywords_exclude: "",
    category_filter: "",
  });

  const { cities, districts, loadingCities, loadingDistricts } = useBrazilianLocations(params.state, params.city);

  const [citySearch, setCitySearch] = useState("");
  const filteredCities = useMemo(() => {
    if (!citySearch) return cities.slice(0, 50);
    return cities.filter((c) => c.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 50);
  }, [cities, citySearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.segment.trim()) return;
    // Build location from city/state/neighborhood/cep
    const hasLocation = params.city || params.location.trim() || params.cep.trim();
    if (!hasLocation) return;

    // Build the location string for the search
    let builtLocation = params.location.trim();
    if (params.city) {
      builtLocation = params.city;
      if (params.neighborhood && params.neighborhood !== "all") {
        builtLocation = `${params.neighborhood}, ${params.city}`;
      }
    }
    if (params.cep.trim()) {
      builtLocation = builtLocation ? `${builtLocation}, ${params.cep.trim()}` : params.cep.trim();
    }

    onSearch({ ...params, location: builtLocation });
  };

  const activeFiltersCount = [
    params.minimum_rating > 0,
    params.min_reviews > 0,
    params.has_website,
    params.has_phone,
    params.has_email,
    params.exclude_already_prospected,
    params.sort_by !== "relevance",
    params.keywords_include.trim() !== "",
    params.keywords_exclude.trim() !== "",
    params.category_filter.trim() !== "",
  ].filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="glass-card animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 pb-0 md:pb-0">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">Nova Prospecção</h2>
        </div>
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            <Filter className="h-3 w-3 mr-1" />
            {activeFiltersCount} filtro{activeFiltersCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="p-4 md:p-6 space-y-4 md:space-y-5">
        {/* Main inputs - Segmento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-2 relative">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Segmento</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: Restaurantes, Dentistas..."
                value={params.segment}
                onChange={(e) => {
                  setParams((p) => ({ ...p, segment: e.target.value }));
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-10 bg-secondary border-border"
              />
            </div>
            {showSuggestions && (
              <div className="absolute z-20 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
                {params.segment.trim().length === 0 ? (
                  // Show categories when input is empty
                  Object.entries(segmentCategories).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50 sticky top-0">
                        {category}
                      </div>
                      {items.slice(0, 5).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                          onMouseDown={() => {
                            setParams((p) => ({ ...p, segment: s }));
                            setShowSuggestions(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ))
                ) : (
                  // Filter across all segments when typing
                  (() => {
                    const query = params.segment.toLowerCase();
                    const matches: { category: string; item: string }[] = [];
                    for (const [cat, items] of Object.entries(segmentCategories)) {
                      for (const item of items) {
                        if (item.toLowerCase().includes(query)) {
                          matches.push({ category: cat, item });
                        }
                      }
                    }
                    return matches.slice(0, 12).map(({ category, item }) => (
                      <button
                        key={item}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
                        onMouseDown={() => {
                          setParams((p) => ({ ...p, segment: item }));
                          setShowSuggestions(false);
                        }}
                      >
                        <span>{item}</span>
                        <span className="text-[10px] text-muted-foreground">{category}</span>
                      </button>
                    ));
                  })()
                )}
                  ))}
              </div>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Estado (UF)</Label>
            <Select
              value={params.state}
              onValueChange={(v) => {
                setParams((p) => ({ ...p, state: v, city: "", neighborhood: "", location: "" }));
                setCitySearch("");
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o estado" />
              </SelectTrigger>
              <SelectContent>
                {brazilianStates.map((s) => (
                  <SelectItem key={s.value || "all"} value={s.value || "all"}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Location row - Cidade, Bairro, CEP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* Cidade - dropdown when state selected, input otherwise */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Cidade
              {loadingCities && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            {params.state && params.state !== "all" && cities.length > 0 ? (
              <Select
                value={params.city}
                onValueChange={(v) => {
                  setParams((p) => ({ ...p, city: v, neighborhood: "", location: v }));
                }}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5">
                    <Input
                      placeholder="Buscar cidade..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      className="h-8 text-sm bg-background"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value="all">Todas as cidades</SelectItem>
                  {filteredCities.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: São Paulo"
                  value={params.location}
                  onChange={(e) => setParams((p) => ({ ...p, location: e.target.value }))}
                  className="pl-10 bg-secondary border-border"
                />
              </div>
            )}
          </div>

          {/* Bairro */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Bairro
              {loadingDistricts && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            {params.city && params.city !== "all" && districts.length > 0 ? (
              <Select
                value={params.neighborhood}
                onValueChange={(v) => setParams((p) => ({ ...p, neighborhood: v }))}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bairros</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Ex: Centro, Jardins..."
                value={params.neighborhood}
                onChange={(e) => setParams((p) => ({ ...p, neighborhood: e.target.value }))}
                className="bg-secondary border-border"
                disabled={!params.city && !params.location}
              />
            )}
          </div>

          {/* CEP */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">CEP</Label>
            <Input
              placeholder="Ex: 01001-000"
              value={params.cep}
              onChange={(e) => setParams((p) => ({ ...p, cep: e.target.value }))}
              className="bg-secondary border-border"
            />
            <p className="text-[10px] text-muted-foreground/70">Opcional - refina a localização</p>
          </div>
        </div>

        {/* Primary sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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

        {/* Toggle switches row */}
        <div className="flex flex-wrap gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={params.has_website}
              onCheckedChange={(v) => setParams((p) => ({ ...p, has_website: v }))}
            />
            <Label className="text-sm text-muted-foreground flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Com website
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={params.has_phone}
              onCheckedChange={(v) => setParams((p) => ({ ...p, has_phone: v }))}
            />
            <Label className="text-sm text-muted-foreground flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> Com telefone
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={params.exclude_already_prospected}
              onCheckedChange={(v) => setParams((p) => ({ ...p, exclude_already_prospected: v }))}
            />
            <Label className="text-sm text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Excluir já prospectados
            </Label>
          </div>
        </div>

        {/* Advanced filters toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-full"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filtros avançados</span>
          {showAdvanced ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
        </button>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="border-t border-border pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Min reviews */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Mín. avaliações
                  </Label>
                  <span className="text-xs font-mono text-primary">{params.min_reviews}</span>
                </div>
                <Slider
                  value={[params.min_reviews]}
                  onValueChange={([v]) => setParams((p) => ({ ...p, min_reviews: v }))}
                  min={0}
                  max={500}
                  step={10}
                />
              </div>

              {/* Sort by */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Ordenar por</Label>
                <Select
                  value={params.sort_by}
                  onValueChange={(v: any) => setParams((p) => ({ ...p, sort_by: v }))}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevância</SelectItem>
                    <SelectItem value="rating">Melhor avaliação</SelectItem>
                    <SelectItem value="reviews">Mais avaliações</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                  <Languages className="h-3 w-3" /> Idioma da busca
                </Label>
                <Select
                  value={params.search_language}
                  onValueChange={(v) => setParams((p) => ({ ...p, search_language: v }))}
                >
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Palavras-chave (incluir)
                </Label>
                <Input
                  placeholder="Ex: delivery, 24h..."
                  value={params.keywords_include}
                  onChange={(e) => setParams((p) => ({ ...p, keywords_include: e.target.value }))}
                  className="bg-secondary border-border"
                />
                <p className="text-[10px] text-muted-foreground/70">Separe por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Palavras-chave (excluir)
                </Label>
                <Input
                  placeholder="Ex: fechado, temporariamente..."
                  value={params.keywords_exclude}
                  onChange={(e) => setParams((p) => ({ ...p, keywords_exclude: e.target.value }))}
                  className="bg-secondary border-border"
                />
                <p className="text-[10px] text-muted-foreground/70">Separe por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Categoria específica
                </Label>
                <Input
                  placeholder="Ex: pizzaria, ortodontista..."
                  value={params.category_filter}
                  onChange={(e) => setParams((p) => ({ ...p, category_filter: e.target.value }))}
                  className="bg-secondary border-border"
                />
                <p className="text-[10px] text-muted-foreground/70">Subcategoria dentro do segmento</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 pt-2">
          <div className="text-xs text-muted-foreground/70">
            {params.segment && (params.city || params.location) ? (
              <span>
                Buscando <span className="text-foreground font-medium">{params.segment}</span> em{" "}
                <span className="text-foreground font-medium">
                  {params.neighborhood && params.neighborhood !== "all" ? `${params.neighborhood}, ` : ""}
                  {params.city && params.city !== "all" ? params.city : params.location}
                  {params.state && params.state !== "all" ? `, ${params.state}` : ""}
                </span>
                {params.cep && <span> (CEP: {params.cep})</span>}
                {params.radius_km > 0 && <span> ({params.radius_km}km)</span>}
              </span>
            ) : (
              <span>Preencha segmento e localização</span>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !params.segment.trim() || (!params.city && !params.location.trim() && !params.cep.trim())}
            className="min-w-[180px]"
          >
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
      </div>
    </form>
  );
}
