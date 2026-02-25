"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface AudioRecorderProps {
  onSubmit: (transcript: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onSubmit, disabled }: AudioRecorderProps) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as typeof window & { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        setTranscript(full);
      };

      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setListening(true);
    }
  }

  function handleSubmit() {
    if (listening) recognitionRef.current?.stop();
    const text = transcript.trim();
    if (!text) return;
    onSubmit(text);
    setTranscript("");
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={
          speechSupported
            ? "Click the mic to speak, or type your answer here..."
            : "Type your answer here..."
        }
        className="min-h-[120px] resize-none"
        disabled={disabled}
      />
      <div className="flex items-center gap-3">
        {speechSupported && (
          <Button
            type="button"
            variant={listening ? "destructive" : "outline"}
            size="sm"
            onClick={toggleListening}
            disabled={disabled}
            className="gap-2"
          >
            {listening ? (
              <>
                <MicOff className="h-4 w-4" />
                Stop recording
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Record answer
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || !transcript.trim()}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Submit answer
        </Button>
        {listening && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Listening...
          </span>
        )}
      </div>
    </div>
  );
}
