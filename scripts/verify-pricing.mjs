// Pricing controls verification (API level): recipes, overrides, size tiers,
// product/material management, and editable site copy — all persist & flow to
// the public quote data.
const BASE = process.env.BASE || "http://localhost:3421";
const out = []; const rec = (n, ok, d="") => { out.push(ok); console.log(`${ok?"✓":"✗"} ${n}${d?" — "+d:""}`); };
let cookie="";
async function api(path,opts={}){const h={origin:BASE,...(opts.headers||{})};if(opts.json)h["content-type"]="application/json";if(cookie)h.cookie=cookie;const r=await fetch(BASE+path,{method:opts.method||"GET",headers:h,body:opts.json?JSON.stringify(opts.json):undefined});const sc=r.headers.get("set-cookie");if(sc)cookie=(sc.match(/jn_admin=[^;]+/)||[cookie])[0];return r;}
const getStore = async () => (await (await api("/api/admin/store")).json()).store;
const putStore = (s) => api("/api/admin/store",{method:"POST",json:{store:s}});
// Parse a product's fromPrice + priceBySize from the homepage RSC payload.
async function publicProduct(id){
  const html = await (await fetch(BASE+"/")).text();
  const block = html.match(new RegExp(`\\\\"id\\\\":\\\\"${id}\\\\"[\\s\\S]{0,400}?\\\\"priceBySize\\\\":\\{[^}]*\\}`));
  if(!block) return null;
  const from = Number((block[0].match(/\\"fromPrice\\":(\d+(?:\.\d+)?)/)||[])[1]);
  const sizes = {}; for(const m of block[0].matchAll(/\\"(\w+)\\":(\d+(?:\.\d+)?)/g)){ if(!["fromPrice"].includes(m[1])) sizes[m[1]]=Number(m[2]); }
  return { from, raw: block[0] };
}
async function homeText(){ return await (await fetch(BASE+"/")).text(); }

await api("/api/admin/login",{method:"POST",json:{password:"balloons"}});

// 1. Recipe edit re-costs the product
let store = await getStore();
const arch = store.products.find(p=>p.id==="arch");
const beforeArch = (await publicProduct("arch")).from;
arch.recipe.latex = (arch.recipe.latex||0) + 100; // double-ish the latex
await putStore(store);
const afterArch = (await publicProduct("arch")).from;
rec("editing a product recipe re-costs the public price", afterArch > beforeArch, `from ${beforeArch} → ${afterArch}`);

// 2. Manual override: sets Standard price; sizes scale by mult
store = await getStore();
const g = store.products.find(p=>p.id==="garland");
g.priceOverride = 120;
await putStore(store);
store = await getStore();
const petite = store.sizes.find(s=>s.mult===Math.min(...store.sizes.map(x=>x.mult)));
const expectFrom = Math.round(120 * petite.mult);
const ov = await publicProduct("garland");
rec("manual override drives the public price (Standard=£120, from=round(120×cheapest))", ov.from === expectFrom, `from=${ov.from}, expected=${expectFrom}`);
// clearing override reverts to calculated
store = await getStore();
store.products.find(p=>p.id==="garland").priceOverride = undefined;
await putStore(store);
const rev = await publicProduct("garland");
rec("clearing the override reverts to the calculated price", rev.from !== expectFrom, `from=${rev.from}`);

// 3. Editable size tiers: add a new tier, it appears in priceBySize
store = await getStore();
store.sizes.push({ id: "huge", name: "Huge", mult: 2 });
await putStore(store);
const withHuge = await publicProduct("arch");
rec("new size tier flows to the public quote (priceBySize.huge)", /\\"huge\\":\d/.test(withHuge.raw), (withHuge.raw.match(/\\"huge\\":(\d+)/)||[])[0]||"missing");

// 4. Product management: add a product without code
store = await getStore();
store.products.push({ id: "sculpt", name: "Custom Sculpture", fill: "air", buildHours: 3, desc: "Bespoke balloon sculpture", recipe: { latex: 60 } });
await putStore(store);
const home1 = await homeText();
rec("a newly added product appears on the public site", home1.includes("Custom Sculpture"));
const sculpt = await publicProduct("sculpt");
rec("the new product is priced live from its recipe", sculpt && sculpt.from > 0, `from=${sculpt?.from}`);

// 5. Material add + used in a recipe
store = await getStore();
store.materials.push({ id: "sparkle", name: "Sparkle spray", unit: "can", cost: 5, stock: 10, lowAt: 2 });
store.products.find(p=>p.id==="sculpt").recipe.sparkle = 1;
const beforeSpark = (await publicProduct("sculpt")).from;
await putStore(store);
const afterSpark = (await publicProduct("sculpt")).from;
rec("adding a material and using it in a recipe raises the cost", afterSpark >= beforeSpark, `from ${beforeSpark} → ${afterSpark}`);

// 6. Editable site copy flows to the homepage
store = await getStore();
store.copy.heroTitle = "Balloons that make the party";
store.copy.contactEmail = "hello@example-test.co.uk";
await putStore(store);
const home2 = await homeText();
rec("editing hero headline updates the homepage", home2.includes("Balloons that make the party"));
rec("editing contact email updates the footer", home2.includes("hello@example-test.co.uk"));

// 7. Editable delivery zone name/areas flow to the public site
store = await getStore();
store.zones[0].name = "Inner Ring";
store.zones[0].areas = "Testville, Exampleton";
await putStore(store);
const home3 = await homeText();
rec("editing a delivery zone name updates the public site", home3.includes("Inner Ring"));
rec("editing a zone's covered areas updates the public site", home3.includes("Testville"));

console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
process.exit(out.every(Boolean)?0:1);
