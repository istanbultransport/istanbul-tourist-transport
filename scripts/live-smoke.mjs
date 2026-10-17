import { chromium } from 'playwright';
import fs from 'node:fs';

const liveUrl = process.env.LIVE_APP_URL || 'https://istanbultransport.github.io/istanbul-tourist-transport-planner/';
const expectedHtml = fs.readFileSync('index.html', 'utf8');
const expectedBuild = (expectedHtml.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || '';
const expectedCache = (fs.readFileSync('sw.js', 'utf8').match(/const CACHE_NAME='([^']+)'/) || [])[1] || '';
const routeCases = JSON.parse(fs.readFileSync('qa/location-regression-cases.json', 'utf8')).routeCases;
const passed = [];
const failures = [];
const record = (name, ok, detail = '') => (ok ? passed : failures).push(ok ? name : name + ': ' + detail);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  let response = null;
  let actualBuild = '';
  let lastError = '';
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      response = await page.goto(liveUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#list .place[data-id]', { timeout: 12000 });
      actualBuild = await page.locator('meta[name="build-id"]').getAttribute('content') || '';
      if (response?.ok() && actualBuild === expectedBuild) break;
      lastError = 'HTTP ' + response?.status() + ', build=' + actualBuild + ', expected=' + expectedBuild;
    } catch (error) {
      lastError = error.message;
    }
    if (attempt < 8) {
      await page.waitForTimeout(15000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }
  }

  record('live site responds successfully', !!response?.ok(), 'HTTP ' + response?.status() + ' ' + lastError);
  record('live build matches current main build', actualBuild === expectedBuild, 'live=' + actualBuild + ' expected=' + expectedBuild);
  const initialCardCount = await page.locator('#list .place[data-id]').count().catch(() => 0);
  record('live app renders place cards', initialCardCount > 0, 'count=' + initialCardCount);
  console.log('Live smoke URL: ' + liveUrl);
  console.log('Expected build: ' + expectedBuild + '; live build: ' + actualBuild);
  if (!response?.ok() || initialCardCount === 0) {
    console.error('Live site unavailable or did not render cards: HTTP ' + response?.status() + '; ' + lastError);
    throw new Error('Live smoke stopped: deployed app could not be loaded.');
  }
  for (const id of ['four_seasons_sultanahmet','karakoy_lokantasi','ciya_sofrasi']) {
    const count = await page.locator('#list .place[data-id="' + id + '"]').count();
    record('live catalogue includes ' + id, count === 1, 'count=' + count);
  }
  record('live catalogue excludes unverified Faros record', await page.locator('#list .place[data-id="faros_karakoy"]').count() === 0);

  await page.locator('.filter[data-filter="Anadolu Yakası"]').click();
  let sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('live Anatolia filter works', sides.length > 0 && sides.every(s => s.includes('Anadolu Yakası')));
  await page.locator('.filter[data-filter="Avrupa Yakası"]').click();
  sides = await page.locator('#list .place[data-id]').evaluateAll(nodes => nodes.map(n => n.querySelector('small')?.textContent || ''));
  record('live Europe filter works', sides.length > 0 && sides.every(s => s.includes('Avrupa Yakası')));
  await page.locator('.filter[data-filter="Tümü"]').click();

  await page.locator('#startPlaceSearch').fill('Karaköy Lokantası');
  record('live business search works', await page.locator('#list .place[data-id]').count() === 1 &&
    await page.locator('#list .place[data-id]').getAttribute('data-id') === 'karakoy_lokantasi');
  await page.locator('#startPlaceSearch').fill('');

  await page.evaluate(() => newRoute());
  await page.locator('#startPlaceSearch').fill('Kadıköy Çarşı');
  await page.locator('#list .place[data-id="kadikoy_carsi"]').click();
  await page.locator('#targetPlaceSearch').fill('Çiya Sofrası');
  await page.locator('#list .place[data-id="ciya_sofrasi"]').click();
  await page.waitForFunction(() => selectedTarget?.id === 'ciya_sofrasi' &&
    getComputedStyle(document.getElementById('route')).display !== 'none', null, { timeout: 20000 });
  const routeState = await page.evaluate(() => ({
    from: start?.id || null, to: selectedTarget?.id || null,
    routeText: document.getElementById('route')?.innerText?.trim() || ''
  }));
  record('live route selection preserves endpoint IDs and shows route',
    routeState.from === 'kadikoy_carsi' && routeState.to === 'ciya_sofrasi' && routeState.routeText.length > 0,
    JSON.stringify(routeState));

  // Exercise every current route fixture through the deployed user interface, not only
  // the in-page route engine. This verifies the live catalogue, selection handoff and
  // rendered route for R01-R47 on the deployed build.
  for (const item of routeCases) {
    try {
      const names = await page.evaluate(({ from, to }) => ({
        from: places.find(p => p.id === from)?.name || null,
        to: places.find(p => p.id === to)?.name || null
      }), item);
      if (!names.from || !names.to) {
        record('live UI route flow ' + item.id, false, 'catalogue name missing: ' + JSON.stringify(names));
        continue;
      }
      await page.evaluate(() => newRoute());
      await page.locator('#startPlaceSearch').fill(names.from);
      await page.locator('#list .place[data-id="' + item.from + '"]').click({ timeout: 7000 });
      await page.locator('#targetPlaceSearch').fill(names.to);
      await page.locator('#list .place[data-id="' + item.to + '"]').click({ timeout: 7000 });
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
        headingStepLabel: document.querySelector('#route .routehead .pill')?.textContent?.trim() || '',
        summaryStepCount: Number(document.querySelectorAll('#route .route-summary .route-stat b')[2]?.textContent || NaN)
      }));
      const headingStepMatch = flow.headingStepLabel.match(/^(\d+)\s+ULAŞIM ADIMI$/i);
      const stepCountConsistent = headingStepMatch
        ? Number(headingStepMatch[1]) === flow.summaryStepCount
        : flow.headingStepLabel === 'PRATİK ROTA';
      const valid = flow.from === item.from && flow.to === item.to &&
        flow.routeText.length > 0 && flow.stepCards > 0 && stepCountConsistent;
      if (['R01','R02','R03','R04','R05','R06','R07','R08','R09','R10','R11','R12','R13','R14','R15','R16','R17','R18','R19','R20','R21','R22','R23','R24','R25','R26','R27','R28'].includes(item.id)) {
        console.log('LIVE ROUTE AUDIT ' + item.id + ': ' + JSON.stringify({
          expectedFrom: item.from, actualFrom: flow.from,
          expectedTo: item.to, actualTo: flow.to,
          stepCards: flow.stepCards, routeText: flow.routeText
        }));
      }
      record('live UI route flow ' + item.id, valid, JSON.stringify({
        expectedFrom: item.from, actualFrom: flow.from,
        expectedTo: item.to, actualTo: flow.to,
        stepCards: flow.stepCards, headingStepLabel: flow.headingStepLabel,
        summaryStepCount: flow.summaryStepCount, routeText: flow.routeText.slice(0, 180)
      }));
      if (item.id === 'R07') {
        const pendikBusValid = flow.routeText.includes('KM13') &&
          flow.routeText.includes('PENDİK YHT İSTASYONU') &&
          flow.routeText.includes('yürüme süresi doğrulanmadı') &&
          flow.routeHtml.includes('RouteDetail?hkod=KM13') &&
          flow.routeHtml.includes('StationDetail?dkod=227794');
        record('live R07 Pendik YHT exposes official KM13 route and stop links without inventing walk time',
          pendikBusValid, flow.routeText.slice(-900));
      }
      if (item.id === 'R27') {
        const modernAccessValid = flow.routeText.includes('Tophane T1') &&
          flow.routeText.includes('4 dakika') && !flow.routeText.includes('Kabataş T1');
        record('live Istanbul Modern route uses Tophane T1 and 4-minute final walk', modernAccessValid,
          flow.routeText.slice(-500));
      }
      if (item.id === 'R11') {
        const ferryAccess = flow.routeText.includes('Barbaros Hayrettin Paşa İskelesi') &&
          flow.routeText.includes('Kadıköy (Eski) İskelesi') &&
          flow.routeText.includes('süre uydurulmuyor') &&
          flow.routeText.includes('Erişim süresi doğrulanmadı') &&
          flow.routeHtml.includes('kadikoy-besiktas-165') &&
          (flow.routeHtml.match(/travelmode=walking/g) || []).length >= 2 &&
          flow.stepCards >= 3;
        record('live R11 Beşiktaş–Kadıköy route includes both pier access walks and official ferry source without invented duration',
          ferryAccess, flow.routeText.slice(0, 1500));
      }
      if (item.id === 'R13') {
        const hotelAccessDisclosed = flow.routeText.includes('Four Seasons Hotel Istanbul at Sultanahmet') &&
          flow.routeText.includes('Sultanahmet T1') &&
          flow.routeText.includes('Yürüme süresi ve gerçek giriş-çıkış güzergâhı bağımsız olarak doğrulanmadı') &&
          flow.routeHtml.includes('origin=Four%20Seasons') &&
          flow.routeHtml.includes('destination=Sultanahmet%20T1');
        record('live R13 Four Seasons access discloses unverified walk time and provides explicit hotel-to-station map route',
          hotelAccessDisclosed, flow.routeText.slice(0,1000));
      }
      if (item.id === 'R21') {
        const routeSummary = flow.routeText.split('🧭 Yolculuk özeti')[1]?.split('🔄 Aktarmada ne yapacaksın?')[0] || '';
        const verifiedMarriottAccess = flow.routeText.includes('Kozyatağı M8') && flow.routeText.includes('7 dakika') &&
          !flow.routeText.includes('13 dakika yürüyün') && !routeSummary.includes('Kozyatağı M4\n↓\nKozyatağı M4');
        record('live Marriott route preserves verified Kozyatağı M8 access', verifiedMarriottAccess,
          flow.routeText.slice(0, 1000));
      }
    } catch (error) {
      record('live UI route flow ' + item.id, false, error.message);
    }
  }
  record('all live UI route fixtures loaded', Array.isArray(routeCases) && routeCases.length === 47,
    'count=' + routeCases.length);

  // Exercise the Yıldız Sarayı long-walk case through the deployed UI.
  // The final card must offer the source-backed U1 bus alternative and both walking links.
  try {
    const yildizNames = await page.evaluate(() => ({
      from: places.find(p => p.id === 'taksim_meydani')?.name || null,
      to: places.find(p => p.id === 'yildiz_sarayi')?.name || null
    }));
    if (!yildizNames.from || !yildizNames.to) {
      record('live Yildiz Palace U1 access flow', false, 'catalogue name missing: ' + JSON.stringify(yildizNames));
    } else {
      await page.evaluate(() => newRoute());
      await page.locator('#startPlaceSearch').fill(yildizNames.from);
      await page.locator('#list .place[data-id="taksim_meydani"]').click({ timeout: 7000 });
      await page.locator('#targetPlaceSearch').fill(yildizNames.to);
      await page.locator('#list .place[data-id="yildiz_sarayi"]').click({ timeout: 7000 });
      await page.waitForFunction(() =>
        selectedTarget?.id === 'yildiz_sarayi' &&
        getComputedStyle(document.getElementById('route')).display !== 'none',
        null, { timeout: 20000 }
      );
      const yildizFlow = await page.evaluate(() => ({
        from: start?.id || null,
        to: selectedTarget?.id || null,
        routeText: document.getElementById('route')?.innerText?.trim() || '',
        navLinks: [...document.querySelectorAll('#route a[href*="google.com/maps/dir/"]')].length
      }));
      const valid = yildizFlow.from === 'taksim_meydani' &&
        yildizFlow.to === 'yildiz_sarayi' &&
        yildizFlow.routeText.includes('U1') &&
        yildizFlow.routeText.includes('Yıldız Teknik Üniversitesi - Beşiktaş Yönü') &&
        yildizFlow.routeText.includes('Yahya Efendi') &&
        yildizFlow.navLinks >= 2;
      record('live Yildiz Palace route offers verified U1 access', valid, JSON.stringify({
        from: yildizFlow.from, to: yildizFlow.to, navLinks: yildizFlow.navLinks,
        routeText: yildizFlow.routeText.slice(-650)
      }));
    }
  } catch (error) {
    record('live Yildiz Palace route offers verified U1 access', false, error.message);
  }

  // Assert the critical 16-minute first-station walking boundary on the deployed build.
  const liveWalkPolicy = await page.evaluate(() => ({
    at15: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:15}],['station','next','M4 Metro','ride']]),
    at16: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:16}],['station','next','M4 Metro','ride']]),
    at17: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:17}],['station','next','M4 Metro','ride']]),
    nullDuration: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:null}],['station','next','M4 Metro','ride']]),
    emptyDuration: shouldAutoStartFirstStationWalk([['origin','station','Yürüyüş','walk',{walkMinutes:''}],['station','next','M4 Metro','ride']])
  }));
  record('live 16-minute walking boundary includes 15/16 and rejects 17', liveWalkPolicy.at15 === true &&
    liveWalkPolicy.at16 === true && liveWalkPolicy.at17 === false, JSON.stringify(liveWalkPolicy));
  record('live unknown walking duration never auto-starts', liveWalkPolicy.nullDuration === false &&
    liveWalkPolicy.emptyDuration === false, JSON.stringify(liveWalkPolicy));

  const liveLastMileSuite = await page.evaluate(() =>
    typeof window.lastMilePresentationQA === 'function'
      ? window.lastMilePresentationQA()
      : { status:'FAIL', failures:[{name:'suite-not-exposed'}] });
  record('live last-mile threshold and verified-bus suite passes', liveLastMileSuite.status === 'PASS' &&
    Array.isArray(liveLastMileSuite.tests) && liveLastMileSuite.tests.length >= 15 &&
    liveLastMileSuite.tests.every(t => t.ok === true),
    JSON.stringify({status:liveLastMileSuite.status,tests:liveLastMileSuite.tests?.length,failures:liveLastMileSuite.failures}));

  const liveEngineSuite = await page.evaluate(() =>
    typeof window.v223AcceptanceQA === 'function'
      ? window.v223AcceptanceQA()
      : { status:'FAIL', failures:[{name:'suite-not-exposed'}] });
  record('live route-engine acceptance suite passes', liveEngineSuite.status === 'PASS' &&
    Array.isArray(liveEngineSuite.tests) && liveEngineSuite.tests.length >= 13 &&
    liveEngineSuite.tests.every(t => t.status === 'PASS'),
    JSON.stringify({status:liveEngineSuite.status,tests:liveEngineSuite.tests?.length,failures:liveEngineSuite.failures}));

  const gpsRegistryAudit = await page.evaluate(async () => {
    try {
      const rows = await fetchGpsStationCoordinates();
      const ids = new Set(['umraniye','dudullu','cekmekoy','mecidiyekoy','levent','kagithane_hub','kayasehir_hub']);
      const requiredKeys = [
        ['umraniye','M5 Metro'], ['dudullu','M5 Metro'], ['cekmekoy','M5 Metro'],
        ['mecidiyekoy','M2 Metro'], ['levent','M2 Metro'],
        ['kagithane_hub','M7 Metro'], ['kayasehir_hub','M3 Metro']
      ];
      const fallback = staticGpsStationCoordinates();
      const liveByKey = new Map(rows.map(row => [row.station + '|' + row.mode, row]));
      const comparePoint = (local, live) => {
        if (!local || !live) return { station: local?.station, mode: local?.mode, covered: false, meters: null, ok: false };
        const meanLat = (local.lat + live.lat) / 2 * Math.PI / 180;
        const dy = (local.lat - live.lat) * 111320;
        const dx = (local.lng - live.lng) * 111320 * Math.cos(meanLat);
        const meters = Math.hypot(dx, dy);
        return { station: local.station, mode: local.mode, label: local.label, covered: true, meters: Math.round(meters * 10) / 10, app: [local.lat, local.lng], official: [live.lat, live.lng], ok: meters <= 10 };
      };
      const fallbackComparisons = requiredKeys.map(([station, mode]) => {
        const local = fallback.find(row => row.station === station && row.mode === mode);
        return comparePoint(local, liveByKey.get(station + '|' + mode));
      });
      const allFallbackComparisons = fallback.map(local => comparePoint(local, liveByKey.get(local.station + '|' + local.mode)));
      const apiCovered = allFallbackComparisons.filter(row => row.covered);
      const apiOutliers = apiCovered.filter(row => !row.ok);
      const apiUnmatchedKeys = allFallbackComparisons.filter(row => !row.covered).map(row => ({ station: row.station, mode: row.mode, label: row.label }));
      const m11EntranceTargets = [
        ['kagithane_hub','M11 Metro',41.08035,28.9756],
        ['olimpiyat','M11 Metro',41.078967,28.768925],
        ['kayasehir_hub','M11 Metro',41.117733,28.765983]
      ];
      const m11EntranceChecks = m11EntranceTargets.map(([station, mode, lat, lng]) => {
        const local = fallback.find(row => row.station === station && row.mode === mode);
        if (!local) return { station, mode, meters: null, ok: false };
        const meanLat = (local.lat + lat) / 2 * Math.PI / 180;
        const dy = (local.lat - lat) * 111320;
        const dx = (local.lng - lng) * 111320 * Math.cos(meanLat);
        const meters = Math.hypot(dx, dy);
        return { station, mode, meters: Math.round(meters * 10) / 10, ok: meters <= 20 };
      });
      const marmarayEntranceTargets = [
        ['yunus_m','Marmaray',40.88444444,29.21055556],
        ['kaynarca_m','Marmaray',40.87138889,29.25583333],
        ['kartal_hub','Marmaray',40.88861111,29.19111111],
        ['suadiye_m','Marmaray',40.96055556,29.08444444]
      ];
      const marmarayEntranceChecks = marmarayEntranceTargets.map(([station, mode, lat, lng]) => {
        const local = fallback.find(row => row.station === station && row.mode === mode);
        if (!local) return { station, mode, meters: null, ok: false };
        const meanLat = (local.lat + lat) / 2 * Math.PI / 180;
        const dy = (local.lat - lat) * 111320;
        const dx = (local.lng - lng) * 111320 * Math.cos(meanLat);
        const meters = Math.hypot(dx, dy);
        return { station, mode, meters: Math.round(meters * 10) / 10, ok: meters <= 20 };
      });
      const crossLineStationPairs = [
        { station: 'ayrilik', a: 'M4 Metro', b: 'Marmaray', min: 0, max: 150 },
        { station: 'uskudar', a: 'M5 Metro', b: 'Marmaray', min: 0, max: 200 },
        { station: 'kartal_hub', a: 'M4 Metro', b: 'Marmaray', min: 500, max: Infinity },
        { station: 'pendik', a: 'M4 Metro', b: 'Marmaray', min: 500, max: Infinity }
      ];
      const crossLineStationChecks = crossLineStationPairs.map(pair => {
        const a = fallback.find(row => row.station === pair.station && row.mode === pair.a);
        const b = fallback.find(row => row.station === pair.station && row.mode === pair.b);
        if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return { station: pair.station, a: pair.a, b: pair.b, meters: null, ok: false };
        const meanLat = (a.lat + b.lat) / 2 * Math.PI / 180;
        const meters = Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(meanLat));
        return { station: pair.station, a: pair.a, b: pair.b, meters: Math.round(meters), ok: meters >= pair.min && meters <= pair.max };
      });
      const marmarayNodeTargets = [
        ['pendik','Marmaray',40.88024,29.23165,20],
        ['erenkoy_m','Marmaray',40.97167,29.07638,10],
        ['sogutlucesme','Marmaray',40.99065,29.03791,75],
        ['ayrilik','Marmaray',41.00015,29.03010,60]
      ];
      const marmarayNodeChecks = marmarayNodeTargets.map(([station, mode, lat, lng, tolerance]) => {
        const local = fallback.find(row => row.station === station && row.mode === mode);
        if (!local) return { station, mode, meters: null, tolerance, ok: false };
        const meanLat = (local.lat + lat) / 2 * Math.PI / 180;
        const meters = Math.hypot((local.lat - lat) * 111320, (local.lng - lng) * 111320 * Math.cos(meanLat));
        return { station, mode, meters: Math.round(meters), tolerance, ok: meters <= tolerance };
      });
      const m11LinePairTargets = [
        { a: ['kagithane_hub','M7 Metro'], b: ['kagithane_hub','M11 Metro'], min: 200, max: 400 },
        { a: ['kayasehir_hub','M3 Metro'], b: ['kayasehir_hub','M11 Metro'], min: 150, max: 350 },
        { a: ['olimpiyat','M9 Metro'], b: ['olimpiyat','M11 Metro'], min: 0, max: 150 },
        { a: ['halkali_stadi_m11','M11 Metro'], b: ['olimpiyat','M11 Metro'], min: 500, max: Infinity }
      ];
      const m11LinePairChecks = m11LinePairTargets.map(pair => {
        const a = fallback.find(row => row.station === pair.a[0] && row.mode === pair.a[1]);
        const b = fallback.find(row => row.station === pair.b[0] && row.mode === pair.b[1]);
        if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return { a: pair.a, b: pair.b, meters: null, ok: false };
        const meanLat = (a.lat + b.lat) / 2 * Math.PI / 180;
        const meters = Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos(meanLat));
        return { a: pair.a, b: pair.b, meters: Math.round(meters), ok: meters >= pair.min && meters <= pair.max };
      });
      return {
        ok: rows.length > 0,
        count: rows.length,
        relevant: rows.filter(row => ids.has(row.station)).map(row => ({
          station: row.station, mode: row.mode, label: row.label, lat: row.lat, lng: row.lng
        })),
        finite: rows.every(row => Number.isFinite(row.lat) && Number.isFinite(row.lng)),
        fallbackComparisons,
        fallbackMatchesOfficial: fallbackComparisons.length === requiredKeys.length && fallbackComparisons.every(row => row.ok),
        allFallbackComparisons,
        apiCoveredCount: apiCovered.length,
        apiOutliers,
        apiUnmatchedKeys,
        marmarayEntranceChecks,
        m11EntranceChecks,
        crossLineStationChecks,
        crossLineStationPairsOk: crossLineStationChecks.length === crossLineStationPairs.length && crossLineStationChecks.every(row => row.ok),
        marmarayNodeChecks,
        marmarayNodeChecksOk: marmarayNodeChecks.length === marmarayNodeTargets.length && marmarayNodeChecks.every(row => row.ok),
        m11LinePairChecks,
        m11LinePairGeometryOk: m11LinePairChecks.length === m11LinePairTargets.length && m11LinePairChecks.every(row => row.ok),
        allOfficialFallbacksMatch: apiCovered.length >= 29 && apiOutliers.length === 0,
        marmarayEntrancesMatchSource: marmarayEntranceChecks.length === marmarayEntranceTargets.length && marmarayEntranceChecks.every(row => row.ok),
        m11EntrancesMatchSource: m11EntranceChecks.length === m11EntranceTargets.length && m11EntranceChecks.every(row => row.ok)
      };
    } catch (error) {
      return { ok: false, count: 0, relevant: [], finite: false, fallbackComparisons: [], fallbackMatchesOfficial: false, allFallbackComparisons: [], apiCoveredCount: 0, apiOutliers: [], apiUnmatchedKeys: [], marmarayEntranceChecks: [], m11EntranceChecks: [], crossLineStationChecks: [], crossLineStationPairsOk: false, marmarayNodeChecks: [], marmarayNodeChecksOk: false, m11LinePairChecks: [], m11LinePairGeometryOk: false, allOfficialFallbacksMatch: false, marmarayEntrancesMatchSource: false, m11EntrancesMatchSource: false, error: String(error) };
    }
  });
  console.log('Official IBB station registry diagnostic: ' + JSON.stringify(gpsRegistryAudit));
  record('official IBB station registry returns mapped coordinates',
    gpsRegistryAudit.ok && gpsRegistryAudit.finite && gpsRegistryAudit.count > 0,
    JSON.stringify(gpsRegistryAudit));
  record('static GPS fallback matches official IBB points for seven verified line-station keys',
    gpsRegistryAudit.fallbackMatchesOfficial,
    JSON.stringify(gpsRegistryAudit.fallbackComparisons));
  record('all IBB-supported static GPS fallbacks match official station points',
    gpsRegistryAudit.allOfficialFallbacksMatch,
    JSON.stringify({covered: gpsRegistryAudit.apiCoveredCount, outliers: gpsRegistryAudit.apiOutliers}));
  record('four Marmaray static fallbacks match station-specific Google Maps entrance pins',
    gpsRegistryAudit.marmarayEntrancesMatchSource,
    JSON.stringify(gpsRegistryAudit.marmarayEntranceChecks));
  record('four same-name cross-line station pairs preserve correct geometry',
    gpsRegistryAudit.crossLineStationPairsOk,
    JSON.stringify(gpsRegistryAudit.crossLineStationChecks));
  record('four Marmaray station nodes remain within secondary-map tolerances',
    gpsRegistryAudit.marmarayNodeChecksOk,
    JSON.stringify(gpsRegistryAudit.marmarayNodeChecks));
  record('four M11/M3/M7/M9 line-specific points preserve expected geometry',
    gpsRegistryAudit.m11LinePairGeometryOk,
    JSON.stringify(gpsRegistryAudit.m11LinePairChecks));
  record('three M11 static fallbacks match geotagged station entrances',
    gpsRegistryAudit.m11EntrancesMatchSource,
    JSON.stringify(gpsRegistryAudit.m11EntranceChecks));

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false, controlled: false, cacheNames: [] };
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller && reg.active) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }
    return { supported: true, controlled: !!navigator.serviceWorker.controller, cacheNames: await caches.keys() };
  });
  record('live service worker controls the app', swState.supported && swState.controlled, JSON.stringify(swState));
  record('live PWA cache version matches main', swState.cacheNames.includes(expectedCache),
    'expected=' + expectedCache + ' actual=' + swState.cacheNames.join(','));

  if (swState.controlled) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#list .place[data-id]', { timeout: 10000 });
    await context.setOffline(true);
    let offlineOk = false;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('#list .place[data-id]', { timeout: 10000 });
      offlineOk = await page.locator('#list .place[data-id]').count() > 0;
    } catch {}
    record('live app shell opens offline from PWA cache', offlineOk);
  } else {
    record('live app shell opens offline from PWA cache', false, 'service worker did not take control');
  }

  record('no uncaught JavaScript errors on live site', pageErrors.length === 0, pageErrors.slice(0, 8).join(' | '));
  record('no JavaScript console errors on live site', consoleErrors.length === 0, consoleErrors.slice(0, 8).join(' | '));
  console.log('Live smoke QA: ' + passed.length + ' passed, ' + failures.length + ' failed');
  for (const name of passed) console.log('PASS ' + name);
  for (const name of failures) console.error('FAIL ' + name);
  await page.screenshot({ path: 'live-smoke-mobile.png', fullPage: true }).catch(() => {});
  await context.close();
} finally {
  await browser.close();
}
if (failures.length) process.exit(1);
