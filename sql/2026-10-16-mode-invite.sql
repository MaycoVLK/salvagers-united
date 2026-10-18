-- =====================================================================================
-- Couriers United — mode invité (navigation sans connexion)
-- Donne aux visiteurs non connectés la lecture de ce qui est déjà public dans l'appli :
--   objets recherchés ouverts, et ventes conclues (seulement shop / date / objet / prix, pour le classement).
-- Relançable sans risque.
-- =====================================================================================

-- 1) Objets recherchés (onglet "Objets recherchés") : lecture des demandes ouvertes
grant select on public.resource_requests to anon;
drop policy if exists cu_resource_requests_public_read on public.resource_requests;
create policy cu_resource_requests_public_read on public.resource_requests
  for select to anon using (status = 'open');

-- 2) Classement de la semaine : ventes conclues, sans acheteur ni message
create or replace view public.public_completed_sales as
  select seller_id, status, updated_at, snap_item_name, snap_price
    from public.marketplace_inquiries
   where status = 'completed';
grant select on public.public_completed_sales to anon, authenticated;

-- 3) Mesure d'audience : nouvel évènement "login_prompt" (fenêtre « connecte-toi » affichée)
drop policy if exists funnel_events_insert on public.funnel_events;
create policy funnel_events_insert on public.funnel_events
  for insert to anon, authenticated
  with check (
    event in ('visit','login_click','login_prompt','share','signed_in','listing_created','blueprint_created','order_created','inquiry_sent')
    and (anon_id is null or length(anon_id) <= 40)
    and (ref is null or length(ref) <= 80)
    and (src is null or length(src) <= 40)
    and (lang is null or length(lang) <= 5)
  );
