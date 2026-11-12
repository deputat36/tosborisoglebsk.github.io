// Public, code-protected participant endpoint. Never expose the service-role key in web assets.
// Deploy on a DEDICATED Supabase project with verify_jwt=false (auth is the team's long random code).
const ORIGIN = Deno.env.get('BATTLE_ALLOWED_ORIGIN') || 'https://tosborisoglebsk.ru';
const BASE = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PEPPER = Deno.env.get('BATTLE_PEPPER') || '';
const encoder = new TextEncoder();

function headers(origin: string | null): HeadersInit {
  return {
    ...(origin === ORIGIN ? { 'Access-Control-Allow-Origin': ORIGIN } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '600',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}
function respond(payload: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(payload), { status, headers: headers(origin) });
}
async function digest(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(PEPPER), {
    name: 'HMAC', hash: 'SHA-256'
  }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function db(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
  const response = await fetch(BASE + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {})
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Database request failed');
  return await response.json();
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return origin === ORIGIN
      ? new Response(null, { status: 204, headers: headers(origin) })
      : respond({ error: 'forbidden' }, 403, origin);
  }
  // An Origin header is a browser isolation measure, not a substitute for codes and rate limits.
  if (origin !== ORIGIN) return respond({ error: 'forbidden' }, 403, origin);
  if (!BASE.startsWith('https://') || !SERVICE_KEY || PEPPER.length < 32) {
    return respond({ error: 'unavailable' }, 503, origin);
  }
  try {
    if (req.method === 'GET') {
      const slug = new URL(req.url).searchParams.get('event') || '';
      if (!/^[a-z0-9-]{4,80}$/.test(slug)) return respond({ error: 'invalid_request' }, 400, origin);
      const events = await db('battle_events?select=id,status,pilot_tos_slug&slug=eq.' + encodeURIComponent(slug)) as
        Array<{ id: string; status: string; pilot_tos_slug: string | null }>;
      if (!Array.isArray(events) || events.length !== 1) return respond({ error: 'unavailable' }, 404, origin);
      const event = events[0];
      let teams: Array<{ id: string; name: string; tos_slug: string }> = [];
      if (event.status !== 'draft') {
        teams = await db('battle_teams?select=id,name,tos_slug&event_id=eq.' + encodeURIComponent(event.id) + '&order=name.asc') as
          Array<{ id: string; name: string; tos_slug: string }>;
      }
      const assignments = await db('battle_assignments?select=team_id&event_id=eq.' + encodeURIComponent(event.id)) as
        Array<{ team_id: string }>;
      if (!Array.isArray(assignments)) throw new Error('Invalid draw counter.');
      // Counts only. Never expose the assignment mapping or dish selection via GET.
      return respond({
        status: event.status,
        pilot_team_slug: event.status === 'pilot' ? event.pilot_tos_slug : null,
        teams,
        total_teams: 26,
        total_dishes: 19,
        remaining: Math.max(0, 19 - assignments.length)
      }, 200, origin);
    }
    if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405, origin);
    const raw = await req.text();
    if (raw.length > 600) return respond({ error: 'invalid_request' }, 400, origin);
    let input: { event?: unknown; team_id?: unknown; code?: unknown };
    try { input = JSON.parse(raw); } catch { return respond({ error: 'invalid_request' }, 400, origin); }
    if (!input || typeof input.event !== 'string' || typeof input.team_id !== 'string' || typeof input.code !== 'string'
       || !/^[a-z0-9-]{4,80}$/.test(input.event)
       || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.team_id)) {
      return respond({ error: 'invalid_request' }, 400, origin);
    }
    const normalized = input.code.toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-HJ-NP-Z2-9]{24}$/.test(normalized)) {
      return respond({ error: 'invalid_credentials' }, 401, origin);
    }
    // Never store un-hashed IP/UA or the original code.
    // Platform rate limiting / WAF is additionally recommended for distributed attacks.
    const clientIp = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
      || 'unknown';
    // Without a trustworthy forwarded IP, avoid globally throttling all browsers with the same UA.
    const clientDigest = await digest('client:' + clientIp + '|' + (req.headers.get('user-agent') || '').slice(0, 180)
      + (clientIp === 'unknown' ? '|' + input.team_id : ''));
    const codeDigest = await digest('code:' + normalized);
    const result = await db('rpc/battle_reveal', 'POST', {
      p_event_slug: input.event,
      p_team_id: input.team_id,
      p_code_digest: codeDigest,
      p_client_digest: clientDigest
    }) as { error?: string; team_name?: string; dish_name?: string };
    if (result && result.error) {
      const mapped = result.error === 'invalid_credentials' ? 401
        : result.error === 'rate_limited' ? 429 : result.error === 'unavailable' ? 503 : 403;
      return respond({ error: result.error }, mapped, origin);
    }
    if (!result || typeof result.team_name !== 'string' || typeof result.dish_name !== 'string') {
      return respond({ error: 'unavailable' }, 503, origin);
    }
    return respond(result, 200, origin);
  } catch {
    // Do not expose SQL errors, headers or secrets to the public.
    return respond({ error: 'unavailable' }, 503, origin);
  }
});
