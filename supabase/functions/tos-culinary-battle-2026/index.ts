// Кулинарный батл ТОС БГО — один компактный API, без новой базы и без секретов в браузере.
// Использует только собственные public.tos_battle26_* таблицы, не обращается к CRM.
const ALLOWED_ORIGIN = "https://tosborisoglebsk.ru";
const EVENT_ID = "culinary-battle-2026";
function respond(req: Request, body: unknown, status=200): Response {
  const origin = req.headers.get("origin");
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "vary": "Origin",
      ...(origin === ALLOWED_ORIGIN ? {"access-control-allow-origin": ALLOWED_ORIGIN} : {}),
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Accept"
    }
  });
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return respond(req,{error:"forbidden"},403);
  if (req.method === "OPTIONS") {
    return new Response(null,{status:204,headers:{
      "access-control-allow-origin":ALLOWED_ORIGIN,
      "access-control-allow-methods":"GET,POST,OPTIONS",
      "access-control-allow-headers":"Content-Type,Accept",
      "access-control-max-age":"600",
      "vary":"Origin"
    }});
  }
  if (!["GET","POST"].includes(req.method)) return respond(req,{error:"method_not_allowed"},405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !secret) return respond(req,{error:"unavailable"},503);
  async function api(endpoint: string, options: RequestInit={}) {
    const response = await fetch(url + "/rest/v1/" + endpoint, {
      ...options,
      headers: {
        "apikey":secret,
        "authorization":"Bearer " + secret,
        "accept":"application/json",
        ...(options.body ? {"content-type":"application/json"} : {}),
        ...(options.headers || {})
      }
    });
    if (!response.ok) throw new Error("Database request status " + response.status);
    return await response.json();
  }
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      if(u.searchParams.get("event") !== EVENT_ID) return respond(req,{error:"unavailable"},404);
      const [events,allTeams,assigned] = await Promise.all([
        api("tos_battle26_event?select=status,pilot_slug&id=eq." + EVENT_ID),
        api("tos_battle26_teams?select=slug,name&order=name.asc"),
        api("tos_battle26_teams?select=slug&dish_id=not.is.null")
      ]);
      if (!Array.isArray(events) || events.length !== 1 ||
          !Array.isArray(allTeams) || allTeams.length !== 26 ||
          !Array.isArray(assigned) || assigned.length > 19) {
        return respond(req,{error:"unavailable"},503);
      }
      return respond(req,{
        status:events[0].status,
        pilot_team_slug:events[0].status === "pilot" ? events[0].pilot_slug : null,
        teams:allTeams.map(t=>({id:t.slug,tos_slug:t.slug,name:t.name})),
        total_teams:26,
        total_dishes:19,
        remaining:19-assigned.length
      });
    }
    if(Number(req.headers.get("content-length")||0)>2048) return respond(req,{error:"invalid_credentials"},400);
    let input: Record<string,unknown>;
    try { input = await req.json(); } catch { return respond(req,{error:"invalid_credentials"},400); }
    if(!input || input.event!==EVENT_ID || typeof input.team_id!=="string" ||
       !/^[a-z0-9-]{2,100}$/.test(input.team_id) ||
       typeof input.code!=="string" || input.code.length>100) {
      return respond(req,{error:"invalid_credentials"},401);
    }
    const code = input.code.toUpperCase().replace(/[\s-]/g,"");
    if(!/^[A-HJ-NP-Z2-9]{24}$/.test(code)) return respond(req,{error:"invalid_credentials"},401);
    const hashBytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
    const hash = Array.from(new Uint8Array(hashBytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const data = await api("rpc/tos_battle26_claim",{
      method:"POST",body:JSON.stringify({p_slug:input.team_id,p_code_hash:hash})
    });
    if(data && data.error) {
      const status = data.error==="pilot_only" ? 403
        : data.error==="not_open" || data.error==="sold_out" ? 409
        : 401;
      return respond(req,data,status);
    }
    if(!data || typeof data.team_name!=="string" || typeof data.dish_name!=="string") {
      return respond(req,{error:"unavailable"},503);
    }
    return respond(req,data);
  } catch {
    return respond(req,{error:"unavailable"},503);
  }
});
