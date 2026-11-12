-- Culinary Battle TOS BGO: 26 eligible TOS, 19 dishes, first 19 valid draws win.
-- Source migration for a NEW, ISOLATED Supabase project only; never apply to CRM.
-- Previous 18x18 SQL was NOT applied to any project, and contained corrupted duplication.
-- No pre-assigned dishes. All choices made atomically on first successful authenticated draw.
begin;

create table public.battle_events (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9-]{4,80}$'),
 title text not null,
 status text not null default 'draft' check(status in('draft','ready','pilot','open','closed','published')),
 pilot_tos_slug text check(pilot_tos_slug is null or pilot_tos_slug ~ '^[a-z0-9-]{2,100}
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.battle_teams (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.battle_events(id) on delete restrict,
 tos_slug text not null check(tos_slug ~ '^[a-z0-9-]{2,100}$'),
 name text not null check(length(btrim(name)) between 2 and 160),
 code_digest text not null check(code_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(event_id,id),
 unique(event_id,tos_slug)
);
create unique index battle_team_names_unique on public.battle_teams(event_id,lower(btrim(name)));
create unique index battle_team_code_unique on public.battle_teams(event_id,code_digest);

create table public.battle_dishes (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.battle_events(id) on delete restrict,
 title text not null check(length(btrim(title)) between 2 and 160),
 created_at timestamptz not null default now(),
 unique(event_id,id)
);
create unique index battle_dish_names_unique on public.battle_dishes(event_id,lower(btrim(title)));

create table public.battle_assignments (
 event_id uuid not null references public.battle_events(id) on delete restrict,
 team_id uuid not null,
 dish_id uuid not null,
 revealed_at timestamptz not null default now(),
 primary key(event_id,team_id),
 unique(event_id,dish_id),
 foreign key(event_id,team_id) references public.battle_teams(event_id,id) on delete restrict,
 foreign key(event_id,dish_id) references public.battle_dishes(event_id,id) on delete restrict
);

-- Activity log must not contain raw IP addresses, codes, or dish names.
create table public.battle_actions (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.battle_events(id) on delete restrict,
 team_id uuid,
 action text not null check(action in('state_changed','code_rotated','invalid_code','rate_limited','revealed','viewed','blocked')),
 client_digest text,
 detail text,
 created_at timestamptz not null default now()
);
create index battle_actions_event_time on public.battle_actions(event_id,created_at desc);
create index battle_actions_team_time on public.battle_actions(team_id,created_at desc);

create table public.battle_rate_limits (
 identity text primary key,
 window_started timestamptz not null default now(),
 attempts int not null default 0 check(attempts >= 0)
);

create function public.battle_guard_event()
returns trigger language plpgsql set search_path = '' as $$
declare v_teams int; v_dishes int; v_assignments int;
begin
 if new.status is distinct from old.status then
   if not (
     (old.status='draft' and new.status='ready') or
     (old.status='ready' and new.status in ('pilot','open','closed')) or
     (old.status='pilot' and new.status in ('open','closed')) or
     (old.status='open' and new.status='closed') or
     (old.status='closed' and new.status='published')
   ) then raise exception 'Invalid battle status transition'; end if;
   if new.status='pilot' then
     if new.pilot_tos_slug is null or not exists (
       select 1 from public.battle_teams
       where event_id=new.id and tos_slug=new.pilot_tos_slug
     ) then raise exception 'Pilot team must belong to event'; end if;
   end if;
   if new.status='open' and new.pilot_tos_slug is not null then
     raise exception 'Clear pilot team when opening the full draw';
   end if;
   if new.status='ready' then
     select count(*) into v_teams from public.battle_teams where event_id=new.id;
     select count(*) into v_dishes from public.battle_dishes where event_id=new.id;
     select count(*) into v_assignments from public.battle_assignments where event_id=new.id;
     if v_teams<>26 or v_dishes<>19 or v_assignments<>0 then
       raise exception 'Ready requires exactly 26 teams, 19 dishes and zero assignments';
     end if;
   end if;
   insert into public.battle_actions(event_id,action,detail)
     values(new.id,'state_changed',old.status||' -> '||new.status);
 end if;
 new.updated_at=now();
 return new;
end $$;
create trigger battle_event_status_guard before update on public.battle_events
for each row execute function public.battle_guard_event();

-- A code may be rotated by the organizer, but the roster cannot change after ready.
create function public.battle_guard_roster()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
 v_event := case when tg_op='DELETE' then old.event_id else new.event_id end;
 select status into v_status from public.battle_events where id=v_event;
 if v_status <> 'draft' then
   if tg_table_name='battle_teams' and tg_op='UPDATE'
     and (to_jsonb(new)-'code_digest')=(to_jsonb(old)-'code_digest') then
       if new.code_digest is distinct from old.code_digest then
         insert into public.battle_actions(event_id,team_id,action)
           values(new.event_id,new.id,'code_rotated');
       end if;
       return new;
   end if;
   raise exception 'Roster is locked';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger battle_team_guard before insert or update or delete on public.battle_teams
for each row execute function public.battle_guard_roster();
create trigger battle_dish_guard before insert or update or delete on public.battle_dishes
for each row execute function public.battle_guard_roster();

-- No editing, deletion or pre-allocation after a first draw.
create function public.battle_guard_assignment()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
 v_event := case when tg_op='DELETE' then old.event_id else new.event_id end;
 select status into v_status from public.battle_events where id=v_event;
 if tg_op<>'INSERT' or v_status not in ('pilot','open') then
   raise exception 'Assignment is immutable and requires open event';
 end if;
 return new;
end $$;
create trigger battle_assignment_guard before insert or update or delete on public.battle_assignments
for each row execute function public.battle_guard_assignment();

-- Called only by Edge Function using a private service role key, never from client.
-- SECURITY INVOKER, NOT DEFINER: grants limited to service_role; no RLS bypass via owner.
-- A FOR UPDATE lock on the event serializes simultaneous valid requests and protects
-- the exact last free dish, even when two or more teams click together.
create function public.battle_reveal(
 p_event_slug text,p_team_id uuid,p_code_digest text,p_client_digest text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 v_event public.battle_events%rowtype;
 v_team public.battle_teams%rowtype;
 v_assignment public.battle_assignments%rowtype;
 v_dish public.battle_dishes%rowtype;
 v_ip_attempts int; v_team_attempts int;
 v_now timestamptz := clock_timestamp();
 v_remaining int;
begin
 if p_code_digest is null or p_client_digest is null
   or p_code_digest !~ '^[a-f0-9]{64}$'
   or p_client_digest !~ '^[a-f0-9]{64}$' then
   return jsonb_build_object('error','invalid_credentials');
 end if;
 select * into v_event from public.battle_events where slug=p_event_slug;
 if not found then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into v_team from public.battle_teams
   where event_id=v_event.id and id=p_team_id;
 if not found then return jsonb_build_object('error','invalid_credentials'); end if;

 insert into public.battle_rate_limits(identity,window_started,attempts)
 values('ip:'||v_event.id||':'||p_client_digest,v_now,1)
 on conflict(identity) do update set
   attempts=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then 1 else public.battle_rate_limits.attempts+1 end,
   window_started=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then v_now else public.battle_rate_limits.window_started end
 returning attempts into v_ip_attempts;
 insert into public.battle_rate_limits(identity,window_started,attempts)
 values('team:'||v_event.id||':'||v_team.id,v_now,1)
 on conflict(identity) do update set
   attempts=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then 1 else public.battle_rate_limits.attempts+1 end,
   window_started=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then v_now else public.battle_rate_limits.window_started end
 returning attempts into v_team_attempts;
 if v_ip_attempts>12 or v_team_attempts>30 then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
   values(v_event.id,v_team.id,'rate_limited',p_client_digest);
   return jsonb_build_object('error','rate_limited');
 end if;
 if v_team.code_digest<>p_code_digest then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
   values(v_event.id,v_team.id,'invalid_code',p_client_digest);
   return jsonb_build_object('error','invalid_credentials');
 end if;

 -- Recheck event and code while holding serializing event lock; reassignment impossible.
 select * into v_event from public.battle_events where id=v_event.id for update;
 select * into v_team from public.battle_teams
   where event_id=v_event.id and id=p_team_id for update;
 if v_team.code_digest<>p_code_digest then
   return jsonb_build_object('error','invalid_credentials');
 end if;

 select * into v_assignment from public.battle_assignments
   where event_id=v_event.id and team_id=v_team.id;
 if found then
   select * into v_dish from public.battle_dishes
   where event_id=v_event.id and id=v_assignment.dish_id;
   insert into public.battle_actions(event_id,team_id,action,client_digest)
     values(v_event.id,v_team.id,'viewed',p_client_digest);
   return jsonb_build_object('team_name',v_team.name,'dish_name',v_dish.title,
     'revealed_at',v_assignment.revealed_at,'first_open',false);
 end if;
 if v_event.status not in ('pilot','open') then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
     values(v_event.id,v_team.id,'blocked',p_client_digest);
   return jsonb_build_object('error',case
     when v_event.status='closed' and
       (select count(*) from public.battle_assignments where event_id=v_event.id)>=19
       then 'sold_out'
     when v_event.status in ('closed','published') then 'closed'
     else 'not_open' end);
 end if;

 -- In pilot, all other valid team codes remain locked. Existing assignments may
 -- still be viewed above, without disclosing any unused dishes.
 if v_event.status='pilot' and v_team.tos_slug is distinct from v_event.pilot_tos_slug then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
   values(v_event.id,v_team.id,'blocked',p_client_digest);
   return jsonb_build_object('error','pilot_only');
 end if;

 -- gen_random_uuid() uses OS-backed cryptographic randomness; exclude taken dishes.
 select d.* into v_dish from public.battle_dishes d
 where d.event_id=v_event.id and not exists (
   select 1 from public.battle_assignments a
   where a.event_id=d.event_id and a.dish_id=d.id)
 order by gen_random_uuid() limit 1;
 if not found then
   update public.battle_events set status='closed' where id=v_event.id and status in ('open','pilot');
   return jsonb_build_object('error','sold_out');
 end if;
 insert into public.battle_assignments(event_id,team_id,dish_id,revealed_at)
 values(v_event.id,v_team.id,v_dish.id,v_now) returning * into v_assignment;
 select count(*) into v_remaining from public.battle_dishes d
 where d.event_id=v_event.id and not exists(
   select 1 from public.battle_assignments a
   where a.event_id=d.event_id and a.dish_id=d.id);
 if v_remaining=0 then
   update public.battle_events set status='closed' where id=v_event.id;
 end if;
 insert into public.battle_actions(event_id,team_id,action,client_digest)
 values(v_event.id,v_team.id,'revealed',p_client_digest);
 return jsonb_build_object('team_name',v_team.name,'dish_name',v_dish.title,
   'revealed_at',v_assignment.revealed_at,'first_open',true,'remaining',v_remaining);
end $$;

-- All tables are invisible to browsers and regular authenticated users.
alter table public.battle_events enable row level security;
alter table public.battle_teams enable row level security;
alter table public.battle_dishes enable row level security;
alter table public.battle_assignments enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_rate_limits enable row level security;
revoke all on public.battle_events,public.battle_teams,public.battle_dishes,
 public.battle_assignments,public.battle_actions,public.battle_rate_limits
 from public,anon,authenticated;
revoke all on function public.battle_reveal(text,uuid,text,text),
 public.battle_guard_event(),public.battle_guard_roster(),public.battle_guard_assignment()
 from public,anon,authenticated;
grant select,insert,update,delete on public.battle_events,public.battle_teams,
 public.battle_dishes,public.battle_assignments,public.battle_actions,
 public.battle_rate_limits to service_role;
grant usage,select on sequence public.battle_actions_id_seq to service_role;
grant execute on function public.battle_reveal(text,uuid,text,text) to service_role;
commit;
),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.battle_teams (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.battle_events(id) on delete restrict,
 tos_slug text not null check(tos_slug ~ '^[a-z0-9-]{2,100}$'),
 name text not null check(length(btrim(name)) between 2 and 160),
 code_digest text not null check(code_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 unique(event_id,id),
 unique(event_id,tos_slug)
);
create unique index battle_team_names_unique on public.battle_teams(event_id,lower(btrim(name)));
create unique index battle_team_code_unique on public.battle_teams(event_id,code_digest);

create table public.battle_dishes (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.battle_events(id) on delete restrict,
 title text not null check(length(btrim(title)) between 2 and 160),
 created_at timestamptz not null default now(),
 unique(event_id,id)
);
create unique index battle_dish_names_unique on public.battle_dishes(event_id,lower(btrim(title)));

create table public.battle_assignments (
 event_id uuid not null references public.battle_events(id) on delete restrict,
 team_id uuid not null,
 dish_id uuid not null,
 revealed_at timestamptz not null default now(),
 primary key(event_id,team_id),
 unique(event_id,dish_id),
 foreign key(event_id,team_id) references public.battle_teams(event_id,id) on delete restrict,
 foreign key(event_id,dish_id) references public.battle_dishes(event_id,id) on delete restrict
);

-- Activity log must not contain raw IP addresses, codes, or dish names.
create table public.battle_actions (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.battle_events(id) on delete restrict,
 team_id uuid,
 action text not null check(action in('state_changed','code_rotated','invalid_code','rate_limited','revealed','viewed','blocked')),
 client_digest text,
 detail text,
 created_at timestamptz not null default now()
);
create index battle_actions_event_time on public.battle_actions(event_id,created_at desc);
create index battle_actions_team_time on public.battle_actions(team_id,created_at desc);

create table public.battle_rate_limits (
 identity text primary key,
 window_started timestamptz not null default now(),
 attempts int not null default 0 check(attempts >= 0)
);

create function public.battle_guard_event()
returns trigger language plpgsql set search_path = '' as $$
declare v_teams int; v_dishes int; v_assignments int;
begin
 if new.status is distinct from old.status then
   if not (
     (old.status='draft' and new.status='ready') or
     (old.status='ready' and new.status in ('open','closed')) or
     (old.status='open' and new.status='closed') or
     (old.status='closed' and new.status='published')
   ) then raise exception 'Invalid battle status transition'; end if;
   if new.status='ready' then
     select count(*) into v_teams from public.battle_teams where event_id=new.id;
     select count(*) into v_dishes from public.battle_dishes where event_id=new.id;
     select count(*) into v_assignments from public.battle_assignments where event_id=new.id;
     if v_teams<>26 or v_dishes<>19 or v_assignments<>0 then
       raise exception 'Ready requires exactly 26 teams, 19 dishes and zero assignments';
     end if;
   end if;
   insert into public.battle_actions(event_id,action,detail)
     values(new.id,'state_changed',old.status||' -> '||new.status);
 end if;
 new.updated_at=now();
 return new;
end $$;
create trigger battle_event_status_guard before update on public.battle_events
for each row execute function public.battle_guard_event();

-- A code may be rotated by the organizer, but the roster cannot change after ready.
create function public.battle_guard_roster()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
 v_event := case when tg_op='DELETE' then old.event_id else new.event_id end;
 select status into v_status from public.battle_events where id=v_event;
 if v_status <> 'draft' then
   if tg_table_name='battle_teams' and tg_op='UPDATE'
     and (to_jsonb(new)-'code_digest')=(to_jsonb(old)-'code_digest') then
       if new.code_digest is distinct from old.code_digest then
         insert into public.battle_actions(event_id,team_id,action)
           values(new.event_id,new.id,'code_rotated');
       end if;
       return new;
   end if;
   raise exception 'Roster is locked';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger battle_team_guard before insert or update or delete on public.battle_teams
for each row execute function public.battle_guard_roster();
create trigger battle_dish_guard before insert or update or delete on public.battle_dishes
for each row execute function public.battle_guard_roster();

-- No editing, deletion or pre-allocation after a first draw.
create function public.battle_guard_assignment()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text; v_event uuid;
begin
 v_event := case when tg_op='DELETE' then old.event_id else new.event_id end;
 select status into v_status from public.battle_events where id=v_event;
 if tg_op<>'INSERT' or v_status<>'open' then
   raise exception 'Assignment is immutable and requires open event';
 end if;
 return new;
end $$;
create trigger battle_assignment_guard before insert or update or delete on public.battle_assignments
for each row execute function public.battle_guard_assignment();

-- Called only by Edge Function using a private service role key, never from client.
-- SECURITY INVOKER, NOT DEFINER: grants limited to service_role; no RLS bypass via owner.
-- A FOR UPDATE lock on the event serializes simultaneous valid requests and protects
-- the exact last free dish, even when two or more teams click together.
create function public.battle_reveal(
 p_event_slug text,p_team_id uuid,p_code_digest text,p_client_digest text
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
 v_event public.battle_events%rowtype;
 v_team public.battle_teams%rowtype;
 v_assignment public.battle_assignments%rowtype;
 v_dish public.battle_dishes%rowtype;
 v_ip_attempts int; v_team_attempts int;
 v_now timestamptz := clock_timestamp();
 v_remaining int;
begin
 if p_code_digest is null or p_client_digest is null
   or p_code_digest !~ '^[a-f0-9]{64}$'
   or p_client_digest !~ '^[a-f0-9]{64}$' then
   return jsonb_build_object('error','invalid_credentials');
 end if;
 select * into v_event from public.battle_events where slug=p_event_slug;
 if not found then return jsonb_build_object('error','invalid_credentials'); end if;
 select * into v_team from public.battle_teams
   where event_id=v_event.id and id=p_team_id;
 if not found then return jsonb_build_object('error','invalid_credentials'); end if;

 insert into public.battle_rate_limits(identity,window_started,attempts)
 values('ip:'||v_event.id||':'||p_client_digest,v_now,1)
 on conflict(identity) do update set
   attempts=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then 1 else public.battle_rate_limits.attempts+1 end,
   window_started=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then v_now else public.battle_rate_limits.window_started end
 returning attempts into v_ip_attempts;
 insert into public.battle_rate_limits(identity,window_started,attempts)
 values('team:'||v_event.id||':'||v_team.id,v_now,1)
 on conflict(identity) do update set
   attempts=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then 1 else public.battle_rate_limits.attempts+1 end,
   window_started=case when public.battle_rate_limits.window_started<v_now-interval '15 minutes'
     then v_now else public.battle_rate_limits.window_started end
 returning attempts into v_team_attempts;
 if v_ip_attempts>12 or v_team_attempts>30 then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
   values(v_event.id,v_team.id,'rate_limited',p_client_digest);
   return jsonb_build_object('error','rate_limited');
 end if;
 if v_team.code_digest<>p_code_digest then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
   values(v_event.id,v_team.id,'invalid_code',p_client_digest);
   return jsonb_build_object('error','invalid_credentials');
 end if;

 -- Recheck event and code while holding serializing event lock; reassignment impossible.
 select * into v_event from public.battle_events where id=v_event.id for update;
 select * into v_team from public.battle_teams
   where event_id=v_event.id and id=p_team_id for update;
 if v_team.code_digest<>p_code_digest then
   return jsonb_build_object('error','invalid_credentials');
 end if;

 select * into v_assignment from public.battle_assignments
   where event_id=v_event.id and team_id=v_team.id;
 if found then
   select * into v_dish from public.battle_dishes
   where event_id=v_event.id and id=v_assignment.dish_id;
   insert into public.battle_actions(event_id,team_id,action,client_digest)
     values(v_event.id,v_team.id,'viewed',p_client_digest);
   return jsonb_build_object('team_name',v_team.name,'dish_name',v_dish.title,
     'revealed_at',v_assignment.revealed_at,'first_open',false);
 end if;
 if v_event.status<>'open' then
   insert into public.battle_actions(event_id,team_id,action,client_digest)
     values(v_event.id,v_team.id,'blocked',p_client_digest);
   return jsonb_build_object('error',case
     when v_event.status='closed' and
       (select count(*) from public.battle_assignments where event_id=v_event.id)>=19
       then 'sold_out'
     when v_event.status in ('closed','published') then 'closed'
     else 'not_open' end);
 end if;

 -- gen_random_uuid() uses OS-backed cryptographic randomness; exclude taken dishes.
 select d.* into v_dish from public.battle_dishes d
 where d.event_id=v_event.id and not exists (
   select 1 from public.battle_assignments a
   where a.event_id=d.event_id and a.dish_id=d.id)
 order by gen_random_uuid() limit 1;
 if not found then
   update public.battle_events set status='closed' where id=v_event.id and status='open';
   return jsonb_build_object('error','sold_out');
 end if;
 insert into public.battle_assignments(event_id,team_id,dish_id,revealed_at)
 values(v_event.id,v_team.id,v_dish.id,v_now) returning * into v_assignment;
 select count(*) into v_remaining from public.battle_dishes d
 where d.event_id=v_event.id and not exists(
   select 1 from public.battle_assignments a
   where a.event_id=d.event_id and a.dish_id=d.id);
 if v_remaining=0 then
   update public.battle_events set status='closed' where id=v_event.id;
 end if;
 insert into public.battle_actions(event_id,team_id,action,client_digest)
 values(v_event.id,v_team.id,'revealed',p_client_digest);
 return jsonb_build_object('team_name',v_team.name,'dish_name',v_dish.title,
   'revealed_at',v_assignment.revealed_at,'first_open',true,'remaining',v_remaining);
end $$;

-- All tables are invisible to browsers and regular authenticated users.
alter table public.battle_events enable row level security;
alter table public.battle_teams enable row level security;
alter table public.battle_dishes enable row level security;
alter table public.battle_assignments enable row level security;
alter table public.battle_actions enable row level security;
alter table public.battle_rate_limits enable row level security;
revoke all on public.battle_events,public.battle_teams,public.battle_dishes,
 public.battle_assignments,public.battle_actions,public.battle_rate_limits
 from public,anon,authenticated;
revoke all on function public.battle_reveal(text,uuid,text,text),
 public.battle_guard_event(),public.battle_guard_roster(),public.battle_guard_assignment()
 from public,anon,authenticated;
grant select,insert,update,delete on public.battle_events,public.battle_teams,
 public.battle_dishes,public.battle_assignments,public.battle_actions,
 public.battle_rate_limits to service_role;
grant usage,select on sequence public.battle_actions_id_seq to service_role;
grant execute on function public.battle_reveal(text,uuid,text,text) to service_role;
commit;
