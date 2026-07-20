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
    zoneId: 'f835c643af278e8fd90e7fb244c14385',
    width: 300,
    height: 250,
    provider: 'adsterra',
    visible: true,
    format: 'iframe',
  } as AdPlacementConfig,
  bottom: {
    zoneId: '6944520e8c7c4d0e08952386d172e80f',
    width: 320,
    height: 50,
    provider: 'adsterra',
    visible: true,
    format: 'iframe',
  } as AdPlacementConfig,
};
