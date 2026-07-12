// Order cancel/archive + permanent-delete verification (API level).
const BASE = process.env.BASE || "http://localhost:3430";
const out=[]; const rec=(n,ok,d="")=>{out.push(ok);console.log(`${ok?"✓":"✗"} ${n}${d?" — "+d:""}`);};
const addDays=(iso,n)=>{const d=new Date(iso+"T12:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const today=new Date().toISOString().slice(0,10);
let cookie="";
async function api(path,opts={}){const h={origin:BASE,...(opts.headers||{})};if(opts.json)h["content-type"]="application/json";if(cookie)h.cookie=cookie;const r=await fetch(BASE+path,{method:opts.method||"GET",headers:h,body:opts.json?JSON.stringify(opts.json):undefined});const sc=r.headers.get("set-cookie");if(sc)cookie=(sc.match(/jn_admin=[^;]+/)||[cookie])[0];return r;}
const getStore=async()=>(await(await api("/api/admin/store")).json()).store;
const putStore=(s)=>api("/api/admin/store",{method:"POST",json:{store:s}});
const book=(date,contact,product="arch")=>api("/api/booking",{method:"POST",json:{kind:"book",productId:product,sizeId:"standard",theme:"Blush & gold",postcode:"PE29 3AB",date,custName:"Del Test",custContact:contact,marketingConsent:false}});
const financeRevenue=async()=>{const s=await getStore();return s.orders.filter(o=>!o.archived).reduce((a,o)=>a+o.price+(o.delivery||0),0);};

await api("/api/admin/login",{method:"POST",json:{password:"balloons"}});

// Create an order to work with
const d1=addDays(today,60);
await book(d1,"del-a@example.com");
let store=await getStore();
let o=store.orders.find(x=>x.phone==="del-a@example.com");
rec("test order created (active)",!!o&&!o.archived,o?.id);
const oid=o.id;

// Archive (cancel) it via store save (upsert-safe flag)
store=await getStore(); o=store.orders.find(x=>x.id===oid); o.archived=true; o.archivedAt=new Date().toISOString();
await putStore(store);
store=await getStore(); o=store.orders.find(x=>x.id===oid);
rec("cancel & archive persists the flag (record kept)",!!o&&o.archived===true);
// Excluded from calendar (iCal feed)
const tok=(await(await api("/api/admin/calendar-token",{method:"POST"})).json()).token;
let ics=await(await fetch(BASE+`/api/calendar/${tok}`)).text();
rec("archived order has NO calendar events",!ics.includes(oid),"");
// Frees availability: fill the day to cap, then archiving one lets a new booking through
store=await getStore(); const cap=store.settings.maxDeliveriesPerDay;
const d2=addDays(today,61);
for(let i=0;i<cap;i++){ await book(d2,`cap${i}@x.com`); }
let full=await book(d2,"overflow@x.com");
rec(`day at capacity rejects an extra booking (409)`,full.status===409,`status=${full.status}`);
// archive one order on that day
store=await getStore(); const onDay=store.orders.find(x=>x.date===d2&&!x.archived); onDay.archived=true;
await putStore(store);
let afterArchive=await book(d2,"afterarchive@x.com");
rec("archiving an order frees its delivery slot (booking now 200/ok)",afterArchive.status===200||afterArchive.ok,`status=${afterArchive.status}`);

// Restore
store=await getStore(); o=store.orders.find(x=>x.id===oid); o.archived=false; delete o.archivedAt;
await putStore(store);
store=await getStore(); o=store.orders.find(x=>x.id===oid);
rec("restore returns the order to active",!!o&&!o.archived);

// Permanent delete via endpoint
const before=(await getStore()).orders.length;
const del=await api(`/api/admin/orders/${oid}`,{method:"DELETE"});
rec("DELETE endpoint returns ok",del.status===200,`status=${del.status}`);
store=await getStore(); o=store.orders.find(x=>x.id===oid);
rec("permanently deleted order is gone from the store",!o,`count ${before}→${store.orders.length}`);
// and stays gone on a fresh read (does not reappear)
store=await getStore();
rec("deleted order does NOT reappear on re-read",!store.orders.find(x=>x.id===oid));
// deleting a missing order → 404
const del2=await api(`/api/admin/orders/${oid}`,{method:"DELETE"});
rec("deleting an already-removed order → 404",del2.status===404,`status=${del2.status}`);
// delete requires auth
const noauth=await fetch(BASE+`/api/admin/orders/whatever`,{method:"DELETE",headers:{origin:BASE}});
rec("delete without auth is rejected (401)",noauth.status===401,`status=${noauth.status}`);

console.log(`\n${out.filter(Boolean).length}/${out.length} checks passed`);
process.exit(out.every(Boolean)?0:1);
