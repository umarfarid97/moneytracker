# Duit cloud sync: what you set up

Duit's sync server is a small Cloudflare Worker with a D1 database (folder `cloud-worker/`). It stores one **encrypted** copy of your data per account and sends the sign-in code by email. It never sees your spending. You do these steps once; each takes a few minutes.

## What it costs

| Item | Cost |
| --- | --- |
| Cloudflare Workers + D1 | RM 0 (free plan; no card needed) |
| Resend (sends the login emails) | RM 0 (free plan, about 3,000 emails a month; check their pricing page) |
| A domain name for the sender address | about RM 50 a year. Resend only sends from a domain you own. |

## 1. Accounts

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. Create a free account at <https://resend.com>.
3. Buy a domain (Cloudflare Registrar, Namecheap, anything). If you buy it at Cloudflare, step 2 below is nearly automatic.

## 2. Let Resend send from your domain

1. Resend > **Domains** > **Add domain**, enter your domain (for example `duit.my` or `mail.yourname.com`).
2. Resend shows DNS records (SPF, DKIM). Add them at your DNS host. With Cloudflare DNS there is a button that adds them for you.
3. Click **Verify** in Resend. Wait until it says *Verified*.
4. Resend > **API Keys** > **Create API key** with *Sending access* only. Copy it (starts with `re_`). You see it once.

## 3. Deploy the server

The database `duit-cloud` is already created in your Cloudflare account and its tables are in place, and its id is in `wrangler.toml`. What is left is the Worker itself and its two secrets. On your computer, with Node 22 installed, in the repo folder:

```bash
cd cloud-worker
npm install
npx wrangler login                      # opens the browser to authorise
```

1. In `cloud-worker/wrangler.toml` set `MAIL_FROM` to an address on your verified Resend domain, for example `Duit <login@yourdomain.com>`.
2. Keep `ALLOWED_ORIGINS` as `https://umarfarid97.github.io` (the web app).

Then:

```bash
openssl rand -hex 32                    # copy the output
npx wrangler secret put PEPPER          # paste that output when asked
npx wrangler secret put RESEND_API_KEY  # paste the re_... key
npx wrangler deploy
```

`wrangler deploy` prints the server address, like `https://duit-cloud.<your-name>.workers.dev`. Check it:

```bash
curl https://duit-cloud.<your-name>.workers.dev/
# {"app":"duit-cloud","ok":true}
```

Keep the `PEPPER` value somewhere safe. If it changes, nobody can sign in with an old code and every account looks new.

## 4. Tell Duit where the server is

Send the server address to Claude in the project chat. It goes into `malaysia-finance-app/src/sync/cloudConfig.ts` (it is not a secret). Until then the cloud sync section shows as unavailable and nothing else changes.

You can also do it yourself: set `CLOUD_API_URL` in that file and rebuild.

## 5. Deploy from GitHub (no terminal)

Use this if you do not want to run commands on your computer. Actions tab > **Deploy cloud server** > Run workflow. It needs three repository secrets (Settings > Secrets and variables > Actions > New repository secret):

- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard > My Profile > API Tokens > Create Token > the *Edit Cloudflare Workers* template.
- `CLOUDFLARE_ACCOUNT_ID`: shown on the right of the Cloudflare dashboard home.
- `RESEND_API_KEY`: your Resend key (`re_...`).

The workflow runs the tests, applies the database migrations, deploys, stores the Resend key on Cloudflare and makes the `PEPPER` secret once. Afterwards the server address is in the Cloudflare dashboard under Workers & Pages > duit-cloud.

## Using it

More > Backup & sync > **Duit cloud**: enter your email, type the 6 digit code, choose a passphrase and save the recovery key. On your next phone or the web app, sign in with the email code and enter the same passphrase.

**The passphrase and recovery key cannot be reset by anyone, including you.** Lose both and every signed-in device, and the cloud copy cannot be opened. Local backup files still work.

## Limits and good to know

- Free plan: 100,000 requests a day for the whole server. Each open app checks about every 3 minutes, so a few users fit easily.
- D1 free storage is 5 GB. Receipts are capped at 3 MB each and 150 MB per account.
- Login codes: 5 per email per hour, 5 wrong tries per code.
- Deleting your account in the app wipes everything stored for it.
