// Prévient Bing, Yandex & co. (protocole IndexNow) dès qu'une page nouvelle ou modifiée apparaît :
// elles sont explorées en heures plutôt qu'en semaines. Tourne tous les jours (voir "crons" dans vercel.json).
// Google n'utilise pas IndexNow : il passe par le sitemap déjà soumis dans la Search Console.
// Aperçu sans rien envoyer : /api/indexnow?dry=1
const L = require('./_lib.js');
const KEY = '8e3f00a29992f7812b259948c73e7d92';

module.exports = async (req, res) => {
  const dry = String(req.query.dry || '') === '1';
  if (!dry && process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ ok: false, error: 'unauthorized' }); return;
  }
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const [listings, bps, shops] = await Promise.all([
    L.q(`marketplace_listings?select=item_name,seller_id&is_deleted=eq.false&created_at=gte.${since}&limit=500`),
    L.q(`blueprints?select=item_name,seller_id&is_deleted=eq.false&created_at=gte.${since}&limit=500`),
    L.q('marketplace_shops?select=id,shop_name&limit=1000')
  ]);
  const byId = {}; shops.forEach(s => { byId[s.id] = s; });
  const paths = new Set(['/', '/marketplace']);
  [...listings, ...bps].forEach(x => {
    if (L.itemUrl(x.item_name) !== '/item/') paths.add(L.itemUrl(x.item_name));
    const sh = byId[x.seller_id]; if (sh && sh.shop_name) paths.add(L.shopUrl(sh));
  });
  const urlList = [...paths].map(p => L.SITE + p);
  const body = { host: new URL(L.SITE).host, key: KEY, keyLocation: L.SITE + '/' + KEY + '.txt', urlList };
  if (dry) { res.status(200).json({ ok: true, dry: true, body }); return; }
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    res.status(200).json({ ok: r.ok, status: r.status, submitted: urlList.length });
  } catch (e) { res.status(200).json({ ok: false, error: String(e && e.message || e) }); }
};
