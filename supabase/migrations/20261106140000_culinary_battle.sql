-- Culinary Battle TOS BGO / dedicated Supabase project only.
-- Apply only to a NEW ISOLATED project. No user-facing tables have anonymous grants.
begin;

create table public.battle_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{4,80}$'),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','ready','open','closed','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.battle_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.battle_events(id) on delete restrict,
  tos_slug text,
  name text not null check (length(btrim(name)) between 2 and 160),
  code_digest text not null check (code_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (event_id, id)
);
create unique index battle_team_names_unique on public.battle_teams (event_id, lower(btrim(name)));
create unique index battle_team_slug_unique on public.battle_teams (event_id, tos_slug) where tos_slug is not null;

create table public.battle_dishes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.battle_events(id) on delete restrict,
  title text not null check (length(btrim(title)) between 2 and 160),
  created_at timestamptz not null default now(),
  unique (event_id, id)
);
create unique index battle_dish_names_unique on public.battle_dishes(event_id, lower(btrim(title)));

create table public.battle_assignments (
  event_id uuid not null references public.battle_events(id) on delete restrict,
  team_id uuid not null,
  dish_id uuid not null,
  revealed_at timestamptz,
  primary key (event_id, team_id),
  unique (event_id, dish_id),
  foreign key (event_id, team_id) references public.battle_teams(event_id,id) on delete restrict,
  foreign key (event_id, dish_id) references public.battle_dishes(event_id,id) on delete restrict
);

-- No raw IP addresses, codes, or results are written to access logs.
create table public.battle_actions (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.battle_events(id) on delete restrict,
  team_id uuid,
  action text not null check (action in (
    'state_changed','code_rotated','invalid_code','rate_limited',
    'revealed','viewed','blocked','override'
  )),
  client_digest text,
  detail text,
  created_at timestamptz not null default now()
);
create index battle_actions_event_time on public.battle_actions (event_id,created_at desc);
create index battle_actions_team_time on public.battle_actions (team_id,created_at desc);

create table public.battle_rate_limits (
  identity text primary key,
  window_started timestamptz not null default now(),
  attempts int not null default 0 check (attempts >= 0)
);

-- An event can be activated only after EXACTLY 18 verified teams, 18 dishes,
-- 18 one-to-one assignments, and 18 digest-based codes have been persisted.
create function public.battle_guard_event()
returns trigger language plpgsql set search_path = '' as $$
declare v_count_teams int; v_count_dishes int; v_count_assignments int;
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status = 'ready') or
      (old.status = 'ready' and new.status in ('open','closed')) or
      (old.status = 'open' and new.status = 'closed') or
      (old.status = 'closed' and new.status = 'published')
    ) then
      raise exception 'Invalid battle status transition';
    end if;
    if new.status = 'ready' then
      select count(*) into v_count_teams from public.battle_teams where event_id = new.id;
      select count(*) into v_count_dishes from public.battle_dishes where event_id = new.id;
      select count(*) into v_count_assignments from public.battle_assignments where event_id = new.id;
      if v_count_teams <> 18 or v_count_dishes <> 18 or v_count_assignments <> 18 then
        raise exception 'Event must have 18 teams, dishes and assignments';
      end if;
    end if;
    insert into public.battle_actions(event_id,action,detail)
      values(new.id,'state_changed',old.status || ' -> ' || new.status);
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger battle_event_status_guard before update on public.battle_events
for each row execute function public.battle_guard_event();

-- A published assignment cannot change. First reveal time can be set once.
create function public.battle_guard_assignment()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
  v_event := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  select status into v_status from public.battle_events where id = v_event;
  if tg_op = 'UPDATE' then
    if (new.event_id,new.team_id,new.dish_id)
      is distinct from (old.event_id,old.team_id,old.dish_id) and v_status <> 'draft' then
      raise exception 'Assignment is permanently locked';
    end if;
    if old.revealed_at is not null and new.revealed_at is distinct from old.revealed_at then
      raise exception 'Reveal time is immutable';
    end if;
    if v_status <> 'draft' and new.revealed_at is null and old.revealed_at is null then
      return new;
    end if;
  elsif v_status <> 'draft' then
    raise exception 'Assignment roster is permanently locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger battle_assignment_guard before insert or update or delete on public.battle_assignments
for each row execute function public.battle_guard_assignment();

-- Teams and dishes cannot be renamed after the distribution is locked.
-- Code reissue remains possible, but every changed code digest is journaled.
create function public.battle_guard_roster()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
  v_event := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  select status into v_status from public.battle_events where id = v_event;
  if v_status <> 'draft' then
    if tg_table_name = 'battle_teams' and tg_op = 'UPDATE'
       and (to_jsonb(new) - 'code_digest') = (to_jsonb(old) - 'code_digest') then
      if new.code_digest is distinct from old.code_digest then
        insert into public.battle_actions(event_id,team_id,action)
          values(new.event_id,new.id,'code_rotated');
      end if;
      return new;
    end if;
    raise exception 'The event roster is permanently locked';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger battle_team_guard before insert or update or delete on public.battle_teams
