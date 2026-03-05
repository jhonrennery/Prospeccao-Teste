import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export default function ExportPage() {
  const [loading, setLoading] = useState(false);

  const exportCSV = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase
        .from("leads")
        .select("*, places(*), place_enrichment:place_enrichment(email)")
        .order("created_at", { ascending: false });

      if (!leads || leads.length === 0) {
        toast.warning("Nenhum lead para exportar");
        return;
      }

      const headers = ["Nome", "Endereço", "Telefone", "Website", "E-mail", "Avaliação", "Categoria", "Status"];
      const rows = leads.map((l: any) => [
        l.places?.name || "",
        l.places?.address || "",
        l.places?.phone || "",
        l.places?.website || "",
        (l.place_enrichment && l.place_enrichment[0]?.email) || "",
        l.places?.rating || "",
        l.places?.category || "",
        l.status,
      ]);

      const csv = [headers.join(","), ...rows.map((r: string[]) => r.map((v) => `"${v}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao exportar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" /> Exportar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Exporte seus leads com dados completos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">CSV</h3>
              <p className="text-xs text-muted-foreground">Compatível com Excel, Google Sheets</p>
            </div>
          </div>
          <Button onClick={exportCSV} disabled={loading} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            {loading ? "Exportando..." : "Exportar CSV"}
          </Button>
        </div>

        <div className="glass-card p-6 space-y-4 opacity-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">XLSX</h3>
              <p className="text-xs text-muted-foreground">Em breve</p>
            </div>
          </div>
          <Button disabled className="w-full" variant="secondary">
            Em breve
          </Button>
        </div>
      </div>
    </div>
  );
}
