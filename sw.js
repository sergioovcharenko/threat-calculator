self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    const clients=await self.clients.matchAll({type:'window'});
    for(const c of clients) c.navigate(c.url);
    await self.registration.unregister();
  })());
});
