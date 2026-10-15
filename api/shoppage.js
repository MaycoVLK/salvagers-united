// Page publique d'une boutique : /shop/<nom-du-shop>--<id>
const L = require('./_lib.js');

module.exports = async (req, res) => {
  const raw = String(req.query.slug || '');
  const m = raw.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/);
  if (!m) { res.writeHead(302, { Location: '/marketplace' }); res.end(); return; }
  const id = m[1].toLowerCase();
  const [shops, listings, bps] = await Promise.all([
    L.q(`marketplace_shops?select=${L.SHOP_COLS}&id=eq.${id}`),
    L.q(`marketplace_listings?select=${L.LISTING_COLS}&seller_id=eq.${id}&is_deleted=eq.false&order=created_at.desc&limit=200`),
    L.q(`blueprints?select=${L.BP_COLS}&seller_id=eq.${id}&is_deleted=eq.false&order=created_at.desc&limit=200`)
  ]);
  const shop = shops[0];
  if (!shop || !shop.shop_name) { res.writeHead(302, { Location: '/marketplace' }); res.end(); return; }
  const canon = L.shopUrl(shop);
  if (raw !== canon.replace('/shop/', '')) { res.writeHead(301, { Location: canon }); res.end(); return; }
  const byId = { [shop.id]: shop };
  const color = /^#[0-9a-f]{6}$/i.test(shop.theme_color || '') ? shop.theme_color : '#ff8c1a';
  const where = [shop.location_name, shop.location_system].filter(Boolean).join(', ');
  const appLink = `/?shop=${shop.id}&amp;utm_source=seo&amp;utm_medium=shop`;
  const desc = (shop.description ? String(shop.description).slice(0, 150) + ' — ' : '') + `${listings.length} items and ${bps.length} blueprints for sale in Star Citizen${where ? ', based in ' + where : ''}.`;
  const body = `
  <p class="crumbs"><a href="/">Couriers United</a> › <a href="/marketplace">Marketplace</a> › ${L.esc(shop.shop_name)}</p>
  <div style="display:flex;gap:16px;align-items:center;margin-top:16px;border-left:4px solid ${color};padding-left:16px">
    ${shop.logo_url ? `<img src="${L.esc(shop.logo_url)}" alt="${L.esc(shop.shop_name)} logo" width="72" height="72" style="width:72px;height:72px;object-fit:cover;border:1px solid #22302a">` : ''}
    <div><h1 style="margin:0">${L.esc(shop.shop_name)}</h1><p class="lead" style="margin:4px 0 0">Star Citizen player shop${where ? ' · ' + L.esc(where) : ''}</p></div>
  </div>
  ${shop.description ? `<p class="lead" style="margin-top:16px">${L.esc(shop.description)}</p>` : ''}
  <div class="stats"><div class="stat"><b>${listings.length}</b><span>items for sale</span></div><div class="stat"><b>${bps.length}</b><span>blueprints</span></div></div>
  <a class="cta" href="${appLink}">VISIT THE SHOP IN THE APP ▸</a>
  ${listings.length ? `<h2>Items for sale</h2><div class="grid">${listings.map(x => L.itemCard(x, byId, 'listing')).join('')}</div>` : ''}
  ${bps.length ? `<h2>Blueprints crafted to order</h2><div class="grid">${bps.map(x => L.itemCard(x, byId, 'bp')).join('')}</div>` : ''}
  <div class="band"><div><b>Buy from ${L.esc(shop.shop_name)}</b><span>Sign in with Discord to send a request, chat with the seller and get your item delivered.</span></div><a class="cta" href="${appLink}">OPEN ▸</a></div>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Couriers United', item: L.SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Marketplace', item: L.SITE + '/marketplace' },
    { '@type': 'ListItem', position: 3, name: shop.shop_name, item: L.SITE + canon } ] }];
  L.send(res, L.layout({ title: `${shop.shop_name} — Star Citizen shop (${listings.length + bps.length} items) | Couriers United`, desc, path: canon, body, jsonld, image: L.SB_URL + '/storage/v1/object/public/marketplace-photos/' + shop.id + '/card.png' }));
};
