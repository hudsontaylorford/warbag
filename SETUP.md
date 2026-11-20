# Getting warbag live

Everything runs on **Vercel** (website + Neon database), with **Cloudflare** for the domain and **Resend** for email. Same shape as Chirk.

## 1. Vercel project and database (done)

The `warbag` repo is imported into Vercel, and a Neon database is connected through the project's **Storage** tab.

Check one thing: **Settings → Environment Variables** must list `DATABASE_URL`. If you see `STORAGE_URL` or similar instead, the database was connected with a different prefix: open **Storage → the database → Settings** (or disconnect and reconnect it) and set **Custom Prefix** to `DATABASE`.

The database tables are created automatically on every deploy (`scripts/migrate.mjs` runs before the build). There's nothing to paste into Neon.

## 2. Environment variables

**Vercel → warbag → Settings → Environment Variables.** Add these for **Production** and **Preview**, and mark the secret as **Sensitive**:

| Name | Value | Without it |
|---|---|---|
| `BETTER_AUTH_SECRET` | A long random string. Generate one at [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32). Keep it; changing it signs everyone out. | Sign-in doesn't work |
| `OWNER_EMAIL` | The email you'll sign in with. On each deploy, this account is created (if needed) and made admin. | No one can sign in (warbag is invite only) |
| `BETTER_AUTH_URL` | `https://warbag.rodeo` (Production only, once the domain works) | Sign-in links use the `.vercel.app` address |
| `RESEND_API_KEY` | A Resend API key with sending access (see section 4) | Sign-in codes can't be sent |
| `EMAIL_FROM` | The sender, e.g. `warbag <hello@warbag.rodeo>` | Sign-in codes can't be sent |

After adding or changing variables: **Deployments → ⋯ on the latest → Redeploy**.

## 3. Your Cloudflare domain

The site stays on Vercel; Cloudflare just points `warbag.rodeo` at it.

1. **Vercel → warbag → Settings → Domains.** Type `warbag.rodeo` and click **Add**. Choose the option that also adds `www.warbag.rodeo` (redirecting to `warbag.rodeo`).
2. Vercel shows the DNS records it wants, usually an **A** record for `@` and a **CNAME** for `www`. Leave that page open.
3. **Cloudflare → warbag.rodeo → DNS → Records.**
   - If there are already records named `warbag.rodeo` (`@`) or `www` (from a parking page or the registrar), **edit** those rather than adding duplicates. Delete any extra `A`, `AAAA` or `CNAME` records on `@` or `www` that Vercel didn't ask for.
   - Copy **Type**, **Name** and **Value/Target** exactly as Vercel shows them.
   - Set **Proxy status** to **DNS only** (grey cloud, not orange). Vercel needs this to issue the HTTPS certificate.
4. Back in Vercel, within a few minutes both domains should show **Valid Configuration**.
5. Add `BETTER_AUTH_URL=https://warbag.rodeo` (section 2) and redeploy.

Leave Cloudflare's **MX** and **TXT** records alone; they're for email.

If anything stays red, send Claude a screenshot of the Vercel Domains page and the Cloudflare DNS page.

## 4. Email (sign-in codes)

warbag sends sign-in codes through Resend. Your Resend account has no free domain slots, so pick one:

- **A. Upgrade Resend** to a plan with more domains, then **Resend → Domains → Add domain** `warbag.rodeo`. Resend shows a few DNS records (TXT, MX, maybe CNAME); add each in **Cloudflare → warbag.rodeo → DNS → Records**, **DNS only**. When Resend says **Verified**, create an API key (**Sending access**, domain `warbag.rodeo`) and set `EMAIL_FROM` to `warbag <hello@warbag.rodeo>`.
- **B. For now, send from chirk.fyi.** In Resend, create a **new** API key just for warbag (Sending access, domain `chirk.fyi`) and set `EMAIL_FROM` to `warbag <warbag@chirk.fyi>`. Free and works today; codes just come from a chirk address. Switching to A later is changing two variables.

Local development needs neither: codes are printed in the terminal running `npm run dev`.

## 5. Check it works

1. Open the site and tap **Sign in**.
2. Enter your `OWNER_EMAIL`. A 6-digit code arrives by email.
3. Enter it. You land on your warbag home.
