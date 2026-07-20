import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdSize, BannerAdPosition, RewardAdPluginEvents } from '@capacitor-community/admob';

const ADMOB_ANDROID_BANNER_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';
const ADMOB_ANDROID_INTERSTITIAL_UNIT_ID = 'ca-app-pub-3940256099942544/1033173712';
const ADMOB_ANDROID_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

const isAndroid = () => {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

let isAdMobInitialized = false;

// Rewarded service ready but disabled configuration
const IS_REWARDED_ENABLED = false;

export const AdService = {
  async initialize() {
    if (!isAndroid()) {
      console.log('[AdService] AdMob initialization skipped on web.');
      return;
    }

    if (isAdMobInitialized) return;

    try {
      console.log('[AdService] Initializing AdMob on Android...');
      await AdMob.initialize();
      isAdMobInitialized = true;
      console.log('[AdService] AdMob initialized successfully.');

      // Setup Rewarded Ad listeners if enabled, otherwise register a disabled placeholder
      if (IS_REWARDED_ENABLED) {
        AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward) => {
          console.log('[AdService] User rewarded:', reward);
        });
      }
    } catch (error) {
      console.error('[AdService] Failed to initialize AdMob:', error);
    }
  },

  async showBanner() {
    if (!isAndroid()) {
      console.log('[AdService] Banner display skipped on web (handled by Adsterra component).');
      return;
    }

    try {
      await this.initialize(); // Ensure initialized
      console.log('[AdService] Showing AdMob adaptive banner...');
      await AdMob.showBanner({
        adId: ADMOB_ANDROID_BANNER_UNIT_ID,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 80, // Position it above the bottom navigation bar
        isTesting: true,
      });
    } catch (error) {
      console.error('[AdService] Failed to show banner:', error);
    }
  },

  async hideBanner() {
    if (!isAndroid()) return;
    try {
      console.log('[AdService] Hiding AdMob banner...');
      await AdMob.hideBanner();
    } catch (error) {
      console.error('[AdService] Failed to hide banner:', error);
    }
  },

  async removeBanner() {
    if (!isAndroid()) return;
    try {
      console.log('[AdService] Removing AdMob banner...');
      await AdMob.removeBanner();
    } catch (error) {
      console.error('[AdService] Failed to remove banner:', error);
    }
  },

  async showInterstitial() {
    if (!isAndroid()) {
      console.log('[AdService] Interstitial skipped on web.');
      return;
    }

    try {
      await this.initialize(); // Ensure initialized
      console.log('[AdService] Preparing AdMob Interstitial...');
      await AdMob.prepareInterstitial({
        adId: ADMOB_ANDROID_INTERSTITIAL_UNIT_ID,
        isTesting: true,
      });
      console.log('[AdService] Showing AdMob Interstitial...');
      await AdMob.showInterstitial();
    } catch (error) {
      console.error('[AdService] Failed to show interstitial:', error);
    }
  },

  // Rewarded service ready but disabled
  async showRewarded() {
    if (!isAndroid()) {
      console.log('[AdService] Rewarded ad skipped on web.');
      return;
    }

    if (!IS_REWARDED_ENABLED) {
      console.log('[AdService] Rewarded ad is disabled.');
      return;
    }

    try {
      await this.initialize();
      console.log('[AdService] Preparing AdMob Rewarded Ad...');
      await AdMob.prepareRewardVideoAd({
        adId: ADMOB_ANDROID_REWARDED_UNIT_ID,
        isTesting: true,
      });
      console.log('[AdService] Showing AdMob Rewarded Ad...');
      await AdMob.showRewardVideoAd();
    } catch (error) {
      console.error('[AdService] Failed to show rewarded ad:', error);
    }
  }
};
