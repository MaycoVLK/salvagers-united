// Outils partagés par les pages publiques (SEO) : /marketplace, /shop/..., /item/..., /sitemap.xml
// Les fichiers dont le nom commence par "_" ne deviennent pas des routes sur Vercel.
const SB_URL = 'https://hdstkdubotlmlndmuwnl.supabase.co';
const SB_KEY = require('./_key.js');
const SITE = 'https://www.couriers-united.space';
const CATS = require('./_cats.json');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtNum = n => (n == null || n === '' || isNaN(n)) ? '' : new Intl.NumberFormat('fr-FR').format(Math.round(+n)).replace(/[\u202F\u00A0]/g, ' ');
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
:root{--bg:#050606;--hull:#0a1110;--line:#1c2925;--accent:#ff8c1a;--accent-dim:#ff8c1a2e;--text:#d9f5e6;--muted:#7d9a8c;--mint:#aef5e0;--stanton:#5fb8ff;--pyro:#ff6a45;--nyx:#b48cff}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Share Tech Mono',ui-monospace,monospace;font-size:15px;line-height:1.6}
a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--text);outline-offset:2px}
.top{border-top:3px solid var(--accent);background:#070c0b;border-bottom:1px solid var(--line)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;height:68px}
.brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-family:'VT323',monospace;font-size:30px;letter-spacing:2px;line-height:1}
.brand:hover{text-decoration:none}
.brand img{width:54px;height:auto}
.brand small{display:block;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:4px;color:var(--muted)}
.cta{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;background:var(--accent);color:#000;font-family:'VT323',monospace;font-size:22px;border:1px solid var(--accent);white-space:nowrap}
.cta:hover{text-decoration:none;filter:brightness(1.1)}
.cta.ghost{background:transparent;color:var(--accent)}
.cta.ghost:hover{background:var(--accent-dim);filter:none}
.ctas{display:flex;gap:10px;flex-wrap:wrap}
.crumbs{font-size:12px;color:var(--muted);margin:22px 0 0}
.crumbs a{color:var(--muted)}
h1{font-family:'VT323',monospace;font-weight:400;font-size:58px;line-height:.95;color:var(--text);margin:14px 0 14px;text-wrap:balance}
h2{font-family:'VT323',monospace;font-weight:400;font-size:32px;color:var(--text);margin:48px 0 6px}
.h2s{color:var(--muted);font-size:14px;margin:0 0 16px;max-width:64ch}
.lead{color:var(--muted);max-width:56ch;margin:0 0 20px}
.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:32px;align-items:start;margin-top:14px}
.facts{list-style:none;margin:22px 0 0;padding:0;display:flex;gap:24px;flex-wrap:wrap}
.facts li{font-size:13px;color:var(--muted)}
.facts b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:34px;line-height:1;color:var(--text)}
.board{background:#020303;border:1px solid var(--line);box-shadow:inset 0 0 0 4px #070b0a,inset 0 0 0 5px var(--line);padding:14px 16px 10px;font-family:'VT323',monospace;min-width:0}
.board-h{display:flex;justify-content:space-between;align-items:center;font-size:21px;color:var(--accent);padding-bottom:8px;border-bottom:2px solid var(--line)}
.live{display:flex;align-items:center;gap:6px;font-size:17px;color:var(--muted)}
.live i{width:7px;height:7px;background:#39ff6a;display:block;animation:bl 1.6s steps(2) infinite}
@keyframes bl{50%{opacity:.25}}
.bcols,.brow{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr) 120px;gap:14px;align-items:baseline}
.bcols span:last-child{text-align:right}
.bcols{font-size:16px;color:#4f6a5f;padding:8px 0 4px}
.brow{padding:6px 0;border-top:1px dashed #16211d;font-size:21px;color:#ffb35c}
.brow:hover{color:#fff;text-decoration:none}
.brow span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brow .s{color:#7d9a8c}.brow .p{text-align:right;color:var(--text)}
.brow span{animation:fl .5s steps(5) both;animation-delay:var(--d,0s)}
@keyframes fl{0%{clip-path:inset(0 0 100% 0);opacity:.3}100%{clip-path:inset(0);opacity:1}}
@media (prefers-reduced-motion:reduce){.brow span,.live i{animation:none}}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{border:1px solid var(--line);padding:6px 10px;font-size:13px;color:var(--text);background:var(--hull);display:inline-flex;align-items:center;gap:8px}
a.chip:hover{border-color:var(--accent);text-decoration:none}
.chip em{font-style:normal;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.card{position:relative;background:var(--hull);border:1px solid var(--line);display:flex;flex-direction:column;min-width:0;color:var(--text);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
.card:hover{border-color:var(--accent);text-decoration:none}
.strip{display:flex;justify-content:space-between;align-items:center;gap:8px;height:30px;padding:0 22px 0 10px;border-bottom:1px solid var(--line);font-size:12px;color:var(--muted);background:#070c0b}
.strip span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sys{flex:none;font-size:11px;padding:0 6px;border:1px solid var(--line);color:var(--muted)}
.ph{aspect-ratio:4/3;background:#060a09;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#33463f;font-size:12px}
.ph img{width:100%;height:100%;object-fit:cover}
.bp .ph{background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:16px 16px}
.ci{padding:12px;display:flex;flex-direction:column;gap:6px;flex:1}
.cn{font-family:'VT323',monospace;font-size:24px;line-height:1.05;color:var(--text)}
.cp{font-family:'VT323',monospace;font-size:30px;line-height:.9;color:var(--accent)}
.cp small{font-family:'Share Tech Mono',monospace;font-size:12px;color:var(--muted);margin-left:5px}
.cs{margin-top:auto;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding:8px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cs i{display:none}
.shops{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.shop{border:1px solid var(--line);border-left:6px solid var(--c,#ff8c1a);background:var(--hull);padding:14px 16px;color:var(--text);display:flex;flex-direction:column;gap:4px}
.shop:hover{border-color:var(--c,#ff8c1a);text-decoration:none}
.shop b{font-family:'VT323',monospace;font-weight:400;font-size:28px;line-height:1;color:#fff}
.shop span{font-size:13px;color:var(--muted)}
.band{margin:52px 0;border:1px solid var(--accent);background:var(--hull);padding:24px 26px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.band b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:34px;line-height:1}
.band span{color:var(--muted);font-size:14px;display:block;margin-top:6px;max-width:60ch}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.step{border-top:2px solid var(--accent);background:var(--hull);padding:16px}
.step b{display:block;font-family:'VT323',monospace;font-weight:400;font-size:26px;color:var(--text);line-height:1.05;margin-bottom:6px}
.step span{font-size:14px;color:var(--muted)}
.faq details{border-top:1px dashed var(--line);padding:14px 0}
.faq summary{cursor:pointer;color:var(--text)}
.faq p{color:var(--muted);margin:8px 0 0;max-width:70ch}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{text-align:left;font-weight:400;color:var(--muted);font-size:13px;padding:8px 6px;border-bottom:1px solid var(--line)}
.tbl td{padding:12px 6px;border-bottom:1px dashed var(--line);vertical-align:top}
.tbl td.p{font-family:'VT323',monospace;font-size:26px;color:var(--accent);white-space:nowrap;text-align:right}
footer{margin-top:64px;border-top:1px solid var(--line);padding:24px 0 40px;font-size:12px;color:var(--muted)}
@media (max-width:880px){.hero{grid-template-columns:1fr;gap:20px}}
@media (max-width:600px){h1{font-size:42px}.brand{font-size:24px}.brand img{width:42px}.nav .cta{height:38px;padding:0 12px;font-size:19px}}
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
  <a class="cta" href="/?utm_source=seo&amp;utm_medium=${encodeURIComponent(path.split('/')[1] || 'home')}">Browse in the app</a>
</div></div>
<main class="wrap">${body}</main>
<footer><div class="wrap">
  <p><a href="/marketplace">Marketplace</a> · <a href="/">Couriers United app</a> · Item data by <a href="https://uexcorp.space" rel="noopener">UEX Corp</a></p>
  <p>Unofficial community project, not affiliated with Cloud Imperium Games. Star Citizen® and Cloud Imperium® are trademarks of Cloud Imperium Rights LLC. Prices are in aUEC (in-game currency) only.</p>
</div></footer>
</body></html>`;
}

const SYS = { Stanton: 'var(--stanton)', Pyro: 'var(--pyro)', Nyx: 'var(--nyx)' };
function itemCard(it, shopsById, kind) {
  const shop = shopsById[it.seller_id];
  const price = kind === 'bp' ? (it.price_turnkey || it.price_client_mats) : it.price;
  const grp = catGroup(it.category_id);
  const ph = it.photo_url ? `<img src="${esc(it.photo_url)}" alt="${esc(it.item_name)}" loading="lazy">` : `<span>${esc(grp || 'Item')}</span>`;
  const sys = shop && SYS[shop.location_system] ? `<span class="sys" style="--s:${SYS[shop.location_system]}">${esc(shop.location_system)}</span>` : '';
  const color = shop && /^#[0-9a-f]{6}$/i.test(shop.theme_color || '') ? shop.theme_color : '#ff8c1a';
  return `<a class="card${kind === 'bp' ? ' bp' : ''}" href="${itemUrl(it.item_name)}"><div class="strip"><span>${kind === 'bp' ? 'Crafted to order' : esc(grp || 'Item')}</span>${sys}</div><div class="ph">${ph}</div><div class="ci">
    <span class="cn">${esc(it.item_name)}</span>
    ${price ? `<span class="cp">${fmtNum(price)}<small>aUEC${kind === 'bp' && it.price_turnkey ? ' ready-made' : ''}</small></span>` : ''}
    ${shop ? `<span class="cs" style="--c:${color}"><i></i>${esc(shop.shop_name)}</span>` : ''}
  </div></a>`;
}

module.exports = { fmtNum, SYS, SB_URL, SB_KEY, SITE, esc, fmt, slugify, shopUrl, itemUrl, catName, catGroup, q, send, layout, itemCard, LISTING_COLS, BP_COLS, SHOP_COLS };
