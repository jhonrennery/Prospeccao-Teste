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

    const results: Array<{ id: string; email?: string; instagram?: string; phone?: string }> = [];

    // Email regex patterns
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const excludePatterns = [
      /.*@(example|test|sentry|wixpress|w3|schema|googleapis|google|facebook|twitter|instagram|noreply|no-reply)\..*$/i,
      /.*\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i,
    ];

    const instagramRegex = /(?:instagram\.com\/|@)([a-zA-Z0-9._]{2,30})/gi;
    const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g;

    const extractFromContent = (content: string) => {
      // Emails
      const emails = content.match(emailRegex) || [];
      const validEmails = emails.filter((email: string) =>
        !excludePatterns.some(pattern => pattern.test(email))
      );

      // Instagram
      const igMatches = [...content.matchAll(instagramRegex)];
      const igUsernames = igMatches.map(m => m[1]).filter(u =>
        !['p', 'reel', 'stories', 'explore', 'accounts', 'direct', 'about', 'help'].includes(u.toLowerCase())
      );

      // Phones
      const phoneMatches = content.match(phoneRegex) || [];
      const validPhones = phoneMatches
        .map(p => p.replace(/\D/g, ''))
        .filter(digits => {
          if (digits.startsWith('55')) digits = digits.slice(2);
          return digits.length >= 10 && digits.length <= 11;
        })
        .map(digits => {
          if (digits.startsWith('55')) digits = digits.slice(2);
          const ddd = digits.slice(0, 2);
          const num = digits.slice(2);
          return num.length === 9
            ? `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`
            : `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
        });

      return {
        emails: validEmails,
        instagram: igUsernames.length > 0 ? `@${igUsernames[0]}` : undefined,
        phone: validPhones.length > 0 ? validPhones[0] : undefined,
      };
    };

    const scrapeUrl = async (url: string) => {
      const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
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
      return { ok: resp.ok, data: await resp.json() };
    };

    const searchWeb = async (query: string) => {
      const resp = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 3,
          lang: 'pt-br',
          country: 'BR',
          scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) return '';
      return (data?.data || []).map((r: any) => r.markdown || r.description || '').join('\n');
    };

    for (const place of places) {
      try {
        let allContent = '';
        let extracted = { emails: [] as string[], instagram: undefined as string | undefined, phone: undefined as string | undefined };

        // Strategy 1: Scrape website if available
        if (place.website) {
          let url = place.website.trim();
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
          }

          console.log(`Enriching via website: ${url}`);

          const { ok, data } = await scrapeUrl(url);

          if (ok) {
            const content = (data.data?.markdown || data.markdown || '') + ' ' +
                           (data.data?.html || data.html || '');
            allContent += content;
            extracted = extractFromContent(content);

            // If no email found, try contact page
            if (extracted.emails.length === 0) {
              const links = data.data?.links || data.links || [];
              const contactLink = links.find((l: string) =>
                /contato|contact|fale.conosco|about|sobre/i.test(l)
              );

              if (contactLink) {
                console.log(`Trying contact page: ${contactLink}`);
                const contactResult = await scrapeUrl(contactLink);
                if (contactResult.ok) {
                  const contactContent = contactResult.data.data?.markdown || contactResult.data.markdown || '';
                  allContent += ' ' + contactContent;
                  const contactExtracted = extractFromContent(allContent);
                  extracted = {
                    emails: contactExtracted.emails.length > 0 ? contactExtracted.emails : extracted.emails,
                    instagram: extracted.instagram || contactExtracted.instagram,
                    phone: extracted.phone || contactExtracted.phone,
                  };
                }
              }
            }
          }
        }

        // Strategy 2: If still missing data, search the web for the business name
        const missingEmail = extracted.emails.length === 0;
        const missingInstagram = !extracted.instagram;
        const missingPhone = !extracted.phone && !place.phone;

        if (missingEmail || missingInstagram || missingPhone) {
          const searchParts = [`"${place.name}"`];
          if (missingEmail) searchParts.push('email contato');
          if (missingInstagram) searchParts.push('instagram');
          if (missingPhone) searchParts.push('telefone WhatsApp');

          console.log(`Web search for missing data: ${place.name}`);
          const webContent = await searchWeb(searchParts.join(' '));

          if (webContent) {
            const webExtracted = extractFromContent(webContent);
            if (missingEmail && webExtracted.emails.length > 0) {
              extracted.emails = webExtracted.emails;
            }
            if (missingInstagram && webExtracted.instagram) {
              extracted.instagram = webExtracted.instagram;
            }
            if (missingPhone && webExtracted.phone) {
              extracted.phone = webExtracted.phone;
            }
          }
        }

        // Pick best email (prefer contact/info emails)
        let bestEmail: string | undefined;
        if (extracted.emails.length > 0) {
          bestEmail = extracted.emails.find((e: string) =>
            /^(contato|contact|info|comercial|vendas|sales|hello|ola|atendimento|sac)/i.test(e)
          ) || extracted.emails[0];
        }

        results.push({
          id: place.id,
          email: bestEmail,
          instagram: extracted.instagram,
          phone: extracted.phone,
        });

        console.log(`${place.name}: email=${bestEmail || 'none'}, ig=${extracted.instagram || 'none'}, phone=${extracted.phone || 'none'}`);

      } catch (err) {
        console.error(`Error enriching ${place.name || place.id}:`, err);
        results.push({ id: place.id });
      }
    }

    const emailCount = results.filter(r => r.email).length;
    const igCount = results.filter(r => r.instagram).length;
    const phoneCount = results.filter(r => r.phone).length;
    console.log(`Enrichment complete. ${emailCount} emails, ${igCount} instagrams, ${phoneCount} phones found.`);

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
