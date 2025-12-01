
import { VideoItem, DEFAULT_INSTANCES, StreamInfo } from '../types';

let currentInstance = DEFAULT_INSTANCES[0];

// Fallback data to show if the API fails, ensuring the app is never "empty"
const FALLBACK_VIDEOS: VideoItem[] = [
  {
    id: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio - beats to relax/study to',
    channelTitle: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    viewCount: 'LIVE'
  },
  {
    id: '4xDzrJKXOOY',
    title: 'synthwave radio - beats to chill/game to',
    channelTitle: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    viewCount: 'LIVE'
  },
  {
    id: '5qap5aO4i9A',
    title: 'lofi hip hop radio - beats to sleep/chill to',
    channelTitle: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    viewCount: 'LIVE'
  },
  {
    id: 'kPa7bsKwL-c',
    title: 'Classical Piano Music for Brain Power',
    channelTitle: 'HALIDONMUSIC',
    thumbnail: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg',
    lengthSeconds: 10540,
    viewCount: '9M'
  }
];

export const setInstance = (url: string) => {
  currentInstance = url.replace(/\/$/, '');
};

export const getInstance = () => currentInstance;

// Automatically find the fastest working instance
export const findFastestInstance = async (): Promise<string> => {
  // Sequential check is often more reliable than parallel for avoiding rate limits/CORS issues on some networks
  for (const instance of DEFAULT_INSTANCES) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${instance}/trending?region=US`, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            console.log(`Connected to: ${instance}`);
            currentInstance = instance;
            return instance;
        }
    } catch (e) {
        continue;
    }
  }
  console.warn("All checks failed, defaulting to primary");
  currentInstance = DEFAULT_INSTANCES[0];
  return DEFAULT_INSTANCES[0];
};

const fetchJson = async (endpoint: string, specificInstance?: string) => {
  const instance = specificInstance || currentInstance;
  const res = await fetch(`${instance}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

export const getPopularVideos = async (): Promise<VideoItem[]> => {
  try {
    const data = await fetchJson('/trending?region=US');
    if (!Array.isArray(data)) return FALLBACK_VIDEOS;
    
    return data.map((item: any) => ({
      id: item.url.split('/watch?v=')[1] || item.url,
      title: item.title,
      channelTitle: item.uploaderName,
      thumbnail: item.thumbnail,
      lengthSeconds: item.duration,
      viewCount: item.views?.toString()
    }));
  } catch (error) {
    console.warn('Trend fetch failed, using fallback videos');
    return FALLBACK_VIDEOS;
  }
};

export const searchVideos = async (query: string): Promise<VideoItem[]> => {
  try {
    let searchTerm = query;
    let directVideoId = '';

    // Advanced URL Parsing for "Navigator" feel
    if (query.match(/youtu\.?be|youtube\.com/)) {
        try {
            const url = new URL(query.startsWith('http') ? query : `https://${query}`);
            if (url.hostname.includes('youtu.be')) {
                directVideoId = url.pathname.slice(1);
            } else if (url.searchParams.has('v')) {
                directVideoId = url.searchParams.get('v') || '';
            } else if (url.pathname.includes('/shorts/')) {
                directVideoId = url.pathname.split('/shorts/')[1];
            } else if (url.pathname.includes('/live/')) {
                directVideoId = url.pathname.split('/live/')[1];
            }
        } catch (e) {
            console.log("Invalid URL parse attempt");
        }
    }

    if (directVideoId) {
         try {
             const details = await fetchJson(`/streams/${directVideoId}`);
             return [{
                 id: directVideoId,
                 title: details.title,
                 channelTitle: details.uploader,
                 thumbnail: details.thumbnailUrl,
                 lengthSeconds: details.duration,
                 viewCount: details.views?.toString()
             }];
         } catch (e) {
             searchTerm = directVideoId;
         }
    }

    const data = await fetchJson(`/search?q=${encodeURIComponent(searchTerm)}&filter=videos`);
    if (!data.items) return [];

    return data.items
      .filter((item: any) => item.type === 'video')
      .map((item: any) => ({
        id: item.url.split('/watch?v=')[1],
        title: item.title,
        channelTitle: item.uploaderName,
        thumbnail: item.thumbnail,
        lengthSeconds: item.duration,
        viewCount: item.views?.toString()
      }));
  } catch (error) {
    console.error('Search failed', error);
    return [];
  }
};

// Robust Stream Fetcher with Retry logic across instances
export const getVideoStreams = async (videoId: string): Promise<StreamInfo | null> => {
    // Try current instance first
    try {
        return await fetchStreamFromInstance(videoId, currentInstance);
    } catch (e) {
        console.warn(`Primary instance failed for stream ${videoId}, trying backups...`);
    }

    // If failed, try a few others specifically
    for (const instance of DEFAULT_INSTANCES) {
        if (instance === currentInstance) continue;
        try {
            const result = await fetchStreamFromInstance(videoId, instance);
            if (result) {
                console.log(`Recovered stream from ${instance}`);
                return result;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
};

const fetchStreamFromInstance = async (videoId: string, instance: string): Promise<StreamInfo> => {
    const data = await fetchJson(`/streams/${videoId}`, instance);
    
    // 1. Try HLS (Best for streaming stability)
    if (data.hls) {
      return {
        url: data.hls,
        mimeType: 'application/x-mpegURL',
        quality: 'Auto'
      };
    }

    // 2. Try MP4 Video+Audio
    const mp4Video = data.videoStreams?.find((s: any) => s.format === 'MPEG-4' && !s.videoOnly);
    if (mp4Video) {
      return {
        url: mp4Video.url,
        mimeType: 'video/mp4',
        quality: mp4Video.quality
      };
    }

    // 3. Fallback: Audio Only (Background play guaranteed)
    const audio = data.audioStreams?.find((s: any) => s.format === 'MPEG-4' || s.format === 'WEBM');
    if (audio) {
      return {
        url: audio.url,
        mimeType: 'audio/mp4',
        quality: 'Audio Only',
        isAudioOnly: true
      };
    }
    
    throw new Error("No suitable streams found");
};
