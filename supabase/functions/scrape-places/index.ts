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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== STRATEGY =====
    // 1. Use Firecrawl search to find pages that LIST businesses (TripAdvisor, blogs, etc.)
    // 2. Scrape the top results to get full content with business names, ratings, etc.
    // 3. Use AI to extract individual businesses from the scraped content
    // 4. Return clean, structured business data

    const queryParts = [segment];
    if (category_filter) queryParts.push(category_filter);
    if (keywords_include) queryParts.push(keywords_include);
    queryParts.push(location);

    const searchQuery = queryParts.join(' ');

    // Step 1: Search for pages listing businesses
    console.log('Searching for business listings:', searchQuery);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${searchQuery} telefone endereço avaliações Google`,
        limit: 10,
        lang: search_language === 'pt' ? 'pt-br' : search_language,
        country: 'BR',
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      }),
    });

    const searchData = await searchResponse.json();
    console.log('Search status:', searchResponse.status);

    if (!searchResponse.ok) {
      console.error('Search error:', JSON.stringify(searchData));
      return new Response(
        JSON.stringify({ error: 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Collect all scraped content
    const allContent: string[] = [];

    if (searchData?.data) {
      for (const result of searchData.data) {
        const md = result.markdown || result.description || '';
        if (md.length > 50) {
          allContent.push(md.slice(0, 3000)); // Limit per result to avoid token overflow
        }
      }
    }

    console.log(`Collected content from ${allContent.length} pages`);

    if (allContent.length === 0) {
      return new Response(
        JSON.stringify({ success: true, places: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Use AI to extract individual businesses
    const combinedContent = allContent.join('\n\n---PAGE BREAK---\n\n').slice(0, 15000);

    console.log('Sending to AI for extraction, content length:', combinedContent.length);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction expert. Extract REAL individual business listings from the provided web content. 
Rules:
- Only extract REAL business establishments (restaurants, stores, clinics, etc.) that are registered on Google My Business
- Do NOT include article titles, blog names, website names, or "top 10" list names
- Do NOT include aggregator sites (TripAdvisor, Yelp, etc.) as businesses
- Extract: name, full address, phone number, website URL, rating (1-5), number of reviews, business category
- Phone numbers should be in Brazilian format
- Rating should be a decimal number (e.g., 4.5)
- If a field is not available, use null
- Return ONLY valid JSON, no markdown formatting`,
          },
          {
            role: 'user',
            content: `Extract all individual "${segment}" businesses located in "${location}" from this content. Return a JSON array of businesses:\n\n${combinedContent}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_businesses',
              description: 'Extract structured business data from web content',
              parameters: {
                type: 'object',
                properties: {
                  businesses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Business name' },
                        address: { type: 'string', description: 'Full address' },
                        phone: { type: 'string', description: 'Phone number in Brazilian format' },
                        website: { type: 'string', description: 'Business website URL' },
                        rating: { type: 'number', description: 'Rating 1-5' },
                        total_reviews: { type: 'number', description: 'Number of reviews' },
                        category: { type: 'string', description: 'Business category/type' },
                      },
                      required: ['name'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['businesses'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_businesses' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI extraction error:', aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let businesses: any[] = [];

    // Parse tool call response
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        businesses = parsed.businesses || [];
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    console.log(`AI extracted ${businesses.length} businesses`);

    // Step 4: Convert to PlaceData format and deduplicate
    const places: PlaceData[] = [];
    const seenNames = new Set<string>();

    for (const biz of businesses) {
      if (!biz.name || biz.name.length < 2) continue;
      
      const normalizedName = biz.name.toLowerCase().trim();
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);

      // Validate and clean data
      let rating = biz.rating ? Number(biz.rating) : null;
      if (rating && (rating < 1 || rating > 5)) rating = null;

      let totalReviews = biz.total_reviews ? Number(biz.total_reviews) : null;
      if (totalReviews && totalReviews < 0) totalReviews = null;

      let website = biz.website || null;
      if (website) {
        // Skip aggregator sites
        if (/(tripadvisor|yelp|foursquare|facebook\.com|instagram\.com|youtube|google\.com)/i.test(website)) {
          website = null;
        }
        // Ensure URL has protocol
        if (website && !website.startsWith('http')) {
          website = `https://${website}`;
        }
      }

      places.push({
        place_id: generatePlaceId(),
        name: biz.name.trim(),
        address: biz.address || null,
        phone: biz.phone || null,
        website,
        rating,
        total_reviews: totalReviews,
        category: biz.category || segment,
        google_maps_url: null,
      });

      if (places.length >= max_results) break;
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
