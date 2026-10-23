import fs from 'node:fs';
import vm from 'node:vm';

const fail = [];
const pass = [];
const check = (name, condition, detail = '') => {
  (condition ? pass : fail).push(condition ? name : `${name}${detail ? `: ${detail}` : ''}`);
};
const read = path => fs.readFileSync(path, 'utf8');

const html = read('index.html');
const sw = read('sw.js');
const manifestText = read('manifest.json');
const qa = read('qa.html');
const regressionText = read('qa/location-regression-cases.json');
let regression = null;
try { regression = JSON.parse(regressionText); pass.push('manual regression dataset valid JSON'); }
catch (error) { fail.push(`manual regression dataset JSON: ${error.message}`); }


const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
check('index.html contains inline scripts', scripts.length > 0);
check('catalogue place IDs that overlap rail nodes retain place access routing', html.includes('if(isKnownRailStationNode(b) && !bObj)'));
check('physical ferry origins always retain an explicit ferry access step', html.includes("if(access.mode==='Vapur') return true;"));
check('Üsküdar ferry–Marmaray interchange is validated in both directions', html.includes("'Vapur|Marmaray':['uskudar']") && html.includes("'Marmaray|Vapur':['uskudar']"));
check('ferry-start instruction uses its configured access hub, not a hardcoded Kadıköy label',
  html.includes("prefix=[[a,startAccess.station,'Vapur",) &&
  html.includes("iskelesinden <b>\u0024{startAccess.label||nodeLabel(startAccess.station)}</b> yönüne giden vapur/motora bin.") &&
  !html.includes("iskelesinden <b>Kadıköy</b> yönüne giden vapur/motora bin.") );
scripts.forEach((source, index) => {
  try { new vm.Script(source, { filename: `index.html:inline-${index + 1}` }); }
  catch (error) { fail.push(`inline script ${index + 1} syntax: ${error.message}`); }
});
try { new vm.Script(sw, { filename: 'sw.js' }); pass.push('sw.js syntax'); }
catch (error) { fail.push(`sw.js syntax: ${error.message}`); }
try { JSON.parse(manifestText); pass.push('manifest.json valid JSON'); }
catch (error) { fail.push(`manifest.json: ${error.message}`); }

// Static ID checks must ignore scripts: template literals contain placeholders
// such as id="${p.id}" that are not literal IDs in the initial HTML DOM.
const staticMarkup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
                         .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
