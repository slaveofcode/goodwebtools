# API Client — UX Improvements

**Date:** 2026-08-16 · Improve existing tool (`api-client`, Dev).

Four user-requested improvements:
1. **Rename environments** — env edit panel now has a Name field (was stuck on "New Environment"); `onRenameEnv` mutates the env name.
2. **Explain environments** — an Info (ⓘ) toggle by the ENV header reveals how variables + `{{name}}` substitution work; env edit uses a Pencil icon and shows a KEY=value placeholder.
3. **Sent-request inspector** — new "Request" tab in the response panel shows the actual outgoing request (method, resolved URL, headers incl. auth, body) with `{{variables}}` resolved. Backed by pure `summarizeSentRequest(req)` in `api-client-request.lib.ts` (unit-tested). The sidebar History tab already logs every sent request.
4. **Collection list redesign** — colored method badge chips, active-request highlight (accent left-border + tint), collection request-count pill, folder icon, hover-reveal actions.

Also updated EN + ID SEO (howTo + a new FAQ about inspecting the sent request).

## DoD
`summarizeSentRequest` unit-tested · full suite + lint + build green · env-help verified rendering via headless screenshot · ship develop→main→verify live.
