// Proxy Discord : le webhook reste côté serveur (variable d'environnement DISCORD_WEBHOOK_URL sur Vercel).
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) { res.status(500).json({ error: 'server_not_configured' }); return; }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') { res.status(400).json({ error: 'bad_body' }); return; }

  // On ne laisse passer que du contenu simple : pas de mentions, tailles limitées.
  const out = { allowed_mentions: { parse: [] }, username: 'Couriers United' };
  if (typeof b.content === 'string') out.content = b.content.slice(0, 1900);
  if (Array.isArray(b.embeds)) out.embeds = b.embeds.slice(0, 3);
  if (!out.content && !out.embeds) { res.status(400).json({ error: 'empty' }); return; }
  if (JSON.stringify(out).length > 6000) { res.status(413).json({ error: 'too_large' }); return; }

  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
    res.status(r.ok ? 204 : 502).end();
  } catch (e) {
    res.status(502).json({ error: 'upstream_error' });
  }
};
