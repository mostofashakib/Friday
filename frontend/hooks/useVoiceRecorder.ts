"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/api";

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

// Silence detection tuning
const SILENCE_THRESHOLD = 0.01;   // RMS amplitude below this = silent
const SILENCE_DURATION_MS = 5_000; // ms of silence before countdown
const VAD_POLL_MS = 100;           // how often to sample audio energy

interface UseVoiceRecorderOptions {
  sessionId: string;
  onSubmit: (transcript: string) => void;
}

export function useVoiceRecorder({ sessionId, onSubmit }: UseVoiceRecorderOptions) {
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [isSupported, setIsSupported] = useState(false);

  const recorderStateRef = useRef<RecorderState>("idle");
  const liveTranscriptRef = useRef("");
  const countdownSecondsRef = useRef(5);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceSinceRef = useRef<number | null>(null); // timestamp when silence started

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const w = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setIsSupported(!!SR && typeof MediaRecorder !== "undefined");
  }, []);

  function setStateSync(s: RecorderState) {
    recorderStateRef.current = s;
    setRecorderState(s);
  }

  function clearCountdownTimer() {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function stopVAD() {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    silenceSinceRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
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

  function getRMS(analyser: AnalyserNode): number {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function startVAD(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    silenceSinceRef.current = null;

    vadTimerRef.current = setInterval(() => {
      const state = recorderStateRef.current;
      if (state === "idle") return;

      const rms = getRMS(analyser);
      const isSpeaking = rms > SILENCE_THRESHOLD;

      if (isSpeaking) {
        // User is speaking — reset silence clock and cancel any active countdown
        silenceSinceRef.current = null;
        if (state === "countdown") {
          clearCountdownTimer();
          countdownSecondsRef.current = 5;
          setCountdownSeconds(5);
          setStateSync("listening");
        }
      } else {
        // User is silent
        if (state === "listening") {
          if (silenceSinceRef.current === null) {
            silenceSinceRef.current = Date.now();
          } else if (Date.now() - silenceSinceRef.current >= SILENCE_DURATION_MS) {
            silenceSinceRef.current = null;
            startCountdown();
          }
        }
        // During countdown: let countdown continue (VAD not resetting it here)
      }
    }, VAD_POLL_MS);
  }

  async function submitRecording() {
    stopVAD();
    recognitionRef.current?.stop();

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      await new Promise<void>((resolve) => {
        mr.onstop = () => resolve();
        mr.stop();
      });
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

    setLiveTranscript("");
    liveTranscriptRef.current = "";
    chunksRef.current = [];
    clearCountdownTimer();
    stopVAD();
    setStateSync("listening");

    // SpeechRecognition — live transcript display only (not used for silence detection)
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
    };
    rec.onend = () => {
      if (recorderStateRef.current === "listening" || recorderStateRef.current === "countdown") {
        try { rec.start(); } catch { /* ignore */ }
      }
    };
    recognitionRef.current = rec;
    rec.start();

    // Microphone stream — used for both MediaRecorder (Whisper) and VAD
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // VAD using Web Audio API
      startVAD(stream);

      // MediaRecorder for Whisper transcription
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
    } catch {
      // Microphone denied — Web Speech transcript only, no VAD
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const cancel = useCallback(() => {
    clearCountdownTimer();
    countdownSecondsRef.current = 5;
    setCountdownSeconds(5);
    if (recorderStateRef.current === "countdown") {
      setStateSync("listening");
      silenceSinceRef.current = null; // restart silence clock
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { liveTranscript, recorderState, countdownSeconds, start, cancel, isSupported };
}
