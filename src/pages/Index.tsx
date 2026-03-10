import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchForm, type SearchParams } from "@/components/SearchForm";
import { ResultsTable, type PlaceResult } from "@/components/ResultsTable";
import { StatsBar } from "@/components/StatsBar";
import { toast } from "sonner";

export default function Index() {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [stats, setStats] = useState({ searches: 0, places: 0, emails: 0, leads: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const [searchRes, placesRes, enrichRes, leadsRes] = await Promise.all([
      supabase.from("search_jobs").select("id", { count: "exact", head: true }),
      supabase.from("places").select("id", { count: "exact", head: true }),
      supabase.from("place_enrichment").select("id", { count: "exact", head: true }).not("email", "is", null),
      supabase.from("leads").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      searches: searchRes.count || 0,
      places: placesRes.count || 0,
      emails: enrichRes.count || 0,
      leads: leadsRes.count || 0,
    });
  };

  const handleSearch = async (params: SearchParams) => {
    setIsSearching(true);
    setResults([]);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado.");
        return;
      }

      // Location is already built by SearchForm's handleSubmit
      const fullLocation = params.state && params.state !== "all"
        ? `${params.location}, ${params.state}`
        : params.location;

      // Create search job
      const { data: job, error: jobError } = await supabase
        .from("search_jobs")
        .insert({
          user_id: userData.user.id,
          segment: params.segment,
          location: fullLocation,
          radius_km: params.radius_km,
          minimum_rating: params.minimum_rating,
          has_website: params.has_website,
          max_results: params.max_results,
          status: "running",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Call scraping edge function with all params
      const { data, error } = await supabase.functions.invoke("scrape-places", {
        body: {
          search_job_id: job.id,
          segment: params.segment,
          location: fullLocation,
          max_results: params.max_results,
          radius_km: params.radius_km,
          keywords_include: params.keywords_include,
          keywords_exclude: params.keywords_exclude,
          category_filter: params.category_filter,
          search_language: params.search_language,
        },
      });

      if (error) throw error;

      // Store email/instagram from scrape separately (not in places table)
      const scrapedExtras = new Map<string, { email?: string; instagram?: string }>();
      if (data?.places && data.places.length > 0) {
        for (const p of data.places) {
          if (p.email || p.instagram) {
            scrapedExtras.set(p.place_id, { email: p.email, instagram: p.instagram });
          }
        }

        // Save places to database
        const placesToInsert = data.places.map((p: any) => ({
          search_job_id: job.id,
          user_id: userData.user!.id,
          place_id: p.place_id || null,
          name: p.name,
          address: p.address,
          phone: p.phone,
          website: p.website,
          rating: p.rating,
          total_reviews: p.total_reviews,
          category: p.category,
          google_maps_url: p.google_maps_url,
          email: p.email || null,
          instagram: p.instagram || null,
        }));

        const { data: savedPlaces, error: saveError } = await supabase
          .from("places")
          .upsert(placesToInsert, { onConflict: "user_id,place_id" })
          .select();

        if (saveError) throw saveError;

        // Client-side filtering based on params
        let filtered = savedPlaces || [];

        if (params.minimum_rating > 0) {
          filtered = filtered.filter((p) => p.rating && Number(p.rating) >= params.minimum_rating);
        }
        if (params.min_reviews > 0) {
          filtered = filtered.filter((p) => p.total_reviews && p.total_reviews >= params.min_reviews);
        }
        if (params.has_website) {
          filtered = filtered.filter((p) => p.website);
        }
        if (params.has_phone) {
          filtered = filtered.filter((p) => p.phone);
        }

        // Exclude already prospected
        if (params.exclude_already_prospected) {
          const { data: existingPlaces } = await supabase
            .from("places")
            .select("place_id")
            .neq("search_job_id", job.id);
          const existingIds = new Set((existingPlaces || []).map((p) => p.place_id));
          filtered = filtered.filter((p) => !p.place_id || !existingIds.has(p.place_id));
        }

        // Sort
        if (params.sort_by === "rating") {
          filtered.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        } else if (params.sort_by === "reviews") {
          filtered.sort((a, b) => (b.total_reviews || 0) - (a.total_reviews || 0));
        }

        // Update job
        await supabase
          .from("search_jobs")
          .update({ status: "completed", total_found: filtered.length })
          .eq("id", job.id);

        const mapped: PlaceResult[] = filtered.map((p) => {
          const extras = scrapedExtras.get(p.place_id || '');
          return {
            id: p.id,
            name: p.name,
            address: p.address || undefined,
            phone: p.phone || undefined,
            website: p.website || undefined,
            rating: p.rating ? Number(p.rating) : undefined,
            total_reviews: p.total_reviews || undefined,
            category: p.category || undefined,
            google_maps_url: p.google_maps_url || undefined,
            email: extras?.email || undefined,
            instagram: extras?.instagram || undefined,
          };
        });

        setResults(mapped);
        toast.success(`${mapped.length} empresas encontradas!`);
      } else {
        await supabase
          .from("search_jobs")
          .update({ status: "completed", total_found: 0 })
          .eq("id", job.id);
        toast.info("Nenhuma empresa encontrada para essa busca.");
      }

      loadStats();
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error(error.message || "Erro ao buscar empresas");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrich = async (ids: string[]) => {
    setIsEnriching(true);
    try {
      const placesToEnrich = results.filter((r) => ids.includes(r.id) && r.website);

      if (placesToEnrich.length === 0) {
        toast.warning("Selecione empresas com website para enriquecer.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("enrich-places", {
        body: {
          places: placesToEnrich.map((p) => ({ id: p.id, website: p.website })),
        },
      });

      if (error) throw error;

      if (data?.results) {
        const enriched = data.results as Array<{ id: string; email?: string; instagram?: string }>;
        const { data: userData } = await supabase.auth.getUser();

        for (const item of enriched) {
          if (item.email || item.instagram) {
            // Save to place_enrichment
            if (item.email) {
              await supabase.from("place_enrichment").insert({
                place_id: item.id,
                email: item.email,
                confidence_score: 0.8,
                source: "website_scrape",
                user_id: userData.user!.id,
              });
            }
            // Persist email/instagram to places table
            await supabase.from("places").update({
              ...(item.email && { email: item.email }),
              ...(item.instagram && { instagram: item.instagram }),
            }).eq("id", item.id);
          }
        }

        setResults((prev) =>
          prev.map((r) => {
            const match = enriched.find((e) => e.id === r.id);
            if (!match) return r;
            return {
              ...r,
              ...(match.email && { email: match.email }),
              ...(match.instagram && { instagram: match.instagram }),
              enrichment_status: (match.email || match.instagram) ? "enriched" as const : r.enrichment_status,
            };
          })
        );

        const emailCount = enriched.filter((e) => e.email).length;
        toast.success(`${emailCount} e-mails encontrados!`);
        loadStats();
      }
    } catch (error: any) {
      console.error("Enrichment error:", error);
      toast.error(error.message || "Erro ao enriquecer dados");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleAddToLeads = async (ids: string[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const leadsToInsert = ids.map((id) => ({
        place_id: id,
        user_id: userData.user!.id,
        status: "new",
      }));

      const { error } = await supabase.from("leads").insert(leadsToInsert);
      if (error) throw error;

      setResults((prev) =>
        prev.map((r) => (ids.includes(r.id) ? { ...r, is_lead: true } : r))
      );

      toast.success(`${ids.length} leads adicionados!`);
      loadStats();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar leads");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Prospecção</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encontre empresas e colete dados de contato automaticamente
        </p>
      </div>

      <StatsBar
        totalSearches={stats.searches}
        totalPlaces={stats.places}
        totalEmails={stats.emails}
        totalLeads={stats.leads}
      />

      <SearchForm onSearch={handleSearch} isLoading={isSearching} />

      <ResultsTable
        results={results}
        onAddToLeads={handleAddToLeads}
        onEnrich={handleEnrich}
        isEnriching={isEnriching}
      />
    </div>
  );
}
