import { useEffect, useState, useMemo, type ReactNode } from "react";
import { subDays, subMonths, startOfDay, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  BarChart3, TrendingUp, DollarSign, Users, Target,
  ArrowDownRight, Phone, Mail,
  CheckCircle2, XCircle, MessageSquare, Zap, CalendarDays,
  Globe, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

interface DashboardData {
  totalProspected: number;
  totalContacted: number;
  totalInterested: number;
  totalConverted: number;
  totalLost: number;
  revenueConverted: number;
  revenuePipeline: number;
  revenueLost: number;
  avgDealValue: number;
  conversionRate: number;
  contactRate: number;
  interestRate: number;
  closeRate: number;
  lossRate: number;
  costPerLead: number;
  totalSearches: number;
  totalWithPhone: number;
  totalWithEmail: number;
  totalWithWebsite: number;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  info: "hsl(210, 100%, 50%)",
  warning: "hsl(38, 92%, 50%)",
  success: "hsl(var(--success))",
  destructive: "hsl(0, 72%, 51%)",
  muted: "hsl(215, 12%, 75%)",
};

type PeriodFilter = "7d" | "30d" | "90d" | "all";
type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type PlaceRow = Pick<Database["public"]["Tables"]["places"]["Row"], "id" | "phone" | "website" | "created_at">;
type EnrichmentRow = Pick<Database["public"]["Tables"]["place_enrichment"]["Row"], "id" | "email" | "created_at">;

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  all: "Tudo",
};

function getDateCutoff(period: PeriodFilter): Date | null {
  const now = new Date();
  switch (period) {
    case "7d": return startOfDay(subDays(now, 7));
    case "30d": return startOfDay(subDays(now, 30));
    case "90d": return startOfDay(subMonths(now, 3));
    default: return null;
  }
}

