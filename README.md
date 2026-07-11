# GoodWebTools

Privacy-first client-side utilities. All processing happens in your browser.

## Features

- **100% Client-Side** - No file uploads, no servers
- **Works Offline** - Install as PWA (coming soon)
- **Open Source** - Audit the code yourself
- **Privacy-First** - Verify with DevTools Network tab

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
npm install
npm run dev
```

Open http://localhost:4321

### Scripts

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Architecture

- **Astro** - Static site with View Transitions
- **React** - Islands for interactivity
- **Tailwind CSS** - Styling
- **Nanostores** - State management
- **Comlink** - Worker communication
- **Vitest** - Testing

## Phase 0 Status

✅ Foundation complete:
- Tool registry with search
- Theme system (light/dark)
- Shared services (File, Worker, Asset, Download, Progress, Persistence)
- Command palette (⌘K)
- Hash demo tool

**Next:** Phase 1 - Dev/Office utilities

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick deploy to Cloudflare Pages:**
```bash
npm run build
npx wrangler pages deploy dist --project-name=goodwebtools
```

## License

MIT
