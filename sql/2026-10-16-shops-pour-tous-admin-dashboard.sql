-- =====================================================================================
-- Couriers United — 16/10/2026
-- 1) Tout le monde peut ouvrir un shop (le rôle coursier reste sur candidature)
-- 2) Dashboard admin : statistiques + liste des membres (fonctions réservées aux admins)
-- 3) Index pour accélérer les pages les plus visitées
-- À lancer UNE fois dans Supabase > SQL Editor. Relançable sans risque.
-- =====================================================================================

-- ---------- 1) SHOPS OUVERTS À TOUS ----------
-- Tout le monde devient vendeur, sauf les membres dont l'admin a retiré le droit ("revoked").
alter table public.profiles alter column is_seller set default true;

update public.profiles
   set is_seller = true
 where coalesce(is_seller, false) = false
   and coalesce(seller_request, '') <> 'revoked';

-- Les nouveaux comptes sont vendeurs dès leur création, même si le compte est créé ailleurs.
create or replace function public.cu_profiles_default_seller()
returns trigger language plpgsql as $$
begin
  if coalesce(new.seller_request, '') <> 'revoked' then
    new.is_seller := true;
  end if;
  return new;
end $$;

drop trigger if exists cu_profiles_default_seller on public.profiles;
create trigger cu_profiles_default_seller
  before insert on public.profiles
  for each row execute function public.cu_profiles_default_seller();


-- ---------- 2) DASHBOARD ADMIN ----------
-- Petit utilitaire : exécute un comptage, renvoie null au lieu d'une erreur si une colonne manque.
create or replace function public.cu_try_num(q text)
returns numeric language plpgsql security definer set search_path = public as $$
declare r numeric;
begin
  execute q into r;
  return r;
exception when others then
  return null;
end $$;
revoke all on function public.cu_try_num(text) from public, anon, authenticated;

create or replace function public.admin_dashboard(p_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d int := greatest(1, least(coalesce(p_days, 7), 90));
  since timestamptz := now() - make_interval(days => d);
  prev  timestamptz := now() - make_interval(days => d * 2);
  out jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;

  out := jsonb_build_object(
    'days', d,
    'members', jsonb_build_object(
      'total',     (select count(*) from public.profiles),
      'new',       (select count(*) from auth.users where created_at > since),
      'new_prev',  (select count(*) from auth.users where created_at > prev and created_at <= since),
      'logins',    (select count(*) from auth.users where last_sign_in_at > since),
      'couriers',  (select count(*) from public.profiles where is_courier),
      'admins',    (select count(*) from public.profiles where role = 'admin'),
      'courier_pending', (select count(*) from public.profiles where courier_request = 'pending')
    ),
    'market', jsonb_build_object(
      'shops',            cu_try_num('select count(*) from public.marketplace_shops'),
      'shops_active',     cu_try_num('select count(distinct seller_id) from public.marketplace_listings where not coalesce(is_deleted,false)'),
      'listings',         cu_try_num('select count(*) from public.marketplace_listings where not coalesce(is_deleted,false)'),
      'listings_new',     cu_try_num(format('select count(*) from public.marketplace_listings where created_at > %L', since)),
      'blueprints',       cu_try_num('select count(*) from public.blueprints where not coalesce(is_deleted,false)'),
      'blueprints_new',   cu_try_num(format('select count(*) from public.blueprints where created_at > %L', since)),
      'inquiries_new',    cu_try_num(format('select count(*) from public.marketplace_inquiries where created_at > %L', since)),
      'sales',            cu_try_num(format('select count(*) from public.marketplace_inquiries where status = ''completed'' and updated_at > %L', since)),
      'sales_volume',     cu_try_num(format('select coalesce(sum(coalesce(snap_price,0) * coalesce(snap_qty,1)),0) from public.marketplace_inquiries where status = ''completed'' and updated_at > %L', since))
    ),
    'orders', jsonb_build_object(
      'new',        cu_try_num(format('select count(*) from public.orders where created_at > %L', since)),
      'pending',    cu_try_num('select count(*) from public.orders where status = ''pending'''),
      'in_progress',cu_try_num('select count(*) from public.orders where status in (''accepted'',''purchased'',''in_transit'')'),
      'delivered',  cu_try_num(format('select count(*) from public.orders where status = ''delivered'' and coalesce(updated_at, created_at) > %L', since)),
      'volume',     cu_try_num(format('select coalesce(sum(total_price),0) from public.orders where status = ''delivered'' and coalesce(updated_at, created_at) > %L', since))
    ),
    'funnel', coalesce((
      select jsonb_agg(jsonb_build_object('event', event, 'people', people, 'total', total) order by people desc)
        from (select event, count(distinct anon_id) as people, count(*) as total
                from public.funnel_events
               where created_at > since and coalesce(anon_id,'') <> 'test-claude'
               group by event) f), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('origin', origin, 'utm', utm, 'visitors', visitors) order by visitors desc)
        from (select coalesce(ref, '(direct)') as origin, coalesce(src, '') as utm, count(distinct anon_id) as visitors
                from public.funnel_events
               where event = 'visit' and created_at > since and coalesce(anon_id,'') <> 'test-claude'
               group by 1, 2 order by 3 desc limit 8) s), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'visitors', coalesce(v.n, 0), 'signups', coalesce(u.n, 0)) order by day)
        from generate_series((now() at time zone 'Europe/Paris')::date - 29, (now() at time zone 'Europe/Paris')::date, interval '1 day') as day
        left join (select (created_at at time zone 'Europe/Paris')::date as dd, count(distinct anon_id) as n
                     from public.funnel_events where event = 'visit' and coalesce(anon_id,'') <> 'test-claude'
                      and created_at > now() - interval '31 days' group by 1) v on v.dd = day::date
        left join (select (created_at at time zone 'Europe/Paris')::date as dd, count(*) as n
                     from auth.users where created_at > now() - interval '31 days' group by 1) u on u.dd = day::date), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(p.rsi_handle, p.discord_username, '?'), 'created_at', u.created_at) order by u.created_at desc)
        from (select id, created_at from auth.users order by created_at desc limit 8) u
        join public.profiles p on p.id = u.id), '[]'::jsonb)
  );
  return out;
