"""Test-only menu for e2e flows (ADR-018).

Since v0.17 a new store starts empty. Flows that need something to sell finish the first-time journey,
then call `add_sample_menu(page, 'bakso')`: it writes the rows from fixtures/sample-menus.json
(a mirror of src/test/sampleMenu.ts, checked by a unit test) straight into IndexedDB and reloads.
Nothing here ships in the app.
"""
import json
import os

MENUS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'sample-menus.json')))

_SEED_JS = """
async (menu) => {
  const db = await new Promise((ok, fail) => { const r = indexedDB.open('kasirku'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
  const all = (store) => new Promise((ok) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result); });
  const [store] = await all('stores');
  const takeaway = (await all('salesModes')).find((m) => m.name === 'Takeaway');
  const now = new Date().toISOString();
  const meta = () => ({ id: crypto.randomUUID(), storeId: store.id, createdAt: now, updatedAt: now });
  const categories = Object.fromEntries(Object.entries(menu.categories).map(([key, name], sortOrder) => [key, { ...meta(), name, sortOrder }]));
  const groups = Object.fromEntries(Object.entries(menu.groups).map(([key, g]) => [key, {
    ...meta(), name: g.name, isRequired: g.isRequired, selectType: g.max === 1 ? 'single' : 'multi', min: g.isRequired ? 1 : 0, max: g.max,
    options: g.options.map(([name, priceDelta], sortOrder) => ({ id: crypto.randomUUID(), name, priceDelta, sortOrder })),
  }]));
  const products = menu.products.map(([name, cat, basePrice, takeawayPrice, groupKeys, variants], sortOrder) => ({
    ...meta(), name, categoryId: categories[cat].id, isActive: true, sortOrder,
    basePrice: variants ? Math.min(...variants.map((v) => v[1])) : basePrice,
    variantGroupIds: groupKeys.map((k) => groups[k].id),
    modePrices: takeawayPrice === null ? {} : { [takeaway.id]: takeawayPrice },
    ...(variants ? { variants: variants.map(([vName, price, vTake], i) => ({ id: crypto.randomUUID(), name: vName, price, sortOrder: i, ...(vTake === null ? {} : { modePrices: { [takeaway.id]: vTake } }) })) } : {}),
  }));
  const tx = db.transaction(['categories', 'variantGroups', 'products'], 'readwrite');
  Object.values(categories).forEach((r) => tx.objectStore('categories').put(r));
  Object.values(groups).forEach((r) => tx.objectStore('variantGroups').put(r));
  products.forEach((r) => tx.objectStore('products').put(r));
  await new Promise((ok, fail) => { tx.oncomplete = ok; tx.onerror = () => fail(tx.error); });
  db.close();
}
"""


def add_sample_menu(page, menu='bakso'):
    """Call once the app shell is up (the store exists). Reloads the page so the app reads the new menu."""
    page.evaluate(_SEED_JS, MENUS[menu])
    page.reload()
    page.get_by_role('navigation').first.wait_for()


def skip_with_sample_menu(page, menu='bakso', skip='Lewati'):
    """First-time journey: press "Lewati" (empty store), then add a sample menu for the flow."""
    page.get_by_role('button', name=skip, exact=True).click()
    page.get_by_role('navigation').first.wait_for()
    add_sample_menu(page, menu)
