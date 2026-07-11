# Deployment Guide

## Cloudflare Pages Deployment

### Prerequisites

1. **Cloudflare Account** - Sign up at https://dash.cloudflare.com
2. **Domain** - Configure GoodWebTools.com in Cloudflare DNS
3. **GitHub Repository** - Code hosted on GitHub

### Automatic Deployment (Recommended)

The project uses GitHub Actions for automatic deployment on every push to `main`.

#### Setup Steps:

1. **Create Cloudflare API Token:**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Cloudflare Pages — Edit" permissions
   - Copy the token

2. **Add GitHub Secrets:**
   - Go to repository Settings → Secrets and variables → Actions
   - Add secrets:
     - `CLOUDFLARE_API_TOKEN` - Your API token
     - `CLOUDFLARE_ACCOUNT_ID` - Found in Cloudflare dashboard URL

3. **Push to main branch:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

4. **Monitor deployment:**
   - Check Actions tab in GitHub
   - Check Cloudflare Pages dashboard

### Manual Deployment

Using Wrangler CLI:

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build project
npm run build

# Deploy
wrangler pages deploy dist --project-name=goodwebtools
```

### Environment Configuration

#### Build Settings:
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 20

#### Environment Variables:
None required - all processing is client-side

### Custom Domain Setup

1. **In Cloudflare Pages Dashboard:**
   - Go to your project → Custom domains
   - Click "Set up a custom domain"
   - Enter: `goodwebtools.com` and `www.goodwebtools.com`

2. **DNS Configuration (if not using Cloudflare DNS):**
   - Add CNAME record: `goodwebtools.com` → `<project>.pages.dev`
   - Add CNAME record: `www` → `<project>.pages.dev`

### Security Headers

The deployment automatically includes security headers for:
- Cross-Origin-Embedder-Policy (COEP)
- Cross-Origin-Opener-Policy (COOP)
- Content-Security-Policy (CSP)

These headers enable SharedArrayBuffer and isolation features needed for WebAssembly tools.

### Performance

- **Global CDN** - Automatic edge caching
- **HTTP/3** - Enabled by default
- **Brotli compression** - Automatic
- **Asset optimization** - Automatic minification

### Monitoring

Check deployment health:
- Cloudflare Analytics dashboard
- GitHub Actions logs
- Browser DevTools Network tab (verify no external requests)

### Rollback

To rollback to a previous version:

```bash
# Via Wrangler
wrangler pages deployment list --project-name=goodwebtools
wrangler pages deployment tail <deployment-id>

# Or use Cloudflare dashboard
# Pages → goodwebtools → Deployments → Rollback
```

### Troubleshooting

**Build fails with dependency errors:**
```bash
npm ci --legacy-peer-deps
```

**Service worker not updating:**
- Clear cache in browser DevTools
- Check sw.js file exists in dist/
- Verify manifest.webmanifest is present

**404 on routes:**
- Astro static output generates /tools/hash-demo/index.html
- Cloudflare Pages auto-handles trailing slashes
- Check astro.config.mjs `output: 'static'`

### Cost

- **Free tier:** 500 builds/month, unlimited bandwidth
- Perfect for this privacy-first, static project