const ids = [...staticMarkup.matchAll(/\bid=["']([^"'$]+)["']/g)].map(m => m[1]);
const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
check('no duplicate static HTML IDs', duplicates.length === 0, duplicates.join(', '));
const idSet = new Set(ids);
// These IDs are intentionally created by render()/safeCards() template strings,
// so they are valid runtime nodes even though they are absent from initial markup.
const dynamicIds = new Set(['startPlaceSearch', 'targetPlaceSearch', 'uiRecoveryPlaceSearch']);
const refs = [...html.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const missing = [...new Set(refs.filter(id => !idSet.has(id) && !dynamicIds.has(id)))];
check('getElementById references resolve (including documented dynamic IDs)', missing.length === 0, missing.join(', '));

const required = [
  ['async GPS callback', 'getCurrentPosition(async pos=>{'],
  ['card renderer', 'function render()'],
  ['fallback card renderer', 'function safeCards()'],
  ['place search', 'uiRecoveryPlaceSearch'],
  ['Europe filter', 'data-filter="Avrupa Yakası"'],
  ['Anatolia filter', 'data-filter="Anadolu Yakası"'],
  ['city discovery tab', 'cityTab.onclick=function'],
  ['ticket help tab', 'ticketTab.onclick=function'],
  ['transport map', 'function openTransportMap'],
  ['GPS live station registry', 'GetStations'],
  ['last-mile bus registry', 'lastMileBusRegistry'],
];
for (const [name, needle] of required) check(name, html.includes(needle));

try {
  const inline = [...qa.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  inline.forEach((source, index) => new vm.Script(source, { filename: `qa.html:inline-${index + 1}` }));
  pass.push('qa.html inline script syntax');
} catch (error) { fail.push(`qa.html syntax: ${error.message}`); }

check('QA harness checks initial place cards and visibility', qa.includes('Başlangıç konum kartları ilk açılışta çiziliyor ve görünür'));
check('QA harness checks visible place search', qa.includes('Semt/turistik yer arama alanı DOM içinde ve görünür'));
check('QA harness checks build badge consistency', qa.includes('Canlı build rozeti HTML build kimliğiyle eşleşiyor'));
check('QA harness checks place-search filtering', qa.includes('Yer araması sonuç listesini filtreliyor'));
check('QA harness checks Anadolu filter results', qa.includes('Anadolu Yakası filtresi doğru kartları gösteriyor'));
check('QA harness checks Avrupa filter results', qa.includes('Avrupa Yakası filtresi doğru kartları gösteriyor'));
check('QA harness checks discovery panel', qa.includes('Şehri Keşfet paneli açılıp kapanıyor'));
check('QA harness checks discovery category cards', qa.includes('Şehri Keşfet kategorisi gerçek kartlar üretiyor'));
check('QA harness checks ticket panel', qa.includes('Bilet yardım paneli açılıp kapanıyor'));
check('QA harness checks transport map', qa.includes('Ulaşım haritası açılıp kapanıyor'));
check('service worker cache is versioned', /CACHE_NAME='itp-v230\.12\.\d+(?:-[a-z0-9]+)?-core'/.test(sw));
const build = (html.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || '';
const buildMinor = build.match(/V230\.12\.(\d+)/);
const cacheMinor = sw.match(/CACHE_NAME='itp-v230\.12\.(\d+)(?:-[a-z0-9]+)?-core'/);
check('build ID and service-worker cache version match', !!buildMinor && !!cacheMinor && buildMinor[1] === cacheMinor[1], `build=${build}; cache=${(cacheMinor||[])[1]||'missing'}`);


if (regression) {
  check('manual regression contains at least 55 places', Array.isArray(regression.locations) && regression.locations.length >= 55, String(regression.locations?.length));
  check('manual regression contains at least 51 route cases', Array.isArray(regression.routeCases) && regression.routeCases.length >= 54, String(regression.routeCases?.length));
  check('manual regression title matches actual location count', regression.title?.includes(`${regression.locations?.length}-place manual regression set`) === true, String(regression.title));
  check('manual regression guide matches actual location and route counts', read('qa/20-location-manual-regression.md').includes(`# ${regression.locations?.length}-place / ${regression.routeCases?.length}-route manual regression`));
  const locationIds = new Set((regression.locations || []).map(place => place.id));
  check('manual regression location IDs are unique', locationIds.size === regression.locations?.length);
  check('all manual route endpoints reference known locations', (regression.routeCases || []).every(route => locationIds.has(route.from) && locationIds.has(route.to)));
  check('no paid API is required for manual regression', regression.policy?.noPaidApi === true);
  check('manual regression forbids invented ETAs', regression.policy?.noInventedEtas === true);
  check('manual regression has release gate documentation', read('qa/20-location-manual-regression.md').includes('Release gate'));
  const catalogMatch = html.match(/const places=(\[[\s\S]*?\]);?\s*(?:const |function )/);
  let catalog = null;
  try { if (catalogMatch) catalog = JSON.parse(catalogMatch[1]); } catch {}
  check('place catalogue can be parsed for regression cross-check', Array.isArray(catalog));
  if (catalog) {
    const catalogById = new Map(catalog.map(place => [place.id, place]));
    const inCatalog = regression.locations.filter(place => place.source === 'existing-catalog');
    check('all marked catalogue places exist by ID', inCatalog.every(place => catalogById.has(place.id)));
    check('catalogue coordinates match regression fixture', inCatalog.every(place => {
      const current = catalogById.get(place.id);
      return current && current.lat === place.lat && current.lng === place.lng;
    }));
    check('business gap probes are explicitly marked', regression.locations.filter(place => place.source === 'business-directory-not-in-catalog').length === 4);
    const businessGaps = regression.locations.filter(place => place.source === 'business-directory-not-in-catalog');
    check('business gap probes have an address and coordinate provenance', businessGaps.every(place => typeof place.address === 'string' && place.address.length > 10 && Number.isFinite(place.lat) && Number.isFinite(place.lng) && Array.isArray(place.sources) && place.sources.length > 0 && typeof place.coordinateStatus === 'string'));
    const expectedIntegratedBusinessIds = ['four_seasons_sultanahmet', 'karakoy_lokantasi', 'ciya_sofrasi'];
    check('verified business records are integrated into the production catalogue', expectedIntegratedBusinessIds.every(id => catalogById.has(id)));
    check('integrated business coordinates exactly match sourced fixtures', expectedIntegratedBusinessIds.every(id => {
      const current = catalogById.get(id), fixture = regression.locations.find(place => place.id === id);
      return !!current && !!fixture && current.lat === fixture.lat && current.lng === fixture.lng && current.name === fixture.name;
    }));
    check('approximate Faros coordinates remain excluded from production catalogue', !catalogById.has('faros_karakoy'));
    const selectionStart = html.slice(html.indexOf('function selectStart(id)'), html.indexOf('function newRoute()', html.indexOf('function selectStart(id)')));
    const selectionTarget = html.slice(html.indexOf('function selectDestination(id)'), html.indexOf('function selectTargetStation(id)', html.indexOf('function selectDestination(id)')));
    check('start selection hands canonical catalogue record to router state', selectionStart.includes('start=nextStart') && selectionStart.includes('lat') === false);
    check('destination selection resolves a canonical catalogue record before routing', selectionTarget.includes('const target=places.find(p=>p.id===id)') && selectionTarget.includes('selectedTarget=target') && selectionTarget.includes('buildRouteToTarget(target)'));

  }
}

const forestAccessRows = [...html.matchAll(/ataturk_kent_ormani:\{station:'haciosman_hub',mode:'M2 Metro',label:'Hacıosman M2',stationOnly:true,walkMinutes:8\}/g)];
check('Atatürk Kent Ormanı start/end access both use Hacıosman M2 and 8-minute walk', forestAccessRows.length === 2);
check('Atatürk Kent Ormanı legacy last-mile walk time matches the 8-minute access record', /ataturk_kent_ormani:\s*8\s*,/.test(html));


const railSectionForNodeAudit = html.slice(html.indexOf('const railLines={'), html.indexOf('const lineTerminals', html.indexOf('const railLines={')));
const parsedLinesForNodeAudit = [...railSectionForNodeAudit.matchAll(/'([^']+)'\s*:\s*\{\s*order:\[([^\]]*)\]/g)]
  .map(match => ({ name: match[1], nodes: [...match[2].matchAll(/'([^']+)'/g)].map(node => node[1]) }));
const nodeLinesForAudit = new Map();
for (const line of parsedLinesForNodeAudit) for (const node of line.nodes) {
  if (!nodeLinesForAudit.has(node)) nodeLinesForAudit.set(node, []);
  nodeLinesForAudit.get(node).push(line.name);
}
const transferTextForNodeAudit = html.slice(html.indexOf('const transferStations={'), html.indexOf('};', html.indexOf('const transferStations={')) + 2);
const transferPairsForNodeAudit = new Map([...transferTextForNodeAudit.matchAll(/'([^']+)\|([^']+)'\s*:\s*\[([^\]]*)\]/g)]
  .map(match => [match[1] + '|' + match[2], new Set([...match[3].matchAll(/'([^']+)'/g)].map(node => node[1]))]));
const undeclaredSharedNodes = [];
for (const [node, modes] of nodeLinesForAudit) {
  for (let i = 0; i < modes.length; i++) for (let j = i + 1; j < modes.length; j++) {
    const a = modes[i], b = modes[j];
    if (!transferPairsForNodeAudit.get(a + '|' + b)?.has(node) && !transferPairsForNodeAudit.get(b + '|' + a)?.has(node)) undeclaredSharedNodes.push({node,a,b});
  }
}
check('all shared rail-node IDs have an explicit transfer declaration', undeclaredSharedNodes.length === 0, JSON.stringify(undeclaredSharedNodes));
const metrobusBlockForAudit = railSectionForNodeAudit.slice(railSectionForNodeAudit.indexOf("'Metrobüs': {"), railSectionForNodeAudit.indexOf("'M4 Metro':"));
const m7BlockForAudit = railSectionForNodeAudit.slice(railSectionForNodeAudit.indexOf("'M7 Metro': {"), railSectionForNodeAudit.indexOf("'M9 Metro':"));
const marmarayBlockForAudit = railSectionForNodeAudit.slice(railSectionForNodeAudit.indexOf("'Marmaray': {"), railSectionForNodeAudit.indexOf("'M5 Metro':"));
check('Bayrampaşa Metrobüs and M1A/M1B use separate node IDs', metrobusBlockForAudit.includes('bayrampasa_mb') && !metrobusBlockForAudit.includes('bayrampasa_hub'));
check('M5 and M7 Veysel Karani stations use separate node IDs', m7BlockForAudit.includes('veysel_karani_m7') && !m7BlockForAudit.includes("'veysel_karani'"));
check('Marmaray omits Zeytinburnu and separates same-name M4 nodes', !marmarayBlockForAudit.includes('zeytinburnu_hub') && marmarayBlockForAudit.includes('bostanci_m') && marmarayBlockForAudit.includes('kartal_m') && marmarayBlockForAudit.includes('pendik_m'));


  const pendikHotelAccess = html.match(/the_green_park_pendik:\{station:'([^']+)',mode:'([^']+)',label:'([^']+)'/);
  check('The Green Park Pendik uses Kaynarca Marmaray access', !!pendikHotelAccess && pendikHotelAccess[1] === 'kaynarca_m' && pendikHotelAccess[2] === 'Marmaray' && pendikHotelAccess[3] === 'Kaynarca Marmaray', JSON.stringify(pendikHotelAccess?.slice(1)));
  check('The Green Park Pendik walking access targets Kaynarca Marmaray', html.includes("hotelWalkingAccessText('The Green Park Pendik','40.87251,29.25102','Kaynarca Marmaray',6)"));
check('known Green Park hotel last-mile walks are included in ETA calculation', html.includes("'bostanci|the_green_park_bostanci': 10") && html.includes("'kaynarca_m|the_green_park_pendik': 6"));
check('unverified final walking duration is excluded from the displayed journey ETA', html.includes('hasUnverifiedFinalAccess=true') && html.includes('Tahmin · son erişim hariç'));
check('M11 and Marmaray ETA use calibrated full-line timings', html.includes("'M11 Metro':64,'Marmaray':108"));
check('browser QA covers long-distance airport ETA sanity checks', read('scripts/browser-qa.mjs').includes('M11 Gayrettepe → İstanbul Havalimanı ETA') && read('scripts/browser-qa.mjs').includes('Marmaray Pendik → Yenikapı ETA'));
  check('Green Park Bostancı → Yeldeğirmeni route fixtures exist', regression.routeCases.some(x=>x.id==='R53'&&x.from==='the_green_park_bostanci'&&x.to==='yeldegirmeni'));
check('Green Park Bostancı → Pendik route fixture exists', regression.routeCases.some(x=>x.id==='R54'&&x.from==='the_green_park_bostanci'&&x.to==='the_green_park_pendik'));
check('Havaist Sultanahmet airport alternative uses official stop and timetable with unknown-duration metadata', html.includes('function havaistSultanahmetAirportCandidate') && html.includes('Çatladıkapı Nikah Sarayı Karşısı İETT Durağı (Sultanahmet)') && html.includes('web.hava.ist/sefer-saatleri.php') && html.includes('durationUnknown:true'));
check('unknown-duration Havaist candidates rank behind known-duration routes', html.includes('function routeHasUnknownDuration(path)') && html.includes('if(aUnknown!==bUnknown) return aUnknown ? 1 : -1;'));
check('browser QA checks Havaist alternative in both directions', read('scripts/browser-qa.mjs').includes("Havaist airport alternative '+direction+' direction is source-backed and duration-safe"));

check('Galata has a ferry-only access override that preserves rail access elsewhere', html.includes("ferryEndAccessOverrides") && html.includes("galata:{station:'karakoy',mode:'Vapur',label:'Karaköy İskelesi',local:true,direct:false}"));
check('Galata route branch evaluates ferry alternative before rail-only fallback', html.includes("if(b==='galata'){\n     const ferryCandidate=multimodalFerryCandidate(a,b);\n     if(ferryCandidate) return ferryCandidate.path;\n   }"));
check('browser QA guards Moda Sahili → Galata ferry and final-mile behavior', read('scripts/browser-qa.mjs').includes('R31 Moda Sahili → Galata offers the Moda–Karaköy ferry and explicit Galata last mile'));
console.log(`Static QA: ${pass.length} passed, ${fail.length} failed`);
for (const name of pass) console.log(`PASS  ${name}`);
for (const name of fail) console.error(`FAIL  ${name}`);
if (fail.length) process.exitCode = 1;
