// /sitemap.xml généré à partir des boutiques et objets en vente.
const L = require('./_lib.js');

module.exports = async (req, res) => {
  const [listings, bps, shops] = await Promise.all([
    L.q('marketplace_listings?select=item_name,seller_id,created_at&is_deleted=eq.false&order=created_at.desc&limit=2000'),
    L.q('blueprints?select=item_name,seller_id,created_at&is_deleted=eq.false&order=created_at.desc&limit=2000'),
    L.q('marketplace_shops?select=id,shop_name&limit=1000')
  ]);
  const all = [...listings, ...bps];
  const lastBy = {}; all.forEach(x => { if (!lastBy[x.seller_id] || x.created_at > lastBy[x.seller_id]) lastBy[x.seller_id] = x.created_at; });
  const items = {}; all.forEach(x => { const k = L.itemUrl(x.item_name); if (!items[k] || x.created_at > items[k]) items[k] = x.created_at; });
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pri: '1.0', freq: 'daily', mod: today },
    { loc: '/marketplace', pri: '0.9', freq: 'hourly', mod: today },
    ...shops.filter(s => s.shop_name && lastBy[s.id]).map(s => ({ loc: L.shopUrl(s), pri: '0.7', freq: 'daily', mod: String(lastBy[s.id]).slice(0, 10) })),
    ...Object.entries(items).filter(([k]) => k !== '/item/').map(([k, d]) => ({ loc: k, pri: '0.6', freq: 'daily', mod: String(d).slice(0, 10) }))
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${L.esc(L.SITE + u.loc)}</loc><lastmod>${u.mod}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
};