for each row execute function public.battle_guard_roster();
create trigger battle_dish_guard before insert or update or delete on public.battle_dishes
for each row execute function public.battle_guard_roster();

-- Called ONLY by the server Edge Function using its private service key.
-- Rate limits are updated atomically in PostgreSQL, even across Edge instances.
create function public.battle_reveal(
  p_event_slug text, p_team_id uuid, p_code_digest text, p_client_digest text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_event public.battle_events%rowtype;
  v_team public.battle_teams%rowtype;
  v_assignment public.battle_assignments%rowtype;
  v_dish text;
  v_ip_attempts int;
  v_team_attempts int;
  v_new boolean := false;
  v_now timestamptz := clock_timestamp();
begin
  if p_code_digest !~ '^[a-f0-9]{64}$'
     or p_client_digest !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('error','invalid_credentials');
  end if;
  select * into v_event from public.battle_events
    where slug = p_event_slug for share;
  if not found then return jsonb_build_object('error','invalid_credentials'); end if;
  -- The current team row is locked so simultaneous requests cannot reveal twice.
  select * into v_team from public.battle_teams
    where id = p_team_id and event_id = v_event.id for update;
  if not found then return jsonb_build_object('error','invalid_credentials'); end if;

  insert into public.battle_rate_limits(identity,window_started,attempts)
    values ('ip:' || v_event.id || ':' || p_client_digest, v_now, 1)
    on conflict (identity) do update set
      attempts = case
        when public.battle_rate_limits.window_started < v_now - interval '15 minutes'
          then 1 else public.battle_rate_limits.attempts + 1 end,
      window_started = case
        when public.battle_rate_limits.window_started < v_now - interval '15 minutes'
          then v_now else public.battle_rate_limits.window_started end
    returning attempts into v_ip_attempts;

  insert into public.battle_rate_limits(identity,window_started,attempts)
    values ('team:' || v_event.id || ':' || v_team.id, v_now, 1)
    on conflict (identity) do update set
      attempts = case
        when public.battle_rate_limits.window_started < v_now - interval '15 minutes'
          then 1 else public.battle_rate_limits.attempts + 1 end,
      window_started = case
        when public.battle_rate_limits.window_started < v_now - interval '15 minutes'
          then v_now else public.battle_rate_limits.window_started end
    returning attempts into v_team_attempts;

  if v_ip_attempts > 12 or v_team_attempts > 30 then
    insert into public.battle_actions(event_id,team_id,action,client_digest)
      values(v_event.id,v_team.id,'rate_limited',p_client_digest);
    return jsonb_build_object('error','rate_limited');
  end if;

  if v_team.code_digest <> p_code_digest then
    insert into public.battle_actions(event_id,team_id,action,client_digest)
      values(v_event.id,v_team.id,'invalid_code',p_client_digest);
    return jsonb_build_object('error','invalid_credentials');
  end if;

  select * into v_assignment from public.battle_assignments
    where event_id = v_event.id and team_id = v_team.id for update;
  if not found then return jsonb_build_object('error','unavailable'); end if;

  if v_assignment.revealed_at is null then
    if v_event.status <> 'open' then
      insert into public.battle_actions(event_id,team_id,action,client_digest)
        values(v_event.id,v_team.id,'blocked',p_client_digest);
      return jsonb_build_object('error', case when v_event.status in ('closed','published')
                                      then 'closed' else 'not_open' end);
    end if;
    update public.battle_assignments
      set revealed_at = v_now where event_id = v_event.id and team_id = v_team.id
      returning * into v_assignment;
    v_new := true;
  end if;
  select title into v_dish from public.battle_dishes
    where event_id = v_event.id and id = v_assignment.dish_id;
  insert into public.battle_actions(event_id,team_id,action,client_digest)
    values(v_event.id,v_team.id,case when v_new then 'revealed' else 'viewed' end,p_client_digest);
  return jsonb_build_object('team_name',v_team.name,'dish_name',v_dish,
      'revealed_at',v_assignment.revealed_at,'first_open',v_new);
end $$;

-- The Data API must NEVER return assignments or code digests to public roles.
alter table public.battle_events enable row level security;
alter table public.battle_teams enable row level security;
alter table public.battle_dishes enable row level security;
alter table public.battle_assignments enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_rate_limits enable row level security;

revoke all on public.battle_events,public.battle_teams,public.battle_dishes,
  public.battle_assignments,public.battle_actions,public.battle_rate_limits
  from public, anon, authenticated;
revoke all on function public.battle_reveal(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.battle_reveal(text,uuid,text,text) to service_role;
revoke all on function public.battle_guard_event(),public.battle_guard_assignment(),
  public.battle_guard_roster() from public,anon,authenticated;

commit;
