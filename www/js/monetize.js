/*
 * Scala 40 — monetization (native apps only).
 * Banner ads on the menu and hand-end screens, an interstitial every few
 * hands, and a one-time "remove ads" purchase with restore. Ads never
 * appear during play, and everything here is a silent no-op on the web:
 * the PWA and any plain browser build stay ad-free automatically.
 *
 * Native plugins (install when building the iOS/Android app):
 *   npm i @capacitor-community/admob @revenuecat/purchases-capacitor
 *
 * TODO(release): replace the CONFIG ids below —
 *  - AdMob ad units: these are Google's public TEST ids; swap in your own
 *    from https://apps.admob.com (keep the test ids while developing,
 *    clicking real ads in a dev build can get an AdMob account banned)
 *  - RevenueCat public API keys + a "no_ads" entitlement attached to a
 *    non-consumable "remove ads" product in both stores
 */
(function (global) {
  'use strict';

  const NO_ADS_KEY = 'scala40.noAds';

  const CONFIG = {
    admob: {
      // Safety latch: Google's public TEST ads serve until this is set to
      // false — flip it as the very last step before store submission.
      // (Tapping your own live ads can get an AdMob account suspended.)
      useTestAds: true,
      test: {
        banner: {
          ios: 'ca-app-pub-3940256099942544/2934735716',
          android: 'ca-app-pub-3940256099942544/6300978111',
        },
        interstitial: {
          ios: 'ca-app-pub-3940256099942544/4411468910',
          android: 'ca-app-pub-3940256099942544/1033173712',
        },
      },
      prod: {
        banner: {
          ios: 'ca-app-pub-1286473724303531/1246417453', // "Menu banner"
          android: 'TODO_ANDROID_BANNER_ID',
        },
        interstitial: {
          ios: 'ca-app-pub-1286473724303531/1016719686', // "Between hands"
          android: 'TODO_ANDROID_INTERSTITIAL_ID',
        },
      },
    },
    revenuecat: {
      apiKey: { ios: 'appl_REPLACE_ME', android: 'goog_REPLACE_ME' },
      entitlement: 'no_ads',
    },
    interstitialEveryHands: 3,
  };

  function adUnits() {
    const a = CONFIG.admob;
    const ids = a.useTestAds ? a.test : a.prod;
    // never ship a TODO placeholder to the ad SDK
    const filled = JSON.stringify(ids).indexOf('TODO_') === -1;
    return filled ? ids : a.test;
  }

  const cap = global.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const platform = native ? cap.getPlatform() : 'web';

  let AdMob = null;
  let Purchases = null;
  let adsReady = false;
  let bannerVisible = false;
  let handsSinceAd = 0;
  let adFree = false;
  try {
    adFree = localStorage.getItem(NO_ADS_KEY) === '1';
  } catch {
    /* storage unavailable */
  }

  function setAdFree(v) {
    adFree = v;
    if (v) {
      try {
        localStorage.setItem(NO_ADS_KEY, '1');
      } catch {}
      hideBanner();
    }
  }

  function entitled(info) {
    const active =
      info && info.customerInfo && info.customerInfo.entitlements &&
      info.customerInfo.entitlements.active;
    return !!(active && active[CONFIG.revenuecat.entitlement]);
  }

  async function init() {
    if (!native) return;
    try {
      AdMob = cap.registerPlugin('AdMob');
    } catch {}
    try {
      Purchases = cap.registerPlugin('Purchases');
    } catch {}

    // Entitlements first — an ad-free customer never loads the SDK's ads.
    if (Purchases) {
      try {
        await Purchases.configure({ apiKey: CONFIG.revenuecat.apiKey[platform] });
        setAdFree(entitled(await Purchases.getCustomerInfo()));
      } catch {}
    }
    if (AdMob && !adFree) {
      try {
        await AdMob.initialize({});
        // GDPR/ATT consent where required; AdMob's UMP handles the rest.
        try {
          const consent = await AdMob.requestConsentInfo({});
          if (consent && consent.isConsentFormAvailable && consent.status === 'REQUIRED') {
            await AdMob.showConsentForm();
          }
        } catch {}
        adsReady = true;
      } catch {}
    }
  }

  async function showBanner() {
    if (!adsReady || adFree || bannerVisible) return;
    try {
      await AdMob.showBanner({
        adId: adUnits().banner[platform],
        adSize: 'ADAPTIVE_BANNER',
        position: 'BOTTOM_CENTER',
        margin: 0,
      });
      bannerVisible = true;
    } catch {}
  }

  async function hideBanner() {
    if (!bannerVisible) return;
    bannerVisible = false;
    try {
      await AdMob.hideBanner();
    } catch {}
  }

  // Called when a hand finishes; shows a full-screen ad every few hands.
  async function onHandEnd() {
    if (!adsReady || adFree) return;
    if (++handsSinceAd < CONFIG.interstitialEveryHands) return;
    handsSinceAd = 0;
    try {
      await AdMob.prepareInterstitial({ adId: adUnits().interstitial[platform] });
      await AdMob.showInterstitial();
    } catch {}
  }

  async function buyRemoveAds() {
    if (!Purchases) return { ok: false, error: 'Purchases are not available on this device.' };
    try {
      const offerings = await Purchases.getOfferings();
      const pkg =
        offerings && offerings.current && offerings.current.availablePackages &&
        offerings.current.availablePackages[0];
      if (!pkg) return { ok: false, error: 'The store product is not configured yet.' };
      const res = await Purchases.purchasePackage({ aPackage: pkg });
      if (entitled(res)) {
        setAdFree(true);
        return { ok: true };
      }
      return { ok: false, error: 'The purchase did not complete.' };
    } catch (e) {
      if (e && e.userCancelled) return { ok: false, error: '' }; // user changed their mind
      return { ok: false, error: (e && e.message) || 'The purchase failed — try again.' };
    }
  }

  async function restorePurchases() {
    if (!Purchases) return { ok: false, error: 'Purchases are not available on this device.' };
    try {
      const info = await Purchases.restorePurchases();
      if (entitled(info)) {
        setAdFree(true);
        return { ok: true };
      }
      return { ok: false, error: 'No previous purchase found for this account.' };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'Restore failed — try again.' };
    }
  }

  global.Monetize = {
    init,
    native,
    // web builds are ad-free by definition; the menu row stays hidden
    showsAds: () => native && !adFree,
    showBanner,
    hideBanner,
    onHandEnd,
    buyRemoveAds,
    restorePurchases,
  };
})(window);
