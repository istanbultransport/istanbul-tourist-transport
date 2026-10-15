# Transport Data Source Audit

## Current release status — 2026-10-15

Latest main commit checked: `793d2d987b6f75d118391aafc41b1e2d4bcc704c`.

- Latest live smoke QA: **77 passed, 0 failed** ([run 38797795685](https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/38797795685)). Chromium confirmed that the deployed build marker matches main, all 47 UI route flows R01–R47 render, the 16-minute boundary accepts 15/16 and rejects 17, the service worker controls the app, the PWA cache matches the source, the app shell reloads offline, and no uncaught JavaScript errors were observed.
- Latest local automated browser QA: **167 passed, 0 failed**; static QA: **51 passed, 0 failed**. [Pages deployment](https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/38797794372) also succeeded.
- Deployed build marker: `V230.12.30-ROUTE-STEP-COUNT`; service-worker cache: `itp-v230.12.30-routestepcount-core`. The latest live smoke checked the build and cache against main.
- Latest UI correction: route-step heading now uses the compressed route path count, with browser and live-smoke assertions that the heading and summary agree.
- **Yıldız Sarayı access status:** the app offers a source-backed U1 candidate from Yıldız Teknik Üniversitesi - Beşiktaş Yönü toward Yahya Efendi, with separate boarding-stop and palace walking-navigation links. The card links to official İETT stop pages for both stops and warns that current stop/service status may change. The app does **not** fetch live closure status automatically. R47 passed in browser QA and live smoke. The official U1 route/stop sequence is source-checked; the boarding walk and final walking path remain secondary-map estimates, not field-surveyed facts.
- **Yıldız walk-time source ambiguity:** the generic [Yıldız Sarayı / Milli Saraylar Moovit listing](https://moovitapp.com/index/tr/toplu_ta%C5%9F%C4%B1ma-Y%C4%B1ld%C4%B1z_Saray%C4%B1_Milli_Saraylar-Istanbul-site_43221241-1563) reports about 12 minutes from M7 Yıldız; the separate [Yıldız Sarayı Müzesi listing](https://moovitapp.com/index/tr/toplu_ta%C5%9F%C4%B1ma-Y%C4%B1ld%C4%B1z_Saray%C4%B1_M%C3%BCzesi-Istanbul-site_231397636-1563), matching the app's museum-specific target query, reports about 22 minutes. These are different mapped entities and cannot be treated as interchangeable. Keep 22 minutes marked as a secondary-map estimate—not field-verified—until the visitor entrance and pedestrian path are independently confirmed.
- **Live first-mile review — R04 potential discrepancy:** the latest deployed route audit for Çiya Sofrası → Taksim renders its first transit step at Kadıköy M4 without a visible origin-to-station walking step. The stored Çiya point (`40.989320, 29.024400`) is approximately **250 m straight-line** from the official IBB/M4 station-node coordinate (`40.9906638, 29.0220076`). This is not a measured pedestrian route and neither point proves the exact visitor/entrance location; nevertheless, the missing walk should be checked and either rendered or explicitly justified before marking R04 fully validated. Sources: [Çiya Sofrası coordinates](https://burayagidelim.com/mekan/istanbul/ciya-sofrasi), [Metro İstanbul M4 station list](https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M4), [live audit run](https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/38800171083). This is a **pending investigation**, not yet a confirmed code fix.
- **Last-mile bus source batch — 2026-10-15:** official İETT stop sequences were rechecked for the current verified alternatives: [15F](https://iett.istanbul/RouteDetail?hkod=15F) includes Anadolu Hisarı and Üsküdar Camii Önü; [15S](https://iett.istanbul/RouteDetail?hkod=15S&routename=SULTANMURAT+-+%C3%9CSK%C3%9CDAR) includes Kuzguncuk–Şehit Samet Uslu and Üsküdar Camii Önü; [FB1](https://www.iett.istanbul/RouteDetail?hkod=FB1&routename=KADIK%C3%96Y+-+FENERBAH%C3%87E) and [FB2](https://www.iett.istanbul/EnRouteDetail?hkod=FB2&routename=KADIK%C3%96Y+-+FENERBAH%C3%87E) both include Şükrü Saraçoğlu Stadı; [48G](https://www.iett.istanbul/RouteDetail?hkod=48G&routename=G%C3%96KT%C3%9CRK-+MESC%C4%B0D%C4%B0+SELAM) includes Kent Ormanı; and [139A](https://www.iett.istanbul/RouteDetail?hkod=139A) includes Şemsipaşa and Ağva Merkez. The 15S ring/limited-trip notes and 139A's Yeniköy/İsaköy/Ovacık route variants plus staged tariff matter: these static plans do not guarantee a particular departure or route variant. This batch confirms published stop-sequence membership only; it does not field-verify stop coordinates or walking paths.
- The all-place coordinate audit lists **217 place cards, 0 missing coordinate pairs, 18 source-cross-checked corrections, and 0 independently verified visitor entrances**. Area/neighborhood coordinates are representative points, not precise entrances.
- The regression fixture and manual QA guide currently describe **53 locations / 47 route scenarios**. Automated UI execution is not proof that every route's physical entrance, transfer walk, or bus stop is accurate.
- Station exit names/numbers have source links, but exact pedestrian paths, accessibility/slopes and exit-to-destination walking times still need independent validation. CI/live smoke results are automated browser checks, not physical field tests.

The sections below preserve the historical source audit first written on 2026-10-09; counts in that historical snapshot should not be interpreted as current QA totals.
---

## Historical audit — 2026-10-09
## Current automated verification

- Live GitHub Pages URL: https://istanbultransport.github.io/istanbul-tourist-transport-planner/
- Live build observed by Chromium: `V230.12.19-BUSINESS-ROUTE-QA`, matching the `main` build marker.
- Live smoke checks: 16 passed, 0 failed. These cover HTTP response, build marker, business catalogue/search, Europe/Anatolia filters, one visible route, JavaScript errors, Service Worker, cache version, and offline app-shell reload.
- Full local Chromium suite: 105 passed, 0 failed. This includes all 40 R01–R40 origin/search/selection/route-display UI flows, route-engine fixture checks, mocked browser geolocation, and offline PWA smoke tests.
- Important distinction: mocked GPS verifies permission/state handling, not physical coordinate accuracy on a real handset.

## Sources checked

### M4 route, station sequence and integrations

Official source: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M4

The official M4 page lists the Kadıköy–Sabiha Gökçen station sequence and identifies these integrations:
- Kadıköy: T3 tram, sea lines, sea buses and motorboats.
- Ayrılık Çeşmesi: Marmaray.
- Ünalan: Metrobüs.
- Kozyatağı: M8.
- Pendik: YHT access via İETT buses.

**Routing implication verified:** M4↔Marmaray is modelled at Ayrılık Çeşmesi, not as a direct transfer at Pendik. Pendik YHT is a surface-access connection, not a rail interchange. The route graph guard and the R01–R40 suite check for invalid transfer shortcuts.

**Additional official integration cross-checks:**
- M8 official page: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M8 confirms Bostancı ↔ Marmaray/high-speed rail/sea lines, Kozyatağı ↔ M4, and Dudullu ↔ M5.
- M5 official page: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M5 confirms Üsküdar ↔ Marmaray/İETT/sea piers, Altunizade ↔ Metrobüs, and Dudullu ↔ M8. It also lists the extension through Sultanbeyli, opened 22 May 2026; the current app's M5 sequence includes Sultanbeyli.
- These source checks agree with the app's M4↔Marmaray at Ayrılık Çeşmesi, M4↔M8 at Kozyatağı, M8↔Marmaray at Bostancı, M8↔M5 at Dudullu, M5↔Marmaray at Üsküdar, and M5↔Metrobüs at Altunizade entries.


### Station exit names

Official source: https://www.metro.istanbul/dosyalar/bilgilendirme/Gece-Metrosu-Kapal%C4%B1-Giri%C5%9Fler.pdf

The application has 24 station records and 80 numbered exit records in `stationExitRegistry`, each labelled with the source `Metro İstanbul PDF`. The official PDF contains exit numbers/names for the M4 stations represented in the registry, including Kadıköy, Ayrılık Çeşmesi, Acıbadem, Ünalan, Göztepe, Yenisahra, Kozyatağı, Bostancı, Küçükyalı, Maltepe, Huzurevi, Gülsuyu, Esenkent, Hastane-Adliye, Soğanlık, Kartal, Yakacık, Pendik, Tavşantepe, Fevzi Çakmak, Yayalar-Şeyhli, Kurtköy and Sabiha Gökçen; it also includes M2/Taksim entries.

**Scope warning:** this is a night-service entrance/exit status document. Its open/closed status must not be presented as current all-day availability. The app uses it for exit names/numbering, not as a live closure feed. Names and numbers are source-backed; real-time access/closure status is not verified by this static registry.

### Last-mile bus registry

Official İETT route links currently embedded in the registry:
- 15F: https://iett.istanbul/RouteDetail?hkod=15F
- 139A: https://iett.istanbul/RouteDetail?hkod=139A&routename=139A
- 48G: https://iett.istanbul/RouteDetail?hkod=48G&routename=G%C3%96KT%C3%9CRK-+MESC%C4%B0D%C4%B0+SELAM

The three entries are marked verified in code and contain stop/boarding/alighting descriptions. This does not guarantee current operating hours or service status; those can change and should be checked against İETT before a journey.

## Remaining data-validation gates

These are **not marked fully verified** by the current CI:

1. **49 static GPS station/mode coordinate records:** the current CSV inventory contains 49 station+mode keys. Live QA cross-checks selected fallback points against official IBB station API data and several line-specific entrance references, but this is not a complete coordinate audit. Every record still needs an independently checked point definition (station node vs public entrance) and real Android/iOS location spot-checks.
2. **Walking estimates:** the source currently contains 30 curated `touristWalkMinutes` entries, 121 `lastMileWalkMinutes` entries and 45 `touristWalkDistanceKmMap` distances. They do not all have per-entry route-source URLs in the application. Values generated from distance and an assumed walking speed are estimates, not measured pedestrian navigation ETAs. Do not describe all of them as field-verified.
3. **All transfer pairs:** the validator rejects unverified same-node rail transfers, and the official M4 integration points above were checked. Every other cross-line transfer pair still needs a line-by-line official-source audit; CI coherence alone is not proof of real-world interchange access.
4. **Station exits to destination walking links:** exit names are source-backed, but the practical walking route, slope/accessibility and minutes from each exit to its linked destination need route-level map or field checks.
5. **Physical-device acceptance:** CI used headless Chromium. It does not replace GPS, Safari/iOS PWA installation, Android home-screen install, push/update behavior or real offline checks on actual phones.

## Release rule

Keep the product in **pre-release verification** until the coordinate, transfer, walking-link and physical-device gates above have evidence. Do not mark a route PASS merely because it renders; record the visible route steps, transfer nodes, walking/last-mile steps, source and build ID.


## GPS coordinate audit extraction — 2026-10-09

- Extracted the current `staticGpsStationCoordinates()` registry from `index.html` into [`qa/station-coordinate-audit.csv`](station-coordinate-audit.csv).
- The CSV contains **49 station/mode records** (49 unique station+mode keys). This differs from the earlier summary of **39 static GPS station coordinates** above; the earlier count should be treated as stale and reconciled with the current source.
- Every row is marked `PENDING_INDEPENDENT_COORDINATE_CHECK`. The OpenStreetMap URL is a visual review link at the current app coordinate, **not evidence that the coordinate is correct**. The official line URL supports station/line identity only, not the exact latitude/longitude.
- Duplicate-coordinate groups detected: Ayrılık Çeşmesi M4/Marmaray; Üsküdar Marmaray/M5; Yenikapı Marmaray/M2; Kağıthane M7/M11; Kayaşehir M3/M11; and **Olimpiyat M11/Halkalı Stadı M11**. Shared coordinates may be valid for connected interchange nodes, but each pair must be reviewed; Olimpiyat/Halkalı Stadı is a high-priority possible coordinate-copy error.
- The current static M4 GPS registry is partial: it contains 11 M4 records, while Metro İstanbul's official M4 page lists 23 stations. Do not infer the missing stations are covered by this GPS candidate list.
- No application coordinates were changed in this step. The CSV is an audit inventory only; the release gate remains blocked until each row has an independently checked coordinate source and a recorded result.


## First independent coordinate cross-check — 2026-10-09

- Updated `qa/station-coordinate-audit.csv` to add a dedicated `coordinate_evidence_source_url` field and recorded source-backed outcomes for three records.
- **Confirmed mismatch:** `Olimpiyat M11` incorrectly reused the `Halkalı Stadı M11` coordinate `41.05629, 28.77441`. Wikidata's Olimpiyatköy record, DailyMetro's station entry and a geotagged Wikimedia Commons station photo place Olimpiyatköy around `41.07855, 28.76951`. The CSV now records that corrected candidate and marks the mismatch; the app's `index.html` has **not** been changed yet. Because the coordinate references are non-operator sources, retain an operator/official-map confirmation as a release follow-up.
- **Cross-check match:** `Halkalı Stadı M11` remains `41.05629, 28.77441`, matching multiple map/catalogue references.
- **Cross-check match:** `Olimpiyat M9` remains `41.07954, 28.76719`, close to the geotagged Wikimedia Commons photo location and other map/catalogue references. This is a separate M9 station from Olimpiyatköy M11.
- Sources: https://www.wikidata.org/wiki/Q113516923 ; https://dailymetro.live/istanbul/en/station/olimpiyatkoy ; https://commons.wikimedia.org/wiki/File:M11_Olimpiyatk%C3%B6y_Metro_%C4%B0stasyonu_21062026_12.jpg ; https://www.wikidata.org/wiki/Q113518000 ; https://dailymetro.live/istanbul/en/station/halkal-stad ; https://mapcarta.com/N10702895858 ; https://commons.wikimedia.org/wiki/File:M9_Olimpiyat_-_Peron_kat%C4%B1_2026.jpg ; https://dailymetro.live/istanbul/station/olimpiyat ; https://turkipedia.com/Olimpiyat_%28%C4%B0stanbul_Metrosu%29
- Remaining 46 records are still pending independent coordinate checks. Do not treat the overall GPS dataset as verified.

## Coordinate audit continuation — 2026-10-09

- Continued the station-by-station review and added source links plus coordinate-difference notes for **19 additional records**, prioritising M4, M11 and shared interchange complexes. Commit: `b908b3e545a66410131d9c11c8dfb705027fce85`.
- Reconciled the current CSV: **49 total records**; **27 remain pending independent coordinate checks**. The other 22 have a recorded comparison result, but this does **not** mean all 22 are approved for release.
- Current status totals: 7 close matches against non-operator map/catalogue sources; 4 matches against non-operator sources; 5 variance-review records; 5 records requiring further coordinate-variance review; 1 confirmed mismatch (Olimpiyat M11); 27 pending.
- M4 inventory count is **12 records**, not 11 as stated in the earlier extraction note. Ten M4 records now have a comparison note; Kartal M4 remains pending. M4 coordinates with notable differences include Acıbadem (~130 m), Ünalan (~105 m), Kozyatağı (~105 m) and Sabiha Gökçen (~400 m) versus the cited DailyMetro catalogue points. These are flagged for point-definition/official-map review, not automatically treated as incorrect because entrances, station footprints and representative map points can differ.
- M4 close comparisons recorded for Kadıköy, Göztepe, Yenisahra, Maltepe and Pendik. Ayrılık Çeşmesi and Bostancı are retained as variance-review items rather than silently changing the app's coordinates.
- M11 checks recorded for Halkalı, İbn Haldun Üniversitesi, Arnavutköy Hastane and Kayaşehir. Kayaşehir M11 is flagged for review because the M11 station point differs from the existing app point and should not be conflated with M3 Kayaşehir Merkez. The earlier Olimpiyat M11 mismatch remains a CSV-only correction candidate; app code has not been changed.
- Interchange-coordinate review recorded for Üsküdar (M5/Marmaray) and Yenikapı (M2/Marmaray). A shared interchange may legitimately use one routing node, but separate line-specific station coordinates should not be assumed to represent the exact same physical entrance/platform.
- Source-quality rule: DailyMetro/Mapcarta/Wikidata/Wikimedia are comparison evidence, not official operator coordinate feeds. The official Metro İstanbul M4 page confirms line/station identity and sequence, not exact latitude/longitude. Therefore, all non-operator matches remain provisional pending an official map/field check where required.
- No application code or live coordinates were changed in this continuation. The CSV is the audit record, and the release gate remains blocked pending resolution of variance flags, the 27 pending rows, transfer/walking validations, and real-device acceptance.

## Marmaray coordinate cross-check continuation — 2026-10-09

- Added source-backed comparisons for **9 more Marmaray records** using Mapcarta pages based on OpenStreetMap station nodes. CSV commit: `e6a58115c38407a9f66c89bdc188079886e2ba14`.
- High-priority discrepancies: **Yunus** differs from the cited railway-station node by over 1 km; **Kaynarca** by roughly 2 km; **Kartal Marmaray** by roughly 1.5 km, with the current Kartal point appearing near the Yunus area; **Suadiye** and **Feneryolu** also differ by several hundred metres. These are flagged for confirmation rather than automatically overwriting app coordinates.
- Erenköy matches the cited OSM/Mapcarta coordinate exactly; Söğütlüçeşme is a close match. Bostancı and Göztepe remain variance-review items.
- Current inventory remains 49 records. After this batch, status totals are: `CROSS_CHECKED_NONOFFICIAL_SOURCE_CLOSE_MATCH`: 8; `CROSS_CHECKED_NONOFFICIAL_SOURCE_VARIANCE_REVIEW`: 7; `COORDINATE_VARIANCE_REVIEW_REQUIRED`: 10; `PENDING_INDEPENDENT_COORDINATE_CHECK`: 18; `CROSS_CHECKED_NONOFFICIAL_SOURCE_MATCH`: 5; `CROSS_CHECKED_COORDINATE_MISMATCH_CONFIRMED`: 1.
- The sources are map/catalogue records, not an official TCDD/Marmaray coordinate feed. For large discrepancies, verify station identity and exact target point (station node, platform, entrance or transfer node) against an operator map before changing app code. No app code was changed in this batch.

## Remaining station-coordinate first-pass review — 2026-10-09

- Completed a first-pass source review for the final 18 rows that were still marked pending. CSV commit: `10486de36d558dfc0e0ff36aa7d7446b7f711414`.
- The current 49-row inventory now has only **1 row still without an independent coordinate comparison**; however, **30 rows still need variance resolution or stronger independent/operator confirmation**, so this does not mean the coordinate dataset is verified or release-ready.
- High-risk Marmaray mismatches are now documented with Mapcarta/OpenStreetMap evidence:
  - Kaynarca app point `40.86510, 29.23250` vs station node `40.87137, 29.25596` (about 2.1 km).
  - Kartal Marmaray app point `40.88560, 29.20840` vs Kartal station node `40.88869, 29.19108` (about 1.5 km). The app point is near the Yunus-area station node; likely station-to-coordinate assignment problem.
  - Yunus app point `40.87620, 29.22150` vs Yunus node `40.88456, 29.21041` (about 1.3 km). The existing coordinate candidates for Yunus and Kartal Marmaray need to be remapped carefully to their actual station identities, not just swapped blindly.
  - Suadiye and Feneryolu also show several-hundred-metre differences and remain flagged.
- Other notable discrepancies:
  - M5 Ümraniye, Dudullu and Çekmeköy show roughly kilometre-scale differences against the cited OSM/Mapcarta station nodes.
  - M2 Şişli–Mecidiyeköy and Levent show several-hundred-metre differences; Taksim, Vezneciler, Gayrettepe and 4. Levent need point-definition review.
  - M11 Kağıthane's Mapcarta/OSM station node is approximately 290 m east of the M7 Kağıthane station node. The two line-specific rows should not share one exact coordinate when the data model intends separate platform/station points.
  - M3 Kayaşehir Merkez and M11 Kayaşehir are distinct stations; preserve separate coordinates. The M3 station is mapped around `41.11908, 28.76634`; the M11 station is nearby but not identical.
- Official Metro İstanbul route pages confirm station names, line identity and interchange relationships, but do not publish precise latitude/longitude in the reviewed pages. Mapcarta/OSM and other catalogues are comparison evidence, not an operator coordinate feed.
- **No live application coordinates were changed.** The CSV records candidate source points and discrepancy notes only. Do not auto-replace the app's coordinate from a map node until the exact intended point (platform, station centroid, entrance or transfer node) and station identity are verified.
- Commit `c52c1e1` completed successfully in both Static and Browser QA and GitHub Pages deployment. The next coordinate-audit commit is checked separately; do not infer its workflow status from the prior commit.



## Coordinate audit: high-confidence mismatches and M2 follow-up — 2026-10-09

- Re-reviewed the Marmaray discrepancies against station-node coordinates and geotagged station photos, then cross-checked the kilometre-scale M5 discrepancies against additional catalogues. Updated `qa/station-coordinate-audit.csv` in commit `53fbf3212820805c544fe7efe47880a0ca7f188a`.
- **Mismatch confirmed in the audit (application code unchanged):**
  - **Yunus Marmaray:** app candidate `40.87620, 29.22150`; Mapcarta/OSM station node `40.88456, 29.21041`, approximately 1.3 km apart. Wikidata repeats the same station coordinate, but shares likely source lineage; this remains provisional pending operator-map confirmation.
  - **Kaynarca Marmaray:** app candidate `40.86510, 29.23250`; Mapcarta/OSM and a geotagged Wikimedia Commons station photo place the station around `40.87137, 29.25596`, approximately 2.1 km apart.
  - **Kartal Marmaray:** app candidate `40.88560, 29.20840`; Mapcarta/OSM plus a geotagged platform photo place Kartal around `40.88869, 29.19108`, approximately 1.5 km apart. The app candidate is near the Yunus area, so the station-to-coordinate mapping must be rebuilt by identity, not fixed by blindly swapping points.
  - **Ümraniye M5:** two nearby OSM station nodes cluster around `41.025, 29.084`, versus app `41.02670, 29.10630` (about 1.9 km).
  - **Dudullu M5:** Mapcarta/OSM and DurakRehberi cluster around `41.0155, 29.1633`, versus app `41.00180, 29.15320` (about 1.7 km).
  - **Çekmeköy M5:** Mapcarta/OSM, DailyMetro and Metrocazar cluster around `41.0145, 29.1895`, versus app `41.02800, 29.17580` (about 1.9 km).
- **M2 Şişhane:** a university thesis station-coordinate appendix provides `41.028661, 28.974896`, around 105 m from the app candidate. This closes the no-comparison gap but leaves a point-definition review; the thesis is not an operator coordinate feed.
- **Kağıthane M7/M11:** the M7 point matches its Mapcarta/OSM node, while the M11 node is about 292 m east. The line-specific rows remain distinct in the audit; no coordinates were copied into the app.
- Updated status totals across all 49 records: 15 close matches, 7 non-official source matches, 14 non-official-source variance reviews, 4 coordinate-variance reviews, and 9 confirmed coordinate mismatches. There are no rows without a first-pass comparison, but **27 records remain unresolved for release** (18 variance reviews plus 9 mismatches). Non-operator source matches are provisional, not operator-certified.
- Evidence links: https://mapcarta.com/N1907439622 ; https://www.wikidata.org/wiki/Q58814876 ; https://commons.wikimedia.org/wiki/File:Kaynarca_Tren_%C4%B0stasyonu.jpg ; https://commons.wikimedia.org/wiki/File:Kartal_Tren_%C4%B0stasyonu.jpg ; https://mapcarta.com/N13819360040 ; https://durakrehberi.com/metro/istasyonlar/dudullu-60014/ ; https://dailymetro.live/istanbul/station/cekmekoy ; https://metrocazar.com/php/index_istanbul.php?action=showStation&from=84 ; https://nek.istanbul.edu.tr/ekos/TEZ/60672.pdf ; https://mapcarta.com/N8853285393
- **No app coordinates were changed.** Next: continue resolving remaining M2/M7/M11 and other line-specific variance records; then map each confirmed mismatch to the exact station/entrance/transfer node, apply only the verified corrections, and run full route/QA/live smoke regression.


## M4 / M11 follow-up and current QA status — 2026-10-09

- Commit `6165fee` updates only the coordinate audit CSV; application coordinates and route logic remain unchanged.
- **M4 cross-check:** the İstanbul Üniversitesi thesis appendix (station-coordinate list) independently supports the app points for Kartal (~6 m), Bostancı (~11 m), Yenisahra (~14 m), Ünalan (~16 m), Kozyatağı (~18 m), Maltepe (~37 m), Acıbadem (~53 m), and Pendik (~57 m). These remain secondary-source checks, not operator certification. Kadıköy shows a source-definition conflict: DailyMetro is ~17 m from the app point while the thesis point is ~130 m away, so it remains a variance review.
- **Marmaray:** geotagged Wikimedia station photographs support the source cluster for Yunus, Kaynarca, Kartal, Suadiye and Feneryolu; the app candidates are about 0.5–2.1 km away. These are recorded as mismatches, but the exact routing/access point still needs operator/entrance verification before any code change.
- **M7/M11 Kağıthane:** M7's app point is supported by an M7 station photo; the M11 entrance photo and station-node sources put M11 about 292 m east of the M7 point. The two line-specific records must remain separate.
- **M3/M11 Kayaşehir:** the M11 photo point is about 75 m from the app candidate, but the same candidate is also about 84 m from the M3 Kayaşehir Merkez node. This shared-coordinate ambiguity remains unresolved until the two station access/routing nodes are explicitly distinguished.
- **M2 Levent and Şişli-Mecidiyeköy:** thesis, OSM/catalogue nodes and geotagged station photos converge on source clusters roughly 0.5–0.6 km from the app candidates. They remain high-priority variance reviews; no coordinates were copied into the app.
- **M5 Altunizade:** the thesis point is about 50 m from the app candidate. The OSM node that was about 185 m away is tagged as a bus-stop/interchange node, not clearly the M5 platform point; this record is now classified as a close secondary-source match rather than a confirmed mismatch.
- Current status across the audit: 49 rows compared; 22 close/match records; 27 unresolved records. **No app coordinates were changed.**
- Actions for commit `6165fee` passed: [Static and Browser QA](https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37948174322) and [Pages build/deployment](https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37948171840). Live smoke reported **16 passed, 0 failed**; expected and live build both `V230.12.19-BUSINESS-ROUTE-QA`; service-worker/cache version matched; offline app shell worked; no uncaught JavaScript or console errors. Browser QA loaded all 40 end-to-end route fixtures and passed the GPS permission, station-exit registry, unverified-transfer blocking, and offline-cache checks.
- The report-only commit triggered its own workflow runs; those must be checked separately before calling the very latest repository state fully green.


## Official IBB station API cross-check and static fallback corrections — 2026-10-09

- Live browser smoke test called the app's existing official endpoint `https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetStations` and received **230 mapped station records**. This is stronger evidence than third-party map-only comparison for the station points returned by this endpoint.
- Official API points observed in the live test and now used by the static/offline fallback:
  - M5 Ümraniye: `41.0247504412, 29.0849146199` (previous fallback was ~1.8 km away).
  - M5 Dudullu: `41.0154404556, 29.1624463539` (previous fallback was ~1.7 km away).
  - M5 Çekmeköy: `41.0145661700, 29.1894478115` (previous fallback was ~1.9 km away).
  - M2 Şişli-Mecidiyeköy: `41.0645069127, 28.9926697578` (previous fallback was ~0.5–0.6 km away).
  - M2 Levent: `41.0767734293, 29.0136876237` (previous fallback was ~0.5–0.6 km away).
  - M7 Kağıthane: `41.0799698, 28.9722495` (previous fallback was ~80 m away).
  - M3 Kayaşehir Merkez: `41.1200643721, 28.7666429962` (previous fallback was ~190 m away).
- The coordinates above are the operator API's station points, not proof that each point is the best public pedestrian entrance. The code and cache version were updated to `V230.12.20-IBB-GPS-FALLBACK` / `itp-v230.12.20-core`; the static fallback is now aligned with the official online data for those seven station/line keys.
- M11 Kağıthane and M11 Kayaşehir remain separate from M7/M3; the IBB response did not return corresponding M11 records in this diagnostic. Marmaray is also not covered by these seven API comparisons. No unverified M11 or Marmaray point was overwritten.
- Audit statuses after the seven API-aligned corrections: {"CROSS_CHECKED_OFFICIAL_SOURCE_MATCH":29,"CROSS_CHECKED_NONOFFICIAL_SOURCE_CLOSE_MATCH":4,"CROSS_CHECKED_NONOFFICIAL_SOURCE_MATCH":11,"CROSS_CHECKED_NONOFFICIAL_SOURCE_VARIANCE_REVIEW":4,"CROSS_CHECKED_COORDINATE_MISMATCH_CONFIRMED":1}. 7 rows remain unresolved for release; this includes non-official-source variance reviews, unresolved variance checks and confirmed mismatches. Non-operator points are not treated as operator-certified.
- Added a live smoke assertion that compares the seven static fallback points to the corresponding live IBB API points (10 m tolerance). This guards against a future offline fallback drifting away from the official station registry.
- Commit `a602fb0` passed static QA, Pages deployment and live smoke (18/18), but browser QA exposed a stale hard-coded cache-name assertion in the test suite after the version bump. This was a test-maintenance defect, not an app runtime defect: commit `7b68e4c` now derives the expected cache name from `sw.js`. On `7b68e4c`, **Static QA passed, Browser QA passed 111/111, Live smoke passed 18/18, and Pages deployment succeeded**. Live smoke confirmed build `V230.12.20-IBB-GPS-FALLBACK`, official IBB station API response (230 mapped rows), all seven static fallback coordinates within 0 m of the returned official coordinates, working service-worker/cache version, offline app-shell loading, and no uncaught JS or console errors. QA: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37949717622 ; Pages: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37949716548.


## Next source-resolution stage — Marmaray and M11 access points

- The seven official IBB coordinate points are now aligned in both online mapping and the static fallback. They are station points from the operator API; the source does not explicitly identify each public entrance.
- Remaining high-priority records must not be overwritten from station-centroid coordinates alone: Marmaray Yunus, Kaynarca, Kartal, Suadiye and Feneryolu; M11 Olimpiyat; M11 Kayaşehir; plus the M4 Sabiha Gökçen variance review.
- For the five Marmaray records, independent station nodes and geotagged platform/station photographs converge on the same station areas, but those sources do not by themselves prove the exact pedestrian entrance. Before changing the app, match each station's entrance/stair node to a current map and verify it does not resolve to the adjacent station or a platform-only point.
- For M11 Kağıthane and Kayaşehir, preserve line-specific points. The live IBB API diagnostic did not return M11 rows; M7/M3 official coordinates must not be copied to M11. For Olimpiyat M11, independently resolve the station identity before using any nearby coordinate.
- The remaining audit is deliberately not considered release-ready until these station/entrance identities and walking targets are verified. Current audit totals: 49 records, 42 source-aligned/close-match records, and 7 unresolved records.


## M11 Olimpiyatköy entrance correction — 2026-10-09

- **Station identity:** Metro İstanbul's official M9 page states that Olimpiyat station provides a transfer to M11: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M9. The UAB project map labels the M11 stop as Olimpiyatköy: https://aygm.uab.gov.tr/uploads/pages/kentici-rayli-sistemler-daire-baskanliklari/istanbul-halkali-istanbul-havalimani-metrosu.pdf.
- **Physical entrance evidence:** the Wikimedia Commons photo dated 21 June 2026 visibly shows the sign “Olimpiyatköy İstasyonu” at the entrance, with Ministry/AYGM branding. The camera geotag is `41.078967, 28.768925`: https://commons.wikimedia.org/wiki/File:M11_Olimpiyatk%C3%B6y_Metro_%C4%B0stasyonu_21062026_12.jpg.
- The prior static M11 point `41.05629, 28.77441` was the same as Halkalı Stadı M11 and approximately 2.5 km from the photographed Olimpiyatköy entrance. The static fallback and label are corrected to `Olimpiyatköy M11 — 41.078967, 28.768925`; build/cache bumped to `V230.12.21-M11-ENTRANCE-FIX` / `itp-v230.12.21-core`.
- Audit status for this row changed from confirmed mismatch to a close match against a geotagged, clearly identified entrance photo; it remains a secondary-source coordinate rather than an operator API coordinate. Total unresolved records decrease from 22 to 21.
- Added a Browser QA assertion that the static M11 point retains this entrance coordinate and correct station name. The internal routing node remains `olimpiyat` for both M9 and M11, reflecting the official interchange; the actual walking path/time between the line-specific entrance/platform points remains a separate route-level check.
- For M11 correction commit `e30a544`, Static QA passed, Browser QA passed 112/112, live smoke passed 18/18 and Pages deployment succeeded.


## Full official API fallback audit + Marmaray entrance pins — 2026-10-09

- A live API diagnostic compared all 49 static GPS fallbacks with the 230-row official IBB Metro İstanbul registry. The endpoint supports **29 line-specific station keys** in the app. Seven were already aligned; the remaining 22 static fallback coordinates have now been aligned to their matching official API rows (M4/M5/M2/M9, including Sabiha Gökçen, Maltepe, Vezneciler, Taksim, Gayrettepe, 4. Levent, Hacıosman and Olimpiyat). This includes correction of Sabiha Gökçen M4 from a ~471 m difference and Maltepe M4 from ~258 m.
- The live smoke now asserts that all 29 API-covered fallback points match the official point within 10 m, rather than testing only the first seven.
- Four Marmaray fallbacks were corrected using station-specific Google Maps location pins linked from pages whose imagery is explicitly labeled as the station entrance; each point independently aligns with its Mapcarta/OSM station node within 20 m:
  - Yunus: `40.88444444, 29.21055556` (old static point was ~1.3 km away).
  - Kaynarca: `40.87138889, 29.25583333` (old static point was ~2.1 km away).
  - Kartal Marmaray: `40.88861111, 29.19111111` (old static point was ~1.5 km away).
  - Suadiye: `40.96055556, 29.08444444` (old static point was ~0.6 km away).
- The corresponding station-specific location sources are https://marmarayistanbul.com.tr/yunus-marmaray/ ; https://marmarayistanbul.com.tr/kaynarca-marmaray/ ; https://marmarayistanbul.com.tr/kartal-marmaray/ ; https://marmarayistanbul.com.tr/suadiye-marmaray/. These are secondary sources, not TCDD operator data; the source pins were cross-checked against independent OSM/Mapcarta station nodes and geotagged station imagery.
- Feneryolu Marmaray remains unmodified because its station guide's Google Maps link resolves to a text search rather than a precise entrance coordinate. The existing point is clearly wrong by about 0.5 km, but a station-centre coordinate is not being substituted for a verified public entrance.
- Build/cache bumped to `V230.12.22-IBB-MARMARAY-FALLBACK` / `itp-v230.12.22-core`. Commit `1af34d7` passed Static QA, Browser QA **112/112**, Live smoke **20/20**, and Pages deployment. Live smoke confirmed build/version match, 230 mapped IBB station rows, all 29 API-covered fallback points matched within 10 m, all four Marmaray pins matched within 20 m, offline app-shell loading, service-worker cache version, and no uncaught JavaScript or console errors. QA: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37951907671 ; Pages: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37951903712.
- Current audit totals: 49 rows; 44 close/matched rows; 5 unresolved rows. Status breakdown: `{"CROSS_CHECKED_OFFICIAL_SOURCE_MATCH":29,"CROSS_CHECKED_NONOFFICIAL_SOURCE_CLOSE_MATCH":4,"CROSS_CHECKED_NONOFFICIAL_SOURCE_MATCH":9,"CROSS_CHECKED_NONOFFICIAL_SOURCE_VARIANCE_REVIEW":5,"CROSS_CHECKED_COORDINATE_MISMATCH_CONFIRMED":1,"COORDINATE_VARIANCE_REVIEW_REQUIRED":1}`.


## M11 Kağıthane Entrance 1 correction — 2026-10-09

- The prior M11 Kağıthane fallback reused the M7 point `41.07965, 28.97312`, although the M11 entrance is about 292 m east.
- The geotagged Wikimedia Commons photo titled “M11 Kağıthane Metro Entrance 1” identifies the physical entrance; camera point `41.08035, 28.97560`. The OSM/Mapcarta M11 station node at `41.08009, 28.97656` is about 90 m away. Official UAB M11 route map: https://aygm.uab.gov.tr/uploads/pages/kentici-rayli-sistemler-daire-baskanliklari/istanbul-halkali-istanbul-havalimani-metrosu.pdf ; entrance photo: https://commons.wikimedia.org/wiki/File:M11_Ka%C4%9F%C4%B1thane_Metro_Entrance_1.jpg.
- The static M11 fallback now uses `41.08035, 28.97560`; M7 remains at the official IBB point `41.0799698, 28.9722495`. Build/cache bumped to `V230.12.23-M11-KAGITHANE-ENTRANCE` / `itp-v230.12.23-core`.
- Added Browser QA and live-smoke checks for both M11 entrance points (Kağıthane Entrance 1 and Olimpiyatköy entrance). Current audit totals: 49 rows; 43 close/matched rows; 6 unresolved rows. The exact public entrance for Feneryolu Marmaray and M11 Kayaşehir remains unresolved, so those points are not changed.
- Commit `dc8df9a` passed Static QA, Browser QA **113/113**, Live smoke **21/21**, and Pages deployment. The live smoke confirmed the new build/cache version, 29 official IBB fallback points aligned within 10 m, four Marmaray entrance pins aligned within 20 m, and both geotagged M11 entrances aligned; offline app-shell and JavaScript error checks also passed. QA: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37952637562 ; Pages: https://github.com/istanbultransport/istanbul-tourist-transport-planner/actions/runs/37952635699. Status breakdown: `{"CROSS_CHECKED_OFFICIAL_SOURCE_MATCH":29,"CROSS_CHECKED_NONOFFICIAL_SOURCE_CLOSE_MATCH":4,"CROSS_CHECKED_NONOFFICIAL_SOURCE_MATCH":10,"CROSS_CHECKED_NONOFFICIAL_SOURCE_VARIANCE_REVIEW":4,"CROSS_CHECKED_COORDINATE_MISMATCH_CONFIRMED":1,"COORDINATE_VARIANCE_REVIEW_REQUIRED":1}`.


## Current release gate — 2026-10-09

- Latest tested app build: `V230.12.23-M11-KAGITHANE-ENTRANCE`; service-worker cache: `itp-v230.12.23-core`.
- Last full CI result: Static QA passed, Browser QA 113/113, Live smoke 21/21, Pages deployment success.
- Current 49-row coordinate audit after the M11 Kayaşehir correction: 44 close/matched rows and 5 unresolved rows. Remaining unresolved entries are four nonofficial-source variance reviews and one confirmed Feneryolu Marmaray mismatch (exact entrance still unverified).
- No coordinate should be changed for those remaining six records until the specific entrance/access point is identified and station identity is distinguished from neighboring stations/platforms.


## Four-record batch review — Bostancı, Göztepe, Ayrılık Çeşmesi, Üsküdar Marmaray — 2026-10-09

This batch reviewed four remaining variance records against station-specific secondary map references and entrance evidence. **No application coordinates were changed** because the available references establish station locations but do not consistently establish the exact public entrance for the Marmaray line:

- **Bostancı:** OSM/Mapcarta point `40.95393, 29.09490` differs by ~135 m; another directory point `40.9538, 29.0952` is still ~100 m from the app point. Entrance not independently confirmed.
- **Göztepe:** OSM/Mapcarta point `40.97921, 29.06263` differs by ~75 m. A Google Maps directions result confirms station identity but not a precise entrance pin.
- **Ayrılık Çeşmesi:** Marmaray OSM node `41.00015, 29.03010` is ~40–50 m away. Geotagged photos around `41.00035, 29.03005` identify the M4 metro entrance; they do not prove the correct Marmaray public entrance, so line-specific point remains unchanged.
- **Üsküdar:** OSM/Mapcarta Marmaray node `41.02564, 29.01315` is ~50 m away, while another directory gives `41.0259, 29.0148`. Metro İstanbul names a distinct “İETT durakları–Marmaray girişi”, but the consulted reference does not give its exact coordinates. The M5 point was not copied onto Marmaray.
- Audit notes now record the comparison and why each point is being held. This is a completed evidence review, not a claim that the four entrance coordinates are verified. Next batch will handle the remaining Feneryolu mismatch and M11 Kayaşehir ambiguity, plus two cross-line station/access checks to keep batches at four records.


## Four-record batch 2 — M11 Kayaşehir, Feneryolu, Kağıthane and Olimpiyat — 2026-10-09

- **Kayaşehir M11 (corrected):** the 2026 geotagged Wikimedia photo identifies the M11 station entrance at `41.117733, 28.765983`; the DailyMetro point `41.11749, 28.76574` is about 35 m away. The prior fallback `41.11833, 28.76639` was between the M3 and M11 station points. The fallback now uses the M11 photo geotag. M3 Kayaşehir Merkez stays at its separate official IBB point `41.1200643721, 28.7666430`.
- **Feneryolu Marmaray (reviewed, unchanged):** confirmed location mismatch remains about 0.5 km, but no exact public entrance coordinate has been independently identified. It stays blocked from coordinate changes rather than substituting a station-centre node.
- **Kağıthane M11 (cross-line check):** retains its separate Entrance 1 point `41.08035, 28.97560`; M7 remains `41.0799698, 28.9722495`. Regression coverage checks the line-specific M11 entrance.
- **Olimpiyatköy M11 (cross-line check):** retains the geotagged entrance point `41.078967, 28.768925`; M9 Olimpiyat remains at its distinct official IBB point `41.0797858226, 28.7684944422`. The station is an interchange, but line-specific fallback points are not collapsed to one coordinate.
- Build/cache bumped to `V230.12.24-KAYASEHIR-M11-ENTRANCE` / `itp-v230.12.24-core`. Browser QA now asserts that M11 Kayaşehir remains separate from M3 Kayaşehir Merkez; live smoke includes all three geotagged M11 entrance targets. This commit's Actions must pass before the batch is marked green.
- Audit totals: 49 records; 44 close/matched; 5 unresolved (four Marmaray variance reviews and the Feneryolu confirmed mismatch).


## CI reliability fix — deployment race between Pages and live smoke — 2026-10-09

- On build `V230.12.24-KAYASEHIR-M11-ENTRANCE`, Static QA passed and Browser QA passed, but live smoke ran while Pages deployment was still publishing and saw the previous cache version `itp-v230.12.23-core`. The same job log confirmed the new HTML build ID was already served and the new M11 coordinate assertions passed; the failing assertion was the service-worker cache still being one deployment behind.
- This is a CI ordering/race issue, not evidence of a station-coordinate regression. Live smoke previously retried deployment visibility four times (~45 seconds); that window was too short for this deployment.
- Increased the live build/cache visibility retry window to eight attempts (~105 seconds) before marking the live build/cache version mismatch as a failure. This keeps the check strict but tolerates the normal Pages propagation window.
- The new workflow run must confirm the fix; do not mark the current build fully green based only on static/browser success.


## Four-record batch 3 — same-name cross-line station geometry — 2026-10-09

Added browser and live-smoke regression checks for four pairs whose names are shared across lines but whose access points should not be blindly merged:

- **Ayrılık Çeşmesi M4 ↔ Marmaray:** ~42 m; expected close interchange complex (≤150 m).
- **Üsküdar M5 ↔ Marmaray:** ~115 m; expected close interchange complex (≤200 m).
- **Kartal M4 ↔ Marmaray:** ~2,630 m; distinct stations despite sharing “Kartal” in the label (must remain >500 m apart).
- **Pendik M4 ↔ Marmaray:** ~1,069 m; distinct stations despite sharing “Pendik” (must remain >500 m apart).
- No application coordinates changed in this batch. The purpose is to prevent future fallback updates from collapsing distinct stations or making interchange geometry implausible. The live smoke will report the measured distances and fail if any pair crosses its tolerance.


### Batch 3 test correction

- First live-smoke run for batch 3 exposed a test-code placement error: the cross-line pair calculation had been inserted inside the Marmaray point-comparison callback, so it never populated the top-level diagnostic result. The app coordinates were not implicated; all preceding live coordinate, cache and M11 checks passed.
- Moved the four-pair geometry comparison to the diagnostic's correct scope so live smoke can report all four distances and evaluate the tolerance assertions. Static QA and Browser QA passed; the corrected live smoke and deployment must be rerun before this batch is green.


### Batch 3 live-smoke follow-up

- Static QA caught a duplicate `m11EntranceTargets` declaration after the cross-line check was moved to the correct scope. The duplicate was introduced during test refactoring; it did not modify application code or coordinates.
- Removed the second declaration and retained the original three-entry M11 entrance comparison. Static QA, browser QA, live smoke and Pages deployment are being rerun on the corrected commit.


## Four-record batch 4 — Marmaray station-node comparison — 2026-10-09

Added browser and live-smoke comparisons for four additional Marmaray points against secondary OSM/Mapcarta station nodes. These are **station-node proximity checks**, not claims that the exact public entrance is proven:

- **Pendik:** app `40.88016, 29.23162`; source `40.88024, 29.23165`; tolerance 20 m.
- **Erenköy:** app `40.97167, 29.07638`; source same point; tolerance 10 m.
- **Söğütlüçeşme:** app `40.99020, 29.03810`; source `40.99065, 29.03791`; tolerance 75 m.
- **Ayrılık Çeşmesi:** app `40.99990, 29.02985`; Marmaray station node `41.00015, 29.03010`; tolerance 60 m. This proximity does not resolve the line-specific public-entrance question; the row remains under review.
- No app coordinates changed. The new regression checks prevent these known station nodes from drifting while keeping entrance uncertainty explicitly documented.


## Four-record batch 5 — M11 line-specific station geometry — 2026-10-09

Added four more coordinate-separation regressions for line-specific points. These check straight-line geometry only, not walking-route lengths:

- **Kağıthane M7 ↔ M11 Entrance 1:** 284 m; expected 200–400 m.
- **Kayaşehir Merkez M3 ↔ Kayaşehir M11:** 265 m; expected 150–350 m.
- **Olimpiyat M9 ↔ Olimpiyatköy M11:** 98 m; expected ≤150 m for the interchange area, while retaining separate line-specific points.
- **Halkalı Stadı M11 ↔ Olimpiyatköy M11:** 2,566 m; expected >500 m because these are distinct stations.
- No app coordinates changed. Browser QA and live smoke now guard against accidental line-point reuse/collapse across these four relationships.

## Four-record entrance-evidence review — Marmaray Bostancı, Göztepe, Ayrılık Çeşmesi, Üsküdar — 2026-10-15

Reviewed four existing variance records against additional geotagged-photo or map references. **No application coordinates were changed** because these sources locate the station/platform area but do not independently identify the exact public entrance.

- **Bostancı Marmaray:** a platform photo geotag is `40.953570, 29.094935` ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bostanci_station.jpg)), about 125 m from the current fallback. The photo is explicitly a view from the Marmaray platform, not an entrance pin.
- **Göztepe Marmaray:** a platform photo geotag is `40.979512, 29.063598` ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:G%C3%B6ztepe_Tren_%C4%B0stasyonu.jpg)), about 170 m from the current fallback. It supports station identity but does not establish the public entrance.
- **Ayrılık Çeşmesi Marmaray:** a station photo is geotagged at `41.000756, 29.030189` ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Marmaray_Ayr%C4%B1l%C4%B1k_%C3%87e%C5%9Fmesi_istasyonu_-_İstanbul.jpg)), about 100 m from the current fallback. A separate image at `41.000353, 29.030052` shows the M4 metro entrance ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ayr%C4%B1l%C4%B1k_%C3%87e%C5%9Fmesi_Metro_Giri%C5%9Fi.jpg)); that point must not be mislabeled as the Marmaray entrance.
- **Üsküdar Marmaray:** a secondary station directory gives `41.025703, 29.014858` ([station listing](https://travel.turkeyturism.com/en/marmaray-uskudar-istasyonu-90-444-8-233.html)), about 100 m from the current fallback. This supports the station area but is not entrance-level evidence.

The CSV review notes now record these comparisons and sources. All four rows remain variance-review items. Do not convert a platform-photo or station-centre coordinate into an entrance coordinate without stronger evidence; route-level map/field verification remains required.

