'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AudioPlayerProps {
  previewUrl: string;
  trackTitle: string;
  artistName: string;
  onEnded?: () => void;
  isPlaying?: boolean;
  onPlayPause?: (isPlaying: boolean) => void;
  autoPlay?: boolean;
}

export function AudioPlayer({
  previewUrl,
  trackTitle,
  artistName,
  onEnded,
  isPlaying,
  onPlayPause,
  autoPlay,
}: AudioPlayerProps) {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playing = isPlaying ?? internalPlaying;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setInternalPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onEnded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);

    if (autoPlay && isPlaying === undefined) {
      audio.play().then(() => setInternalPlaying(true)).catch(() => {});
    }
  }, [previewUrl, autoPlay, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying === undefined) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
    setInternalPlaying(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextPlaying = !playing;
    if (nextPlaying) {
      try {
        await audio.play();
      } catch (error) {
        console.error('[OffDaWallV2] Audio play error:', error);
        return;
      }
    } else {
      audio.pause();
    }

    if (isPlaying === undefined) {
      setInternalPlaying(nextPlaying);
    }
    onPlayPause?.(nextPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border border-border p-4 space-y-3">
      <audio ref={audioRef} src={previewUrl} preload="metadata" />
      
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlay}
          className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{trackTitle}</div>
          <div className="text-xs text-muted-foreground truncate">{artistName}</div>
        </div>
      </div>

      <div className="space-y-2">
        <Slider
          value={[currentTime]}
          max={duration}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[10px] uppercase tracking-wider">30s Preview</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="h-8 w-8"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-24 cursor-pointer"
        />
      </div>
    </div>
  );
}

