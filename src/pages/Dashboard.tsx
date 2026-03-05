import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, TrendingUp, DollarSign, Users, Target,
  ArrowUpRight, ArrowDownRight, Percent, Phone, Mail,
  CheckCircle2, XCircle, MessageSquare, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const [
      { data: leads },
      { data: places },
      { data: enrichments },
      { count: searchCount },
    ] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("places").select("id, phone, website"),
      supabase.from("place_enrichment").select("id, email").not("email", "is", null),
      supabase.from("search_jobs").select("id", { count: "exact", head: true }),
    ]);

    const allLeads = leads || [];
    const allPlaces = places || [];
    const allEnrichments = enrichments || [];

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

    setData({
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
      totalSearches: searchCount || 0,
      totalWithPhone,
      totalWithEmail,
      totalWithWebsite,
    });

    setFunnelData([
      { name: "Prospectados", value: totalProspected, fill: COLORS.info },
      { name: "Contatados", value: totalContacted, fill: COLORS.warning },
      { name: "Interessados", value: totalInterested, fill: COLORS.primary },
      { name: "Convertidos", value: totalConverted, fill: COLORS.success },
    ]);

    setStatusDistribution([
      { name: "Novo", value: newLeads.length, color: COLORS.info },
      { name: "Contatado", value: contacted.length, color: COLORS.warning },
      { name: "Interessado", value: interested.length, color: COLORS.primary },
      { name: "Convertido", value: converted.length, color: COLORS.success },
      { name: "Perdido", value: lost.length, color: COLORS.destructive },
    ]);

    setLoading(false);
  };

  if (loading || !data) {
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
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão completa de performance, receita e taxa de conversão
        </p>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <div className="glass-card p-4 md:p-5">
          <h3 className="font-display text-sm font-semibold text-foreground mb-4">Funil de Conversão</h3>
          <div className="space-y-3">
            {funnelData.map((item, i) => {
              const maxVal = funnelData[0]?.value || 1;
              const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
              const dropoff = i > 0 && funnelData[i - 1].value > 0
                ? ((funnelData[i - 1].value - item.value) / funnelData[i - 1].value * 100)
                : 0;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-foreground">{item.value}</span>
                      {i > 0 && dropoff > 0 && (
                        <Badge variant="secondary" className="text-[9px] font-mono text-destructive">
                          <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />
                          -{dropoff.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="h-6 bg-secondary rounded-md overflow-hidden">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: item.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
