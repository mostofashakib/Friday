"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import QuestionCard from "@/components/interview/QuestionCard";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import DifficultyMeter from "@/components/interview/DifficultyMeter";
import VoiceOrb from "@/components/interview/VoiceOrb";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { getHistory, submitTurn, interruptTTS, synthesizeTTS } from "@/lib/api";
import type { Message, Grading } from "@/types";

const MAX_TURNS = 8;

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentTurn, setCurrentTurn] = useState(1);
  const [difficulty, setDifficulty] = useState(3);
  const [isFollowup, setIsFollowup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [lastGrading, setLastGrading] = useState<Grading | null>(null);
  const [lastCoachNote, setLastCoachNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedIntroRef = useRef(false);

  const recorder = useVoiceRecorder({
    sessionId,
    onSubmit: handleAnswer,
  });

  // Derived orb state — single source of truth
  const orbState = submitting
    ? "idle"
    : ttsPlaying
    ? "ai-speaking"
    : recorder.recorderState === "listening"
    ? "user-speaking"
    : recorder.recorderState === "countdown"
    ? "countdown"
    : "idle";

  useEffect(() => {
    async function load() {
      let lastInterviewer: Message | undefined;
      try {
        const { messages: msgs } = await getHistory(sessionId);
        setMessages(msgs);
        lastInterviewer = [...msgs].reverse().find((m) => m.role === "interviewer");
        if (lastInterviewer) {
          setCurrentQuestion(lastInterviewer.content);
          setCurrentTurn(lastInterviewer.turn_number);
          setIsFollowup(lastInterviewer.is_followup);
        }
      } catch {
        setError("Failed to load session.");
      } finally {
        setLoading(false);
      }

      if (!lastInterviewer || hasPlayedIntroRef.current) return;
      hasPlayedIntroRef.current = true;

      const isFirstQuestion = lastInterviewer.turn_number === 1 && !lastInterviewer.is_followup;
      const ttsText = isFirstQuestion
        ? `Hi, my name is Friday. I'm your AI interview coach for today's session. I'll be asking you a series of questions and providing feedback on your responses to help you improve. Let's get started with your first question. ${lastInterviewer.content}`
        : lastInterviewer.content;

      try {
        const { audio } = await synthesizeTTS(ttsText, sessionId);
        playTTS(audio);
      } catch {
        playTTS(null);
      }
    }
    load();
  }, [sessionId]);

  function playTTS(ttsAudio: string | null) {
    if (!ttsAudio) {
      // No audio — go straight to recording
      void recorder.start();
      return;
    }
    const blob = base64ToBlob(ttsAudio, "audio/mpeg");
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    audioRef.current = el;
    setTtsPlaying(true);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      setTtsPlaying(false);
      void recorder.start();
    };
    el.onended = cleanup;
    el.onerror = cleanup;
    el.play().catch(cleanup);
  }

  async function handleOrbInterrupt() {
    audioRef.current?.pause();
    setTtsPlaying(false);
    await interruptTTS(sessionId);
    void recorder.start();
  }

  async function handleAnswer(answer: string) {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitTurn(sessionId, answer);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: "user",
        content: answer,
        competency: result.grading?.competency ?? null,
        score: result.grading?.score ?? null,
        turn_number: result.turn - 1,
        is_followup: false,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLastGrading(result.grading);
      setLastCoachNote(result.coaching_note);

      if (result.session_complete) {
        router.push(`/report/${sessionId}`);
        return;
      }

      if (result.question) {
        const interviewerMsg: Message = {
          id: crypto.randomUUID(),
          session_id: sessionId,
          role: "interviewer",
          content: result.question,
          competency: null,
          score: null,
          turn_number: result.turn,
          is_followup: result.is_followup,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, interviewerMsg]);
        setCurrentQuestion(result.question);
        setCurrentTurn(result.turn);
        setDifficulty(result.difficulty);
        setIsFollowup(result.is_followup);
        playTTS(result.tts_audio);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)", animation: "glow-pulse 1.5s ease-in-out infinite" }}
            >
              <span className="text-lg">🎙</span>
            </div>
            <p className="text-[14px] text-muted">Loading your interview…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-20 pb-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left column: Transcript */}
          <div className="lg:col-span-1">
            <div className="card-gb-subtle h-full">
              <div className="card-gb-subtle-inner p-4 h-full">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-4 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Conversation
                </p>
                <TranscriptPanel messages={messages} />
              </div>
            </div>
          </div>

          {/* Right column: Active interview */}
          <div className="lg:col-span-2 space-y-4">

            {/* Progress bar */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner px-5 py-4">
                <DifficultyMeter difficulty={difficulty} turn={currentTurn} maxTurns={MAX_TURNS} />
              </div>
            </div>

            {/* Hero orb */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner px-5 py-6 flex flex-col items-center">
                <VoiceOrb state={orbState} onInterrupt={handleOrbInterrupt} />
              </div>
            </div>

            {/* Current question */}
            {currentQuestion && (
              <QuestionCard
                question={currentQuestion}
                turn={currentTurn}
                difficulty={difficulty}
                isFollowup={isFollowup}
              />
            )}

            {/* Live transcript */}
            {(orbState === "user-speaking" || orbState === "countdown") && recorder.liveTranscript && (
              <div className="card-gb-subtle">
                <div className="card-gb-subtle-inner px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                    Your words
                  </p>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.7)" }}>
                    {recorder.liveTranscript}
                  </p>
                </div>
              </div>
            )}

            {/* Countdown strip */}
            {orbState === "countdown" && (
              <div
                className="flex items-center gap-3 px-5 py-3 rounded-xl"
                style={{ background: "rgba(255,159,10,0.07)", border: "1px solid rgba(255,159,10,0.15)" }}
              >
                <div className="flex-1 h-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${(recorder.countdownSeconds / 5) * 100}%`,
                      background: "#FF9F0A",
                    }}
                  />
                </div>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: "rgba(255,159,10,0.9)" }}>
                  {recorder.countdownSeconds}s
                </span>
                <button
                  type="button"
                  onClick={recorder.cancel}
                  className="text-[12px] font-medium px-3 py-1 rounded-lg transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                >
                  Keep talking
                </button>
              </div>
            )}

            {/* Coach feedback */}
            {lastGrading && (
              <div className="card-gb-purple">
                <div className="card-gb-purple-inner px-5 py-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[12px] font-semibold" style={{ color: "rgba(94,92,230,0.9)" }}>
                      Coach feedback
                    </span>
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                      style={{
                        background: lastGrading.score >= 4 ? "rgba(48,209,88,0.12)" : lastGrading.score >= 3 ? "rgba(255,159,10,0.12)" : "rgba(255,69,58,0.12)",
                        color: lastGrading.score >= 4 ? "#30D158" : lastGrading.score >= 3 ? "#FF9F0A" : "#FF453A",
                        boxShadow: lastGrading.score >= 4 ? "0 0 8px rgba(48,209,88,0.2)" : lastGrading.score >= 3 ? "0 0 8px rgba(255,159,10,0.2)" : "0 0 8px rgba(255,69,58,0.2)",
                      }}
                    >
                      {lastGrading.score}/5
                    </span>
                    {lastGrading.competency && (
                      <span className="text-[11px] text-dimmer">{lastGrading.competency}</span>
                    )}
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.6)" }}>{lastGrading.feedback}</p>
                  {lastCoachNote && (
                    <p
                      className="text-[13px] leading-relaxed pt-2.5"
                      style={{ borderTop: "1px solid rgba(94,92,230,0.12)", color: "rgba(94,92,230,0.8)", fontStyle: "italic" }}
                    >
                      {lastCoachNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submitting indicator */}
            {submitting && (
              <p className="text-[12px] text-accent" style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }}>
                Friday is reviewing your answer…
              </p>
            )}

            {/* General error */}
            {error && (
              <p
                className="text-[12px] rounded-xl px-3 py-2"
                style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}
              >
                {error}
              </p>
            )}

          </div>
        </div>
      </main>
    </>
  );
}
