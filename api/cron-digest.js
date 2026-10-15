// Récap hebdo automatique posté sur Discord (tous les lundis, voir "crons" dans vercel.json).
// Réglages Vercel (Settings > Environment Variables) :
//   DISCORD_DIGEST_WEBHOOK = URL du webhook du salon Discord (jamais dans le code : elle avait fuité)
//   CRON_SECRET            = n'importe quelle phrase secrète ; Vercel l'envoie lui-même à chaque exécution
// Aperçu sans rien poster : /api/cron-digest?dry=1
const L = require('./_lib.js');

module.exports = async (req, res) => {
  const dry = String(req.query.dry || '') === '1';
  if (!dry && process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' }); return;
  }
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [listings, bps, newShops, allShops, sotd] = await Promise.all([
    L.q(`marketplace_listings?select=item_name,price,seller_id,created_at&is_deleted=eq.false&created_at=gte.${since}&order=created_at.desc&limit=300`),
    L.q(`blueprints?select=item_name,price_turnkey,price_client_mats,seller_id,created_at&is_deleted=eq.false&created_at=gte.${since}&order=created_at.desc&limit=300`),
    L.q(`marketplace_shops?select=id,shop_name&created_at=gte.${since}&limit=50`),
    L.q('marketplace_shops?select=id,shop_name,theme_color&limit=1000'),
    (async () => { try { const r = await fetch(L.SB_URL + '/rest/v1/rpc/get_shop_of_the_day', { method: 'POST', headers: { apikey: L.SB_KEY, Authorization: 'Bearer ' + L.SB_KEY, 'Content-Type': 'application/json' }, body: '{}' }); if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j[0] : j; } catch (e) { return null; } })()
  ]);
  const byId = {}; allShops.forEach(s => { byId[s.id] = s; });
  const u = (path, medium) => `${L.SITE}${path}${path.includes('?') ? '&' : '?'}utm_source=discord&utm_medium=${medium}`;

  const per = {};
  [...listings, ...bps].forEach(x => { per[x.seller_id] = (per[x.seller_id] || 0) + 1; });
  const top = Object.entries(per).filter(([id]) => byId[id] && byId[id].shop_name).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const fresh = [...listings.map(x => ({ n: x.item_name, p: x.price, s: x.seller_id })), ...bps.map(x => ({ n: x.item_name, p: x.price_turnkey || x.price_client_mats, s: x.seller_id, bp: true }))].slice(0, 6);

  const fields = [];
  if (top.length) fields.push({ name: 'Most active shops this week', value: top.map(([id, n], i) => `${medals[i]} [${byId[id].shop_name}](${u(L.shopUrl(byId[id]), 'digest_top')}) · ${n} new item${n > 1 ? 's' : ''}`).join('\n') });
  if (fresh.length) fields.push({ name: 'Fresh on the marketplace', value: fresh.map(f => `• [${f.n}](${u(L.itemUrl(f.n), 'digest_item')})${f.p ? ` — ${L.fmt(f.p)}` : ''}${f.bp ? ' *(crafted to order)*' : ''}${byId[f.s] ? ` · ${byId[f.s].shop_name}` : ''}`).join('\n').slice(0, 1000) });
  if (newShops.length) fields.push({ name: `Welcome to ${newShops.length} new shop${newShops.length > 1 ? 's' : ''}`, value: newShops.slice(0, 8).filter(s => s.shop_name).map(s => `[${s.shop_name}](${u(L.shopUrl(s), 'digest_new_shop')})`).join(' · ') || '—' });
  const sotdId = typeof sotd === 'string' ? sotd : (sotd && (sotd.seller_id || sotd.id));
  const sotdShop = sotdId ? byId[sotdId] : null;
  if (sotdShop) fields.push({ name: '★ Shop of the day', value: `[${sotdShop.shop_name}](${u(L.shopUrl(sotdShop), 'digest_sotd')})` });

  const total = listings.length + bps.length;
  const embed = {
    title: '📦 Couriers United — weekly market report',
    url: u('/marketplace', 'digest_title'),
    description: total
      ? `**${total}** new item${total > 1 ? 's' : ''} and blueprint${total > 1 ? 's' : ''} this week. Browse everything without logging in, or open your own shop for free.`
      : 'Quiet week on the marketplace. Be the first: open your shop for free and list your gear.',
    color: 0xff8c1a,
    fields,
    footer: { text: 'Couriers United · player marketplace & deliveries for Star Citizen' },
    timestamp: new Date().toISOString()
  };
  const payload = { username: 'Couriers United', embeds: [embed], allowed_mentions: { parse: [] } };

  if (dry) { res.status(200).json({ ok: true, dry: true, payload }); return; }
  const hook = process.env.DISCORD_DIGEST_WEBHOOK;
  if (!hook) { res.status(200).json({ ok: false, error: 'DISCORD_DIGEST_WEBHOOK not set' }); return; }
  const r = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  res.status(200).json({ ok: r.ok, status: r.status });
};
