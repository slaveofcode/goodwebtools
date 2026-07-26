# Contributing to GoodWebTools

Thanks for wanting to help! GoodWebTools is a collection of privacy-first tools
that run entirely in the browser. Contributions — new tools, fixes, docs — are
welcome.

## Setup

```bash
git clone https://github.com/slaveofcode/goodwebtools
cd goodwebtools
npm install --legacy-peer-deps   # a peer-dep conflict (tfjs/upscaler) needs this
npm run dev                      # http://localhost:4321
```

Some tools need ML model files staged locally: `npm run stage:models`.

## Checks (run before opening a PR)

```bash
npm test -- --run    # unit tests (Vitest)
npm run build        # production build
npm run lint         # ESLint
```

CI runs all three on every PR.

## Branching

- Base your work on `develop` (not `main`). Open PRs against `develop`.
- Keep PRs focused; one tool or fix per PR.

## Adding a new tool

Tools are self-registering. To add one:

1. **Pure logic** → `src/tools/<category>/<name>.lib.ts` with Vitest tests
   (`<name>.lib.test.ts`). Keep DOM/canvas out of the pure functions so they're
   testable.
2. **UI island** → `src/islands/<category>/<Name>.tsx`, a default-exported React
   component with **no required props**. Use the shared UI (`Dropzone`,
   `ImageResult`/`ResultActions`, `usePasteImage`, etc.).
3. **Register it** in `src/registry/tools.ts` — append a `ToolDef`:
   ```ts
   {
     id: 'my-tool',
     name: 'My Tool',
     category: 'Image',            // Dev | PDF | Image | Files | Draw | Media | Playground
     route: '/tools/my-tool',
     keywords: ['...'],
     icon: SomeLucideIcon,
     summary: 'One-line description',
     load: () => import('@/islands/image/MyTool'),
     status: 'stable',
   }
   ```
   The route and page are generated automatically from the registry.

That's it — no routing or page files to touch.

## Principles

- **Client-side only.** No servers, no uploads; user data never leaves the browser.
- **Follow existing patterns.** Match the surrounding code's style and structure.
- **Test the logic.** Pure `*.lib.ts` functions get unit tests.

## Reporting bugs / ideas

Use the issue templates, or start a [Discussion](https://github.com/slaveofcode/goodwebtools/discussions).
By contributing you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
