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
  if (!val || val === 'null' || val === 'undefined' || val === 'N/A' || val === 'n/a') return null;
  return String(val).trim();
}

async function firecrawlSearch(apiKey: string, query: string, limit: number, lang: string): Promise<any[]> {
  const resp = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      lang: lang === 'pt' ? 'pt-br' : lang,
      country: 'BR',
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error('Search error:', JSON.stringify(data));
    return [];
  }
  return data?.data || [];
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

    const baseQuery = [segment, category_filter, keywords_include, location]
      .filter(Boolean).join(' ');

    console.log('Base query:', baseQuery);

    // Multiple targeted searches in parallel for broader, more precise results
    const searchQueries = [
      // Google Maps / Google Meu Negócio focused
      `${baseQuery} site:google.com/maps OR "Google Meu Negócio" telefone endereço`,
      // General business listing with contact info
      `"${segment}" "${location}" telefone email contato instagram`,
      // Business directories and yellow pages
      `${baseQuery} guia comercial lista empresas telefone WhatsApp`,
    ];

    console.log('Running', searchQueries.length, 'parallel searches');

    const searchResults = await Promise.all(
      searchQueries.map(q => firecrawlSearch(apiKey, q, 6, search_language))
    );

    // Collect and deduplicate content from all searches
    const contentParts: string[] = [];
    const seenUrls = new Set<string>();

    for (const results of searchResults) {
      for (const r of results) {
        const url = r.url || '';
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        const md = r.markdown || r.description || '';
        if (md.length > 50) {
          contentParts.push(md.slice(0, 4000));
        }
      }
    }

    console.log(`Collected ${contentParts.length} unique pages of content`);

    if (contentParts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, places: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = contentParts.join('\n---PAGE_BREAK---\n').slice(0, 25000);

    // AI extraction with improved prompt
    console.log('AI extraction, content:', content.length, 'chars');

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um extrator especializado em dados de empresas brasileiras. Sua tarefa é extrair APENAS estabelecimentos REAIS do tipo "${segment}" localizados em "${location}".

REGRAS CRÍTICAS:
1. Extraia APENAS empresas reais com nome comercial próprio. IGNORE: artigos de blog, listas "top 10", "melhores X", sites agregadores (Yelp, TripAdvisor, iFood, Rappi), resultados genéricos.
2. PRIORIZE extrair dados de contato: telefone, email, Instagram e website. Esses são os dados mais valiosos.
3. Telefone: formato brasileiro (XX) XXXXX-XXXX ou (XX) XXXX-XXXX. Aceite também números com +55.
4. Email: apenas emails corporativos válidos. Ignore emails genéricos de plataformas.
5. Instagram: extraia o @ ou a URL completa. Ignore perfis de plataformas/agregadores.
6. Website: apenas o site oficial da empresa. Ignore links de redes sociais, plataformas de avaliação.
7. Se a empresa não tiver determinado dado, simplesmente omita o campo.
8. Deduplicar: se a mesma empresa aparecer mais de uma vez, mescle os dados (pegue o mais completo).`,
          },
          {
            role: 'user',
            content: `Extraia até ${max_results} empresas do tipo "${segment}" em "${location}" do conteúdo abaixo. Para cada empresa, extraia o máximo de dados de contato possível (telefone, email, Instagram, website):\n\n${content}`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_businesses',
            description: 'Lista de empresas reais extraídas com dados de contato',
            parameters: {
              type: 'object',
              properties: {
                businesses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Nome comercial da empresa' },
                      address: { type: 'string', description: 'Endereço completo' },
                      phone: { type: 'string', description: 'Telefone no formato (XX) XXXXX-XXXX' },
                      website: { type: 'string', description: 'URL do site oficial' },
                      email: { type: 'string', description: 'Email de contato corporativo' },
                      instagram: { type: 'string', description: 'Username ou URL do Instagram' },
                      rating: { type: 'number', description: 'Avaliação de 1 a 5' },
                      total_reviews: { type: 'number', description: 'Número total de avaliações' },
                      category: { type: 'string', description: 'Categoria/segmento do negócio' },
                      google_maps_url: { type: 'string', description: 'Link do Google Maps' },
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
      if (website && /(tripadvisor|yelp|facebook\.com|instagram\.com|youtube|google\.com|ifood|rappi|apontador|telelistas|guiamais)/i.test(website)) {
        website = null;
      }
      if (website && !website.startsWith('http')) website = `https://${website}`;

      let phone = cleanVal(biz.phone);
      if (phone) {
        // Normalize phone
        let digits = phone.replace(/\D/g, '');
        // Remove country code 55 if present at start
        if (digits.startsWith('55') && digits.length > 11) {
          digits = digits.slice(2);
        }
        if (digits.length < 8 || digits.length > 11) {
          phone = null;
        } else if (digits.length >= 10) {
          const ddd = digits.slice(0, 2);
          const num = digits.slice(2);
          phone = num.length === 9
            ? `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
            : `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
        }
      }

      // Clean email
      let email = cleanVal(biz.email);
      if (email) {
        email = email.toLowerCase().trim();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) email = null;
        // Exclude platform emails
        if (email && /(example|test|sentry|wixpress|w3|schema|googleapis|google|facebook|twitter|noreply|no-reply)/i.test(email)) {
          email = null;
        }
      }

      // Clean instagram
      let instagram = cleanVal(biz.instagram);
      if (instagram) {
        instagram = instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, '').replace(/\?.*$/, '');
        if (instagram.length < 2 || /^(p|reel|stories|explore|accounts|direct)$/i.test(instagram)) instagram = null;
      }

      // Clean google maps url
      let googleMapsUrl = cleanVal(biz.google_maps_url);
      if (googleMapsUrl && !googleMapsUrl.includes('google.com/maps') && !googleMapsUrl.includes('goo.gl/maps')) {
        googleMapsUrl = null;
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
        google_maps_url: googleMapsUrl,
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

    console.log(`Returning ${final.length} businesses (${final.filter(p => p.phone).length} with phone, ${final.filter(p => p.email).length} with email, ${final.filter(p => p.instagram).length} with instagram)`);

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
