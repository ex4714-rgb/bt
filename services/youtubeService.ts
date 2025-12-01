
import { VideoItem, DEFAULT_INSTANCES, StreamInfo } from '../types';

let currentInstance = DEFAULT_INSTANCES[0];

// Fallback data to show ONLY if ALL servers fail
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
    id: 'kPa7bsKwL-c',
    title: 'Classical Piano Music for Brain Power',
    channelTitle: 'HALIDONMUSIC',
    thumbnail: 'https://i.ytimg.com/vi/kPa7bsKwL-c/hqdefault.jpg',
    lengthSeconds: 10540,
    viewCount: '9M'
  },
  {
    id: '5qap5aO4i9A',
    title: 'lofi hip hop radio - beats to sleep/chill to',
    channelTitle: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    viewCount: 'LIVE'
  }
];

export const setInstance = (url: string) => {
  currentInstance = url.replace(/\/$/, '');
};

export const getInstance = () => currentInstance;

// Initial check to find a "good" server to start with
export const findFastestInstance = async (): Promise<string> => {
  for (const instance of DEFAULT_INSTANCES) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // Fast timeout
        const res = await fetch(`${instance}/trending?region=US`, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
            console.log(`Initial connection to: ${instance}`);
            currentInstance = instance;
            return instance;
        }
    } catch (e) {
        continue;
    }
  }
  // Even if initial check fails, we don't throw, we just let the robust fetchers below handle it
  return DEFAULT_INSTANCES[0];
};

const fetchJson = async (endpoint: string, specificInstance?: string) => {
  const instance = specificInstance || currentInstance;
  const res = await fetch(`${instance}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

/**
 * Universal Retry Fetcher
 * Tries the 'current' instance first.
 * If that fails (AV block, 403, Network Error), it cycles through DEFAULT_INSTANCES.
 */
const robustFetch = async (path: string): Promise<any> => {
    // 1. Try current preferred instance
    try {
        return await fetchJson(path, currentInstance);
    } catch (e) {
        console.warn(`Primary ${currentInstance} failed for ${path}, starting search for working server...`);
    }

    // 2. Loop through all others
    for (const instance of DEFAULT_INSTANCES) {
        if (instance === currentInstance) continue;
        try {
            const data = await fetchJson(path, instance);
            console.log(`Recovered using ${instance}`);
            currentInstance = instance; // Update preference to this working one
            return data;
        } catch (e) {
            // Keep looking
        }
    }
    throw new Error("All servers failed");
};

export const getPopularVideos = async (): Promise<VideoItem[]> => {
  try {
    const data = await robustFetch('/trending?region=US');
    
    // API sometimes returns an object with "items" or just an array
    const items = Array.isArray(data) ? data : (data.items || []);

    if (items.length === 0) return FALLBACK_VIDEOS;
    
    return items.map((item: any) => ({
      id: item.url.split('/watch?v=')[1] || item.url,
      title: item.title,
      channelTitle: item.uploaderName,
      thumbnail: item.thumbnail,
      lengthSeconds: item.duration,
      viewCount: item.views?.toString()
    }));
  } catch (error) {
    console.error('Trend fetch failed on all mirrors:', error);
    return FALLBACK_VIDEOS;
  }
};

export const searchVideos = async (query: string): Promise<VideoItem[]> => {
  try {
    let searchTerm = query;
    let directVideoId = '';

    // URL Parsing
    if (query.match(/youtu\.?be|youtube\.com/)) {
        try {
            const url = new URL(query.startsWith('http') ? query : `https://${query}`);
            if (url.hostname.includes('youtu.be')) directVideoId = url.pathname.slice(1);
            else if (url.searchParams.has('v')) directVideoId = url.searchParams.get('v') || '';
            else if (url.pathname.includes('/shorts/')) directVideoId = url.pathname.split('/shorts/')[1];
        } catch (e) {}
    }

    if (directVideoId) {
         try {
             // Robust fetch for stream details
             const details = await robustFetch(`/streams/${directVideoId}`);
             return [{
                 id: directVideoId,
                 title: details.title,
                 channelTitle: details.uploader,
                 thumbnail: details.thumbnailUrl,
                 lengthSeconds: details.duration,
                 viewCount: details.views?.toString()
             }];
         } catch (e) {
             searchTerm = directVideoId; // Fallback to searching the ID
         }
    }

    const data = await robustFetch(`/search?q=${encodeURIComponent(searchTerm)}&filter=videos`);
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
    console.error('Search failed on all mirrors', error);
    return [];
  }
};

export const getVideoStreams = async (videoId: string): Promise<StreamInfo | null> => {
    // We can reuse the robustFetch logic manually here because we need to parse the result specifically per instance
    
    // Helper to extract stream info from data
    const extract = (data: any): StreamInfo => {
        if (data.hls) return { url: data.hls, mimeType: 'application/x-mpegURL', quality: 'Auto' };
        const mp4 = data.videoStreams?.find((s: any) => s.format === 'MPEG-4' && !s.videoOnly);
        if (mp4) return { url: mp4.url, mimeType: 'video/mp4', quality: mp4.quality };
        const audio = data.audioStreams?.find((s: any) => s.format === 'MPEG-4' || s.format === 'WEBM');
        if (audio) return { url: audio.url, mimeType: 'audio/mp4', quality: 'Audio Only', isAudioOnly: true };
        throw new Error("No streams");
    };

    // 1. Try Current
    try {
        const data = await fetchJson(`/streams/${videoId}`, currentInstance);
        return extract(data);
    } catch(e) {}

    // 2. Loop All
    for (const instance of DEFAULT_INSTANCES) {
        if (instance === currentInstance) continue;
        try {
            const data = await fetchJson(`/streams/${videoId}`, instance);
            console.log(`Stream found on ${instance}`);
            currentInstance = instance;
            return extract(data);
        } catch (e) {}
    }

    return null;
};
