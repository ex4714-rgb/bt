
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

// Updated list: Removed 'tokhmi', prioritized 'clean' domains
export const DEFAULT_INSTANCES = [
  'https://api.piped.privacy.com.de',   // Germany (High reliability)
  'https://pipedapi.drgns.space',       // US (Fast)
  'https://api.piped.chalos.xyz',       // US
  'https://pipedapi.smnz.de',           // Germany (Clean)
  'https://pipedapi.moomoo.me',         // Australia
  'https://api.piped.projectsegfau.lt', // Lithuania
  'https://pipedapi.ducks.party',       // Global
  'https://api.piped.forcad.Pd'         // Fallback
];
