# Getting warbag live

Warbag runs on **Vercel** (website + Neon database), with **Cloudflare** for the domain and **Resend** for email. Do the parts in order. Every step is 🟢 PRODUCTION (warbag has no demo environment).

## Part A · Check the database connection (2 minutes)

1. 🟢 PRODUCTION · **Vercel → project `warbag` → Settings → Environment Variables.**
2. In the list, find a variable named exactly **`DATABASE_URL`**.
   - You should see it, with Production and Preview ticked. Done, go to Part B.
   - If you only see names like `STORAGE_URL` or `POSTGRES_URL`, the Neon database was connected with a different prefix. Go to **Vercel → project `warbag` → Storage → (your Neon database) → Projects** (or **Settings**), disconnect `warbag`, then **Connect Project → `warbag`**, and in **Custom Prefix** type `DATABASE`. Check step 2 again.

## Part B · Point warbag.rodeo at Vercel (10 minutes, plus waiting)

1. 🟢 PRODUCTION · **Vercel → project `warbag` → Settings → Domains → Add Domain.**
2. Type `warbag.rodeo` and click **Add**. When asked about `www`, choose the option that **redirects `www.warbag.rodeo` to `warbag.rodeo`**.
3. Vercel now shows both domains as **Invalid Configuration** with the DNS records it wants. Leave this tab open. You'll usually see:
   - `warbag.rodeo`: **Type `A`**, **Name `@`**, **Value** an IP address (often `216.198.79.1` or `76.76.21.21`).
   - `www.warbag.rodeo`: **Type `CNAME`**, **Name `www`**, **Value** ending in `vercel-dns.com` (often project-specific, like `abc123.vercel-dns-017.com`).
   Use the exact values Vercel shows you, not these examples.
4. 🟢 PRODUCTION · In a new tab: **Cloudflare → warbag.rodeo → DNS → Records.**
5. Remove anything in the way: if there are existing **A**, **AAAA** or **CNAME** records named `warbag.rodeo` (shown as `@`) or `www`, click **Edit → Delete** on each. Leave **MX** and **TXT** records alone.
6. Click **Add record**:
   - **Type:** `A`
   - **Name:** `@`
   - **IPv4 address:** the A value from Vercel (step 3)
   - **Proxy status:** click the orange cloud so it turns **grey (DNS only)**
   - **TTL:** Auto
   - Click **Save**.
7. Click **Add record** again:
   - **Type:** `CNAME`
   - **Name:** `www`
   - **Target:** the CNAME value from Vercel (step 3)
   - **Proxy status:** **grey (DNS only)**
   - **TTL:** Auto
   - Click **Save**.
8. Back on the **Vercel → Domains** tab, wait 2 to 15 minutes and refresh. You should see **Valid Configuration** on both domains. If either stays red after 30 minutes, send Claude a screenshot of the Vercel Domains page and the Cloudflare DNS Records page.

## Part C · Email for sign-in codes (5 minutes)

Your Resend account has no free domain slots, so warbag sends from the already-verified `chirk.fyi` domain for now. Codes arrive from "Hudson" at `warbag@chirk.fyi` (the name says nothing about warbag, so family see only the app they use; Hudson, 2026-11-27). Switching to a warbag.rodeo address later only changes two settings.

1. 🟢 PRODUCTION · **Resend (resend.com) → API Keys → Create API Key.**
2. Fill in:
   - **Name:** `warbag`
   - **Permission:** `Sending access`
   - **Domain:** `chirk.fyi`
3. Click **Add**. Copy the key (starts with `re_`). Resend only shows it once; keep the tab open until Part D is done.

## Part D · Warbag's settings in Vercel (5 minutes)

1. 🟢 PRODUCTION · Make a secret: open **https://generate-secret.vercel.app/32** and copy the text it shows. (Refreshing gives a new one; use any one, once.)
2. 🟢 PRODUCTION · **Vercel → project `warbag` → Settings → Environment Variables.** For each row below: type the **Key**, paste or type the **Value**, tick the **Environments** shown, turn on **Sensitive** where it says so, click **Save**.

| Key | Value | Environments | Sensitive |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | the secret from step 1 | Production, Preview | On |
| `OWNER_EMAIL` | the email you'll sign in with | Production, Preview | Off |
| `RESEND_API_KEY` | the `re_...` key from Part C | Production, Preview | On |
| `EMAIL_FROM` | `Hudson <warbag@chirk.fyi>` (Production; Preview still has `warbag <warbag@chirk.fyi>`, which only preview builds use) | Production, Preview | Off |
| `BETTER_AUTH_URL` | `https://warbag.rodeo` | Production only | Off |

3. You should now see those five plus `DATABASE_URL` in the list.

Keep `BETTER_AUTH_SECRET` forever. Changing it signs everyone out.

## Part E · Turn it on (5 minutes)

1. 🟢 PRODUCTION · **GitHub → hudsontaylorford/warbag → Pull requests →** the open sign-in PR.
2. Scroll to the bottom. You should see the **check** with a green tick. (If it's red, don't merge; tell Claude.)
3. Click **Merge pull request → Confirm merge.**
4. 🟢 PRODUCTION · **Vercel → project `warbag` → Deployments.** The top deployment says **Building**, then **Ready** after about 2 minutes, labeled **Production**.
5. Click it → **Build Logs**. Near the top you should see:
   - `migrate: applied 0001_auth.sql`
   - `migrate: owner account created`
   If you see `migrate: no DATABASE_URL, skipping` instead, redo Part A, then **⋯ → Redeploy** on that deployment.

