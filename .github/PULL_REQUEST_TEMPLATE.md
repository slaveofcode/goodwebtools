## What does this PR do?

<!-- A short description. Link any related issue: Closes #123 -->

## Checklist

- [ ] `npm test -- --run` passes
- [ ] `npm run build` succeeds
- [ ] `npm run lint` is clean
- [ ] New tool? It's registered in `src/registry/tools.ts` with an island + tests
- [ ] No owner-specific deploy assets changed (wrangler bucket names, secrets, domain)
- [ ] Everything still runs fully client-side (no data leaves the browser)