end $$;
revoke all on function public.admin_dashboard(int) from public, anon;
grant execute on function public.admin_dashboard(int) to authenticated;

-- Liste des membres enrichie (date d'inscription, dernière connexion, shop, annonces).
create or replace function public.admin_members()
returns table (
  id uuid, discord_username text, rsi_handle text, avatar_url text, role text,
  is_courier boolean, is_seller boolean, courier_request text, seller_request text,
  created_at timestamptz, last_sign_in_at timestamptz, shop_name text, listings bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin') then
    raise exception 'admin only';
  end if;
  return query
    select p.id, p.discord_username::text, p.rsi_handle::text, p.avatar_url::text, p.role::text,
           coalesce(p.is_courier,false), coalesce(p.is_seller,false), p.courier_request::text, p.seller_request::text,
           u.created_at, u.last_sign_in_at, s.shop_name::text,
           (select count(*) from public.marketplace_listings l where l.seller_id = p.id and not coalesce(l.is_deleted,false))
      from public.profiles p
      left join auth.users u on u.id = p.id
      left join public.marketplace_shops s on s.id = p.id
     order by u.created_at desc nulls last;
end $$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;


-- ---------- 3) INDEX (accélèrent les requêtes fréquentes, sans rien changer à l'affichage) ----------
-- (chaque index est protégé : s'il ne peut pas être créé, il est simplement ignoré)
do $$ begin execute 'create index if not exists cu_listings_seller_idx   on public.marketplace_listings (seller_id) where not is_deleted'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_listings_recent_idx   on public.marketplace_listings (created_at desc) where not is_deleted'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_blueprints_seller_idx on public.blueprints (seller_id) where not is_deleted'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_blueprints_recent_idx on public.blueprints (created_at desc) where not is_deleted'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_inquiries_seller_idx  on public.marketplace_inquiries (seller_id, status)'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_inquiries_buyer_idx   on public.marketplace_inquiries (buyer_id, status)'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_orders_status_idx     on public.orders (status, created_at)'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_orders_client_idx     on public.orders (client_id, created_at desc)'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
do $$ begin execute 'create index if not exists cu_notifs_user_idx       on public.notifications (user_id, read)'; exception when others then raise notice 'index ignoré : %', sqlerrm; end $$;
