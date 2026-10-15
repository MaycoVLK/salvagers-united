// Page publique /marketplace : tout ce qui est en vente, lisible par Google et sans connexion.
const L = require('./_lib.js');

module.exports = async (req, res) => {
  const [listings, bps, shops] = await Promise.all([
    L.q(`marketplace_listings?select=${L.LISTING_COLS}&is_deleted=eq.false&order=created_at.desc&limit=400`),
    L.q(`blueprints?select=${L.BP_COLS}&is_deleted=eq.false&order=created_at.desc&limit=400`),
    L.q(`marketplace_shops?select=${L.SHOP_COLS}&limit=500`)
  ]);
  const byId = {}; shops.forEach(s => { byId[s.id] = s; });
  const active = new Set([...listings, ...bps].map(x => x.seller_id));
  const activeShops = shops.filter(s => active.has(s.id) && s.shop_name);
  const count = {}; [...listings, ...bps].forEach(x => { if (x.seller_id) count[x.seller_id] = (count[x.seller_id] || 0) + 1; });
  activeShops.sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0));

  // catégories (groupes) les plus fournies
  const groups = {};
  [...listings, ...bps].forEach(x => { const g = L.catGroup(x.category_id); if (g) groups[g] = (groups[g] || 0) + 1; });
  const topGroups = Object.entries(groups).sort((a, b) => b[1] - a[1]);

  // objets distincts (pour les liens internes vers les pages /item/...)
  const names = {};
  [...listings, ...bps].forEach(x => { const k = L.slugify(x.item_name); if (k && !names[k]) names[k] = x.item_name; });
  const itemLinks = Object.values(names).slice(0, 120);

  const board = listings.slice(0, 8).map((x, i) => `<a class="brow" style="--d:${(i * 0.09).toFixed(2)}s" href="${L.itemUrl(x.item_name)}"><span>${L.esc(x.item_name)}</span><span class="s">${L.esc((byId[x.seller_id] || {}).shop_name || '—')}</span><span class="p">${L.fmtNum(x.price)}</span></a>`).join('');
  const body = `
  <p class="crumbs"><a href="/">Couriers United</a> › Marketplace</p>
  <section class="hero">
    <div>
      <h1>The players' market of the 'verse</h1>
      <p class="lead">Crafted armor, blueprints, ship components: buy straight from other Star Citizen players, then meet in game or get it delivered across Stanton, Pyro and Nyx. Prices in aUEC.</p>
      <div class="ctas"><a class="cta" href="/?utm_source=seo&amp;utm_medium=marketplace">Browse and buy in the app</a><a class="cta ghost" href="/?utm_source=seo&amp;utm_medium=marketplace_open_shop">Open my shop for free</a></div>
      <ul class="facts"><li><b>${listings.length}</b>items for sale</li><li><b>${bps.length}</b>blueprints crafted to order</li><li><b>${activeShops.length}</b>player shops</li></ul>
    </div>
    <div class="board" aria-label="Latest listings">
      <div class="board-h"><span>Just landed on the market</span><span class="live"><i></i>live</span></div>
      <div class="bcols"><span>Item</span><span>Shop</span><span>Price aUEC</span></div>
      ${board || '<p class="lead">No item listed right now.</p>'}
    </div>
  </section>

  ${topGroups.length ? `<h2>Browse by category</h2><p class="h2s">What players are selling right now.</p><div class="chips">${topGroups.map(([g, n]) => `<span class="chip">${L.esc(g)}<em>${n}</em></span>`).join('')}</div>` : ''}

  <h2>On the shelves now</h2>
  <p class="h2s">The latest items listed by player shops. Open one to see every offer for it.</p>
  ${listings.length ? `<div class="grid">${listings.slice(0, 48).map(x => L.itemCard(x, byId, 'listing')).join('')}</div>` : '<p class="lead">No item listed right now.</p>'}

  <h2>Crafted to order</h2>
  <p class="h2s">These sellers own the blueprint and craft the item for you, ready-made or with your own materials.</p>
  ${bps.length ? `<div class="grid">${bps.slice(0, 36).map(x => L.itemCard(x, byId, 'bp')).join('')}</div>` : '<p class="lead">No blueprint listed right now.</p>'}

  <h2>Player shops</h2>
  <p class="h2s">Every shop is run by a player. Pick one and see everything they sell.</p>
  <div class="shops">${activeShops.slice(0, 60).map(s => `<a class="shop" style="--c:${/^#[0-9a-f]{6}$/i.test(s.theme_color || '') ? s.theme_color : '#ff8c1a'}" href="${L.shopUrl(s)}"><b>${L.esc(s.shop_name)}</b><span>${count[s.id] || 0} items${s.location_system ? ' in ' + L.esc(s.location_system) : ''}</span></a>`).join('')}</div>

  <div class="band"><div><b>Your hangar is full of things someone wants.</b><span>Anyone can open a shop on Couriers United. List your items and blueprints in two minutes with your Discord account.</span></div><a class="cta" href="/?utm_source=seo&amp;utm_medium=marketplace_open_shop">Open my shop</a></div>

  <h2>How a trade works</h2>
  <div class="steps">
    <div class="step"><b>Find it</b><span>Browse items and blueprints from player shops, or post what you are looking for.</span></div>
    <div class="step"><b>Talk to the seller</b><span>Send a request or an offer and chat with the seller in the app.</span></div>
    <div class="step"><b>Meet or get it delivered</b><span>Meet in game, or let a courier deliver it in Stanton, Pyro or Nyx.</span></div>
  </div>

  ${itemLinks.length ? `<h2>Every item on the market</h2><div class="chips">${itemLinks.map(n => `<a class="chip" href="${L.itemUrl(n)}">${L.esc(n)}</a>`).join('')}</div>` : ''}

  <h2>Questions</h2>
  <div class="faq">
    <details><summary>Is Couriers United free?</summary><p>Yes. Browsing, opening a shop and listing items is free. Deliveries by couriers include a commission, shown before you order.</p></details>
    <details><summary>Is this real money trading?</summary><p>No. All prices are in aUEC, the in-game currency. Real-money trading is not allowed.</p></details>
    <details><summary>How do I sign in?</summary><p>With your Discord account, in one click. Your RSI handle lets other players add you in game.</p></details>
  </div>`;

  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Star Citizen marketplace — Couriers United', url: L.SITE + '/marketplace',
    description: 'Player marketplace for Star Citizen: crafted gear, blueprints and rare items, with delivery across Stanton, Pyro and Nyx.',
    mainEntity: { '@type': 'ItemList', numberOfItems: listings.length + bps.length,
      itemListElement: listings.slice(0, 20).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.item_name, url: L.SITE + L.itemUrl(x.item_name) })) }
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
      { '@type': 'Question', name: 'Is Couriers United free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Browsing, opening a shop and listing items is free. Deliveries by couriers include a commission, shown before you order.' } },
      { '@type': 'Question', name: 'Is this real money trading?', acceptedAnswer: { '@type': 'Answer', text: 'No. All prices are in aUEC, the in-game currency.' } }
    ]
  }];
  L.send(res, L.layout({
    title: `Star Citizen Marketplace — ${listings.length + bps.length} items & blueprints from players | Couriers United`,
    desc: `Buy crafted armor, weapons, ship components and blueprints from ${activeShops.length} Star Citizen player shops. Delivery across Stanton, Pyro and Nyx. Prices in aUEC.`,
    path: '/marketplace', body, jsonld
  }));
};
