export type AdProvider = 'adsterra' | 'adsense';

export interface AdPlacementConfig {
  zoneId: string;
  width: number;
  height: number;
  provider: AdProvider;
  visible: boolean;
}

export const AD_CONFIG: Record<'top' | 'middle' | 'bottom', AdPlacementConfig> = {
  top: {
    zoneId: '426d84b6522644d6827b82837d66fa25_top',
    width: 320,
    height: 50,
    provider: 'adsterra',
    visible: true,
  },
  middle: {
    zoneId: '426d84b6522644d6827b82837d66fa25_middle',
    width: 300,
    height: 250,
    provider: 'adsterra',
    visible: true,
  },
  bottom: {
    zoneId: '426d84b6522644d6827b82837d66fa25_bottom',
    width: 320,
    height: 50,
    provider: 'adsterra',
    visible: true,
  },
};
