const C="dayplan-v1",A=["./","./index.html","./app.js","./schedule.js","./manifest.json","./icon-180.png","./icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const u=new URL(e.request.url);
if(u.pathname.endsWith("/schedule.js")||u.pathname.endsWith("/app.js")){e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(C).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)));return}
e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request).then(r=>{const y=r.clone();caches.open(C).then(c=>c.put(e.request,y));return r})))});
