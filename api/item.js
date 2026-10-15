// Page publique d'un objet : /item/<nom-de-l-objet> — « où acheter X dans Star Citizen », tous vendeurs confondus.
const L = require('./_lib.js');

module.exports = async (req, res) => {
  const slug = L.slugify(String(req.query.slug || ''));
  if (!slug || slug.length < 2) { res.writeHead(302, { Location: '/marketplace' }); res.end(); return; }
  const pattern = '*' + slug.split('-').filter(Boolean).slice(0, 8).join('*') + '*';
  const enc = encodeURIComponent(pattern);
  const [l0, b0] = await Promise.all([
    L.q(`marketplace_listings?select=${L.LISTING_COLS}&is_deleted=eq.false&item_name=ilike.${enc}&order=price.asc&limit=100`),
    L.q(`blueprints?select=${L.BP_COLS}&is_deleted=eq.false&item_name=ilike.${enc}&order=created_at.desc&limit=100`)
  ]);
  // on ne garde que les noms qui donnent exactement ce slug (évite « Helmet » qui attrape tous les casques)
  const listings = l0.filter(x => L.slugify(x.item_name) === slug);
  const bps = b0.filter(x => L.slugify(x.item_name) === slug);
  const all = [...listings, ...bps];
  const ids = [...new Set(all.map(x => x.seller_id))];
  const shops = ids.length ? await L.q(`marketplace_shops?select=${L.SHOP_COLS}&id=in.(${ids.join(',')})`) : [];
  const byId = {}; shops.forEach(s => { byId[s.id] = s; });
  if (!all.length) {
    const body = `<p class="crumbs"><a href="/">Couriers United</a> › <a href="/marketplace">Marketplace</a></p>
      <h1>This item is not for sale right now</h1><p class="lead">Nobody is selling it at the moment. Post a request in the app: sellers and crafters will see it.</p>
      <a class="cta" href="/?utm_source=seo&amp;utm_medium=item_missing">POST A REQUEST ▸</a> <a class="cta ghost" href="/marketplace">SEE THE MARKETPLACE</a>`;
    res.setHeader('X-Robots-Tag', 'noindex');
    return L.send(res, L.layout({ title: 'Item not available — Couriers United', desc: 'This Star Citizen item is not for sale right now on Couriers United.', path: '/item/' + slug, body }), 404);
  }
  const name = all[0].item_name;
  const cat = L.catName(all[0].category_id), grp = L.catGroup(all[0].category_id);
  const prices = [...listings.map(x => +x.price), ...bps.map(x => +(x.price_turnkey || x.price_client_mats))].filter(p => p > 0);
  const min = prices.length ? Math.min(...prices) : null, max = prices.length ? Math.max(...prices) : null;
  const rows = [
    ...listings.map(x => ({ shop: byId[x.seller_id], price: x.price, kind: 'In stock', note: x.quantity > 1 ? `${x.quantity} available` : '' })),
    ...bps.map(x => ({ shop: byId[x.seller_id], price: x.price_turnkey || x.price_client_mats, kind: 'Crafted to order', note: x.price_client_mats && x.price_turnkey ? `${L.fmt(x.price_client_mats)} with your materials` : (x.materials ? 'Materials: ' + String(x.materials).slice(0, 80) : '') }))
  ].sort((a, b) => (+a.price || 9e15) - (+b.price || 9e15));
  const photo = all.find(x => x.photo_url);
  const body = `
  <p class="crumbs"><a href="/">Couriers United</a> › <a href="/marketplace">Marketplace</a>${grp ? ' › ' + L.esc(grp) : ''} › ${L.esc(name)}</p>
  <h1>Where to buy <em>${L.esc(name)}</em> in Star Citizen</h1>
  <p class="lead">${rows.length} offer${rows.length > 1 ? 's' : ''} from ${ids.length} player shop${ids.length > 1 ? 's' : ''}${min ? `, from ${L.fmt(min)}` : ''}${cat ? ` · ${L.esc(cat)}` : ''}. Buy it from another player and meet in game, or get it delivered to Stanton, Pyro or Nyx.</p>
  ${photo ? `<img src="${L.esc(photo.photo_url)}" alt="${L.esc(name)}" style="max-width:420px;width:100%;border:1px solid #22302a;display:block;margin:10px 0 16px" loading="lazy">` : ''}
  <a class="cta" href="/?utm_source=seo&amp;utm_medium=item">BUY IN THE APP ▸</a>
  <h2>Offers</h2>
  <table class="tbl"><thead><tr><th>SHOP</th><th>TYPE</th><th>PRICE</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td>${r.shop ? `<a href="${L.shopUrl(r.shop)}">${L.esc(r.shop.shop_name)}</a>` : 'Player shop'}${r.note ? `<br><span style="color:#7d9a8c;font-size:12px">${L.esc(r.note)}</span>` : ''}</td><td>${r.kind}</td><td class="p">${r.price ? L.fmt(r.price) : '—'}</td></tr>`).join('')}
  </tbody></table>
  <div class="band"><div><b>Don't see the right price?</b><span>Post a request for ${L.esc(name)} in the app: sellers and crafters get notified.</span></div><a class="cta" href="/?utm_source=seo&amp;utm_medium=item_request">POST A REQUEST ▸</a></div>
  <p><a href="/marketplace">← Back to the whole marketplace</a></p>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Couriers United', item: L.SITE + '/' },
    { '@type': 'ListItem', position: 2, name: 'Marketplace', item: L.SITE + '/marketplace' },
    { '@type': 'ListItem', position: 3, name, item: L.SITE + L.itemUrl(name) } ] }];
  L.send(res, L.layout({
    title: `${name} — where to buy in Star Citizen${min ? ` (from ${L.fmt(min)})` : ''} | Couriers United`,
    desc: `${rows.length} player offer${rows.length > 1 ? 's' : ''} for ${name} in Star Citizen${min ? `, from ${L.fmt(min)}` : ''}. Ready-made or crafted to order, delivered across Stanton, Pyro and Nyx.`,
    path: L.itemUrl(name), body, jsonld, image: photo ? photo.photo_url : undefined
  }));
};
