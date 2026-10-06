// Proxy UEX : la clé reste côté serveur (variable d'environnement UEX_SECRET_KEY sur Vercel).
const ALLOWED = {
  commodities: [],
  vehicles: [],
  items: ['id_category'],
  items_prices: ['id_item'],
};
const CACHE = { commodities: 300, vehicles: 3600, items: 3600, items_prices: 120 };

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const key = process.env.UEX_SECRET_KEY;
  if (!key) { res.status(500).json({ error: 'server_not_configured' }); return; }

  const path = String(req.query.path || '');
  if (!Object.prototype.hasOwnProperty.call(ALLOWED, path)) { res.status(400).json({ error: 'bad_path' }); return; }

  const qs = new URLSearchParams();
  for (const name of ALLOWED[path]) {
    const v = req.query[name];
    if (v === undefined) continue;
    if (!/^\d{1,6}$/.test(String(v))) { res.status(400).json({ error: 'bad_param' }); return; }
    qs.set(name, String(v));
  }

  try {
    const r = await fetch(`https://uexcorp.space/api/2.0/${path}${qs.toString() ? '?' + qs : ''}`, { headers: { secret_key: key } });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json');
    if (r.ok) res.setHeader('Cache-Control', `public, s-maxage=${CACHE[path]}, stale-while-revalidate=600`);
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: 'upstream_error' });
  }
};
