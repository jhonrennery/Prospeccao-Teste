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
  email: string | null;
  instagram: string | null;
}

function generatePlaceId(): string {
  return `gm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanVal(val: any): string | null {
  if (!val || val === 'null' || val === 'undefined' || val === 'N/A') return null;
  return String(val).trim();
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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey || !lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const query = [segment, category_filter, keywords_include, location]
      .filter(Boolean).join(' ');

    console.log('Searching:', query);

    // Single Firecrawl search with scrape to get content
    const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${query} endereço telefone avaliações Google`,
        limit: 8,
        lang: search_language === 'pt' ? 'pt-br' : search_language,
        country: 'BR',
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
      }),
    });

    const searchData = await searchResp.json();
    console.log('Search status:', searchResp.status);

    if (!searchResp.ok) {
      console.error('Search error:', JSON.stringify(searchData));
      return new Response(
        JSON.stringify({ error: 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect content (limit to avoid token overflow)
    const contentParts: string[] = [];
    if (searchData?.data) {
      for (const r of searchData.data) {
        const md = r.markdown || r.description || '';
        if (md.length > 50) {
          contentParts.push(md.slice(0, 3000));
        }
      }
    }

    console.log(`Collected ${contentParts.length} pages of content`);

    if (contentParts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, places: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = contentParts.join('\n---\n').slice(0, 15000);

    // AI extraction
    console.log('AI extraction, content:', content.length, 'chars');

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Extraia empresas REAIS (Google Meu Negócio) do conteúdo. Apenas estabelecimentos físicos com CNPJ. Ignore nomes de artigos, blogs, listas "top 10", sites agregadores. Telefone em formato (XX) XXXXX-XXXX. Se dado não existe, omita o campo.`,
          },
          {
            role: 'user',
            content: `Extraia até ${max_results} "${segment}" de "${location}". Inclua email e Instagram quando disponíveis:\n\n${content}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_businesses',
            description: 'Lista de empresas reais extraídas',
            parameters: {
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
                      website: { type: 'string' },
                      email: { type: 'string' },
                      instagram: { type: 'string', description: 'Instagram username or URL' },
                      rating: { type: 'number' },
                      total_reviews: { type: 'number' },
                      category: { type: 'string' },
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
        }],
        tool_choice: { type: 'function', function: { name: 'extract_businesses' } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('AI error:', aiResp.status, errText);
      const status = aiResp.status;
      const msg = status === 429 ? 'Limite de requisições excedido' 
                : status === 402 ? 'Créditos de IA esgotados'
                : 'Falha na extração';
      return new Response(
        JSON.stringify({ error: msg }),
        { status: status >= 400 && status < 500 ? status : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResp.json();
    let businesses: any[] = [];

    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        businesses = JSON.parse(toolCall.function.arguments).businesses || [];
      } catch (e) {
        console.error('Parse error:', e);
      }
    }

    console.log(`AI extracted ${businesses.length} businesses`);

    // Clean and deduplicate
    const places: PlaceData[] = [];
    const seen = new Set<string>();

    for (const biz of businesses) {
      const name = cleanVal(biz.name);
      if (!name || name.length < 2 || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      let rating = biz.rating ? Number(biz.rating) : null;
      if (rating && (rating < 1 || rating > 5)) rating = null;

      let website = cleanVal(biz.website);
      if (website && /(tripadvisor|yelp|facebook\.com|instagram\.com|youtube|google\.com|ifood|rappi)/i.test(website)) {
        website = null;
      }
      if (website && !website.startsWith('http')) website = `https://${website}`;

      let phone = cleanVal(biz.phone);
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 8 || digits.length > 13) phone = null;
      }

      // Clean email
      let email = cleanVal(biz.email);
      if (email) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) email = null;
      }

      // Clean instagram
      let instagram = cleanVal(biz.instagram);
      if (instagram) {
        instagram = instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
        if (instagram.length < 2) instagram = null;
      }

      places.push({
        place_id: generatePlaceId(),
        name,
        address: cleanVal(biz.address),
        phone,
        website,
        rating,
        total_reviews: biz.total_reviews > 0 ? Number(biz.total_reviews) : null,
        category: cleanVal(biz.category) || segment,
        google_maps_url: null,
        email,
        instagram: instagram ? `@${instagram}` : null,
      });

      if (places.length >= max_results) break;
    }

    // Keyword exclusion
    let final = places;
    if (keywords_exclude) {
      const excl = keywords_exclude.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      final = final.filter(p => {
        const t = `${p.name} ${p.address || ''}`.toLowerCase();
        return !excl.some(w => t.includes(w));
      });
    }

    console.log(`Returning ${final.length} businesses`);

    return new Response(
      JSON.stringify({ success: true, places: final }),
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
