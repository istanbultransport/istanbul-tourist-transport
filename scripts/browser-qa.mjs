import { chromium } from 'playwright';
import fs from 'node:fs';

const failures = [];
const passed = [];
const record = (name, ok, detail = '') => (ok ? passed : failures).push(ok ? name : `${name}: ${detail}`);
const read = p => fs.readFileSync(p, 'utf8');
const cases = JSON.parse(read('qa/location-regression-cases.json'));
const coordinateAudit = JSON.parse(read('qa/all-place-coordinate-audit.json'));
const appHtml = read('index.html');
const htmlBuild = (appHtml.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || '';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.route('**/sw.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* service worker disabled in deterministic test */' }));
  await page.goto('http://127.0.0.1:4173/index.html?qa=ci', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#list .place[data-id]', { timeout: 15000 });
  record('mobile viewport renders place cards', await page.locator('#list .place[data-id]').count() > 0);
  record('build marker present in browser', await page.locator('meta[name="build-id"]').getAttribute('content') === htmlBuild);

  for (const id of ['four_seasons_sultanahmet','karakoy_lokantasi','ciya_sofrasi']) {
    const count = await page.locator('#list .place[data-id="'+id+'"]').count();
    record('catalogue renders '+id, count === 1, 'count='+count);
  }
  record('Faros unverified business excluded', await page.locator('#list .place[data-id="faros_karakoy"]').count() === 0);

  const filter = page.locator('.filter[data-filter="Anadolu Yakası"]');
  await filter.click();
  let sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('Anatolia filter updates rendered cards', sides.length > 0 && sides.every(s => s.includes('Anadolu Yakası')));
  await page.locator('.filter[data-filter="Avrupa Yakası"]').click();
  sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('Europe filter updates rendered cards', sides.length > 0 && sides.every(s => s.includes('Avrupa Yakası')));
  await page.locator('.filter[data-filter="Tümü"]').click();

  const search = page.locator('#startPlaceSearch');
  await search.fill('Karaköy Lokantası');
  const searchCount = await page.locator('#list .place[data-id]').count();
  record('business search filters by exact name', searchCount === 1 && await page.locator('#list .place[data-id]').getAttribute('data-id') === 'karakoy_lokantasi');
  await page.locator('#startPlaceSearch').fill('');
  // Reassert the all-places filter and wait for the debounced search results before
  // selecting the next route; without this synchronization the initial route click
  // can race the list refresh in CI.
  await page.locator('.filter[data-filter="Tümü"]').click();
  await page.waitForFunction(() =>
    document.querySelector('#list .place[data-id="kadikoy_carsi"]') !== null,
    null,
    { timeout: 10000 }
  );

  // Select canonical origin/target through the UI and assert the JS state retained IDs/coordinates.
  await page.locator('#list .place[data-id="kadikoy_carsi"]').click();
  await page.locator('#list .place[data-id="ciya_sofrasi"]').click();
  const selected = await page.evaluate(() => ({
    start: { id: typeof start!=='undefined'?start?.id:null, lat: typeof start!=='undefined'?start?.lat:null, lng: typeof start!=='undefined'?start?.lng:null },
    target: { id: typeof selectedTarget!=='undefined'?selectedTarget?.id:null, lat: typeof selectedTarget!=='undefined'?selectedTarget?.lat:null, lng: typeof selectedTarget!=='undefined'?selectedTarget?.lng:null },
    routeVisible: getComputedStyle(document.getElementById('route')).display !== 'none'
  }));
  record('origin ID and coordinates preserved through UI selection', selected.start.id === 'kadikoy_carsi' && Number.isFinite(selected.start.lat) && Number.isFinite(selected.start.lng), JSON.stringify(selected.start));
  record('target ID and coordinates preserved through UI selection', selected.target.id === 'ciya_sofrasi' && Number.isFinite(selected.target.lat) && Number.isFinite(selected.target.lng), JSON.stringify(selected.target));
  record('route output shown after destination click', selected.routeVisible);

  // Responsive acceptance matrix: run the real selected-route screen at common
  // narrow phone, standard phone, tablet and desktop viewport widths.
  for (const viewport of [
    { width: 320, height: 720, label: 'small phone' },
    { width: 360, height: 800, label: 'Android phone' },
    { width: 390, height: 844, label: 'iPhone-sized phone' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 1024, height: 768, label: 'small laptop' },
    { width: 1365, height: 900, label: 'desktop' }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const layout = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      routeVisible: getComputedStyle(document.getElementById('route')).display !== 'none'
    }));
    record('responsive layout '+viewport.label+' ('+viewport.width+'px)',
      layout.document <= layout.viewport + 1 && layout.body <= layout.viewport + 1 && layout.routeVisible,
      JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'browser-qa-mobile.png', fullPage: true });
  record('no uncaught browser console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));

  // Route-engine fixture regression, run against the actual in-page data/graph.
  for (const item of cases.routeCases) {
    const result = await page.evaluate(({ from, to }) => {
      const hasId = id => typeof places!=='undefined' && Array.isArray(places) && places.some(p => p.id === id);
      if (!hasId(from) || !hasId(to)) return { ok:false,reason:'endpoint missing' };
      let path = route(from,to);
      if (!path) path = minimumRailRoute(from,to,4,null,null);
      if (!path) {
        const candidates = generateRouteCandidates(from,to);
        path = selectBestRoute(candidates)?.path || candidates?.[0]?.path || null;
      }
      if (!Array.isArray(path) || !path.length) return { ok:false,reason:'route missing' };
      const validation = validateRoute(path);
      return { ok:validation.ok,reason:validation.reason,steps:path.length,modes:path.map(s=>s[2]),path:path.map(s=>[s[0],s[1],s[2]]),finalMile:path.some(s=>s[2]==='Son ulaşım'),walk:path.some(s=>s[2]==='Yürüyüş') };
    }, item);
    record('route fixture '+item.id, result.ok === true, result.reason || JSON.stringify(result));
    if (item.id === 'R48') {
      const ferryLeg = result.path.find(step => step[0] === 'kanlica' && step[2] === 'Vapur');
      record('R48 Kanlıca → Bostancı preserves the Kanlıca → Üsküdar ferry leg and names the correct hub',
        result.path[0]?.[0] === 'kanlica' &&
        !!ferryLeg && ferryLeg[1] === 'uskudar' &&
        String(ferryLeg[3]).includes('Üsküdar') &&
        !String(ferryLeg[3]).includes('Kadıköy'),
        JSON.stringify(result.path));
    }
  }
  // Audit the shared ferry-start access formatter across every catalogue place
  // that resolves to a Vapur start access and can reach Bostancı by rail.
  const ferryStartAudit = await page.evaluate(() => {
    return places.filter(p => p.id !== 'bostanci' && getStartRailAccess(p.id)?.mode === 'Vapur')
      .map(p => {
        const access = resolveStationAccess(p.id, 'bostanci');
        const path = minimumRailRoute(p.id, 'bostanci', 4);
        if (!access || !path || path[0]?.[2] === 'Yürüyüş') {
          return { id:p.id, skipped:true, reason:!path?'no rail path':'direct/short-walk access' };
        }
        const step = path.find(s => s[0] === p.id && s[2] === 'Vapur');
        const expected = access.label || nodeLabel(access.station);
        return {
          id:p.id, expected, station:access.station,
          ok:!!step && path[0]?.[0] === p.id && step[1] === access.station &&
             String(step[3]).includes(expected) &&
             (!String(step[3]).includes('Kadıköy') || expected.includes('Kadıköy')),
          text:step?.[3] || ''
        };
      });
  });
  const checkedFerryStarts = ferryStartAudit.filter(x => !x.skipped);
  record('all routed ferry-start instructions match their configured access hub',
    checkedFerryStarts.length > 0 && checkedFerryStarts.every(x => x.ok),
    JSON.stringify({checked:checkedFerryStarts.length, failures:checkedFerryStarts.filter(x=>!x.ok), skipped:ferryStartAudit.filter(x=>x.skipped).length}));

  // Full end-to-end user flow for every fixture: reset -> search/select origin ->
  // search/select destination -> wait for the rendered route -> assert canonical IDs.
  // This intentionally drives the actual mobile UI rather than invoking the router directly.
  for (const item of cases.routeCases) {
    try {
      const names = await page.evaluate(({ from, to }) => ({
        from: places.find(p => p.id === from)?.name || null,
        to: places.find(p => p.id === to)?.name || null
      }), item);
      if (!names.from || !names.to) {
        record('UI route flow '+item.id, false, 'catalogue name missing: '+JSON.stringify(names));
        continue;
      }
      await page.evaluate(() => newRoute());
      await page.locator('#startPlaceSearch').fill(names.from);
      await page.locator('#list .place[data-id="'+item.from+'"]').click({ timeout: 7000 });
      await page.locator('#targetPlaceSearch').fill(names.to);
      await page.locator('#list .place[data-id="'+item.to+'"]').click({ timeout: 7000 });
      await page.waitForFunction(({ to }) =>
        typeof selectedTarget !== 'undefined' &&
        selectedTarget?.id === to &&
        getComputedStyle(document.getElementById('route')).display !== 'none',
        { to: item.to },
        { timeout: 20000 }
      );
      const flow = await page.evaluate(() => ({
        from: start?.id || null,
        to: selectedTarget?.id || null,
        routeText: document.getElementById('route')?.innerText?.trim() || '',
        routeHtml: document.getElementById('route')?.innerHTML || '',
        stepCards: document.querySelectorAll('#route .step').length,
        summaryLabels: [...document.querySelectorAll('#route .route-summary .route-stat span')].map(n => n.textContent.trim()),
        headingStepLabel: document.querySelector('#route .routehead .pill')?.textContent?.trim() || '',
        summaryStepCount: Number(document.querySelectorAll('#route .route-summary .route-stat b')[2]?.textContent || NaN)
      }));
      const hasJourneySummary = ['Tahmini yolculuk','aktarma','ulaşım adımı'].every(label => flow.summaryLabels.includes(label));
      const headingStepMatch = flow.headingStepLabel.match(/^(\d+)\s+ULAŞIM ADIMI$/i);
      const stepCountConsistent = headingStepMatch
        ? Number(headingStepMatch[1]) === flow.summaryStepCount
        : flow.headingStepLabel === 'PRATİK ROTA';
      const valid = flow.from === item.from && flow.to === item.to &&
        flow.routeText.length > 0 && flow.routeHtml.length > 0 &&
        flow.stepCards > 0 && hasJourneySummary && stepCountConsistent;
      if (item.id === 'R07') {
        const pendikBusValid = flow.routeText.includes('KM13') &&
          flow.routeText.includes('PENDİK YHT İSTASYONU') &&
          flow.routeText.includes('yürüme süresi doğrulanmadı') &&
          flow.routeHtml.includes('RouteDetail?hkod=KM13') &&
          flow.routeHtml.includes('StationDetail?dkod=227794');
        record('R07 Pendik YHT exposes official KM13 route and stop links without inventing walk time',
          pendikBusValid, flow.routeText.slice(-900));
      }
      record('UI route flow '+item.id, valid, JSON.stringify({
        expectedFrom: item.from, actualFrom: flow.from,
        expectedTo: item.to, actualTo: flow.to,
        stepCards: flow.stepCards, summaryLabels: flow.summaryLabels,
        headingStepLabel: flow.headingStepLabel, summaryStepCount: flow.summaryStepCount,
        routeText: flow.routeText.slice(0, 240)
      }));
      if(item.id==='R13'){
        const hotelAccessDisclosed = flow.routeText.includes('Four Seasons Hotel Istanbul at Sultanahmet') &&
          flow.routeText.includes('Sultanahmet T1') &&
          flow.routeText.includes('Yürüme süresi ve gerçek giriş-çıkış güzergâhı bağımsız olarak doğrulanmadı') &&
          flow.routeHtml.includes('origin=Four%20Seasons') &&
          flow.routeHtml.includes('destination=Sultanahmet%20T1');
        record('R13 Four Seasons access discloses unverified walk time and provides explicit hotel-to-station map route',
          hotelAccessDisclosed, flow.routeText.slice(0,1000));
      }
      if(['R04','R15','R20','R26','R27'].includes(item.id)){
        const expectedOrigin = item.from === 'ciya_sofrasi'
          ? 'origin=%C3%87iya%20Sofras%C4%B1'
          : 'origin=Karak%C3%B6y%20Lokantas%C4%B1';
        const restaurantAccess = flow.routeText.includes('Restoran girişinden durağa yürüme süresi ve kesin yaya güzergâhı bağımsız olarak doğrulanmadı') &&
          flow.routeHtml.includes('travelmode=walking') &&
          flow.routeHtml.includes('yaya rotasını haritada kontrol et') &&
          flow.routeHtml.includes(expectedOrigin);
        record(item.id+' restaurant origin discloses unverified walk time and provides correct walking map link',
          restaurantAccess, flow.routeText.slice(0,900));
      }
      if(item.id==='R24'){
        const km46Access = flow.routeText.includes('KM46') &&
          flow.routeText.includes('Kozyatağı Metro (225653)') &&
          flow.routeText.includes('ring olarak çalışır') &&
          flow.routeHtml.includes('RouteDetail?hkod=KM46') &&
          flow.routeHtml.includes('StationDetail?dkod=225653');
        record('R24 Radisson access names official KM46 route and the exact alighting stop',
          km46Access, flow.routeText.slice(0,1300));
      }
      if(item.id==='R21'){
        const routeSummary=flow.routeText.split('🧭 Yolculuk özeti')[1]?.split('🔄 Aktarmada ne yapacaksın?')[0]||'';
        const verifiedMarriottAccess=flow.routeText.includes('Kozyatağı M8') && flow.routeText.includes('7 dakika') &&
          !flow.routeText.includes('13 dakika yürüyün') && !routeSummary.includes('Kozyatağı M4\n↓\nKozyatağı M4');
        record('R21 preserves verified Marriott-to-M8 access and avoids duplicate station summary',verifiedMarriottAccess,flow.routeText.slice(0,1200));
      }
    } catch (error) {
      record('UI route flow '+item.id, false, error.message);
    }
  }
  record('all end-to-end UI route flows loaded', Array.isArray(cases.routeCases) && cases.routeCases.length === 49, 'count='+cases.routeCases.length);

  record('all route fixtures loaded', Array.isArray(cases.routeCases) && cases.routeCases.length === 49, 'count='+cases.routeCases.length);

  // Atatürk Kent Ormanı: the Hacıosman M2 access is roughly an 8-minute walk, not 1 minute.
  const forestRouteAudit = await page.evaluate(() => {
    const resolve = (from, to) => {
      let path = route(from, to);
      if (!path) path = minimumRailRoute(from, to, 4);
      if (!path) {
        const candidates = generateRouteCandidates(from, to);
        path = selectBestRoute(candidates)?.path || candidates?.[0]?.path || null;
      }
      return path;
    };
    const forward = resolve('istanbul-airport', 'ataturk_kent_ormani');
    const reverse = resolve('ataturk_kent_ormani', 'istanbul-airport');
    const access = getEndAccess('ataturk_kent_ormani');
    return {
      minutes: getLastMileWalkMinutes(access, 'ataturk_kent_ormani'),
      forward: forward?.map(s => ({ from:s[0], to:s[1], mode:s[2], text:String(s[3]||'') })) || null,
      reverse: reverse?.map(s => ({ from:s[0], to:s[1], mode:s[2], text:String(s[3]||'') })) || null
    };
  });
  const f = forestRouteAudit.forward || [];
  const r = forestRouteAudit.reverse || [];
  record('Atatürk Kent Ormanı access time is 8 minutes in target data',
    forestRouteAudit.minutes === 8, JSON.stringify({minutes:forestRouteAudit.minutes}));
  record('Airport → Atatürk Kent Ormanı uses M11 then M2 and an 8-minute final walk',
    f.some(s=>s.from==='istanbul-airport'&&s.to==='gayrettepe'&&s.mode==='M11 Metro') &&
    f.some(s=>s.from==='gayrettepe'&&s.to==='haciosman_hub'&&s.mode==='M2 Metro') &&
    f.some(s=>s.mode==='Son ulaşım'&&s.text.includes('8 dakika')),
    JSON.stringify(f.map(s=>({from:s.from,to:s.to,mode:s.mode,text:s.text.slice(0,100)}))));
  record('Atatürk Kent Ormanı → Airport starts with an 8-minute walk then M2 and M11',
    r[0]?.from==='ataturk_kent_ormani'&&r[0]?.to==='haciosman_hub'&&r[0]?.mode==='Yürüyüş'&&r[0]?.text.includes('8 dakika') &&
    r.some(s=>s.from==='haciosman_hub'&&s.to==='gayrettepe'&&s.mode==='M2 Metro') &&
    r.some(s=>s.from==='gayrettepe'&&s.to==='istanbul-airport'&&s.mode==='M11 Metro'),
    JSON.stringify(r.map(s=>({from:s.from,to:s.to,mode:s.mode,text:s.text.slice(0,100)}))));

  // Istanbul Modern's official visitor guide lists Tophane Tram Station at 250 m.
  const modernAccessAudit = await page.evaluate(() => {
    const access = getEndAccess('istanbul_modern');
    return {station:access?.station || null, mode:access?.mode || null,
      minutes:getLastMileWalkMinutes(access,'istanbul_modern')};
  });
  record('Istanbul Modern uses source-verified Tophane T1 and 4-minute access',
    modernAccessAudit.station === 'tophane_t1' && modernAccessAudit.mode === 'T1 Tramvay' && modernAccessAudit.minutes === 4,
    JSON.stringify(modernAccessAudit));

  // Access policy: walking remains acceptable through 16 minutes; >16 minutes must not be auto-started as a walk. Unknown durations and non-boarding walks must not qualify.
  const firstWalkPolicy = await page.evaluate(() => ({
    at15: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:15}],['station','next','M4 Metro','ride']]),
    at16: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:16}],['station','next','M4 Metro','ride']]),
    at17: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:17}],['station','next','M4 Metro','ride']]),
    nullDuration: shouldAutoStartFirstStationWalk([['qa_unknown_origin','qa_unknown_station','Yürüyüş','walk',{walkMinutes:null}],['qa_unknown_station','next','M4 Metro','ride']]),
    emptyDuration: shouldAutoStartFirstStationWalk([['qa_unknown_origin','qa_unknown_station','Yürüyüş','walk',{walkMinutes:''}],['qa_unknown_station','next','M4 Metro','ride']]),
    unknown: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{}],['station','next','M4 Metro','ride']]),
    noWalk: shouldAutoStartFirstStationWalk([['origin','station','M4 Metro','ride'],['station','next','Marmaray','ride']]),
    walkNotToBoarding: shouldAutoStartFirstStationWalk([['origin','place','Yürüyüş','walk',{walkMinutes:5}],['place','station','Yürüyüş','walk'],['station','next','M4 Metro','ride']])
  }));
  record('first-station walk auto-start includes 15 and exactly 16 minutes', firstWalkPolicy.at15 === true && firstWalkPolicy.at16 === true, JSON.stringify(firstWalkPolicy));
  record('first-station walk auto-start excludes over 16 / unknown / non-boarding walks',
    firstWalkPolicy.at17 === false && firstWalkPolicy.nullDuration === false &&
    firstWalkPolicy.emptyDuration === false && firstWalkPolicy.unknown === false &&
    firstWalkPolicy.noWalk === false && firstWalkPolicy.walkNotToBoarding === false,
    JSON.stringify(firstWalkPolicy));

  // Corrected POI targets must feed their exact coordinates into the walking-navigation URL.
  const coordinateTargetIds = ['anadolu_hisari','ayasofya','sultanahmet','kadikoy_carsi',
    'ataturk_kultur_merkezi_akm','taksim_meydani','mesher','ashkenazi_sinagogu',
    'galata_semt','tunel','rumelihisari','ortakoy','samatya','bostanci','taksim','eminonu','moda','karakoy'];
  for (const targetId of coordinateTargetIds) {
    const result = await page.evaluate(id => {
      const target = places.find(p => p.id === id);
      if (!target) return { ok:false, reason:'target missing' };
      const html = lastMileTargetNavigationHtml({ station:'uskudar', mode:'Vapur', label:'Üsküdar İskelesi' }, id, target.name);
      const href = (html.match(/href="([^"]+)"/) || [])[1];
      if (!href) return { ok:false, reason:'navigation link missing' };
      const url = new URL(href);
      const expected = target.lat + ',' + target.lng;
      return { ok:url.searchParams.get('destination') === expected, expected, actual:url.searchParams.get('destination') };
    }, targetId);
    record('POI walking navigation uses stored target coordinates '+targetId, result.ok === true, JSON.stringify(result));
  }

  // Run the app's own targeted route-engine acceptance suite, not only generic route existence.
  const engineAcceptance = await page.evaluate(() => {
    if (typeof window.v223AcceptanceQA !== 'function') return { status:'FAIL', reason:'suite not exposed', tests:[] };
    return window.v223AcceptanceQA();
  });
  record('route-engine targeted acceptance suite', engineAcceptance.status === 'PASS' &&
    Array.isArray(engineAcceptance.tests) && engineAcceptance.tests.length >= 13 &&
    engineAcceptance.tests.every(t => t.status === 'PASS'),
    JSON.stringify({status:engineAcceptance.status,tests:engineAcceptance.tests?.length,failures:engineAcceptance.failures}));

  const lastMileAcceptance = await page.evaluate(() => {
    if (typeof window.lastMilePresentationQA !== 'function') return { status:'FAIL', failures:[{name:'suite-not-exposed'}] };
    return window.lastMilePresentationQA();
  });
  record('last-mile 16-minute threshold and verified-bus suite',
    lastMileAcceptance.status === 'PASS' &&
    Array.isArray(lastMileAcceptance.tests) &&
    lastMileAcceptance.tests.length >= 15 &&
    lastMileAcceptance.tests.every(t => t.ok === true),
    JSON.stringify({status:lastMileAcceptance.status,tests:lastMileAcceptance.tests?.length,failures:lastMileAcceptance.failures}));

  // Deterministic network-failure and malformed-data cases for optional external APIs.
  const networkFailureContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const networkFailurePage = await networkFailureContext.newPage();
    await networkFailurePage.goto('http://127.0.0.1:4173/index.html?qa=network-failure', { waitUntil: 'domcontentloaded' });
    const networkState = await networkFailurePage.evaluate(async () => {
      const originalFetch = window.fetch;
      window.fetch = async () => { throw new TypeError('Failed to fetch (deterministic QA)'); };
      try {
        const liveStations = await fetchGpsStationCoordinates();
        const stationFallback = gpsStationCoordinates();
        const walking = await exactWalkingEstimate({ lat: 41, lng: 29 }, { lat: 41.01, lng: 29.01 });
        const unresolved = await resolvePlaceCoordinate({
          id: 'qa_network_failure_place',
          name: 'QA Missing Place',
          kind: 'Turistik nokta'
        });
        return {
          stationApiFailureUsesStaticFallback: liveStations.length === 0 && stationFallback.length > 0,
          walkingApiFailureUsesGeodesicFallback: walking?.source === 'fallback-geodesic-estimate' &&
            Number.isFinite(walking.minutes) && walking.minutes > 0,
          failedGeocodingDoesNotInventCoordinates: unresolved === null
        };
      } finally {
        window.fetch = originalFetch;
      }
    });
    record('station API network failure keeps audited static station coordinates',
      networkState.stationApiFailureUsesStaticFallback, JSON.stringify(networkState));
    record('walking API network failure uses explicit geodesic fallback',
      networkState.walkingApiFailureUsesGeodesicFallback, JSON.stringify(networkState));
    record('failed place geocoding remains unresolved instead of inventing coordinates',
      networkState.failedGeocodingDoesNotInventCoordinates, JSON.stringify(networkState));

    const malformedState = await networkFailurePage.evaluate(async () => {
      const originalFetch = window.fetch;
      window.fetch = async () => ({ ok: true, json: async () => ({ trip: { summary: { time: 'unknown', length: null } } }) });
      try {
        const walking = await exactWalkingEstimate({ lat: 41.02, lng: 29.02 }, { lat: 41.03, lng: 29.03 });
        return {
          malformedApiUsesFallback: walking?.source === 'fallback-geodesic-estimate' &&
            Number.isFinite(walking.minutes) && walking.minutes > 0
        };
      } finally {
        window.fetch = originalFetch;
      }
    });
    record('malformed walking API response uses fallback instead of crashing',
      malformedState.malformedApiUsesFallback, JSON.stringify(malformedState));
  } catch (error) {
    record('external API network/missing-data fallback checks', false, error.message);
  } finally {
    await networkFailureContext.close();
  }

  // Source-backed correction ledger IDs should all pass coordinate handoff.
  const correctionIds = coordinateAudit.verifiedCoordinateCorrections.map(item => item.id);
  const checkedIds = new Set(coordinateTargetIds);
  record('all source-backed coordinate corrections have navigation coverage',
    correctionIds.every(id => checkedIds.has(id)),
    'covered=' + [...checkedIds].filter(id => correctionIds.includes(id)).length + '/' + correctionIds.length);

  const accessAudit = await page.evaluate(() => {
    const gps = typeof staticGpsStationCoordinates === 'function' ? staticGpsStationCoordinates() : [];
    const exits = Object.values(stationExitRegistry || {}).flatMap(x => x.exits || []);
    const fake = [['pendik','pendik','M4 Metro',''],['pendik','pendik','Marmaray','']];
    const real = [['ayrilik','ayrilik','M4 Metro',''],['ayrilik','ayrilik','Marmaray','']];
    return {
      gpsOk: gps.length >= 10 && gps.every(x => Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng))) && gps.some(x => x.station === 'pendik' && x.mode === 'M4 Metro'),
      olimpiyatM11EntranceOk: (() => { const row = gps.find(x => x.station === 'olimpiyat' && x.mode === 'M11 Metro'); return !!row && row.label === 'Olimpiyatköy M11' && Math.abs(row.lat - 41.078967) < 0.000001 && Math.abs(row.lng - 28.768925) < 0.000001; })(),
      kagithaneM11EntranceOk: (() => { const row = gps.find(x => x.station === 'kagithane_hub' && x.mode === 'M11 Metro'); return !!row && row.label === 'Kağıthane M11' && Math.abs(row.lat - 41.08035) < 0.000001 && Math.abs(row.lng - 28.9756) < 0.000001; })(),
      kayasehirM11EntranceOk: (() => { const m11 = gps.find(x => x.station === 'kayasehir_hub' && x.mode === 'M11 Metro'); const m3 = gps.find(x => x.station === 'kayasehir_hub' && x.mode === 'M3 Metro'); return !!m11 && !!m3 && Math.abs(m11.lat - 41.117733) < 0.000001 && Math.abs(m11.lng - 28.765983) < 0.000001 && Math.hypot((m11.lat - m3.lat) * 111320, (m11.lng - m3.lng) * 111320 * Math.cos(m11.lat * Math.PI / 180)) > 100; })(),
      crossLineStationPairsOk: (() => {
        const pairs = [
          { station: 'ayrilik', a: 'M4 Metro', b: 'Marmaray', min: 0, max: 150 },
          { station: 'uskudar', a: 'M5 Metro', b: 'Marmaray', min: 0, max: 200 },
          { station: 'kartal_hub', a: 'M4 Metro', b: 'Marmaray', min: 500, max: Infinity },
          { station: 'pendik', a: 'M4 Metro', b: 'Marmaray', min: 500, max: Infinity }
        ];
        return pairs.every(pair => {
          const a = gps.find(row => row.station === pair.station && row.mode === pair.a);
          const b = gps.find(row => row.station === pair.station && row.mode === pair.b);
          if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return false;
          const meanLat = (a.lat + b.lat) / 2 * Math.PI / 180;
          const meters = Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(meanLat));
          return meters >= pair.min && meters <= pair.max;
        });
      })(),
      marmarayNodeChecksOk: (() => {
        const targets = [
          { station: 'pendik', lat: 40.88024, lng: 29.23165, tolerance: 20 },
          { station: 'erenkoy_m', lat: 40.97167, lng: 29.07638, tolerance: 10 },
          { station: 'sogutlucesme', lat: 40.99065, lng: 29.03791, tolerance: 75 },
          { station: 'ayrilik', lat: 41.00015, lng: 29.03010, tolerance: 60 }
        ];
        return targets.every(target => {
          const row = gps.find(item => item.station === target.station && item.mode === 'Marmaray');
          if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return false;
          const meanLat = (row.lat + target.lat) / 2 * Math.PI / 180;
          const meters = Math.hypot((row.lat - target.lat) * 111320, (row.lng - target.lng) * 111320 * Math.cos(meanLat));
          return meters <= target.tolerance;
        });
      })(),
      m11LinePairGeometryOk: (() => {
        const pairs = [
          { a: ['kagithane_hub','M7 Metro'], b: ['kagithane_hub','M11 Metro'], min: 200, max: 400 },
          { a: ['kayasehir_hub','M3 Metro'], b: ['kayasehir_hub','M11 Metro'], min: 150, max: 350 },
          { a: ['olimpiyat','M9 Metro'], b: ['olimpiyat','M11 Metro'], min: 0, max: 150 },
          { a: ['halkali_stadi_m11','M11 Metro'], b: ['olimpiyat','M11 Metro'], min: 500, max: Infinity }
        ];
        return pairs.every(pair => {
          const a = gps.find(row => row.station === pair.a[0] && row.mode === pair.a[1]);
          const b = gps.find(row => row.station === pair.b[0] && row.mode === pair.b[1]);
          if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return false;
          const meanLat = (a.lat + b.lat) / 2 * Math.PI / 180;
          const meters = Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(meanLat));
          return meters >= pair.min && meters <= pair.max;
        });
      })(),
      exitsOk: exits.length > 0 && exits.every(x => x.no !== undefined && !!x.name),
      exitSourcesOk: (() => {
        const officialUrl = 'https://www.metro.istanbul/dosyalar/bilgilendirme/Gece-Metrosu-Kapal%C4%B1-Giri%C5%9Fler.pdf';
        const sourced = exits.filter(x => x.source === 'Metro İstanbul PDF');
        return sourced.length === 80 && sourced.every(x => x.sourceUrl === officialUrl);
      })(),
      transferGuardOk: hasVerifiedTransitTransfers(fake) === false && hasVerifiedTransitTransfers(real) === true,
      falseWalkGuardOk: (touristWalkTime('uskudar','anadolu_hisari') == null) && (lastMileWalkMinutes.anadolu_hisari == null)
    };
  });
  record('GPS station coordinates have valid values', accessAudit.gpsOk);
  record('M11 Olimpiyatköy fallback targets geotagged entrance', accessAudit.olimpiyatM11EntranceOk);
  record('M11 Kağıthane fallback targets geotagged Entrance 1', accessAudit.kagithaneM11EntranceOk);
  record('M11 Kayaşehir entrance is distinct from M3 Kayaşehir Merkez', accessAudit.kayasehirM11EntranceOk);
  record('four same-name cross-line station coordinate pairs preserve correct geometry', accessAudit.crossLineStationPairsOk);
  record('four Marmaray station nodes remain within secondary-map tolerances', accessAudit.marmarayNodeChecksOk);
  record('four M11/M3/M7/M9 line-specific points preserve expected geometry', accessAudit.m11LinePairGeometryOk);
  record('station exit registry entries have names and IDs', accessAudit.exitsOk);
  record('Metro İstanbul exit records link authoritative source PDF', accessAudit.exitSourcesOk);
  record('unverified same-node transfer is blocked', accessAudit.transferGuardOk);
  record('unverified short walking link is not invented', accessAudit.falseWalkGuardOk);

  // Exercise browser geolocation permission with a deterministic mock near Pendik M4.
  const gpsContext = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 40.88839, longitude: 29.23817, accuracy: 20 } });
  try {
    const gpsPage = await gpsContext.newPage();
    await gpsPage.route('**/GetStations', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await gpsPage.goto('http://127.0.0.1:4173/index.html?qa=gps', { waitUntil: 'domcontentloaded' });
    await gpsPage.locator('#useCurrentLocationBtn').click();
    await gpsPage.waitForFunction(() => (typeof start !== 'undefined' && start?.isCurrentLocation === true) || (document.getElementById('locationStatus')?.textContent || '').includes('15 dakika yürüme'), { timeout: 12000 });
    const gpsState = await gpsPage.evaluate(() => ({ selected: start?.isCurrentLocation === true, lat: currentLocation?.lat, lng: currentLocation?.lng, station: currentLocationStation?.station, status: document.getElementById('locationStatus')?.textContent || '' }));
    record('GPS permission flow accepts browser geolocation and selects current location', gpsState.selected && Math.abs(gpsState.lat - 40.88839) < 0.001 && Math.abs(gpsState.lng - 29.23817) < 0.001, JSON.stringify(gpsState));
  } catch (error) {
    record('GPS permission flow browser smoke test', false, error.message);
  } finally {
    await gpsContext.close();
  }

  // Deterministic GPS failure cases: denied permission, unavailable fix, and timeout.
  for (const scenario of [
    { code: 1, name: 'GPS permission denied', expected: 'Konum izni verilmedi.' },
    { code: 2, name: 'GPS position unavailable', expected: 'GPS/Wi‑Fi bağlantını kontrol edip tekrar dene.' },
    { code: 3, name: 'GPS request timeout', expected: 'Konum isteği zaman aşımına uğradı.' }
  ]) {
    const failureContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const failurePage = await failureContext.newPage();
      await failurePage.addInitScript(code => {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: { getCurrentPosition(_success, error) { Promise.resolve().then(() => error({ code, message: 'deterministic QA error' })); } }
        });
      }, scenario.code);
      await failurePage.goto('http://127.0.0.1:4173/index.html?qa=gps-error', { waitUntil: 'domcontentloaded' });
      await failurePage.locator('#useCurrentLocationBtn').click();
      await failurePage.waitForFunction(expected => (document.getElementById('locationStatus')?.textContent || '').includes(expected), scenario.expected, { timeout: 5000 });
      const state = await failurePage.evaluate(() => ({
        status: document.getElementById('locationStatus')?.textContent || '',
        buttonEnabled: !document.getElementById('useCurrentLocationBtn')?.disabled
      }));
      record(scenario.name + ' shows actionable error and resets button',
        state.status.includes(scenario.expected) && state.buttonEnabled, JSON.stringify(state));
    } catch (error) {
      record(scenario.name + ' error handling', false, error.message);
    } finally {
      await failureContext.close();
    }
  }

  // Popup blockers may throw or return null; either way preserve the in-app walking link.
  for (const [blockMode,blockPopup] of [
    ['throws', () => { throw new Error('popup blocked by deterministic QA'); }],
    ['returns-null', () => null]
  ]) {
    const navFailureContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const navFailurePage = await navFailureContext.newPage();
      await navFailurePage.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
      const navState = await navFailurePage.evaluate(mode => {
        const route = document.getElementById('route');
        route.innerHTML = '<div class="timeline"><div class="step now"><a href="https://www.google.com/maps/dir/?api=1&destination=41.0%2C29.0">Yürü — hedefe navigasyonu aç</a></div></div>';
        route.style.display = 'block';
        window.__ITP_DISABLE_AUTO_WALK_NAV__ = false;
        window.open = mode === 'throws' ? () => { throw new Error('popup blocked by deterministic QA'); } : () => null;
        const path = [['origin','station','Yürüyüş','walk',{walkMinutes:5}],['station','next','M4 Metro','ride']];
        const returned = autoStartFirstStationNavigation(path);
        const link = document.querySelector('#route .timeline .step.now a');
        return { returned, focusedFallback: document.activeElement === link, linkAvailable: !!link?.href };
      }, blockMode);
      record('blocked external navigation (' + blockMode + ') leaves focused walking-link fallback',
        navState.returned === false && navState.focusedFallback && navState.linkAvailable, JSON.stringify(navState));
    } catch (error) {
      record('blocked external navigation fallback (' + blockMode + ')', false, error.message);
    } finally {
      await navFailureContext.close();
    }
  }

  // Panels/tabs should remain clickable on a narrow viewport.
  for (const [id,panelId,label] of [
    ['cityExploreTab','cityExplorePanel','city exploration panel'],
    ['ticketHelpTab','ticketHelpPanel','ticket help panel']
  ]) {
    const button = page.locator('#'+id), panel = page.locator('#'+panelId);
    await button.click();
    const opened = await panel.evaluate(el => el.classList.contains('open'));
    await button.click();
    record(label+' opens from mobile UI', opened);
  }

  // Verify service-worker install, core cache population and offline navigation.
  const sw = read('sw.js');
  const cacheName = (sw.match(/const CACHE_NAME='([^']+)'/) || [])[1] || '';
  record('versioned PWA cache matches the restaurant-and-bus-access release and includes QA fixtures',
    cacheName === 'itp-v230.12.37-kanlicaferrylabel-core' &&
    htmlBuild === 'V230.12.37-KANLICA-FERRY-LABEL' &&
    sw.includes('./qa/location-regression-cases.json') && sw.includes('./qa.html'));
  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto('http://127.0.0.1:4173/manifest.json', { waitUntil: 'domcontentloaded' });
    await offlinePage.evaluate(async () => { await caches.open('itp-v230.12.26-core'); });
    await offlinePage.goto('http://127.0.0.1:4173/index.html?qa=offline', { waitUntil: 'domcontentloaded' });
    await offlinePage.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller && reg.active) {
        await new Promise(resolve => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
          setTimeout(resolve, 4000);
        });
      }
    });
    await offlinePage.reload({ waitUntil: 'domcontentloaded' });
    await offlinePage.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    const cacheState = await offlinePage.evaluate(async cacheName => {
      const keys = await caches.keys();
      return {
        controlled: !!navigator.serviceWorker.controller,
        cache: keys.includes(cacheName),
        cachedIndex: !!(await (await caches.open(cacheName)).match('./index.html')),
        oldCacheRemoved: !keys.includes('itp-v230.12.26-core')
      };
    }, cacheName);
    record('PWA service worker controls page, caches app shell, and removes stale release cache',
      cacheState.controlled && cacheState.cache && cacheState.cachedIndex && cacheState.oldCacheRemoved, JSON.stringify(cacheState));
    await offlineContext.setOffline(true);
    await offlinePage.reload({ waitUntil: 'domcontentloaded' });
    await offlinePage.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    record('PWA app shell renders offline from cache', await offlinePage.locator('#list .place[data-id]').count() > 0);
  } catch (error) {
    record('PWA offline smoke test', false, error.message);
  } finally {
    await offlineContext.close();
  }
} finally {
  await browser.close();
}
console.log(`Browser QA: ${passed.length} passed, ${failures.length} failed`);
for (const name of passed) console.log('PASS '+name);
for (const name of failures) console.error('FAIL '+name);
if (failures.length) process.exit(1);
