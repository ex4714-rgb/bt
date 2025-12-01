
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, List, Search, 
  Settings, Home, RefreshCw, X, Globe, Lock, MoreVertical, Youtube, User, Minimize2, Maximize2
} from 'lucide-react';
import Hls from 'hls.js';
import { VideoItem, UserSettings, DEFAULT_INSTANCES } from './types';
import * as youtubeService from './services/youtubeService';
import SettingsModal from './components/SettingsModal';

const DEFAULT_SETTINGS: UserSettings = {
  invidiousInstance: DEFAULT_INSTANCES[0],
  isLoggedIn: false,
};

const getAvatarColor = (name: string) => {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-600', 'bg-pink-600'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function App() {
  // --- State ---
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('bahaTubeSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  const [activeTab, setActiveTab] = useState<'home' | 'playlist'>('home');
  const [homeVideos, setHomeVideos] = useState<VideoItem[]>([]);
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  
  // Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  // UI
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- Initialization ---

  useEffect(() => {
    initApp();
    
    // Cleanup HLS on unmount
    return () => {
        if (hlsRef.current) {
            hlsRef.current.destroy();
        }
    };
  }, []);

  const initApp = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await youtubeService.findFastestInstance();
      await loadHomeFeed();
    } catch (e) {
      setErrorMsg("Could not connect to network. Please retry.");
      setIsLoading(false);
    }
  };

  const loadHomeFeed = async () => {
    setIsLoading(true);
    const videos = await youtubeService.getPopularVideos();
    if (videos.length > 0) {
      setHomeVideos(videos);
      setErrorMsg(null);
    } else {
      setErrorMsg("No videos found. Try searching.");
    }
    setIsLoading(false);
  };

  // --- Player Logic ---

  useEffect(() => {
    const loadStream = async () => {
      if (currentIndex === -1 || !playlist[currentIndex]) return;
      
      const video = playlist[currentIndex];
      
      setIsLoadingStream(true);
      setErrorMsg(null);
      
      // Cleanup previous stream
      if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
      }
      if(videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src'); 
          videoRef.current.load();
      }

      const streamInfo = await youtubeService.getVideoStreams(video.id);
      
      if (streamInfo && videoRef.current) {
        setCurrentStreamUrl(streamInfo.url);
        setIsAudioOnly(!!streamInfo.isAudioOnly);
        updateMediaSession(video);

        // HLS Logic
        if (Hls.isSupported() && streamInfo.mimeType === 'application/x-mpegURL') {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hls.loadSource(streamInfo.url);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(e => console.warn("Auto-play blocked:", e));
            });
            hls.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('fatal network error encountered, try to recover');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('fatal media error encountered, try to recover');
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
            hlsRef.current = hls;
        } else {
            // Native Support (Safari/iOS) or standard MP4
            videoRef.current.src = streamInfo.url;
            videoRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
        }

      } else {
        console.error("Stream load failed");
        // Try next video after short delay
        setTimeout(playNext, 2000);
      }
      setIsLoadingStream(false);
    };

    loadStream();
  }, [currentIndex]);

  // Sync Play State
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  };

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % playlist.length);
  }, [playlist.length]);

  const playPrev = useCallback(() => {
    if (playlist.length === 0) return;
    setCurrentIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const updateMediaSession = (video: VideoItem) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: video.title,
        artist: video.channelTitle,
        artwork: [{ src: video.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
  };

  const addToPlaylist = (video: VideoItem) => {
    setPlaylist(prev => {
      const exists = prev.find(v => v.id === video.id);
      if (exists) {
          const idx = prev.findIndex(v => v.id === video.id);
          setCurrentIndex(idx);
          return prev;
      }
      const newPl = [...prev, video];
      setCurrentIndex(newPl.length - 1); 
      return newPl;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setActiveTab('home');
    setHomeVideos([]); 
    
    const results = await youtubeService.searchVideos(searchQuery);
    if (results.length > 0) {
        setHomeVideos(results);
    } else {
        setErrorMsg("No results found.");
    }
    setIsLoading(false);
  };

  const handleControlsInteraction = () => {
      setShowControls(true);
      resetControlsTimeout();
  };

  const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
          if (isPlaying) setShowControls(false);
      }, 3000);
  };

  // Format time MM:SS or HH:MM:SS
  const formatTime = (time: number) => {
      if (isNaN(time)) return "0:00";
      const h = Math.floor(time / 3600);
      const m = Math.floor((time % 3600) / 60);
      const s = Math.floor(time % 60);
      if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white font-sans overflow-hidden select-none">
      
      {/* --- Header --- */}
      <div className="bg-[#0f0f0f] px-4 py-2 flex items-center justify-between gap-4 z-30 sticky top-0 border-b border-[#272727]">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => initApp()}>
           <div className="bg-red-600 rounded-lg p-1">
             <Play className="w-3 h-3 fill-white text-white" />
           </div>
           <span className="font-bold text-lg tracking-tighter">BahaTube</span>
        </div>

        <div className="flex-1 max-w-md mx-2">
            <form onSubmit={handleSearch} className="relative w-full">
                <input 
                    className="w-full bg-[#272727] border border-[#303030] rounded-full py-1.5 pl-9 pr-8 text-sm text-white placeholder:text-[#888] focus:outline-none focus:border-[#1c62b9] transition-colors"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-4 h-4 text-[#888] absolute left-3 top-1/2 -translate-y-1/2" />
                {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                        <X className="w-3 h-3 text-[#888]" />
                    </button>
                )}
            </form>
        </div>

        <button onClick={() => setIsSettingsOpen(true)} className="p-1">
            <User className="w-6 h-6 text-white rounded-full bg-purple-600 p-1" />
        </button>
      </div>

      {/* --- Video Player Container --- */}
      <div className={`w-full bg-black flex-shrink-0 transition-all duration-300 relative z-20 group
        ${currentIndex !== -1 ? 'aspect-video shadow-xl' : 'h-0 overflow-hidden'}`}
        onMouseMove={handleControlsInteraction}
        onClick={handleControlsInteraction}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        <video 
          ref={videoRef}
          className={`w-full h-full bg-black object-contain ${isAudioOnly ? 'hidden' : 'block'}`}
          playsInline
          onTimeUpdate={(e) => {
             setCurrentTime(e.currentTarget.currentTime);
             setDuration(e.currentTarget.duration || 0);
          }}
          onEnded={playNext}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsLoadingStream(true)}
          onPlaying={() => setIsLoadingStream(false)}
        />

        {/* Audio Mode Placeholder */}
        {isAudioOnly && (
            <div className="w-full h-full flex items-center justify-center bg-[#1e1e1e] relative overflow-hidden">
                {playlist[currentIndex] && (
                    <>
                        <img src={playlist[currentIndex].thumbnail} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-xl scale-110" />
                        <div className="z-10 flex flex-col items-center">
                            <img src={playlist[currentIndex].thumbnail} className="w-32 h-32 rounded-xl shadow-2xl mb-4 object-cover" />
                            <p className="text-sm font-medium text-white/90">Audio Mode</p>
                        </div>
                    </>
                )}
            </div>
        )}

        {/* Loading Spinner */}
        {isLoadingStream && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
                 <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
             </div>
        )}

        {/* Controls Overlay */}
        <div className={`absolute inset-0 bg-black/60 flex flex-col justify-between transition-opacity duration-200 z-20 
            ${showControls || !isPlaying ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
            
            {/* Top Bar (Title) */}
            <div className="p-3 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                 <div className="flex-1">
                    <h3 className="text-sm font-medium text-white line-clamp-1">{playlist[currentIndex]?.title}</h3>
                    <p className="text-xs text-white/70">{playlist[currentIndex]?.channelTitle}</p>
                 </div>
                 <button className="p-2"><MoreVertical className="w-5 h-5 text-white" /></button>
            </div>

            {/* Center Controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-10 pointer-events-none">
                <button onClick={(e) => { e.stopPropagation(); playPrev(); }} className="pointer-events-auto p-4 rounded-full active:bg-white/10 transition">
                    <SkipBack className="w-8 h-8 fill-white text-white" />
                </button>
                
                <button onClick={togglePlay} className="pointer-events-auto bg-black/20 backdrop-blur-sm rounded-full p-4 hover:bg-black/40 transition scale-110">
                   {isPlaying ? <Pause className="w-10 h-10 fill-white text-white" /> : <Play className="w-10 h-10 fill-white text-white ml-1" />}
                </button>
                
                <button onClick={(e) => { e.stopPropagation(); playNext(); }} className="pointer-events-auto p-4 rounded-full active:bg-white/10 transition">
                    <SkipForward className="w-8 h-8 fill-white text-white" />
                </button>
            </div>

            {/* Bottom Controls */}
            <div className="px-3 pb-2 pt-8 bg-gradient-to-t from-black/80 to-transparent">
               <div className="flex items-center justify-between text-xs font-medium text-white mb-2">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-white/70">{formatTime(duration)}</span>
               </div>
               
               {/* Progress Bar (Interactive) */}
               <div className="relative w-full h-1 bg-white/30 cursor-pointer group py-2"
                    onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        if(videoRef.current) videoRef.current.currentTime = pos * duration;
                    }}>
                   <div className="absolute top-2 left-0 h-0.5 bg-red-600 rounded-full" style={{ width: `${(currentTime/duration)*100}%` }}>
                       <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                   </div>
               </div>
            </div>
        </div>

        {/* Minimal Progress Bar (When controls hidden) */}
        {!showControls && isPlaying && (
             <div className="absolute bottom-0 left-0 w-full h-[2px] bg-zinc-700 z-10">
                 <div className="h-full bg-red-600" style={{ width: `${(currentTime/duration)*100}%` }} />
             </div>
        )}
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 overflow-y-auto bg-[#0f0f0f] relative scroll-smooth">
        
        {isLoading && (
            <div className="flex justify-center pt-20">
                <div className="w-8 h-8 border-4 border-zinc-600 border-t-red-600 rounded-full animate-spin" />
            </div>
        )}
        
        {errorMsg && !isLoading && (
            <div className="p-8 text-center text-zinc-400 mt-10">
                <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4 text-sm">{errorMsg}</p>
                <button onClick={initApp} className="text-[#3ea6ff] text-sm font-medium px-4 py-2 hover:bg-[#3ea6ff]/10 rounded-full">
                    Retry Connection
                </button>
            </div>
        )}

        {/* Home Feed */}
        {!isLoading && !errorMsg && activeTab === 'home' && (
           <div className="pb-20">
              {homeVideos.map((video, idx) => (
                <div key={idx} onClick={() => addToPlaylist(video)} className="mb-1 cursor-pointer active:bg-[#1a1a1a] transition-colors">
                   <div className="relative w-full aspect-video bg-[#1f1f1f]">
                      <img 
                        src={video.thumbnail} 
                        className="w-full h-full object-cover" 
                        loading="lazy" 
                        onError={(e) => e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                      />
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1 py-0.5 rounded">
                        {video.lengthSeconds ? formatTime(video.lengthSeconds) : '0:00'}
                      </span>
                   </div>

                   <div className="flex gap-3 p-3">
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white ${getAvatarColor(video.channelTitle)}`}>
                          {video.channelTitle.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                          <h3 className="text-white text-[14px] leading-5 font-normal line-clamp-2 mb-1">
                              {video.title}
                          </h3>
                          <div className="text-[#aaa] text-[12px] flex items-center gap-1">
                              <span>{video.channelTitle}</span>
                              <span className="text-[8px]">•</span>
                              <span>{video.viewCount ? Math.floor(Number(video.viewCount)/1000) + 'K views' : 'Views hidden'}</span>
                          </div>
                      </div>
                      
                      <div className="flex-shrink-0 pt-1" onClick={(e) => { e.stopPropagation(); /* Show Menu */ }}>
                          <MoreVertical className="w-4 h-4 text-white" />
                      </div>
                   </div>
                </div>
              ))}
           </div>
        )}

        {/* Playlist View */}
        {activeTab === 'playlist' && (
            <div className="pb-20">
                <div className="px-4 py-3 border-b border-[#272727] sticky top-0 bg-[#0f0f0f] z-10 flex justify-between items-center">
                    <h2 className="text-base font-bold text-white">Current Queue</h2>
                    <span className="text-xs text-[#aaa]">{playlist.length} videos</span>
                </div>
                
                {playlist.length === 0 && (
                    <div className="p-8 text-center text-[#aaa] text-sm mt-10">
                        Queue is empty. <br/> Go Home to add videos.
                    </div>
                )}

                {playlist.map((video, idx) => (
                    <div key={idx} onClick={() => setCurrentIndex(idx)} 
                        className={`flex items-center gap-3 px-4 py-3 active:bg-[#272727] ${currentIndex === idx ? 'bg-[#262626]' : ''}`}>
                        
                        <div className="relative w-28 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                             <img src={video.thumbnail} className="w-full h-full object-cover" />
                             {currentIndex === idx && (
                                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    {isPlaying ? (
                                       <div className="flex gap-1">
                                           <div className="w-1 h-3 bg-white animate-pulse" />
                                           <div className="w-1 h-3 bg-white animate-pulse delay-75" />
                                           <div className="w-1 h-3 bg-white animate-pulse delay-150" />
                                       </div>
                                    ) : <Play className="w-4 h-4 fill-white text-white"/>}
                                 </div>
                             )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium line-clamp-2 ${currentIndex === idx ? 'text-white' : 'text-[#f1f1f1]'}`}>
                                {video.title}
                            </h4>
                            <p className="text-xs text-[#aaa] mt-1">{video.channelTitle}</p>
                        </div>
                        
                        <button onClick={(e) => { e.stopPropagation(); setPlaylist(p => p.filter((_,i) => i!==idx)); }} className="p-2">
                            <X className="w-4 h-4 text-[#aaa]" />
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* --- Bottom Navigation --- */}
      <div className="flex items-center justify-around bg-[#0f0f0f] border-t border-[#272727] h-[48px] pb-safe-bottom z-40">
         <button 
            onClick={() => setActiveTab('home')} 
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full active:bg-[#272727]"
         >
            <Home className={`w-6 h-6 ${activeTab === 'home' ? 'fill-white text-white' : 'text-white stroke-1'}`} />
            <span className="text-[10px] text-white">Home</span>
         </button>
         
         <button className="flex-1 flex flex-col items-center justify-center gap-1 h-full opacity-50 cursor-not-allowed">
            <Youtube className="w-6 h-6 text-white stroke-1" />
            <span className="text-[10px] text-white">Shorts</span>
         </button>

         <button 
            onClick={() => setActiveTab('playlist')} 
            className="flex-1 flex flex-col items-center justify-center gap-1 h-full active:bg-[#272727]"
         >
            <List className={`w-6 h-6 ${activeTab === 'playlist' ? 'text-white stroke-[2.5px]' : 'text-white stroke-1'}`} />
            <span className="text-[10px] text-white">Library</span>
         </button>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(s) => { setSettings(s); youtubeService.setInstance(s.invidiousInstance); }}
      />
    </div>
  );
}
