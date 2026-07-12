// Contact form + enquiries inbox verification (API level).
const BASE = process.env.BASE || "http://localhost:3440";
const out=[]; const rec=(n,ok,d="")=>{out.push(ok);console.log(`${ok?"✓":"✗"} ${n}${d?" — "+d:""}`);};
let cookie="";
async function api(path,opts={}){const h={origin:BASE,...(opts.headers||{})};if(opts.json)h["content-type"]="application/json";if(cookie)h.cookie=cookie;const r=await fetch(BASE+path,{method:opts.method||"GET",headers:h,body:opts.json?JSON.stringify(opts.json):undefined});const sc=r.headers.get("set-cookie");if(sc)cookie=(sc.match(/jn_admin=[^;]+/)||[cookie])[0];return r;}
// submit with a per-call IP so rate-limit buckets don't collide
const submit=(body,ip="1.1.1.1")=>api("/api/contact",{method:"POST",headers:{"x-forwarded-for":ip},json:body});
const getStore=async()=>(await(await api("/api/admin/store")).json()).store;

// 1. Valid submission
let r=await submit({name:"Ada Lovelace",email:"ada@example.com",phone:"07700900111",message:"Do you do christening balloon arches?",eventDate:"2026-09-01"},"10.0.0.1");
let j=await r.json();
rec("valid enquiry accepted (200)",r.status===200,`status=${r.status}`);
rec("success message returned",/on its way|thanks/i.test(j.message||""),"");

// 2. login + inspect store
await api("/api/admin/login",{method:"POST",json:{password:"balloons"}});
let store=await getStore();
let e=(store.enquiries||[]).find(x=>x.email==="ada@example.com");
rec("enquiry persisted with status New + createdAt",!!e&&e.status==="New"&&!!e.createdAt,e?.id);
rec("enquiry source recorded",!!e&&!!e.source,e?.source);
// CRM link
let c=(store.contacts||[]).find(x=>x.email==="ada@example.com");
rec("enquiry auto-creates a CRM contact (same record orders use)",!!c&&c.source==="Website enquiry",c?.status);

// 3. honeypot
r=await submit({name:"Bot",email:"bot@example.com",message:"spam",company:"AcmeSpam"},"10.0.0.2");
rec("honeypot submission returns 200 but stores nothing",r.status===200,`status=${r.status}`);
store=await getStore();
rec("honeypot enquiry NOT stored",!(store.enquiries||[]).some(x=>x.email==="bot@example.com"));

// 4. validation
rec("missing name/email → 400",(await submit({name:"",email:"",message:"hi"},"10.0.0.3")).status===400);
rec("bad email → 400",(await submit({name:"X",email:"notanemail",message:"hi"},"10.0.0.4")).status===400);
rec("empty message → 400",(await submit({name:"X",email:"x@y.com",message:""},"10.0.0.5")).status===400);
rec("invalid event date → 400",(await submit({name:"X",email:"x@y.com",message:"hi there",eventDate:"nope"},"10.0.0.6")).status===400);

// 5. product prefill capture
r=await submit({name:"Priya",email:"priya@example.com",message:"Question about this arch",productId:"arch",source:"Quote builder: Birthday Arch"},"10.0.0.7");
store=await getStore();
e=(store.enquiries||[]).find(x=>x.email==="priya@example.com");
rec("product-linked enquiry captures productName",!!e&&e.productName==="Birthday Arch",e?.productName);

// 6. admin status change persists (via store save)
store=await getStore();
const target=(store.enquiries||[]).find(x=>x.email==="ada@example.com");
target.status="Replied";
await api("/api/admin/store",{method:"POST",json:{store}});
store=await getStore();
rec("enquiry status change persists (New→Replied)",(store.enquiries||[]).find(x=>x.id===target.id)?.status==="Replied");

// 7. GDPR: deleting the contact scrubs their enquiry
c=(store.contacts||[]).find(x=>x.email==="ada@example.com");
await api(`/api/admin/contacts/${c.id}`,{method:"DELETE"});
store=await getStore();
e=(store.enquiries||[]).find(x=>x.id===target.id);
rec("GDPR erase scrubs the enquirer's PII from their enquiry",!!e&&e.name==="[deleted]"&&e.email===""&&e.message==="[removed]",`name=${e?.name}`);

// 8. rate limiting (same IP burst)
let hit429=false;
for(let i=0;i<10;i++){ const rr=await submit({name:"Burst",email:`b${i}@x.com`,message:"hello there"},"9.9.9.9"); if(rr.status===429){hit429=true;break;} }
rec("rate limiting kicks in on a burst from one IP (429)",hit429);

// 9. contact page renders with the form + intro
const page=await (await fetch(BASE+"/contact")).text();
rec("/contact page renders the form + intro",page.includes("Send message")&&page.includes("Say hello"));
// homepage header has a Contact link
const home=await (await fetch(BASE+"/")).text();
rec("homepage header/footer link to /contact",home.includes('href="/contact"'));

console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
process.exit(out.every(Boolean)?0:1);
