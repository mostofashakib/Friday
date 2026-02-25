"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, Volume2 } from "lucide-react";
import { interruptTTS } from "@/lib/api";

interface TTSPlayerProps {
  audio: string | null;  // base64 MP3
  text: string;
  sessionId: string;
  onPlaybackEnd?: () => void;
}

export default function TTSPlayer({ audio, text, sessionId, onPlaybackEnd }: TTSPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!audio) {
      onPlaybackEnd?.();
      return;
    }

    const blob = base64ToBlob(audio, "audio/mpeg");
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audioRef.current = el;

    el.onplay = () => setPlaying(true);
    el.onended = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
      onPlaybackEnd?.();
    };
    el.onerror = () => {
      setPlaying(false);
      URL.revokeObjectURL(url);
      onPlaybackEnd?.();
    };

    el.play().catch(() => {
      setPlaying(false);
      onPlaybackEnd?.();
    });

    return () => {
      el.pause();
      URL.revokeObjectURL(url);
    };
  }, [audio]);

  async function handleInterrupt() {
    audioRef.current?.pause();
    setPlaying(false);
    await interruptTTS(sessionId);
    onPlaybackEnd?.();
  }

  return (
    <div className="flex items-center gap-3">
      {playing ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Volume2 className="h-4 w-4 text-primary animate-pulse" />
          <span>Speaking...</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleInterrupt}
            className="h-7 px-2 text-xs"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>
      ) : (
        !audio && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Volume2 className="h-4 w-4" />
            <span className="italic">Voice unavailable — reading mode</span>
          </div>
        )
      )}
    </div>
  );
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNums = Array.from(byteChars).map((c) => c.charCodeAt(0));
  return new Blob([new Uint8Array(byteNums)], { type: mimeType });
}
