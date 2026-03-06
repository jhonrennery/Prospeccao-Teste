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

// Filter out article/blog/list titles that aren't real businesses
function isArticleTitle(name: string): boolean {
  return /\b(melhores|top \d|best \d|onde comer|where to|guia de|os \d+ |las \d+ |dicas|blog|como escolher|ranking|lista de|review of|updated|atualizado|youtube)/i.test(name);
}

// Filter out non-business URLs
function isArticleSite(url: string): boolean {
  return /(tripadvisor|yelp|foursquare|facebook\.com|instagram\.com|youtube|blog|guia|wikipedia|tiktok|twitter|x\.com|reddit)/i.test(url);
}

// Extract a valid Brazilian phone from text
function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+55\s?)?(?:\(?0?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/);
  if (!match) return null;
  const cleaned = match[0].replace(/\D/g, '');
  if (cleaned.length >= 8 && cleaned.length <= 13) return match[0];
  return null;
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

    // ===== STRATEGY =====
    // 1. Scrape Google local search results page (renders server-side, contains business cards)
    // 2. Use Firecrawl JSON extraction to get structured business data
    // 3. Fallback: scrape individual Google Maps place pages from links found

    const queryParts = [segment];
    if (category_filter) queryParts.push(category_filter);
    if (keywords_include) queryParts.push(keywords_include);
    queryParts.push(location);

    const searchQuery = queryParts.join(' ');
    const places: PlaceData[] = [];
    const seenNames = new Set<string>();

    // ---- APPROACH 1: Scrape Google Local Search results with JSON extraction ----
    const googleLocalUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=lcl&num=20`;
    console.log('Scraping Google local search:', googleLocalUrl);

    const localScrape = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: googleLocalUrl,
        formats: [
          'markdown',
          {
            type: 'json',
            prompt: `Extract all business listings from this Google local search results page. For each business, extract: name, address, phone number, rating (number 1-5), number of reviews, category/type, and Google Maps URL if available. Only extract real business names, NOT article titles or "top 10" lists.`,
            schema: {
              type: 'object',
              properties: {
                businesses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      address: { type: 'string' },
                      phone: { type: 'string' },
                      rating: { type: 'number' },
                      total_reviews: { type: 'number' },
                      category: { type: 'string' },
                      google_maps_url: { type: 'string' },
                      website: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
              },
              required: ['businesses'],
            },
          },
        ],
        waitFor: 3000,
        location: {
          country: 'BR',
          languages: [search_language === 'pt' ? 'pt-BR' : search_language],
        },
      }),
    });

    const localData = await localScrape.json();
    console.log('Google local scrape status:', localScrape.status);

    // Process JSON extraction results
    const jsonData = localData?.data?.json || localData?.json;
    if (jsonData?.businesses) {
      console.log(`JSON extraction found ${jsonData.businesses.length} businesses`);
      for (const biz of jsonData.businesses) {
        if (!biz.name || biz.name.length < 2 || isArticleTitle(biz.name)) continue;
        if (seenNames.has(biz.name.toLowerCase())) continue;
        seenNames.add(biz.name.toLowerCase());

        places.push({
          place_id: generatePlaceId(),
          name: biz.name,
          address: biz.address || null,
          phone: biz.phone || null,
          website: biz.website && !isArticleSite(biz.website) ? biz.website : null,
          rating: biz.rating && biz.rating >= 1 && biz.rating <= 5 ? biz.rating : null,
          total_reviews: biz.total_reviews && biz.total_reviews > 0 ? biz.total_reviews : null,
          category: biz.category || segment,
          google_maps_url: biz.google_maps_url || null,
        });

        if (places.length >= max_results) break;
      }
    }

    // Also parse the markdown for any additional businesses
    const markdown = localData?.data?.markdown || localData?.markdown || '';
    console.log('Local search markdown length:', markdown.length);
    if (markdown.length > 100) {
      console.log('Markdown preview:', markdown.slice(0, 1500));
    }

    // ---- APPROACH 2: If JSON extraction didn't work well, try Google Maps scrape ----
    if (places.length < 3) {
      console.log('JSON extraction yielded few results, trying Google Maps scrape...');
      
      const mapsQuery = `${segment}${category_filter ? ' ' + category_filter : ''} em ${location}`;
      const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(mapsQuery)}`;

      const mapsScrape = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: mapsUrl,
          formats: [
            'markdown',
            {
              type: 'json',
              prompt: `Extract all business listings shown on this Google Maps search results page. For each business extract: name, full address, phone, rating, number of reviews, category, website URL. Only real businesses, not articles.`,
              schema: {
                type: 'object',
                properties: {
                  businesses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        address: { type: 'string' },
                        phone: { type: 'string' },
                        rating: { type: 'number' },
                        total_reviews: { type: 'number' },
                        category: { type: 'string' },
                        website: { type: 'string' },
                      },
                      required: ['name'],
                    },
                  },
                },
                required: ['businesses'],
              },
            },
          ],
          waitFor: 5000,
          location: { country: 'BR', languages: ['pt-BR'] },
        }),
      });

      const mapsData = await mapsScrape.json();
      console.log('Maps scrape status:', mapsScrape.status);

      const mapsJson = mapsData?.data?.json || mapsData?.json;
      if (mapsJson?.businesses) {
        console.log(`Maps JSON extraction found ${mapsJson.businesses.length} businesses`);
        for (const biz of mapsJson.businesses) {
          if (!biz.name || biz.name.length < 2 || isArticleTitle(biz.name)) continue;
          if (seenNames.has(biz.name.toLowerCase())) continue;
          seenNames.add(biz.name.toLowerCase());

          places.push({
            place_id: generatePlaceId(),
            name: biz.name,
            address: biz.address || null,
            phone: biz.phone || null,
            website: biz.website && !isArticleSite(biz.website) ? biz.website : null,
            rating: biz.rating && biz.rating >= 1 && biz.rating <= 5 ? biz.rating : null,
            total_reviews: biz.total_reviews && biz.total_reviews > 0 ? biz.total_reviews : null,
            category: biz.category || segment,
            google_maps_url: null,
          });

          if (places.length >= max_results) break;
        }
      }

      // Parse Maps markdown as well
      const mapsMarkdown = mapsData?.data?.markdown || mapsData?.markdown || '';
      console.log('Maps markdown length:', mapsMarkdown.length);
      if (mapsMarkdown.length > 100) {
        console.log('Maps markdown preview:', mapsMarkdown.slice(0, 1500));
      }
    }

    // ---- APPROACH 3: Firecrawl search as last resort ----
    if (places.length < 3) {
      console.log('Trying Firecrawl search as fallback...');

      // Search for individual business listings, not articles
      const fbSearchQuery = `"${segment}" "${location}" telefone endereço avaliações -melhores -top -ranking -blog -guia`;
      
      const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: fbSearchQuery,
          limit: Math.min(max_results, 20),
          lang: search_language === 'pt' ? 'pt-br' : search_language,
          country: 'BR',
        }),
      });

      const searchData = await searchResp.json();
      console.log('Fallback search status:', searchResp.status);

      if (searchResp.ok && searchData?.data) {
        for (const result of searchData.data) {
          const url = result.url || '';
          let name = result.title || '';

          // Clean up title
          name = name.replace(/\s*[-–·|].*$/i, '').trim();

          if (!name || name.length < 2 || name.length > 80) continue;
          if (seenNames.has(name.toLowerCase())) continue;
          if (isArticleTitle(name)) continue;
          if (isArticleSite(url)) continue;

          seenNames.add(name.toLowerCase());

          const desc = result.description || '';
          const phone = extractPhone(desc);

          places.push({
            place_id: generatePlaceId(),
            name,
            address: desc.slice(0, 200) || null,
            phone,
            website: isArticleSite(url) ? null : url,
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
    let finalPlaces = places;
    if (keywords_exclude) {
      const excludeWords = keywords_exclude.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      finalPlaces = finalPlaces.filter(p => {
        const text = `${p.name} ${p.address || ''} ${p.category}`.toLowerCase();
        return !excludeWords.some(w => text.includes(w));
      });
    }

    finalPlaces = finalPlaces.slice(0, max_results);
    console.log(`Returning ${finalPlaces.length} businesses`);

    return new Response(
      JSON.stringify({ success: true, places: finalPlaces }),
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
