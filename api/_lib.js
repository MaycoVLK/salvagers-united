// Outils partagés par les pages publiques (SEO) : /marketplace, /shop/..., /item/..., /sitemap.xml
// Les fichiers dont le nom commence par "_" ne deviennent pas des routes sur Vercel.
const SB_URL = 'https://hdstkdubotlmlndmuwnl.supabase.co';
const SB_KEY = require('./_key.js');
const SITE = 'https://www.couriers-united.space';
const CATS = require('./_cats.json');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => (n == null || n === '' || isNaN(n)) ? '' : new Intl.NumberFormat('fr-FR').format(Math.round(+n)).replace(/[\u202F\u00A0]/g, ' ') + ' aUEC';
const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const shopUrl = s => `/shop/${slugify(s.shop_name) || 'shop'}--${s.id}`;
const itemUrl = name => `/item/${slugify(name)}`;
const catName = id => CATS[id] ? CATS[id][0] : null;
const catGroup = id => CATS[id] ? CATS[id][2] : null;

async function q(path) {
  try {
    const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) { return []; }
}

const LISTING_COLS = 'id,item_name,price,quantity,photo_url,seller_id,category_id,created_at,is_stock,description';
const BP_COLS = 'id,item_name,price_turnkey,price_client_mats,materials,photo_url,seller_id,category_id,created_at,description';
const SHOP_COLS = 'id,shop_name,description,logo_url,theme_color,location_system,location_name,created_at';

function send(res, html, status) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  res.status(status || 200).send(html);
}

const CSS = `
*{box-sizing:border-box}
:root{--bg:#050606;--panel:#0d1210;--border:#22302a;--accent:#ff8c1a;--accent-dim:#ff8c1a33;--text:#d9f5e6;--muted:#7d9a8c;--mint:#aef5e0}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Share Tech Mono',ui-monospace,monospace;font-size:15px;line-height:1.6}
a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
.top{border-top:3px solid var(--accent);background:#070c0b;border-bottom:1px solid var(--border)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;height:68px}
.brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-family:'VT323',monospace;font-size:30px;letter-spacing:2px;line-height:1}
.brand img{width:54px;height:auto}
.brand small{display:block;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:4px;color:var(--muted)}
.cta{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 18px;background:var(--accent);color:#000;font-weight:700;letter-spacing:1.5px;font-size:13px;border:0;white-space:nowrap}
.cta:hover{text-decoration:none;filter:brightness(1.1)}
.cta.ghost{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.crumbs{font-size:12px;color:var(--muted);margin:22px 0 0}
.crumbs a{color:var(--muted)}
h1{font-family:'VT323',monospace;font-weight:400;font-size:46px;line-height:1.05;color:var(--text);margin:14px 0 10px;letter-spacing:1px}
h1 em{font-style:normal;color:var(--accent)}
h2{font-family:'VT323',monospace;font-weight:400;font-size:30px;color:var(--accent);margin:40px 0 14px;letter-spacing:1px}
h2::before{content:"// ";opacity:.7}
.lead{color:var(--muted);max-width:760px;margin:0 0 18px}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
.stat{border:1px solid var(--border);background:var(--panel);padding:10px 14px;min-width:130px}
.stat b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:30px;line-height:1;color:var(--accent)}
.stat span{font-size:12px;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.card{border:1px solid var(--border);background:var(--panel);display:flex;flex-direction:column;min-width:0;color:var(--text)}
.card:hover{border-color:var(--accent);text-decoration:none}
.ph{aspect-ratio:4/3;background:#0a0f0d;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#33463f;font-size:12px;letter-spacing:2px}
.ph img{width:100%;height:100%;object-fit:cover}
.ci{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.cn{font-family:'VT323',monospace;font-size:21px;line-height:1.1;color:var(--mint)}
.cp{font-family:'VT323',monospace;font-size:22px;color:var(--accent);line-height:1}
.cs{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tag{display:inline-block;font-size:11px;letter-spacing:1px;border:1px solid var(--border);color:var(--muted);padding:1px 6px;margin-right:4px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{border:1px solid var(--border);padding:6px 10px;font-size:13px;color:var(--text);background:var(--panel)}
.chip:hover{border-color:var(--accent);text-decoration:none}
.chip em{font-style:normal;color:var(--muted);margin-left:6px}
.shops{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.shop{border:1px solid var(--border);border-left:4px solid var(--c,#ff8c1a);background:var(--panel);padding:14px 16px;color:var(--text);display:block}
.shop:hover{border-color:var(--c,#ff8c1a);text-decoration:none}
.shop b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:26px;line-height:1.05;color:#fff}
.shop span{font-size:13px;color:var(--muted)}
.band{margin:44px 0;border:1px solid var(--accent);background:linear-gradient(90deg,var(--accent-dim),transparent 60%),var(--panel);padding:22px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.band b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:30px;line-height:1.05}
.band span{color:var(--muted);font-size:14px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.step{border:1px solid var(--border);background:var(--panel);padding:16px}
.step b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:24px;color:var(--mint)}
.step span{font-size:13px;color:var(--muted)}
.faq details{border-top:1px dashed var(--border);padding:12px 0}
.faq summary{cursor:pointer;color:var(--text)}
.faq p{color:var(--muted);margin:8px 0 0}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{text-align:left;font-weight:400;color:var(--muted);font-size:12px;letter-spacing:1px;padding:8px 6px;border-bottom:1px solid var(--border)}
.tbl td{padding:10px 6px;border-bottom:1px dashed var(--border);vertical-align:top}
.tbl td.p{font-family:'VT323',monospace;font-size:22px;color:var(--accent);white-space:nowrap}
footer{margin-top:60px;border-top:1px solid var(--border);padding:24px 0 40px;font-size:12px;color:var(--muted)}
@media (max-width:600px){h1{font-size:36px}.brand{font-size:24px}.brand img{width:42px}.nav .cta{height:38px;padding:0 12px;font-size:12px}}
`;

