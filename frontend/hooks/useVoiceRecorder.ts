"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/api";

// Web Speech API types (not fully typed in all TS DOM lib versions)
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export type RecorderState = "idle" | "listening" | "countdown";

interface UseVoiceRecorderOptions {
  sessionId: string;
  onSubmit: (transcript: string) => void;
}

export function useVoiceRecorder({ sessionId, onSubmit }: UseVoiceRecorderOptions) {
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [isSupported, setIsSupported] = useState(false);

  // Refs hold the live values so timer callbacks don't capture stale closures
  const recorderStateRef = useRef<RecorderState>("idle");
  const liveTranscriptRef = useRef("");
  const countdownSecondsRef = useRef(5);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const w = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setIsSupported(!!SR && typeof MediaRecorder !== "undefined");
  }, []);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function clearCountdownTimer() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function setStateSync(s: RecorderState) {
    recorderStateRef.current = s;
    setRecorderState(s);
  }

  function startCountdown() {
    countdownSecondsRef.current = 5;
    setCountdownSeconds(5);
    setStateSync("countdown");

    countdownTimerRef.current = setInterval(() => {
      countdownSecondsRef.current -= 1;
      setCountdownSeconds(countdownSecondsRef.current);
      if (countdownSecondsRef.current <= 0) {
        clearCountdownTimer();
        void submitRecording();
      }
    }, 1000);
  }

  function resetSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (recorderStateRef.current === "listening") {
        startCountdown();
      }
    }, 2000);
  }

  async function submitRecording() {
    // Stop SpeechRecognition
    recognitionRef.current?.stop();

    // Stop MediaRecorder and wait for final ondataavailable
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
        mr.stop();
      });
      // Release microphone
      mr.stream.getTracks().forEach((t) => t.stop());
    }

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fallback = liveTranscriptRef.current;
    setStateSync("idle");

    try {
      const transcript = await transcribeAudio(blob, sessionId);
      onSubmit(transcript || fallback);
    } catch {
      onSubmit(fallback);
    }

    // Reset for next turn
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    chunksRef.current = [];
  }

  const start = useCallback(async () => {
    const w = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    // Reset
    setLiveTranscript("");
    liveTranscriptRef.current = "";
    chunksRef.current = [];
    clearSilenceTimer();
    clearCountdownTimer();
    setStateSync("listening");

    // SpeechRecognition — live transcript display
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event: SpeechRecognitionResultEvent) => {
      const results = event.results as ArrayLike<ArrayLike<{ transcript: string }>>;
      let full = "";
      for (let i = 0; i < (results as unknown as { length: number }).length; i++) {
        full += results[i][0].transcript;
      }
      setLiveTranscript(full);
      liveTranscriptRef.current = full;

      // Cancel countdown if speech resumes
      if (recorderStateRef.current === "countdown") {
        clearCountdownTimer();
        countdownSecondsRef.current = 5;
        setCountdownSeconds(5);
        setStateSync("listening");
      }
      resetSilenceTimer();
    };
    rec.onend = () => {
      // Chrome stops SR after ~60s silence; restart if we're still supposed to be listening
      if (recorderStateRef.current === "listening" || recorderStateRef.current === "countdown") {
        try { rec.start(); } catch { /* ignore if already stopping */ }
      }
    };
    recognitionRef.current = rec;
    rec.start();
    resetSilenceTimer();

    // MediaRecorder — raw audio for Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(250); // chunk every 250 ms
      mediaRecorderRef.current = mr;
    } catch {
      // Microphone denied — continue with Web Speech only (Whisper path disabled)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const cancel = useCallback(() => {
    clearCountdownTimer();
    countdownSecondsRef.current = 5;
    setCountdownSeconds(5);
    if (recorderStateRef.current === "countdown") {
      setStateSync("listening");
      resetSilenceTimer();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { liveTranscript, recorderState, countdownSeconds, start, cancel, isSupported };
}
