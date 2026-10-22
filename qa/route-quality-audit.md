# Route quality audit

## Purpose

The browser QA run now emits a `ROUTE_QUALITY_REVIEW` record for route fixtures with potentially burdensome journeys. These records are triage signals for engineering review, not automatic proof that a route is wrong.

## Metrics

- `score`: the route engine's internal `routeDecisionScore`; lower is preferred by the current heuristic.
- `transitTransfers`: estimated transfer count from the route engine.
- `walkMinutes`: walking duration estimated from route metadata and app heuristics; it is not a live ETA or a field measurement.
- `localSteps`: local/surface-access steps.
- `busSteps`: bus legs.
- `railStops`: the route engine's rail-distance proxy.
- `surfaceMinutes` / `surfacePenalty`: surface-transfer metadata and its heuristic penalty.
- `candidateCount`: number of valid alternatives produced by `generateRouteCandidates`.

## Review flags

A fixture is printed for human review if one or more thresholds are met:

- `walkMinutes >= 20`
- `transitTransfers >= 3`
- `localSteps >= 2`
- `busSteps >= 2`
- `airport-alternative-coverage<2` for the Pendik, Four Seasons Sultanahmet, and Radisson Blu Asia airport fixtures when the candidate builder returns fewer than two valid candidates.

These thresholds prioritize review; they do not fail the build. A long walk may be the only realistic access, and the estimates can be incomplete. The airport candidate-coverage flag indicates that QA cannot compare multiple generated candidates; it does **not** mean the selected route is incorrect or that an unverified alternative should be invented.

## Automated guarantees

For every fixture, browser QA checks that route-quality metrics are finite. Where candidates exist, it checks that candidate ordering is consistent with `compareRouteQuality` and that `selectBestRoute` returns the first-ranked candidate.

These assertions test internal consistency only. They do **not** prove the chosen journey is fastest, the walking estimate is correct, the route data is current, or the trip has been verified in the field. Those require comparison with reliable current operator data and manual live-browser checks.

## Follow-up procedure

1. Run the browser QA workflow and collect every `ROUTE_QUALITY_REVIEW` record.
2. Review flagged fixtures against official operator sources and a live map; record evidence and expected route.
3. Correct route logic/data only when the evidence supports a change.
4. Add a fixture-specific regression assertion for each confirmed defect.
5. Rerun the failed case and the full browser QA suite before merging.
