---
doc: SETUP
last_updated: 2026-10-28
owner: Harris Shamsi
---

# Setup runbook (P0 M0.3)

> Steps only the owner can do: they need your accounts, passwords or payment. Never paste keys, private keys or secrets into chat, docs or commits; they go straight into the platform's env settings (SECURITY §4).

## Status reconciliation — 2026-10-28

| Item | Evidence / status |
|---|---|
| Convex, Clerk, Vercel | Connected per owner on 2026-10-18 (§5); application integrations remain unimplemented |
| npm `unstale` reservation, 2FA and trusted publishing | 2026-10-28: package prepared outside repo; npm registry returns 404; browser account `forklift22` requires security-key 2FA for CLI login. Login/publication and package publishing controls pending |
| GitHub App `unstale-dev` and test-repo installation | Owner confirmation pending |
| Render workspace and GitHub connection | Owner confirmation pending; deployment belongs to P2 |
| `unstale.dev` ownership | Runbook records registration on 2026-10-12; owner confirmation pending |

M0.3 is partially complete. Account setup does not block offline P1 engine work; web initialisation remains P4.

## 1. npm package `unstale`

Registry returned 404 on 2026-10-28. Reservation package prepared at `C:/Users/user/Desktop/unstale-placeholder` (`unstale@0.0.1`); `npm pack --dry-run --ignore-scripts --json` and `npm publish --dry-run --ignore-scripts --access public --json` exit 0 and include only README.md/package.json. Not published yet: npm CLI login is awaiting the owner's security-key challenge as `forklift22`. The real CLI publishes from CI in P5 (SEC-100).

1. Create an account at <https://www.npmjs.com/signup> and verify the email.
2. Turn on two-factor auth: avatar → **Account** → **Two-Factor Authentication**, mode **Authorization and writes** (a security key or authenticator app).
3. In a terminal, outside this repo:

   ```bash
   mkdir unstale-placeholder
   ```

   Create `unstale-placeholder/package.json`:

   ```json
   {
     "name": "unstale",
     "version": "0.0.1",
     "description": "Keeps docs true while you code and on every PR. In development.",
     "license": "MIT",
     "repository": { "type": "git", "url": "git+https://github.com/Tunasmelt/Unstale.git" },
     "homepage": "https://github.com/Tunasmelt/Unstale"
   }
   ```

   and `unstale-placeholder/README.md` saying the package is in active development, with the repo link. npm discourages empty name-squatting; a README tying it to a real project keeps it legitimate.
4. Publish once by hand (the only manual publish):

   ```bash
   npm login
   ```

   ```bash
   npm publish ./unstale-placeholder --access public
   ```

5. Lock it down on npmjs.com → package **unstale** → **Settings**:
   - **Publishing access:** require two-factor authentication and disallow tokens.
   - **Trusted Publisher:** GitHub Actions, organisation/user `Tunasmelt`, repository `Unstale`, workflow `release.yml` (added in P5). From then on CI publishes with provenance and no npm token exists (SEC-100).

   Current npm docs require the named workflow to exist in `.github/workflows/` in the GitHub repository. `release.yml` is not present yet; trusted publishing remains pending until that workflow lands. Reference: https://docs.npmjs.com/trusted-publishers/

## 2. GitHub App `unstale-dev`

Dev app now; the prod app `unstale` is created the same way in P5 (M5.3).

1. GitHub → avatar → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.
2. Fill in:

   | Field | Value |
   |---|---|
   | GitHub App name | `unstale-dev` |
   | Homepage URL | `https://github.com/Tunasmelt/Unstale` (switch to `https://unstale.dev` later) |
   | Callback URL / user authorization | leave empty; untick **Request user authorization (OAuth) during installation** (sign-in is Clerk, not the App) |
   | Setup URL | leave empty for now (dashboard URL in P4) |
   | Webhook → Active | **untick for now.** In P2 set URL `https://<convex-deployment>.convex.site/github/webhook` and tick it |
   | Webhook secret | generate one (below) and keep it in your password manager; in P2 it goes into Convex env `GITHUB_WEBHOOK_SECRET` |
   | Where can this app be installed | **Only on this account** |

   Generate the webhook secret locally (prints a random value; don't paste it anywhere but your password manager):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Permissions** (REQ-001; nothing else):

   | Scope | Permission | Access |
   |---|---|---|
   | Repository | Contents | Read-only |
   | Repository | Pull requests | Read and write |
   | Repository | Checks | Read and write |
   | Repository | Metadata | Read-only (mandatory) |

4. **Subscribe to events:** **Pull request**. (Installation and installation-repositories events reach every App without subscribing.)
5. **Create GitHub App**, then on its page:
   - Note the **App ID** → later Render env `GITHUB_APP_ID`.
   - **Generate a private key** → a `.pem` downloads. Store it outside the repo (`*.pem` is gitignored). In P2 it becomes Render secret file / env `GITHUB_APP_PRIVATE_KEY`; then delete the local copy.
6. **Install App** → your account → **Only select repositories** → a throwaway test repo for M2.5 (not `Unstale` itself yet).

## 3. Render (worker, ADR-018)

Nothing to deploy until `apps/worker` has a Dockerfile (P2 M2.3). Now: create the account/workspace and connect GitHub (Render → **Account settings** → **Git providers** → GitHub, access to `Tunasmelt/Unstale` only).

In P2, **New** → **Web Service**:

| Setting | Value |
|---|---|
| Repository | `Tunasmelt/Unstale`, branch `main` |
| Runtime | Docker; Dockerfile path `apps/worker/Dockerfile`, context repo root |
| Region | same region as the Convex deployment (lower latency for API-002) |
| Health check path | `/health` (API-003) |
| Instance type | free for dev (sleeps when idle, cold start on first PR); paid before launch (OQ-3, SEC-051) |
| Env vars | `GITHUB_APP_ID`, `WORKER_HMAC_SECRET`, `KEY_SEAL_PRIVATE_KEY`; `GITHUB_APP_PRIVATE_KEY` as a secret file |
| Auto-deploy | on, from `main` |

## 4. Domain `unstale.dev`

Registered 2026-10-12 at Hostinger. If it is yours: nothing until P4, when DNS for `unstale.dev` and `app.unstale.dev` points to Vercel. If it is not yours, pick another name before P4.

## 5. Already connected (per owner, 2026-10-18)

Convex, Clerk (application `app_3KrbFB6OLixkseXu7K6hlVZdsDp`, Next.js), Vercel.
