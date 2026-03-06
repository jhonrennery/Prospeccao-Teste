const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceData {
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  total_reviews: number | null;
  category: string;
  google_maps_url: string | null;
}

function generatePlaceId(): string {
  return `gm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse Google Maps search results page markdown into structured business data.
 * Google Maps markdown typically contains blocks like:
 * 
 * **Business Name**
 * 4.5(1,234) · $$$ · Category
 * Address line
 * Open until 10 PM
 * Phone: (xx) xxxxx-xxxx
 */
function parseGoogleMapsMarkdown(markdown: string, segment: string): PlaceData[] {
  const places: PlaceData[] = [];
  const seenNames = new Set<string>();

  // Split by lines and process
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and navigation/header content
    if (!line || line.startsWith('[') && line.includes('Google') || line === '---') {
      i++;
      continue;
    }

    // Detect business name patterns:
    // 1. Bold text: **Business Name**
    // 2. Header: ## Business Name or ### Business Name  
    // 3. Link with business: [Business Name](url)
    let businessName: string | null = null;
    let mapsUrl: string | null = null;

    // Pattern: [**Name**](maps_url) or [Name](maps_url)
    const linkMatch = line.match(/\[(?:\*\*)?(.+?)(?:\*\*)?\]\((https:\/\/www\.google\.com\/maps\/place\/[^\)]+)\)/);
    if (linkMatch) {
      businessName = linkMatch[1].trim();
      mapsUrl = linkMatch[2];
    }

    // Pattern: **Name** (standalone bold)
    if (!businessName) {
      const boldMatch = line.match(/^\*\*(.{3,80})\*\*$/);
      if (boldMatch) {
        businessName = boldMatch[1].trim();
      }
    }

    // Pattern: ### Name (header)
    if (!businessName) {
      const headerMatch = line.match(/^#{1,4}\s+(.{3,80})$/);
      if (headerMatch) {
        const candidate = headerMatch[1].trim();
        // Skip generic headers
        if (!candidate.match(/^(results|resultados|maps|google|buscar|search|filtros|filters)/i)) {
          businessName = candidate;
        }
      }
    }

    if (!businessName || seenNames.has(businessName.toLowerCase())) {
      i++;
      continue;
    }

    // Skip if it looks like an article title (contains "melhores", "top", "best", "where to")
    if (businessName.match(/\b(melhores|top \d|best \d|onde comer|where to|guia de|os \d+ |las \d+ )/i)) {
      i++;
      continue;
    }

    seenNames.add(businessName.toLowerCase());

    // Now look ahead for business details (next 8 lines)
    const place: PlaceData = {
      place_id: generatePlaceId(),
      name: businessName,
      address: null,
      phone: null,
      website: null,
      rating: null,
      total_reviews: null,
      category: segment,
      google_maps_url: mapsUrl,
    };

    const lookAhead = Math.min(i + 10, lines.length);
    for (let j = i + 1; j < lookAhead; j++) {
      const detail = lines[j].trim();
      if (!detail) continue;

      // If we hit another business name, stop
      if (detail.match(/^\*\*.{3,80}\*\*$/) || detail.match(/^#{1,4}\s+.{3,}/)) break;

      // Rating pattern: 4.5(1,234) or 4,5 (1.234) or ⭐ 4.5
      if (!place.rating) {
        const ratingMatch = detail.match(/(\d[.,]\d)\s*(?:\(|★|⭐|\·)/);
        if (ratingMatch) {
          const val = parseFloat(ratingMatch[1].replace(',', '.'));
          if (val >= 1 && val <= 5) place.rating = val;
        }
        // Also try standalone rating
        const ratingMatch2 = detail.match(/^(\d[.,]\d)\s*$/);
        if (ratingMatch2) {
          const val = parseFloat(ratingMatch2[1].replace(',', '.'));
          if (val >= 1 && val <= 5) place.rating = val;
        }
      }

      // Reviews pattern: (1,234) or (1.234 avaliações) or 1234 reviews
      if (!place.total_reviews) {
        const reviewMatch = detail.match(/\(([0-9.,]+)\s*(?:avalia|review|opinione|reseña)?/i) ||
          detail.match(/([0-9.,]+)\s+(?:avalia|review|opinione|reseña)/i);
        if (reviewMatch) {
          const num = parseInt(reviewMatch[1].replace(/[.,]/g, ''));
          if (num > 0 && num < 1000000) place.total_reviews = num;
        }
      }

      // Phone pattern: Brazilian phones (xx) xxxxx-xxxx or +55 xx xxxxx-xxxx
      if (!place.phone) {
        const phoneMatch = detail.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
        if (phoneMatch) {
          // Validate it looks like a real phone (not a rating or price)
          const cleaned = phoneMatch[0].replace(/\D/g, '');
          if (cleaned.length >= 8 && cleaned.length <= 13) {
            place.phone = phoneMatch[0];
          }
        }
      }

      // Address pattern: Contains common address indicators
      if (!place.address) {
        if (detail.match(/\b(rua|av\.|avenida|travessa|praça|rod\.|rodovia|alameda|largo|r\.|qd|quadra|lote|bairro|centro|n[°º]|nº|km|cep|\d{5}-\d{3})/i)) {
          place.address = detail.replace(/^[·•\-\*]\s*/, '').slice(0, 200);
        }
      }

      // Maps URL from links in detail lines
      if (!place.google_maps_url) {
        const urlMatch = detail.match(/https:\/\/www\.google\.com\/maps\/place\/[^\s\)]+/);
        if (urlMatch) place.google_maps_url = urlMatch[0];
      }

      // Website (non-google URL)
      if (!place.website) {
        const webMatch = detail.match(/(?:site|website|web|página|pagina)[\s:]+\[?([^\s\]]+)/i);
        if (webMatch && !webMatch[1].includes('google.com')) {
          place.website = webMatch[1];
        }
      }
    }

    places.push(place);
    i++;
  }

  return places;
}

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

    // Build Google Maps search query focused on real businesses
    const queryParts = [segment];
    if (category_filter) queryParts.push(category_filter);
    if (keywords_include) queryParts.push(keywords_include);
    queryParts.push('em');
    queryParts.push(location);

    const mapsQuery = queryParts.join(' ');
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

    console.log('Scraping Google Maps for businesses:', mapsUrl);

    // Scrape Google Maps search results - this is the PRIMARY source
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: mapsUrl,
        formats: ['markdown'],
        waitFor: 5000, // Wait longer for Maps to load results
        location: {
          country: 'BR',
          languages: [search_language === 'pt' ? 'pt-BR' : search_language],
        },
      }),
    });

    const scrapeData = await scrapeResponse.json();
    console.log('Google Maps scrape status:', scrapeResponse.status);

    if (!scrapeResponse.ok) {
      console.error('Firecrawl scrape error:', JSON.stringify(scrapeData));
      return new Response(
        JSON.stringify({ error: scrapeData.error || 'Failed to scrape Google Maps' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || '';
    console.log('Markdown length:', markdown.length);
    console.log('Markdown preview (first 2000 chars):', markdown.slice(0, 2000));

    // Parse businesses from the Google Maps markdown
    let places = parseGoogleMapsMarkdown(markdown, segment);

    // If Maps scrape didn't yield good results, try a Google search specifically for businesses
    if (places.length < 3) {
      console.log('Maps scrape yielded few results, trying Google search for businesses...');

      // Search specifically for Google Maps business listings
      const searchQuery = `site:google.com/maps/place ${segment} ${location}`;
      
      const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: Math.min(max_results, 20),
          lang: search_language === 'pt' ? 'pt-br' : search_language,
          country: 'BR',
        }),
      });

      const searchData = await searchResponse.json();
      console.log('Google search fallback status:', searchResponse.status);

      if (searchResponse.ok && searchData?.data) {
        const seenNames = new Set(places.map(p => p.name.toLowerCase()));

        for (const result of searchData.data) {
          // Only process Google Maps place results
          const url = result.url || '';
          const isGoogleMapsPlace = url.includes('google.com/maps/place/');
          
          // Extract clean business name
          let name = result.title || '';
          // Remove common suffixes from Google Maps titles
          name = name.replace(/\s*[-–·|]\s*Google Maps.*$/i, '').trim();
          name = name.replace(/\s*[-–·|]\s*Google Meu Negócio.*$/i, '').trim();
          
          if (!name || name.length < 2 || name.length > 100) continue;
          if (seenNames.has(name.toLowerCase())) continue;
          
          // Skip article-like titles
          if (name.match(/\b(melhores|top \d|best \d|onde comer|where to|guia de|os \d+ |las \d+ )/i)) continue;

          seenNames.add(name.toLowerCase());

          // Extract data from description
          const desc = result.description || '';
          const phoneMatch = desc.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
          const ratingMatch = desc.match(/(\d[.,]\d)\s*(?:estrela|star|⭐|\()/i);
          const reviewMatch = desc.match(/\((\d+)\s*(?:avalia|review)/i);

          let phone = phoneMatch?.[0] || null;
          if (phone) {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 8 || cleaned.length > 13) phone = null;
          }

          places.push({
            place_id: generatePlaceId(),
            name,
            address: desc.slice(0, 200) || null,
            phone,
            website: null,
            rating: ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : null,
            total_reviews: reviewMatch ? parseInt(reviewMatch[1]) : null,
            category: segment,
            google_maps_url: isGoogleMapsPlace ? url : null,
          });

          if (places.length >= max_results) break;
        }
      }
    }

    // If still no results, try scraping Google search for "{segment} em {location}" with Maps results
    if (places.length < 3) {
      console.log('Still few results, trying direct Google search...');

      const directQuery = `${segment} ${category_filter || ''} em ${location} telefone endereço`;
      
      const directSearch = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: directQuery,
          limit: Math.min(max_results, 20),
          lang: search_language === 'pt' ? 'pt-br' : search_language,
          country: 'BR',
        }),
      });

      const directData = await directSearch.json();
      
      if (directSearch.ok && directData?.data) {
        const seenNames = new Set(places.map(p => p.name.toLowerCase()));
        
        for (const result of directData.data) {
          const url = result.url || '';
          let name = result.title || '';
          
          // Clean up title
          name = name.replace(/\s*[-–·|].*$/i, '').trim();
          
          if (!name || name.length < 2 || name.length > 80) continue;
          if (seenNames.has(name.toLowerCase())) continue;
          if (name.match(/\b(melhores|top \d|best \d|onde comer|where to|guia de|os \d+ |las \d+ |dicas|blog)/i)) continue;
          // Skip if URL is from article/blog sites
          if (url.match(/(tripadvisor|yelp|foursquare|facebook|instagram|youtube|blog|guia|wikipedia)/i)) continue;

          seenNames.add(name.toLowerCase());

          const desc = result.description || '';
          const phoneMatch = desc.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
          
          let phone = phoneMatch?.[0] || null;
          if (phone) {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 8 || cleaned.length > 13) phone = null;
          }

          places.push({
            place_id: generatePlaceId(),
            name,
            address: desc.slice(0, 200) || null,
            phone,
            website: url.match(/(tripadvisor|yelp|google|facebook|instagram)/i) ? null : url,
            rating: null,
            total_reviews: null,
            category: segment,
            google_maps_url: url.includes('google.com/maps') ? url : null,
          });

          if (places.length >= max_results) break;
        }
      }
    }

    // Apply keyword exclusion filter
    if (keywords_exclude) {
      const excludeWords = keywords_exclude.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      places = places.filter(p => {
        const text = `${p.name} ${p.address || ''} ${p.category}`.toLowerCase();
        return !excludeWords.some(w => text.includes(w));
      });
    }

    // Limit results
    places = places.slice(0, max_results);

    console.log(`Returning ${places.length} businesses`);

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
