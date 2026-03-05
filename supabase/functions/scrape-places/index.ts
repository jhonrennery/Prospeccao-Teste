const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      segment,
      location,
      max_results = 50,
      radius_km = 10,
      keywords_include = "",
      keywords_exclude = "",
      category_filter = "",
      search_language = "pt",
    } = await req.json();

    if (!segment || !location) {
      return new Response(
        JSON.stringify({ error: 'segment and location are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a richer search query
    const parts = [segment];
    if (category_filter) parts.push(category_filter);
    if (keywords_include) parts.push(keywords_include);
    parts.push(location);
    if (radius_km) parts.push(`raio ${radius_km}km`);

    const query = parts.join(' ');
    const langMap: Record<string, string> = { pt: 'pt-br', en: 'en', es: 'es' };

    console.log('Searching with Firecrawl:', query, '| lang:', search_language);

    // Use Firecrawl search to find businesses
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: Math.min(max_results, 20),
        lang: langMap[search_language] || 'pt-br',
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    const searchData = await searchResponse.json();
    console.log('Firecrawl search response status:', searchResponse.status);

    if (!searchResponse.ok) {
      console.error('Firecrawl error:', searchData);
      return new Response(
        JSON.stringify({ error: searchData.error || 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also try to scrape Google Maps directly
    const mapsQuery = `${segment}${category_filter ? ' ' + category_filter : ''} em ${location}`;
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;
    
    console.log('Scraping Google Maps URL:', mapsUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: mapsUrl,
        formats: ['markdown'],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    console.log('Maps scrape status:', scrapeResponse.status);

    // Parse results from both sources
    const places: any[] = [];
    const seenNames = new Set<string>();

    // Parse from search results
    if (searchData?.data) {
      for (const result of searchData.data) {
        const name = result.title?.replace(/ - Google Maps.*$/, '').replace(/ \|.*$/, '').trim();
        if (!name || seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());

        // Extract data from markdown content
        const markdown = result.markdown || '';
        const phoneMatch = markdown.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/);
        const websiteMatch = markdown.match(/https?:\/\/(?!.*google)[^\s"'<>]+/);
        const ratingMatch = markdown.match(/(\d[.,]\d)\s*(?:estrelas?|stars?|⭐)/i);

        places.push({
          place_id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          address: result.description?.slice(0, 200) || null,
          phone: phoneMatch?.[0] || null,
          website: websiteMatch?.[0] || null,
          rating: ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null,
          total_reviews: null,
          category: segment,
          google_maps_url: result.url?.includes('google.com/maps') ? result.url : null,
        });

        if (places.length >= max_results) break;
      }
    }

    // Parse from Maps scrape
    if (scrapeData?.data?.markdown && places.length < max_results) {
      const lines = scrapeData.data.markdown.split('\n');
      let currentPlace: any = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Look for business names (usually in headers or bold)
        const nameMatch = trimmed.match(/^#{1,3}\s+(.+)/) || trimmed.match(/\*\*(.+?)\*\*/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          if (name.length > 2 && name.length < 100 && !seenNames.has(name.toLowerCase())) {
            if (currentPlace && currentPlace.name) {
              places.push(currentPlace);
            }
            seenNames.add(name.toLowerCase());
            currentPlace = {
              place_id: `fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name,
              address: null,
              phone: null,
              website: null,
              rating: null,
              total_reviews: null,
              category: segment,
              google_maps_url: null,
            };
          }
        }

        if (currentPlace) {
          const phoneMatch = trimmed.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/);
          if (phoneMatch) currentPlace.phone = phoneMatch[0];

          const ratingMatch = trimmed.match(/(\d[.,]\d)/);
          if (ratingMatch && !currentPlace.rating) {
            const val = parseFloat(ratingMatch[1].replace(',', '.'));
            if (val >= 1 && val <= 5) currentPlace.rating = val;
          }

          const reviewMatch = trimmed.match(/\((\d+)\s*(?:avalia|review)/i);
          if (reviewMatch) currentPlace.total_reviews = parseInt(reviewMatch[1]);
        }

        if (places.length >= max_results) break;
      }

      if (currentPlace && currentPlace.name && places.length < max_results) {
        places.push(currentPlace);
      }
    }

    console.log(`Found ${places.length} places`);

    return new Response(
      JSON.stringify({ success: true, places }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
