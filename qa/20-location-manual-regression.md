# 55-place / 49-route manual regression

## Purpose
Run a controlled no-paid-API regression pass before deciding whether to integrate Google Places. Dataset: `qa/location-regression-cases.json` (55 places, 49 route scenarios).

## Coverage and limits
- 49 entries match the current in-app place catalogue by ID/name and have the catalogue's stored coordinates.
- Three business records are integrated into the in-app catalogue and route selection: Four Seasons Hotel Istanbul at Sultanahmet, Karaköy Lokantası and Çiya Sofrası. Their coordinates are cross-checked but have not been field-surveyed. Faros Karaköy remains excluded from production selection because its point is approximate; it stays a non-runnable gap probe.
- This dataset is a **test plan**; CI verifies the source and a browser QA page exercises all 49 route fixtures (R01–R49). Hosted-browser/field validation is still required before claiming production readiness.
- Do not invent coordinates, station choices, walking times, or ETAs. Verify business identity and route details against reliable current sources during execution.
- Yıldız Sarayı long-access case: the app's stored M7 access estimate is 22 minutes. The source-backed U1 candidate boards at **Yıldız Teknik Üniversitesi - Beşiktaş Yönü**, follows the official U1 ring toward **Çırağan / Yahya Efendi**, and ends with walking navigation to the palace address. Official route evidence: [İETT U1](https://iett.istanbul/RouteDetail?hkod=U1\&routename=besiktas-ulus) and [Metro İstanbul M7](https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M7); stop walking references are secondary-map estimates from [Moovit](https://moovitapp.com/index/tr/toplu_ta%C5%9F%C4%B1ma-Y%C4%B1ld%C4%B1z_Saray%C4%B1_Milli_Saraylar-Istanbul-site_43221241-1563). The estimate is not a field survey; confirm the boarding side and final walking path in the deployed browser and on site.
- A test passes only after it is performed in the deployed browser and its visible output is checked. Static QA alone does not prove live interaction works.

## Execution order
1. Record deployed build ID and confirm it matches the intended GitHub commit.
2. Open the live app in a fresh browser session; record whether place cards and search are visible.
3. For each route case R01–R47, set the origin and destination, calculate the route, and record the actual result.
4. Verify origin/destination identity, coordinates or place ID handoff, selected station, transfers, pier/exit instructions, walking time, and error handling.
5. Repeat the route with origin/destination reversed when meaningful.
6. Test clear/reset, rapid repeated search, and mobile layout.
7. Fix each failure, rerun the failed case, then rerun all 47 cases as regression.
8. Separately test PWA cache/offline behavior after route regression passes.

## Result record
For every case record: PASS/FAIL/BLOCKED, build ID, screenshot, selected origin/destination, selected station(s), transfers, walking minutes, console errors, source used to verify expected result, and a short defect description.

## Release gate
Do not call the route system production-ready while any critical origin/destination selection, route calculation, wrong-station, broken tab/search, or stale-cache regression remains unresolved. Mark unverified live tests as BLOCKED rather than PASS.


## Added ferry regression
- **R48 Kanlıca → Bostancı:** the initial ferry step must name Üsküdar as the access hub; it must not say Kadıköy.
- **R49 Bostancı → Kanlıca:** verify reverse-direction route coherence and final ferry access.
- Browser QA also audits every catalogue origin whose start access mode is `Vapur` and checks the displayed hub against its configured access record.