function layout({ title, desc, path, body, jsonld, image }) {
  const url = SITE + path;
  const img = image || SITE + '/cu-logo.png';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Couriers United">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#ff8c1a">
<link rel="icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>${CSS}</style>
${(jsonld || []).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('')}
<script defer src="/_vercel/insights/script.js"></script>
</head><body>
<div class="top"><div class="wrap nav">
  <a class="brand" href="/" aria-label="Couriers United"><img src="/cu-logo.png" alt="" width="54" height="32"><span>COURIERS<small>UNITED</small></span></a>
  <a class="cta" href="/?utm_source=seo&amp;utm_medium=${encodeURIComponent(path.split('/')[1] || 'home')}">OPEN THE APP ▸</a>
</div></div>
<main class="wrap">${body}</main>
<footer><div class="wrap">
  <p><a href="/marketplace">Marketplace</a> · <a href="/">Couriers United app</a> · Item data by <a href="https://uexcorp.space" rel="noopener">UEX Corp</a></p>
  <p>Unofficial community project, not affiliated with Cloud Imperium Games. Star Citizen® and Cloud Imperium® are trademarks of Cloud Imperium Rights LLC. Prices are in aUEC (in-game currency) only.</p>
</div></footer>
</body></html>`;
}

function itemCard(it, shopsById, kind) {
  const shop = shopsById[it.seller_id];
  const price = kind === 'bp' ? (it.price_turnkey || it.price_client_mats) : it.price;
  const ph = it.photo_url ? `<img src="${esc(it.photo_url)}" alt="${esc(it.item_name)}" loading="lazy">` : `<span>${esc((catGroup(it.category_id) || 'ITEM').toUpperCase())}</span>`;
  return `<a class="card" href="${itemUrl(it.item_name)}"><div class="ph">${ph}</div><div class="ci">
    <span class="cn">${esc(it.item_name)}</span>
    ${price ? `<span class="cp">${fmt(price)}</span>` : ''}
    <span class="cs">${kind === 'bp' ? '<span class="tag">CRAFTED TO ORDER</span>' : ''}${shop ? 'by ' + esc(shop.shop_name) : ''}</span>
  </div></a>`;
}

module.exports = { SB_URL, SB_KEY, SITE, esc, fmt, slugify, shopUrl, itemUrl, catName, catGroup, q, send, layout, itemCard, LISTING_COLS, BP_COLS, SHOP_COLS };
