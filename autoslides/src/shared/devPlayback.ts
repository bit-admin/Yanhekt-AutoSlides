export type DevPlaybackFormat = 'hls' | 'mp4' | 'aac';

export interface DevPlaybackSource {
  kind: 'ok';
  url: string;
  clientId: string;
  platform: 'yanhekt' | 'yanhe2';
  format: DevPlaybackFormat;
  live: boolean;
}

export type DevPlaybackResult = DevPlaybackSource | {
  kind: 'disabled' | 'invalidUrl' | 'yanhektSignIn' | 'yanhe2SignIn' | 'proxyFailed';
};

export type DevDownloadPrepared = {
  kind: 'ok';
  url: string;
  account: string;
  outputName: string;
  format: DevPlaybackFormat;
} | {
  kind: 'disabled' | 'invalidUrl' | 'liveUnsupported' | 'yanhektSignIn' | 'yanhe2SignIn';
};
