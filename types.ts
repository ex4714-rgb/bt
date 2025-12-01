
export interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  lengthSeconds?: number;
  viewCount?: string;
}

export interface PlaylistItem {
  id: string; 
  title: string;
  thumbnail: string;
  videos: VideoItem[];
}

export interface UserSettings {
  invidiousInstance: string;
  isLoggedIn: boolean;
  username?: string;
}

export interface StreamInfo {
  url: string;
  mimeType: string;
  quality: string;
  isAudioOnly?: boolean;
}

// Updated list prioritizing instances less likely to be blocked by AVs
export const DEFAULT_INSTANCES = [
  'https://api.piped.privacy.com.de',  // Usually cleaner reputation
  'https://pipedapi.drgns.space',      // Good uptime
  'https://api.piped.chalos.xyz',
  'https://pipedapi.kavin.rocks',      // Fallback (often blocked)
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.adminforge.de',
  'https://api.piped.forcad.Pd',
  'https://piped-api.lunar.icu'
];
