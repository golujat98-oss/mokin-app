export type AdProvider = 'adsterra' | 'adsense';

export interface AdPlacementConfig {
  zoneId: string;
  width: number;
  height: number;
  provider: AdProvider;
  visible: boolean;
  format: 'iframe';
}

export const AD_CONFIG = {
  dashboard_top: {
    zoneId: '6944520e8c7c4d0e08952386d172e80f',
    width: 320,
    height: 50,
    provider: 'adsterra',
    visible: true,
    format: 'iframe',
  } as AdPlacementConfig,
  middle: {
    zoneId: '426d84b6522644d6827b82837d66fa25_middle',
    width: 300,
    height: 250,
    provider: 'adsterra',
    visible: true,
    format: 'iframe',
  } as AdPlacementConfig,
  bottom: {
    zoneId: '426d84b6522644d6827b82837d66fa25_bottom',
    width: 320,
    height: 50,
    provider: 'adsterra',
    visible: true,
    format: 'iframe',
  } as AdPlacementConfig,
};
