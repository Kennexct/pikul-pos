# Runbook — rename the project to Pikul on GitHub and Cloudflare (ADR-016)

The code already says Pikul. This runbook renames the places outside the code. Do the steps in order.

## 0. Before you start (business, not code)
- Trademark: search PDKI (pdki-indonesia.dgip.go.id) for "Pikul" in classes 9 and 42.
- Domain: buy one (e.g. `pikul.id`, `pikul.app`, `getpikul.com`). You need it for email (Resend) and the custom domain.

## 1. GitHub: rename the repository `Kennexct/kasirku` → `Kennexct/pikul`
1. github.com/Kennexct/kasirku → **Settings** → **General** → *Repository name* → `pikul` → **Rename**.
2. GitHub redirects the old URL, but update your local clone so you don't rely on it:
   `git remote set-url origin https://github.com/Kennexct/pikul.git`
3. Optional: description "Pikul — aplikasi kasir offline untuk UMKM", and the brand app icon as the social preview (Settings → Social preview, use `pikul-app-icon-1024.png`).

## 2. Cloudflare Pages
The `*.pages.dev` subdomain comes from the project name and **cannot be changed** after creation (Cloudflare known issues). So the name is chosen when the project is created.

### A. You have not created the Pages project yet (current state, Nov 2026) — recommended
1. Rename the GitHub repo first (step 1).
2. Workers & Pages → **Create** → **Pages** → **Connect to Git** → pick `Kennexct/pikul`.
3. **Project name: `pikul`** → your site becomes `https://pikul.pages.dev` (if taken, Cloudflare offers `pikul-xxx`; pick e.g. `pikul-pos`).
4. Build: command `npm run build`, output `dist`, variable `NODE_VERSION=20`.
5. Variables from `.env.example`. Use the new names: `APP_ORIGIN=https://pikul.pages.dev` (later your domain), `MAIL_FROM=Pikul <masuk@yourdomain>`, `ADMIN_EMAILS=…`.
6. Continue with `docs/runbooks/deploy-cloudflare.md` (Neon, Resend, admin).

### B. You already have a project called `kasirku`
1. After the GitHub rename, push a commit and check that a deployment starts. GitHub redirects renamed repos and builds usually keep working, but Cloudflare does not document this. If the project page shows "linked to a repository that no longer exists", go to step 2.
2. To get the `pikul.pages.dev` address you must create a **new** project `pikul` (steps A.2–A.5), copy every variable and secret from the old project (Settings → Variables and Secrets; secrets are not readable, paste them again from your password manager), deploy, test, then move the custom domain (old project → Custom domains → remove; new project → add) and delete the old project.
3. Access passes stay valid across projects as long as `PASS_PRIVATE_JWK` and the build's `VITE_PASS_PUBLIC_JWK` are the same key pair. Neon data is untouched.
4. Sellers who installed the app from `kasirku.pages.dev` keep their data **on that address** (browser storage is per site). Without a custom domain, a new address means a fresh device. That is why the custom domain should be set up before real sellers start.

## 3. Custom domain (do this before sellers use the app)
1. Pages project `pikul` → **Custom domains** → add `pikul.id` (and `www`), follow the DNS steps.
2. Update `APP_ORIGIN=https://pikul.id`, redeploy. Update the Google OAuth origin if Google sign-in is on.
3. Optional: redirect `pikul.pages.dev` to the domain (Cloudflare "Redirect to custom domain" how-to, Bulk Redirects).
4. Zero Trust Access on `/admin/*` (if used): change the application domain to the new one.

## 4. Email (Resend)
1. Resend → Domains → add the new domain, add the DNS records, wait for **Verified**.
2. `MAIL_FROM=Pikul <masuk@pikul.id>`, redeploy, sign in once to check the email says "Kode masuk Pikul".

## 5. Neon (optional)
The database name does not matter to the app. Leaving it `kasirku` is fine. If you create a new Neon project, name it `pikul`, run `db/migrations/001` and `002`, and update `DATABASE_URL`.

## 6. Check after go-live
- `https://<domain>/` shows the Pikul logo and "Jualan ringan. Catatan beres." in the footer.
- `/app/` → install to home screen: icon is the Pikul mark, name "Pikul".
- Sign-in email subject "Kode masuk Pikul: 123456".
- Reports export file starts with `pikul-`, backup with `pikul-cadangan-`.

## What does NOT change (on purpose)
IndexedDB `kasirku`, localStorage `kasirku-*`, backup marker `app: "kasirku"` (ADR-016). Never rename them.
