"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import QuestionCard from "@/components/interview/QuestionCard";
import AudioRecorder from "@/components/interview/AudioRecorder";
import TTSPlayer from "@/components/interview/TTSPlayer";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import DifficultyMeter from "@/components/interview/DifficultyMeter";
import { getHistory, submitTurn } from "@/lib/api";
import type { Message, Grading } from "@/types";

const MAX_TURNS = 8;

export default function InterviewSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentTurn, setCurrentTurn] = useState(1);
  const [difficulty, setDifficulty] = useState(3);
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);
  const [isFollowup, setIsFollowup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [lastGrading, setLastGrading] = useState<Grading | null>(null);
  const [lastCoachNote, setLastCoachNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { messages: msgs } = await getHistory(sessionId);
        setMessages(msgs);
        const lastInterviewer = [...msgs].reverse().find((m) => m.role === "interviewer");
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
    }
    load();
  }, [sessionId]);

  async function handleAnswer(answer: string) {
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
        setTtsAudio(result.tts_audio);
        setTtsPlaying(!!result.tts_audio);
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
        <main className="min-h-screen bg-black pt-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(10,132,255,0.1)", border: "1px solid rgba(10,132,255,0.2)", animation: "glow-pulse 1.5s ease-in-out infinite" }}
            >
              <span className="text-lg">🎙</span>
            </div>
            <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.35)" }}>Loading your interview…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(10,132,255,0.04) 0%, transparent 55%)" }} />

      <main className="relative min-h-screen bg-black pt-20 pb-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left column: Transcript ── */}
          <div className="lg:col-span-1">
            <div
              className="rounded-2xl p-4 h-full"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-4"
                style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.07em" }}
              >
                Conversation
              </p>
              <TranscriptPanel messages={messages} />
            </div>
          </div>

          {/* ── Right column: Active interview ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Progress bar */}
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <DifficultyMeter difficulty={difficulty} turn={currentTurn} maxTurns={MAX_TURNS} />
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

            {/* TTS player */}
            {(ttsAudio || ttsPlaying) && (
              <TTSPlayer
                audio={ttsAudio}
                text={currentQuestion}
                sessionId={sessionId}
                onPlaybackEnd={() => setTtsPlaying(false)}
              />
            )}

            {/* Last grading feedback */}
            {lastGrading && (
              <div
                className="rounded-2xl px-5 py-4 space-y-2.5"
                style={{ background: "rgba(94,92,230,0.05)", border: "1px solid rgba(94,92,230,0.12)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] font-semibold" style={{ color: "rgba(94,92,230,0.9)" }}>
                    Coach feedback
                  </span>
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      background: lastGrading.score >= 4 ? "rgba(48,209,88,0.12)" : lastGrading.score >= 3 ? "rgba(255,159,10,0.12)" : "rgba(255,69,58,0.12)",
                      color: lastGrading.score >= 4 ? "#30D158" : lastGrading.score >= 3 ? "#FF9F0A" : "#FF453A",
                    }}
                  >
                    {lastGrading.score}/5
                  </span>
                  {lastGrading.competency && (
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>{lastGrading.competency}</span>
                  )}
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.6)" }}>{lastGrading.feedback}</p>
                {lastCoachNote && (
                  <p
                    className="text-[13px] leading-relaxed pt-1"
                    style={{ borderTop: "1px solid rgba(94,92,230,0.1)", paddingTop: "10px", color: "rgba(94,92,230,0.8)", fontStyle: "italic" }}
                  >
                    {lastCoachNote}
                  </p>
                )}
              </div>
            )}

            {/* Answer input */}
            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.07em" }}
              >
                Your answer
              </p>
              <AudioRecorder onSubmit={handleAnswer} disabled={submitting || ttsPlaying} />

              {submitting && (
                <p
                  className="text-[12px] mt-3"
                  style={{ color: "rgba(10,132,255,0.7)", animation: "glow-pulse 1.5s ease-in-out infinite" }}
                >
                  Friday is reviewing your answer…
                </p>
              )}
              {error && (
                <p
                  className="text-[12px] mt-3 rounded-xl px-3 py-2"
                  style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}
                >
                  {error}
                </p>
              )}
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
