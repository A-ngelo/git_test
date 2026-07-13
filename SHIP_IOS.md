# Shipping Scala 40 to the App Store — no Mac required

Everything code-side is in this repo. Your part is connecting accounts in
a browser and pressing buttons, in this order. Each numbered section is
one sitting.

## 1. Deploy the game server (once, ~10 min)

Online mode, the ranked ladder, the privacy policy page and `app-ads.txt`
all live on this one process.

1. Sign up at [fly.io](https://fly.io), install `flyctl` (works on Windows).
2. In the repo folder: `flyctl launch --copy-config --name <your-name>-scala40`
   then `flyctl deploy`.
3. Note your URL, e.g. `https://your-scala40.fly.dev`. Check that
   `/privacy.html` and `/app-ads.txt` load in a browser.
4. Put that URL into `www/index.html` → `window.GAME_SERVER_URL = '…'`
   (this is what the native app talks to; the web version ignores it).

## 2. App Store Connect: app record + API key (~15 min)

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com):

1. **Register the bundle id** — [developer.apple.com](https://developer.apple.com)
   → Certificates, Identifiers & Profiles → Identifiers → **+** →
   App IDs → App: id `com.angelo.scala40` (must match `capacitor.config.json`
   and `codemagic.yaml`). No extra capabilities needed.
2. **Create the app** — App Store Connect → My Apps → **+** → New App:
   platform iOS, name "Scala 40" (or your variant if taken), primary
   language Italian or English, that bundle id.
3. **Create the API key** — Users and Access → Integrations → App Store
   Connect API → **+**. Role: App Manager. Download the `.p8` file
   (one-time download — keep it) and note the Key ID + Issuer ID.

## 3. Codemagic: connect and build (~15 min)

1. Sign up at [codemagic.io](https://codemagic.io) with your GitHub
   account and add this repository. It auto-detects `codemagic.yaml`.
2. Teams → Personal team → Integrations → **App Store Connect** → add the
   `.p8` key with its Key ID + Issuer ID. Name the integration `scala40`
   (must match the yaml).
3. In the app's settings create an **environment variable group** named
   `scala40` containing `ADMOB_APP_ID_IOS` = your AdMob iOS **App ID**
   (the one with the **~ tilde**, from AdMob → Apps → App settings).
4. Press **Start new build** → workflow "iOS → TestFlight".

First build takes ~15 min and lands in **TestFlight** automatically.
Install TestFlight on your iPhone, and the build appears there to play.
Expect the very first build to need one or two retries — that is normal
native-build weather, paste any red log lines back to Claude.

## 4. RevenueCat: the Remove Ads purchase (~20 min)

1. App Store Connect → your app → Monetization → In-App Purchases →
   **+** Non-Consumable: product id `remove_ads`, price $2.99 (or your
   pick). Fill the display name/description (EN + IT).
2. Sign up at [revenuecat.com](https://revenuecat.com) (free) → new
   project → add the iOS app (bundle id again) with an App Store Connect
   API key when asked.
3. Products → import `remove_ads`; Entitlements → create `no_ads` and
   attach the product; Offerings → default offering containing it.
4. Copy the **public Apple API key** (`appl_…`) into
   `www/js/monetize.js` → `CONFIG.revenuecat.apiKey.ios` (or paste it to
   Claude to wire in).

## 5. The listing (browser, any time)

- Screenshots: 6.7" and 6.5" iPhone sizes required (Claude can generate
  store-ready screenshots from the real game).
- Description EN + IT, keywords ("scala 40", "carte", "ramino", …),
  support URL and **privacy policy URL**: `https://<your-server>/privacy.html`.
- App Privacy questionnaire: with AdMob, declare Identifiers +  Usage
  Data, used for third-party advertising — AdMob's docs have the exact
  answers ("Google Mobile Ads SDK app privacy details").
- In AdMob → Apps: link each AdMob app to its store listing once live,
  and confirm `app-ads.txt` is detected (served from your server root).

## 6. Release checklist (the last 30 minutes)

- [ ] `window.GAME_SERVER_URL` set to your deployed server
- [ ] RevenueCat `appl_…` key in `monetize.js`
- [ ] `useTestAds: false` in `monetize.js` — the very last change
- [ ] Version bumped if needed (`APP_VERSION` in `codemagic.yaml`)
- [ ] Fresh Codemagic build → test on your own iPhone from TestFlight:
      play a hand, buy Remove Ads with a **sandbox tester** account
      (App Store Connect → Users and Access → Sandbox), tap Restore
- [ ] App Store Connect → your app → add the build → Submit for Review

Review typically takes 1–3 days. Android later: same story with
`npm run android` locally on your Windows PC (Android Studio runs there)
or a Codemagic Android workflow — ask Claude when you're ready.