export default function Dashboard() {
  const [allLeadsRaw, setAllLeadsRaw] = useState<LeadRow[]>([]);
  const [allPlacesRaw, setAllPlacesRaw] = useState<PlaceRow[]>([]);
  const [allEnrichmentsRaw, setAllEnrichmentsRaw] = useState<EnrichmentRow[]>([]);
  const [searchCountRaw, setSearchCountRaw] = useState(0);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRawData();
  }, []);

  const loadRawData = async () => {
    setLoading(true);
    const [
      { data: leads },
      { data: places },
      { data: enrichments },
      { count: searchCount },
    ] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("places").select("id, phone, website, created_at"),
      supabase.from("place_enrichment").select("id, email, created_at").not("email", "is", null),
      supabase.from("search_jobs").select("id", { count: "exact", head: true }),
    ]);
    setAllLeadsRaw(leads || []);
    setAllPlacesRaw(places || []);
    setAllEnrichmentsRaw(enrichments || []);
    setSearchCountRaw(searchCount || 0);
    setLoading(false);
  };

  const { data, funnelData, statusDistribution, timelineData } = useMemo(() => {
    const cutoff = getDateCutoff(period);
    const filterByDate = <T extends { created_at: string }>(arr: T[]) =>
      cutoff ? arr.filter((item) => new Date(item.created_at) >= cutoff) : arr;

    const allLeads = filterByDate(allLeadsRaw);
    const allPlaces = filterByDate(allPlacesRaw);
    const allEnrichments = filterByDate(allEnrichmentsRaw);

    const totalProspected = allPlaces.length;
    const byStatus = (s: string) => allLeads.filter((l) => l.status === s);

    const newLeads = byStatus("new");
    const contacted = byStatus("contacted");
    const interested = byStatus("interested");
    const converted = byStatus("converted");
    const lost = byStatus("lost");

    const sumValue = (arr: LeadRow[]) =>
      arr.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    const revenueConverted = sumValue(converted);
    const revenuePipeline = sumValue([...newLeads, ...contacted, ...interested]);
    const revenueLost = sumValue(lost);

    const totalContacted = contacted.length + interested.length + converted.length + lost.length;
    const totalInterested = interested.length + converted.length;
    const totalConverted = converted.length;
    const totalLost = lost.length;

    const conversionRate = totalProspected > 0 ? (totalConverted / totalProspected) * 100 : 0;
    const contactRate = totalProspected > 0 ? (totalContacted / totalProspected) * 100 : 0;
    const interestRate = totalContacted > 0 ? (totalInterested / totalContacted) * 100 : 0;
    const closeRate = totalInterested > 0 ? (totalConverted / totalInterested) * 100 : 0;
    const lossRate = allLeads.length > 0 ? (totalLost / allLeads.length) * 100 : 0;

    const avgDealValue = totalConverted > 0 ? revenueConverted / totalConverted : 0;
    const totalWithPhone = allPlaces.filter((p) => p.phone).length;
    const totalWithWebsite = allPlaces.filter((p) => p.website).length;
    const totalWithEmail = allEnrichments.length;

    const computedData: DashboardData = {
      totalProspected,
      totalContacted,
      totalInterested,
      totalConverted,
      totalLost,
      revenueConverted,
      revenuePipeline,
      revenueLost,
      avgDealValue,
      conversionRate,
      contactRate,
      interestRate,
      closeRate,
      lossRate,
      costPerLead: 0,
      totalSearches: searchCountRaw,
      totalWithPhone,
      totalWithEmail,
      totalWithWebsite,
    };

    const computedFunnel = [
      { name: "Prospectados", value: totalProspected, fill: COLORS.info },
      { name: "Contatados", value: totalContacted, fill: COLORS.warning },
      { name: "Interessados", value: totalInterested, fill: COLORS.primary },
      { name: "Convertidos", value: totalConverted, fill: COLORS.success },
    ];

    const computedStatus = [
      { name: "Novo", value: newLeads.length, color: COLORS.info },
      { name: "Contatado", value: contacted.length, color: COLORS.warning },
      { name: "Interessado", value: interested.length, color: COLORS.primary },
      { name: "Convertido", value: converted.length, color: COLORS.success },
      { name: "Perdido", value: lost.length, color: COLORS.destructive },
    ];

    // Monthly timeline data
    const monthMap = new Map<string, { month: string; prospectados: number; convertidos: number; receita: number; perdidos: number }>();
    
    allPlaces.forEach((p) => {
      const key = format(new Date(p.created_at), "yyyy-MM");
      const label = format(new Date(p.created_at), "MMM/yy");
      if (!monthMap.has(key)) monthMap.set(key, { month: label, prospectados: 0, convertidos: 0, receita: 0, perdidos: 0 });
      monthMap.get(key)!.prospectados++;
    });

    allLeads.forEach((l) => {
      const key = format(new Date(l.created_at), "yyyy-MM");
      const label = format(new Date(l.created_at), "MMM/yy");
      if (!monthMap.has(key)) monthMap.set(key, { month: label, prospectados: 0, convertidos: 0, receita: 0, perdidos: 0 });
      if (l.status === "converted") {
        monthMap.get(key)!.convertidos++;
        monthMap.get(key)!.receita += Number(l.estimated_value) || 0;
      }
      if (l.status === "lost") {
        monthMap.get(key)!.perdidos++;
      }
    });

    const computedTimeline = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);

    return { data: computedData, funnelData: computedFunnel, statusDistribution: computedStatus, timelineData: computedTimeline };
  }, [allLeadsRaw, allPlacesRaw, allEnrichmentsRaw, searchCountRaw, period]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1440px]">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2 tracking-tight">
          <BarChart3 className="h-6 w-6 text-primary" /> Dashboard Executivo
        </h1>
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando painel...</div>
      </div>
    );
  }

  const winRateLabel =
    data.closeRate >= 35 ? "Acima da meta" : data.closeRate >= 20 ? "Dentro do esperado" : "Abaixo da meta";
  const conversionPerContract =
    data.totalConverted > 0 ? Math.ceil(data.totalProspected / data.totalConverted) : null;
  const uncoveredLeads = Math.max(data.totalProspected - data.totalContacted, 0);

  return (
    <div className="space-y-6 max-w-[1440px] pb-4">
      <section className="glass-card p-5 md:p-6 border-border/80 shadow-[0_8px_24px_-18px_hsl(var(--foreground)/0.4)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Painel Executivo
                </span>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Dashboard de Prospecção Comercial
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Leitura consolidada de funil, receita e cobertura de dados para decisão operacional.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[420px]">
              <HeaderKpi label="Buscas" value={data.totalSearches.toString()} />
              <HeaderKpi label="Prospectados" value={data.totalProspected.toString()} />
              <HeaderKpi label="Convertidos" value={data.totalConverted.toString()} />
              <HeaderKpi label="Taxa Geral" value={formatPercent(data.conversionRate)} highlight />
              <HeaderKpi label="Win Rate" value={formatPercent(data.closeRate)} highlight />
              <HeaderKpi label="Ticket Médio" value={formatCurrency(data.avgDealValue)} />
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border/80 bg-background/70 px-2.5 py-1">
                Win rate: <strong className="text-foreground">{winRateLabel}</strong>
              </span>
              <span className="rounded-md border border-border/80 bg-background/70 px-2.5 py-1">
                Leads sem contato: <strong className="text-foreground">{uncoveredLeads}</strong>
              </span>
              <span className="rounded-md border border-border/80 bg-background/70 px-2.5 py-1">
                Eficiência:{" "}
                <strong className="text-foreground">
                  {conversionPerContract ? `1 contrato a cada ${conversionPerContract} prospects` : "sem conversões"}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/70 p-1">
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={period === p ? "default" : "ghost"}
                  className="h-7 px-3 text-xs"
                  onClick={() => setPeriod(p)}
                >
                  <CalendarDays className="mr-1 h-3 w-3" />
                  {PERIOD_LABELS[p]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita Fechada"
          value={formatCurrency(data.revenueConverted)}
          sub={`${data.totalConverted} contratos`}
          tone="primary"
        />
        <ExecutiveMetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Pipeline Ativo"
          value={formatCurrency(data.revenuePipeline)}
          sub="Em negociação"
          tone="info"
        />
        <ExecutiveMetricCard
          icon={<Target className="h-4 w-4" />}
          label="Ticket Médio"
          value={formatCurrency(data.avgDealValue)}
          sub="Por contrato"
          tone="warning"
        />
        <ExecutiveMetricCard
          icon={<XCircle className="h-4 w-4" />}
          label="Receita Perdida"
          value={formatCurrency(data.revenueLost)}
          sub={`${data.totalLost} perdidos`}
          tone="destructive"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.75fr_1fr]">
        <div className="glass-card p-4 md:p-5 border-border/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold tracking-wide text-foreground">
                Indicadores de Conversão
              </h3>
              <p className="text-[11px] text-muted-foreground">Eficiência por etapa do processo comercial</p>
            </div>
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <CompactRateCard label="Taxa Geral" value={data.conversionRate} icon={<Zap className="h-3.5 w-3.5" />} description="Prospectado -> Convertido" />
            <CompactRateCard label="Contato" value={data.contactRate} icon={<Phone className="h-3.5 w-3.5" />} description="Prospectado -> Contatado" />
            <CompactRateCard label="Interesse" value={data.interestRate} icon={<MessageSquare className="h-3.5 w-3.5" />} description="Contatado -> Interessado" />
            <CompactRateCard label="Fechamento" value={data.closeRate} icon={<CheckCircle2 className="h-3.5 w-3.5" />} description="Interessado -> Convertido" />
            <CompactRateCard label="Perda" value={data.lossRate} icon={<XCircle className="h-3.5 w-3.5" />} description="Leads Perdidos" negative />
          </div>
        </div>

        <div className="glass-card p-4 md:p-5 border-border/80">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold tracking-wide text-foreground">
                Cobertura de Dados
              </h3>
              <p className="text-[11px] text-muted-foreground">Qualidade dos dados coletados na prospecção</p>
            </div>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-3">
            <QualityRow label="Com Telefone" value={data.totalWithPhone} total={data.totalProspected} icon={<Phone className="h-3.5 w-3.5" />} color={COLORS.warning} />
            <QualityRow label="Com Website" value={data.totalWithWebsite} total={data.totalProspected} icon={<Globe className="h-3.5 w-3.5" />} color={COLORS.primary} />
            <QualityRow label="Com E-mail" value={data.totalWithEmail} total={data.totalProspected} icon={<Mail className="h-3.5 w-3.5" />} color={COLORS.success} />
            <div className="rounded-lg border border-border/80 bg-background/70 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Base prospectada</span>
                <strong className="font-mono text-foreground">{data.totalProspected}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Total de buscas</span>
                <strong className="font-mono text-foreground">{data.totalSearches}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="glass-card p-4 md:p-5 border-border/80">
          <h3 className="font-display mb-1 text-sm font-semibold text-foreground">Funil de Conversão do Pipeline</h3>
          <p className="mb-4 text-[11px] text-muted-foreground">Visualize o drop-off entre cada etapa da prospecção</p>
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col items-center gap-1">
            {funnelData.map((item, i) => {
              const maxVal = funnelData[0]?.value || 1;
              const widthPct = maxVal > 0 ? Math.max((item.value / maxVal) * 100, 12) : 12;
              const dropoff = i > 0 && funnelData[i - 1].value > 0
                ? ((funnelData[i - 1].value - item.value) / funnelData[i - 1].value * 100)
                : 0;
              return (
                <div key={item.name} className="w-full flex flex-col items-center">
                  <div
                    className="flex h-12 items-center justify-between rounded-md px-4 transition-all duration-500 shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.15)]"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: item.fill,
                      minWidth: "120px",
                    }}
                  >
                    <span className="truncate text-xs font-semibold text-white">{item.name}</span>
                    <span className="font-mono text-xs font-bold text-white/90">{item.value}</span>
                  </div>
                  {i < funnelData.length - 1 && dropoff > 0 && (
                    <div className="flex items-center gap-1 py-0.5">
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                      <span className="font-mono text-[10px] text-destructive">-{dropoff.toFixed(0)}% drop-off</span>
                    </div>
                  )}
                  {i < funnelData.length - 1 && dropoff === 0 && <div className="py-1" />}
                </div>
              );
            })}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxas entre etapas</h4>
            {[
              { from: "Prospectados", to: "Contatados", rate: data.contactRate, fromVal: data.totalProspected, toVal: data.totalContacted },
              { from: "Contatados", to: "Interessados", rate: data.interestRate, fromVal: data.totalContacted, toVal: data.totalInterested },
              { from: "Interessados", to: "Convertidos", rate: data.closeRate, fromVal: data.totalInterested, toVal: data.totalConverted },
            ].map((stage) => (
                <div key={stage.from} className="rounded-lg border border-border/80 bg-background/70 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stage.from} {"->"} {stage.to}</span>
                    <span className={`font-mono font-bold text-sm ${
                    stage.rate > 50 ? "text-primary" : stage.rate > 20 ? "text-warning" : "text-destructive"
                  }`}>
                    {formatPercent(stage.rate)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(stage.rate, 1)}%`,
                      backgroundColor: stage.rate > 50 ? COLORS.success : stage.rate > 20 ? COLORS.warning : COLORS.destructive,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground/70">
                    <span>{stage.fromVal} entradas</span>
                    <span>{stage.toVal} saidas</span>
                </div>
              </div>
            ))}
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
              <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Conversao geral (ponta a ponta)</span>
                  <span className="font-mono text-lg font-bold text-primary">{formatPercent(data.conversionRate)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                De {data.totalProspected} prospectados, {data.totalConverted} converteram
                {data.totalConverted > 0 && ` (1 a cada ${Math.ceil(data.totalProspected / data.totalConverted)})`}
              </p>
            </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 md:p-5 border-border/80">
          <h3 className="font-display mb-4 text-sm font-semibold text-foreground">Distribuicao por Status</h3>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="h-40 w-full max-w-[230px] self-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution.filter((s) => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5">
              {statusDistribution.map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-md border border-border/70 bg-background/60 px-2.5 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="truncate text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-mono text-foreground font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-4 md:p-5 border-border/80">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Receita por Etapa</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: "Pipeline", value: data.revenuePipeline, fill: COLORS.info },
              { name: "Fechada", value: data.revenueConverted, fill: COLORS.success },
              { name: "Perdida", value: data.revenueLost, fill: COLORS.destructive },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), "Valor"]} contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {[COLORS.info, COLORS.success, COLORS.destructive].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {timelineData.length > 0 && (
        <div className="glass-card p-4 md:p-5 border-border/80">
          <h3 className="font-display text-sm font-semibold text-foreground mb-1">Evolução Mensal</h3>
          <p className="text-[11px] text-muted-foreground mb-4">Prospecções, conversões e receita ao longo do tempo</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Prospecções vs Conversões</h4>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="gradProspect" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradConvert" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="prospectados" name="Prospectados" stroke={COLORS.info} fill="url(#gradProspect)" strokeWidth={2} />
                  <Area type="monotone" dataKey="convertidos" name="Convertidos" stroke={COLORS.success} fill="url(#gradConvert)" strokeWidth={2} />
                  <Area type="monotone" dataKey="perdidos" name="Perdidos" stroke={COLORS.destructive} fill={COLORS.destructive} fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Receita Mensal (Convertida)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [formatCurrency(value), "Receita"]} contentStyle={tooltipStyle} />
                  <Bar dataKey="receita" name="Receita" fill={COLORS.success} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-4 md:p-5 border-border/80">
        <h3 className="font-display text-sm font-semibold text-foreground mb-4">Qualidade dos Dados Prospectados</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <QualityRow
            label="Total Prospectado"
            value={data.totalProspected}
            total={data.totalProspected}
            icon={<Users className="h-3.5 w-3.5" />}
            color={COLORS.info}
          />
          <QualityRow
            label="Com Telefone"
            value={data.totalWithPhone}
            total={data.totalProspected}
            icon={<Phone className="h-3.5 w-3.5" />}
            color={COLORS.warning}
          />
          <QualityRow
            label="Com Website"
            value={data.totalWithWebsite}
            total={data.totalProspected}
            icon={<Globe className="h-3.5 w-3.5" />}
            color={COLORS.primary}
          />
          <QualityRow
            label="Com E-mail"
            value={data.totalWithEmail}
            total={data.totalProspected}
            icon={<Mail className="h-3.5 w-3.5" />}
            color={COLORS.success}
          />
        </div>
      </div>

      <div className="glass-card p-4 md:p-5 border-border/80">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-foreground">Insights Operacionais</h3>
          <span className="rounded border border-border/80 bg-background/70 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Acionaveis
          </span>
        </div>
        <div className="space-y-2.5">
          {data.totalProspected > 0 && data.totalConverted === 0 && (
            <InsightItem type="warning" text="Você ainda não converteu nenhum lead. Foque em entrar em contato com os leads interessados." />
          )}
          {data.conversionRate > 0 && data.conversionRate < 5 && (
            <InsightItem type="warning" text={`Sua taxa de conversão geral é de ${formatPercent(data.conversionRate)}. Considere melhorar a qualificação dos leads antes do contato.`} />
          )}
          {data.conversionRate >= 5 && (
            <InsightItem type="success" text={`Boa taxa de conversão: ${formatPercent(data.conversionRate)}! Continue com a estratégia atual.`} />
          )}
          {data.lossRate > 40 && (
            <InsightItem type="danger" text={`Taxa de perda alta: ${formatPercent(data.lossRate)}. Revise o processo de qualificação e abordagem.`} />
          )}
          {data.contactRate < 30 && data.totalProspected > 10 && (
            <InsightItem type="info" text={`Apenas ${formatPercent(data.contactRate)} dos prospectados foram contatados. Há oportunidades paradas no funil.`} />
          )}
          {data.interestRate > 50 && (
            <InsightItem type="success" text={`Excelente taxa de interesse: ${formatPercent(data.interestRate)} dos contatados demonstraram interesse.`} />
          )}
          {data.totalProspected > 0 && (
            <InsightItem
              type="info"
              text={`Para cada contrato fechado, você precisa prospectar em média ${conversionPerContract ?? "∞"} empresas.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

function HeaderKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${highlight ? "border-primary/25 bg-primary/10" : "border-border/80 bg-background/70"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-mono text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ExecutiveMetricCard({ icon, label, value, sub, tone }: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "info" | "warning" | "destructive";
}) {
  const tones = {
    primary: { bg: "bg-primary/10", color: "text-primary", line: "before:bg-primary" },
    info: { bg: "bg-info/10", color: "text-info", line: "before:bg-info" },
    warning: { bg: "bg-warning/10", color: "text-warning", line: "before:bg-warning" },
    destructive: { bg: "bg-destructive/10", color: "text-destructive", line: "before:bg-destructive" },
  };

  return (
    <div className={`glass-card relative overflow-hidden p-4 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${tones[tone].line}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tones[tone].bg}`}>
          <span className={tones[tone].color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-lg font-bold tracking-tight text-foreground truncate">{value}</div>
          <div className="text-[10px] text-muted-foreground">{sub}</div>
        </div>
      </div>
    </div>
  );
}

function CompactRateCard({ label, value, icon, description, negative }: {
  label: string;
  value: number;
  icon: ReactNode;
  description: string;
  negative?: boolean;
}) {
  const isGood = negative ? value < 20 : value > 30;
  const isBad = negative ? value > 40 : value < 10;

  return (
    <div className="rounded-lg border border-border/80 bg-background/70 p-3 text-center space-y-1.5">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-display text-2xl font-bold ${
        isBad ? "text-destructive" : isGood ? "text-primary" : "text-foreground"
      }`}>
        {formatPercent(value)}
      </div>
      <div className="text-[9px] text-muted-foreground/70">{description}</div>
    </div>
  );
}

function QualityRow({ label, value, total, icon, color }: {
  label: string;
  value: number;
  total: number;
  icon: ReactNode;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5 rounded-md border border-border/70 bg-background/60 p-2.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">{icon} {label}</div>
        <span className="font-mono text-foreground">{value}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-[10px] text-muted-foreground/70 text-right">{formatPercent(pct)}</div>
    </div>
  );
}

function InsightItem({ type, text }: { type: "success" | "warning" | "danger" | "info"; text: string }) {
  const styles = {
    success: "border-l-primary bg-primary/5 border border-primary/10",
    warning: "border-l-warning bg-warning/5 border border-warning/10",
    danger: "border-l-destructive bg-destructive/5 border border-destructive/10",
    info: "border-l-info bg-info/5 border border-info/10",
  };
  const icons = {
    success: <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />,
    warning: <Zap className="h-3.5 w-3.5 text-warning shrink-0" />,
    danger: <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />,
    info: <TrendingUp className="h-3.5 w-3.5 text-info shrink-0" />,
  };

  return (
    <div className={`flex items-start gap-2 border-l-2 ${styles[type]} rounded-r-md px-3 py-2`}>
      {icons[type]}
      <span className="text-xs text-foreground">{text}</span>
    </div>
  );
}
