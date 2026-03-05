import { Building2, Mail, Users, Search } from "lucide-react";

interface StatsBarProps {
  totalSearches: number;
  totalPlaces: number;
  totalEmails: number;
  totalLeads: number;
}

export function StatsBar({ totalSearches, totalPlaces, totalEmails, totalLeads }: StatsBarProps) {
  const stats = [
    { icon: Search, label: "Buscas", value: totalSearches, color: "text-info" },
    { icon: Building2, label: "Empresas", value: totalPlaces, color: "text-foreground" },
    { icon: Mail, label: "E-mails", value: totalEmails, color: "text-primary" },
    { icon: Users, label: "Leads", value: totalLeads, color: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="glass-card p-3 md:p-4 flex items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
