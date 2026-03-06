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

function cleanNullish(val: any): string | null {
  if (!val || val === 'null' || val === 'undefined' || val === 'N/A' || val === 'n/a') return null;
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

    // Build search queries
    const baseQuery = category_filter 
      ? `${segment} ${category_filter} ${location}`
      : `${segment} ${location}`;

    // Run multiple search queries in parallel to get more diverse content
    const searchQueries = [
      `${baseQuery} endereço telefone avaliações`,
      `${baseQuery} Google Maps avaliações`,
      `melhores ${baseQuery} telefone contato`,
    ];

    console.log('Running parallel searches for:', baseQuery);

    const searchPromises = searchQueries.map(query =>
      fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 5,
          lang: search_language === 'pt' ? 'pt-br' : search_language,
          country: 'BR',
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
          },
        }),
      }).then(r => r.json()).catch(() => null)
    );

    const searchResults = await Promise.all(searchPromises);
    
    // Collect all scraped content
    const allContent: string[] = [];
    const seenUrls = new Set<string>();

    for (const searchData of searchResults) {
      if (!searchData?.data) continue;
      for (const result of searchData.data) {
        const url = result.url || '';
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        
        const md = result.markdown || '';
        const desc = result.description || '';
        const title = result.title || '';
        
        if (md.length > 100) {
          allContent.push(`## Page: ${title}\nURL: ${url}\n\n${md.slice(0, 4000)}`);
        } else if (desc.length > 30) {
          allContent.push(`## Page: ${title}\nURL: ${url}\n\n${desc}`);
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

    // Use AI to extract individual businesses from the combined content
    const combinedContent = allContent.join('\n\n---\n\n').slice(0, 20000);
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
            content: `Você é um especialista em extração de dados de empresas do Google Meu Negócio (Google My Business).

REGRAS OBRIGATÓRIAS:
1. Extraia APENAS empresas REAIS que existem fisicamente - estabelecimentos com CNPJ, endereço real
2. NÃO inclua: nomes de artigos, blogs, sites agregadores (TripAdvisor, Yelp, iFood, Rappi)
3. NÃO inclua: listas "top 10", "melhores", "guias", "onde comer"
4. Cada empresa deve ter pelo menos o nome
5. Telefone deve estar em formato brasileiro: (XX) XXXX-XXXX ou (XX) XXXXX-XXXX
6. Rating deve ser um número de 1.0 a 5.0
7. Se um campo não está disponível, omita-o do resultado (não use "null" como texto)
8. Extraia o máximo possível de empresas REAIS mencionadas no conteúdo
9. Priorize empresas que tenham endereço ou telefone mencionados`,
          },
          {
            role: 'user',
            content: `Extraia todas as empresas reais do tipo "${segment}" localizadas em "${location}" mencionadas neste conteúdo. Retorne até ${max_results} empresas:\n\n${combinedContent}`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_businesses',
              description: 'Retorna lista de empresas reais extraídas do conteúdo',
              parameters: {
                type: 'object',
                properties: {
                  businesses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Nome da empresa' },
                        address: { type: 'string', description: 'Endereço completo' },
                        phone: { type: 'string', description: 'Telefone no formato (XX) XXXXX-XXXX' },
                        website: { type: 'string', description: 'URL do site da empresa (não agregadores)' },
                        rating: { type: 'number', description: 'Nota de 1.0 a 5.0' },
                        total_reviews: { type: 'number', description: 'Número total de avaliações' },
                        category: { type: 'string', description: 'Categoria/tipo do negócio' },
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
      console.error('AI error:', aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Falha na extração por IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    let businesses: any[] = [];

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

    // Convert to PlaceData and clean
    const places: PlaceData[] = [];
    const seenNames = new Set<string>();

    for (const biz of businesses) {
      const name = cleanNullish(biz.name);
      if (!name || name.length < 2) continue;
      
      const normalizedName = name.toLowerCase();
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);

      let rating = biz.rating ? Number(biz.rating) : null;
      if (rating && (rating < 1 || rating > 5)) rating = null;

      let totalReviews = biz.total_reviews ? Number(biz.total_reviews) : null;
      if (totalReviews && totalReviews < 0) totalReviews = null;

      let website = cleanNullish(biz.website);
      if (website) {
        if (/(tripadvisor|yelp|foursquare|facebook\.com|instagram\.com|youtube|google\.com|ifood|rappi)/i.test(website)) {
          website = null;
        } else if (!website.startsWith('http')) {
          website = `https://${website}`;
        }
      }

      let phone = cleanNullish(biz.phone);
      if (phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 8 || cleaned.length > 13) phone = null;
      }

      places.push({
        place_id: generatePlaceId(),
        name,
        address: cleanNullish(biz.address),
        phone,
        website,
        rating,
        total_reviews: totalReviews,
        category: cleanNullish(biz.category) || segment,
        google_maps_url: null,
      });

      if (places.length >= max_results) break;
    }

    // Apply keyword exclusion
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
