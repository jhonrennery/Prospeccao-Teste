import { useEffect, useState, useMemo } from "react";
import { subDays, subMonths, startOfDay, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, TrendingUp, DollarSign, Users, Target,
  ArrowUpRight, ArrowDownRight, Percent, Phone, Mail,
  CheckCircle2, XCircle, MessageSquare, Zap, CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  FunnelChart, Funnel, LabelList,
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
  primary: "hsl(160, 84%, 36%)",
  info: "hsl(210, 100%, 50%)",
  warning: "hsl(38, 92%, 50%)",
  success: "hsl(160, 84%, 36%)",
  destructive: "hsl(0, 72%, 51%)",
  muted: "hsl(215, 12%, 75%)",
};

type PeriodFilter = "7d" | "30d" | "90d" | "all";

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
  const [allLeadsRaw, setAllLeadsRaw] = useState<any[]>([]);
  const [allPlacesRaw, setAllPlacesRaw] = useState<any[]>([]);
  const [allEnrichmentsRaw, setAllEnrichmentsRaw] = useState<any[]>([]);
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

  const { data, funnelData, statusDistribution } = useMemo(() => {
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

    const sumValue = (arr: any[]) =>
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
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Dashboard
        </h1>
        <div className="glass-card p-12 text-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão completa de performance, receita e taxa de conversão
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              className="text-xs h-7 px-3"
              onClick={() => setPeriod(p)}
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>
      </div>

      {/* Revenue cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita Fechada"
          value={formatCurrency(data.revenueConverted)}
          sub={`${data.totalConverted} contratos`}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Pipeline Ativo"
          value={formatCurrency(data.revenuePipeline)}
          sub="Em negociação"
          iconColor="text-info"
          iconBg="bg-info/10"
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Ticket Médio"
          value={formatCurrency(data.avgDealValue)}
          sub="Por contrato"
          iconColor="text-warning"
          iconBg="bg-warning/10"
        />
        <MetricCard
          icon={<XCircle className="h-4 w-4" />}
          label="Receita Perdida"
          value={formatCurrency(data.revenueLost)}
          sub={`${data.totalLost} perdidos`}
          iconColor="text-destructive"
          iconBg="bg-destructive/10"
        />
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <RateCard label="Taxa Geral" value={data.conversionRate} icon={<Zap className="h-3.5 w-3.5" />} description="Prospectado → Convertido" />
        <RateCard label="Contato" value={data.contactRate} icon={<Phone className="h-3.5 w-3.5" />} description="Prospectado → Contatado" />
        <RateCard label="Interesse" value={data.interestRate} icon={<MessageSquare className="h-3.5 w-3.5" />} description="Contatado → Interessado" />
        <RateCard label="Fechamento" value={data.closeRate} icon={<CheckCircle2 className="h-3.5 w-3.5" />} description="Interessado → Convertido" />
        <RateCard label="Perda" value={data.lossRate} icon={<XCircle className="h-3.5 w-3.5" />} description="Total de perdidos" negative />
      </div>

      {/* Charts row */}
      {/* Funnel Chart - Full Width */}
      <div className="glass-card p-4 md:p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-1">Funil de Conversão do Pipeline</h3>
        <p className="text-[11px] text-muted-foreground mb-4">Visualize o drop-off entre cada etapa da prospecção</p>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 items-center">
          {/* Visual funnel */}
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
                    className="h-12 rounded-lg flex items-center justify-between px-4 transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: item.fill,
                      minWidth: "120px",
                    }}
                  >
                    <span className="text-white text-xs font-semibold truncate">{item.name}</span>
                    <span className="text-white/90 text-xs font-mono font-bold">{item.value}</span>
                  </div>
                  {i < funnelData.length - 1 && dropoff > 0 && (
                    <div className="flex items-center gap-1 py-0.5">
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] font-mono text-destructive">-{dropoff.toFixed(0)}% drop-off</span>
                    </div>
                  )}
                  {i < funnelData.length - 1 && dropoff === 0 && <div className="py-1" />}
                </div>
              );
            })}
          </div>

          {/* Conversion rates between stages */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Taxas entre etapas</h4>
            {[
              { from: "Prospectados", to: "Contatados", rate: data.contactRate, fromVal: data.totalProspected, toVal: data.totalContacted },
              { from: "Contatados", to: "Interessados", rate: data.interestRate, fromVal: data.totalContacted, toVal: data.totalInterested },
              { from: "Interessados", to: "Convertidos", rate: data.closeRate, fromVal: data.totalInterested, toVal: data.totalConverted },
            ].map((stage) => (
              <div key={stage.from} className="glass-card p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{stage.from} → {stage.to}</span>
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
                  <span>{stage.toVal} saídas</span>
                </div>
              </div>
            ))}
            <div className="glass-card p-3 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium">Conversão geral (ponta a ponta)</span>
                <span className="font-mono font-bold text-lg text-primary">{formatPercent(data.conversionRate)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                De {data.totalProspected} prospectados, {data.totalConverted} converteram
                {data.totalConverted > 0 && ` (1 a cada ${Math.ceil(data.totalProspected / data.totalConverted)})`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution pie */}
        <div className="glass-card p-4 md:p-5">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Distribuição por Status</h3>
          <div className="flex items-center gap-4">
            <div className="w-40 h-40 sm:w-48 sm:h-48">
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {statusDistribution.map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-mono text-foreground font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue by stage */}
        <div className="glass-card p-4 md:p-5">
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
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Valor"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {[COLORS.info, COLORS.success, COLORS.destructive].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data quality / enrichment stats */}
      <div className="glass-card p-4 md:p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-4">Qualidade dos Dados Prospectados</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <QualityBar
            label="Total Prospectado"
            value={data.totalProspected}
            total={data.totalProspected}
            icon={<Users className="h-3.5 w-3.5" />}
            color={COLORS.info}
          />
          <QualityBar
            label="Com Telefone"
            value={data.totalWithPhone}
            total={data.totalProspected}
            icon={<Phone className="h-3.5 w-3.5" />}
            color={COLORS.warning}
          />
          <QualityBar
            label="Com Website"
            value={data.totalWithWebsite}
            total={data.totalProspected}
            icon={<Mail className="h-3.5 w-3.5" />}
            color={COLORS.primary}
          />
          <QualityBar
            label="Com E-mail"
            value={data.totalWithEmail}
            total={data.totalProspected}
            icon={<Mail className="h-3.5 w-3.5" />}
            color={COLORS.success}
          />
        </div>
      </div>

      {/* Bottom insights */}
      <div className="glass-card p-4 md:p-5">
        <h3 className="font-display text-sm font-semibold text-foreground mb-3">Insights</h3>
        <div className="space-y-2">
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
              text={`Para cada contrato fechado, você precisa prospectar em média ${data.totalConverted > 0 ? Math.ceil(data.totalProspected / data.totalConverted) : "∞"} empresas.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, iconColor, iconBg }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  iconColor: string; iconBg: string;
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-lg font-bold text-foreground truncate">{value}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function RateCard({ label, value, icon, description, negative }: {
  label: string; value: number; icon: React.ReactNode; description: string; negative?: boolean;
}) {
  const isGood = negative ? value < 20 : value > 30;
  const isBad = negative ? value > 40 : value < 10;

  return (
    <div className="glass-card p-3 text-center space-y-1.5">
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

function QualityBar({ label, value, total, icon, color }: {
  label: string; value: number; total: number; icon: React.ReactNode; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
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
    success: "border-l-primary bg-primary/5",
    warning: "border-l-warning bg-warning/5",
    danger: "border-l-destructive bg-destructive/5",
    info: "border-l-info bg-info/5",
  };
  const icons = {
    success: <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />,
    warning: <ArrowUpRight className="h-3.5 w-3.5 text-warning shrink-0" />,
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
