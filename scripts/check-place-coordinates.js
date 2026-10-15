#!/usr/bin/env node
// Offline coordinate integrity regression. Run: node scripts/check-place-coordinates.js
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('const places=');
const graphStart=html.indexOf('const graph=',start);
const end=graphStart>start?html.lastIndexOf(';',graphStart):-1;
const match=start>=0&&end>start?[null,html.slice(start+'const places='.length,end).trim()]:null;
assert(match,'places catalogue not found');
const places=JSON.parse(match[1]);
const audit=JSON.parse(fs.readFileSync('qa/all-place-coordinate-audit.json','utf8'));
const scenarios=JSON.parse(fs.readFileSync('qa/location-regression-cases.json','utf8'));
const ids=new Set();
const errors=[];
for(const p of places){
 if(ids.has(p.id))errors.push('duplicate id '+p.id);
 ids.add(p.id);
 if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))errors.push('missing/invalid coordinates '+p.id);
 if(p.lat<40.5||p.lat>42||p.lng<27.5||p.lng>30.5)errors.push('outside Istanbul broad bounds '+p.id);
}
const audited=new Map(audit.places.map(p=>[p.id,p]));
for(const p of places){
 const a=audited.get(p.id);
 if(!a)errors.push('not audited '+p.id);
 else if(a.lat!==p.lat||a.lng!==p.lng)errors.push('audit coordinate stale '+p.id);
}
if(audit.places.length!==places.length)errors.push('catalogue/audit count mismatch');
const coordinateGroups=new Map();
for(const p of places){const key=p.lat+','+p.lng;if(!coordinateGroups.has(key))coordinateGroups.set(key,[]);coordinateGroups.get(key).push(p.id);}
const actualPairs=[...coordinateGroups.entries()].filter(([,group])=>group.length>1).flatMap(([coordinates,group])=>group.slice(1).map(id=>({firstId:group[0],secondId:id,coordinates,overlapType:'requires-semantic-review'}))).map(p=>p.firstId+'|'+p.secondId+'|'+p.coordinates).sort();
const auditedPairs=(audit.duplicateCoordinatePairs||[]).map(p=>p.firstId+'|'+p.secondId+'|'+p.coordinates).sort();
if(JSON.stringify(actualPairs)!==JSON.stringify(auditedPairs))errors.push('duplicate coordinate report does not match current catalogue');
if(audit.summary?.duplicateCoordinatePairs!==actualPairs.length)errors.push('duplicate coordinate summary count stale');
for(const item of (audit.verifiedCoordinateCorrections||[])){const current=places.find(p=>p.id===item.id);if(!current||current.lat!==item.to?.lat||current.lng!==item.to?.lng)errors.push('verified correction does not match current catalogue '+item.id);}
for(const p of scenarios.locations){
 if(p.source==='existing-catalog' && ids.has(p.id)){
  const current=places.find(x=>x.id===p.id);
  if(current.lat!==p.lat||current.lng!==p.lng)errors.push('regression coordinate stale '+p.id);
 }
}
for(const route of scenarios.routeCases){
 if(!ids.has(route.from)||!ids.has(route.to))errors.push('route references missing card '+route.id);
}
console.log(JSON.stringify({cards:places.length,audited:audit.places.length,routeCases:scenarios.routeCases.length,errors},null,2));
if(errors.length)process.exitCode=1;
