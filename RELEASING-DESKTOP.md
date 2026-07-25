# Desktop Release Guide

How to build, sign, and publish a GoodWebTools desktop release.

## Prerequisites

- Rust + Cargo (stable)
- Node.js 20+ / npm 10+
- `@tauri-apps/cli` (`npm install` already pulls this in)
- FFmpeg sidecars in `src-tauri/bin/` (see [Bundling FFmpeg](#bundling-ffmpeg))
- The Tauri signing private key (see [Signing Setup](#signing-setup))

---

## Signing Setup

GoodWebTools releases are signed with an Ed25519/minisign key so that the
auto-updater can verify downloads haven't been tampered with.

### Generating the keypair (one-time, already done)

The keypair was generated once and the public key is already committed to
`src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

If you ever need to regenerate it:

```bash
# 1. Generate an Ed25519 private key
openssl genpkey -algorithm ed25519 -out ~/.tauri/goodwebtools_priv.pem

# 2. Extract the public key
openssl pkey -in ~/.tauri/goodwebtools_priv.pem -pubout -out ~/.tauri/goodwebtools_pub.pem

# 3. Build the minisign public key (magic "Ed" + 8-byte key-id + 32-byte pk)
python3 - << 'EOF'
import base64, os
spki = base64.b64decode(open('/Users/tada-adityakresna/.tauri/goodwebtools_pub.pem')
    .read().replace('-----BEGIN PUBLIC KEY-----','').replace('-----END PUBLIC KEY-----','').strip())
raw_pk = spki[12:]  # skip 12-byte SPKI header
minisign_pub = base64.b64encode(b'Ed' + os.urandom(8) + raw_pk).decode()
print(f'pubkey: {minisign_pub}')
EOF

# 4. Put the printed pubkey into src-tauri/tauri.conf.json → plugins.updater.pubkey
```

### Adding the private key to GitHub Actions

The CI release workflow (`release.yml`) needs the private key to sign each
platform artifact. Store it as a GitHub Actions secret:

1. Export the private key as base64:

   ```bash
   openssl pkey -in ~/.tauri/goodwebtools_priv.pem -traditional | openssl base64 -A
   ```

2. Go to **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**.

3. Create the following secrets:

   | Secret name                        | Value                                      |
   |------------------------------------|--------------------------------------------|
   | `TAURI_SIGNING_PRIVATE_KEY`        | Base64 string from step 1                  |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Leave empty (no password was set)        |

4. The `release.yml` workflow already reads these via:

   ```yaml
   env:
     TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
     TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
   ```

### GitHub Actions secrets — full reference

`release.yml` references the secrets below. Set them under **repo → Settings →
Secrets and variables → Actions**. The **updater** secrets are required for a
usable release; the **Apple** secrets are optional but recommended for macOS
(without them, macOS builds are unsigned/un-notarized and Gatekeeper warns users).

| Secret | Required | Purpose | How to obtain |
|--------|----------|---------|---------------|
| `TAURI_SIGNING_PRIVATE_KEY` | **Yes** | Signs each artifact so the auto-updater can verify it | `openssl pkey -in ~/.tauri/goodwebtools_priv.pem -traditional \| openssl base64 -A` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | **Yes** (may be empty) | Password for the signing key | Empty string if the key has no password |
| `APPLE_CERTIFICATE` | macOS only | Base64 of the Developer ID Application `.p12` | `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | macOS only | Password for the `.p12` | Set when exporting the cert |
| `APPLE_SIGNING_IDENTITY` | macOS only | Codesign identity | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | macOS only | Apple ID for notarization | Your Apple developer account email |
| `APPLE_PASSWORD` | macOS only | App-specific password for notarization | appleid.apple.com → Sign-In & Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | macOS only | Apple Developer Team ID | Apple Developer → Membership |

> **Minimum to ship a beta:** just the two `TAURI_SIGNING_*` secrets. Without the
> Apple secrets the macOS `.app`/`.dmg` still builds, but users must right-click →
> Open to bypass Gatekeeper. Windows/Linux need no additional secrets.

**Verify a release built correctly:** after the tag build finishes, the GitHub
Release should contain per-platform installers **and** a `latest.json` (the
updater manifest, signed with `TAURI_SIGNING_PRIVATE_KEY`). If `latest.json` is
missing, the signing secrets weren't set.

> **Keep the private key safe.** Never commit `~/.tauri/goodwebtools_priv.pem`
> to the repository. It is already covered by `.gitignore` via `src-tauri/bin/`
> exclusion, but store an offline backup in a password manager.

---

## Bundling FFmpeg

Screen recording with audio requires a platform-specific FFmpeg binary bundled
inside the app. Place each binary at `src-tauri/bin/ffmpeg-<triple>`:

| Platform          | Triple                           | Extension |
|-------------------|----------------------------------|-----------|
| macOS Apple Silicon | `aarch64-apple-darwin`         | (none)    |
| macOS Intel       | `x86_64-apple-darwin`            | (none)    |
| Windows x64       | `x86_64-pc-windows-msvc`         | `.exe`    |
| Linux x64         | `x86_64-unknown-linux-gnu`       | (none)    |

Download static FFmpeg builds from:
- macOS/Linux: <https://evermeet.cx/ffmpeg/> or <https://johnvansickle.com/ffmpeg/>
- Windows: <https://www.gyan.dev/ffmpeg/builds/> (essentials build)

Or run the helper script:

```bash
npm run download:ffmpeg
```

Verify everything is in place before building:

```bash
npm run bundle:check
```

---

## Running a Release

### 1. Bump the version

Update the version in **both** places (they must match):

```bash
# src-tauri/tauri.conf.json  →  "version": "1.0.0-beta.2"
# src-tauri/Cargo.toml       →  version = "1.0.0-beta.2"
```

### 2. Update CHANGELOG.md

Add a section for the new version above the previous one.

### 3. Tag and push

```bash
git tag desktop-v1.0.0-beta.2
git push origin desktop-v1.0.0-beta.2
```

The `release.yml` GitHub Actions workflow triggers on `desktop-v*` tags and:
- Runs `npm test -- --run` (385 tests must pass)
- Runs `npm run bundle:check`
- Builds for macOS arm64, macOS x64, Windows, Linux
- Signs each artifact with `TAURI_SIGNING_PRIVATE_KEY`
- Creates a GitHub Release (marked pre-release for alpha/beta tags)

### 4. Publish the update manifest

After the release is published, create (or update) the `latest.json` file in the
release assets so the auto-updater can find it. Tauri's action generates
`latest.json` automatically — verify it appears in the release after CI finishes.

---

## Local Release Build (without CI)

```bash
# 1. Ensure FFmpeg sidecars are present
npm run bundle:check

# 2. Build the app (runs npm run build then tauri build)
npm run tauri:build

# Output: src-tauri/target/release/bundle/
```

To sign manually, set the env vars before building:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(openssl pkey -in ~/.tauri/goodwebtools_priv.pem -traditional | openssl base64 -A)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri:build
```
