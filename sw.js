const CACHE_NAME='itp-v230.12.26-core';
const CORE_ASSETS=['./','./index.html','./manifest.json','./sw.js','./qa.html','./qa/location-regression-cases.json','./qa/20-location-manual-regression.md','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  if(event.request.mode==='navigate' || event.request.destination==='document'){
    const requestUrl=new URL(event.request.url);
    const relativePath=requestUrl.pathname.endsWith('/qa.html')?'./qa.html':requestUrl.pathname.endsWith('/index.html')?'./index.html':'./index.html';
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      if(response.ok) caches.open(CACHE_NAME).then(cache=>cache.put(relativePath,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match(relativePath).then(cached=>cached||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>cached)));
});