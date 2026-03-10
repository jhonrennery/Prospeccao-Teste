const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { places } = await req.json();

    if (!places || !Array.isArray(places)) {
      return new Response(
        JSON.stringify({ error: 'places array is required' }),
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

    const results: Array<{ id: string; email?: string; instagram?: string }> = [];

    // Email regex patterns
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const excludePatterns = [
      /.*@(example|test|sentry|wixpress|w3|schema|googleapis|google|facebook|twitter|instagram)\..*$/i,
      /.*\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
    ];

    const instagramRegex = /(?:instagram\.com\/|@)([a-zA-Z0-9._]{2,30})/gi;

    for (const place of places) {
      if (!place.website) {
        results.push({ id: place.id });
        continue;
      }

      const extractFromContent = (content: string) => {
        const emails = content.match(emailRegex) || [];
        const validEmails = emails.filter((email: string) =>
          !excludePatterns.some(pattern => pattern.test(email))
        );
        const igMatches = [...content.matchAll(instagramRegex)];
        const igUsernames = igMatches.map(m => m[1]).filter(u => 
          !['p', 'reel', 'stories', 'explore', 'accounts', 'direct'].includes(u.toLowerCase())
        );
        return { emails: validEmails, instagram: igUsernames.length > 0 ? `@${igUsernames[0]}` : undefined };
      };

      try {
        let url = place.website.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }

        console.log(`Enriching: ${url}`);

        // Scrape the website for emails
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown', 'links'],
            onlyMainContent: false,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const content = (data.data?.markdown || data.markdown || '') + ' ' + 
                         (data.data?.html || data.html || '');

          const extracted = extractFromContent(content);

          if (extracted.emails.length > 0) {
            const contactEmail = extracted.emails.find((e: string) => 
              /^(contato|contact|info|comercial|vendas|sales|hello|ola)/i.test(e)
            ) || extracted.emails[0];

            results.push({ id: place.id, email: contactEmail, instagram: extracted.instagram });
            console.log(`Found email for ${url}: ${contactEmail}`, extracted.instagram ? `IG: ${extracted.instagram}` : '');
          } else {
            // Try contact page
            const links = data.data?.links || data.links || [];
            const contactLink = links.find((l: string) => 
              /contato|contact|fale.conosco|about/i.test(l)
            );

            if (contactLink) {
              console.log(`Trying contact page: ${contactLink}`);
              const contactResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url: contactLink,
                  formats: ['markdown'],
                  onlyMainContent: false,
                }),
              });

              const contactData = await contactResponse.json();
              if (contactResponse.ok) {
                const contactContent = contactData.data?.markdown || contactData.markdown || '';
                const contactExtracted = extractFromContent(contactContent);
                const ig = extracted.instagram || contactExtracted.instagram;

                if (contactExtracted.emails.length > 0) {
                  results.push({ id: place.id, email: contactExtracted.emails[0], instagram: ig });
                } else {
                  results.push({ id: place.id, instagram: ig });
                }
              } else {
                results.push({ id: place.id, instagram: extracted.instagram });
              }
            } else {
              results.push({ id: place.id, instagram: extracted.instagram });
            }
          }
        } else {
          console.error(`Scrape failed for ${url}:`, data);
          results.push({ id: place.id });
        }
      } catch (err) {
        console.error(`Error enriching ${place.website}:`, err);
        results.push({ id: place.id });
      }
    }

    console.log(`Enrichment complete. ${results.filter(r => r.email).length} emails found.`);

    return new Response(
      JSON.stringify({ success: true, results }),
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