## Part F · Check it works (2 minutes)

1. On your phone, open **https://warbag.rodeo**. You should see "warbag · Coming soon" and a **Sign in** link.
2. Tap **Sign in**, enter your `OWNER_EMAIL`, tap **Send code**.
3. Within a minute an email arrives from **Hudson** (`warbag@chirk.fyi`), subject "123456 is your sign-in code". Check spam the first time.
4. Enter the code and tap **Sign in**. You should land on your warbag home showing "Signed in as" your email.

If no email arrives: **Vercel → project `warbag` → Logs**, filter for "Email", and send Claude a screenshot.

## Part G · Mosey receipt photos (10 minutes)

Receipt photos need two things: a private file store on Vercel, and an Anthropic API key so Claude can read them. Without them, Mosey works the same but hides **Add from a receipt photo**. Previews never get either.

Claude couldn't open vercel.com or console.anthropic.com from its session to confirm the exact screen names below. If a label differs, look for the closest match, and the check at the end proves it worked.

**Private file store**

1. 🟢 PRODUCTION · **Vercel → project `warbag` → Storage → Create** (it may say **Create Database**) → **Blob**.
2. Name: `warbag-receipts`. If it asks for access, choose **Private**. Click **Create**.
3. When it asks which environments to connect: tick **Production** only. Click **Connect**.
4. **Vercel → project `warbag` → Settings → Environment Variables.** You should see `BLOB_READ_WRITE_TOKEN` (Production).

**Anthropic API key**

5. 🟢 PRODUCTION · **https://console.anthropic.com → Settings → API Keys → Create Key.** Name: `warbag receipts`. Copy the key (starts `sk-ant-`); it's shown once.
6. Optional but wise: **Console → Settings → Limits** and set a monthly spend limit (reading a receipt costs about a cent).
7. 🟢 PRODUCTION · **Vercel → project `warbag` → Settings → Environment Variables → Add.**

| Key | Value | Environments | Sensitive |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | the `sk-ant-...` key from step 5 | Production only | On |

**Turn it on**

8. 🟢 PRODUCTION · **Vercel → project `warbag` → Deployments →** the top one labeled **Production** → **⋯ → Redeploy.** Wait for **Ready**.
9. Check: on your phone open a Mosey trip → **Money**. You should see **Add from a receipt photo**. Take a photo of any receipt: within about 15 seconds you should see "Filled in from the photo. Check it before saving." Save it, then tap **Receipt ›** on the expense: the photo opens.

If the photo saves but says it couldn't be read, the API key is missing or wrong. If it says "Couldn't save the photo", the Blob store isn't connected (or was created as public). Send Claude a screenshot of **Vercel → project `warbag` → Logs** filtered for "receipt".

## Part H · Room Tuner for someone (1 minute each)

Nothing to set up in Vercel: Room Tuner uses the database it already has, and **Fill from a screenshot** uses the Anthropic key from Part G (without it, that button is hidden).

1. 🟢 PRODUCTION · **https://warbag.rodeo → People →** the person.
2. Under **Apps**, tick **Room Tuner** and tap **Save**.
3. Check: they sign in and see **Room Tuner** in their launcher. You always have it as an admin.

To bring in your setups from the old page: **Room Tuner → Import setups →** pick `room-tuner-setups.json` → **Import**. You should see "Imported 1 setup ✓" and "Authentics 500 · Living room" in the list.

## Part I · Jot (5 minutes once, then 1 minute per person)

Jot uses the database it already has and sends reminders through the Resend email from Part C. A GitHub Actions schedule ("Jot reminders", every 5 minutes, often a few minutes late) asks warbag to send due reminders. One secret, saved in both Vercel and GitHub, makes sure only that schedule can.

1. 🟢 PRODUCTION · make a secret: on a Mac, open Terminal and run `openssl rand -hex 32`. Copy the 64 letters and numbers it prints.
2. 🟢 PRODUCTION · **Vercel → project `warbag` → Settings → Environment Variables → Add**. Key: `CRON_SECRET`. Value: the secret from step 1. Environments: **Production** only. **Save**.
3. 🟢 PRODUCTION · **GitHub → hudsontaylorford/warbag → Settings → Secrets and variables → Actions → New repository secret**. Name: `CRON_SECRET`. Secret: the same value. **Add secret**.
4. Tell Claude both are saved; the PR is merged after that (merging deploys, so Vercel picks up the secret).
5. Check, after the merge: **GitHub → hudsontaylorford/warbag → Actions → Jot reminders → Run workflow → Run workflow**. You should see a green run whose "Send due reminders" step prints `{"sent":0,"skipped":0,"failed":0}` (or a count, if a reminder was due).

Jot for someone:

1. 🟢 PRODUCTION · **https://warbag.rodeo → People →** the person.
2. Under **Apps**, tick **Jot** and tap **Save**.
3. Check: they sign in and see **Jot** in their launcher. You always have it as an admin.

To bring in your notes from the old Stickies: copy `data/notes.json` (and `data/trash.json`, if you want its Trash) from the old box, then **Jot → Import from Stickies →** pick the file **→ Import**. You should see "Imported N notes ✓" and your notes on the board, newest of the old order first.

## Later

Changing setup? Update this file in the same PR.
