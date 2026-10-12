// Lien de partage d'une boutique : https://couriers-united.space/s/<id>
// - Discord / X / etc. lisent les balises Open Graph ci-dessous et affichent la carte de la boutique.
// - Un humain est redirigé tout de suite vers /?shop=<id> (la vraie appli).
const SB_URL = 'https://hdstkdubotlmlndmuwnl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkc3RrZHVib3RsbWxuZG11d25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0OTQ5ODAsImV4cCI6MjEwNjA3MDk4MH0.mcu8_sH5UEmVXROhf12DN2JKjFUG_WgCOeIbZMsDrRI';
const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

async function getShop(id){
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/public_shop_card', { method: 'POST', headers: h, body: JSON.stringify({ p_id: id }) });
    if (r.ok) { const j = await r.json(); const row = Array.isArray(j) ? j[0] : j; if (row && row.shop_name) return row; }
  } catch (e) {}
  try {
    const r = await fetch(SB_URL + '/rest/v1/marketplace_shops?select=shop_name,description,theme_color&id=eq.' + id, { headers: h });
    if (r.ok) { const j = await r.json(); if (j && j[0]) return j[0]; }
  } catch (e) {}
  return null;
}

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'couriers-united.space');
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) { res.writeHead(302, { Location: base + '/' }); res.end(); return; }
  const shop = await getShop(id);
  const name = (shop && shop.shop_name) || 'Couriers United';
  const desc = (shop && shop.description && String(shop.description).slice(0, 180)) || 'Boutique sur Couriers United — livraison & marketplace Star Citizen.';
  const color = (shop && /^#[0-9a-fA-F]{6}$/.test(shop.theme_color || '')) ? shop.theme_color : '#ffb000';
  const img = SB_URL + '/storage/v1/object/public/marketplace-photos/' + id + '/card.png';
  const target = base + '/?shop=' + id;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(name)} — Couriers United</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${esc(color)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Couriers United">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(base + '/s/' + id)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1050"><meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0a0a0a;color:#ddd;font-family:monospace"><p>Redirection… <a href="${esc(target)}" style="color:${esc(color)}">${esc(name)}</a></p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(html);
};
