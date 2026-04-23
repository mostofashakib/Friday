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

            {/* Answer input */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Your answer
                </p>
                <AudioRecorder onSubmit={handleAnswer} disabled={submitting || ttsPlaying} />

                {submitting && (
                  <p className="text-[12px] mt-3 text-accent" style={{ animation: "glow-pulse 1.5s ease-in-out infinite" }}>
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
        </div>
      </main>
    </>
  );
}
