const V='mi-espacio-v1',SHELL=['./','index.html','manifest.json','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!='GET')return;
e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{const n=fetch(r).then(x=>{if(x&&(x.ok||x.type=='opaque'))caches.open(V).then(c=>c.put(r,x.clone()));return x}).catch(()=>m||caches.match('index.html'));return m||n}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l.length?l[0].focus():clients.openWindow('./')))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){}e.waitUntil(self.registration.showNotification(d.title||'Mi espacio',{body:d.body||'',icon:'icons/icon-192.png'}))});
