
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

// Highly reliable Piped instances sorted by uptime probability
// Updated with currently working instances
export const DEFAULT_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacy.com.de',
  'https://pipedapi.drgns.space',
  'https://api.piped.chalos.xyz',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.adminforge.de',
  'https://api.piped.forcad.Pd',
  'https://piped-api.lunar.icu'
];
