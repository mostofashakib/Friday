"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import QuestionCard from "@/components/interview/QuestionCard";
import AudioRecorder from "@/components/interview/AudioRecorder";
import TTSPlayer from "@/components/interview/TTSPlayer";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import DifficultyMeter from "@/components/interview/DifficultyMeter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

  // Load initial session state (first question was set by /start in setup page)
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

      // Add user message to local transcript
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

      // Add next question to transcript
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
        <main className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Loading your interview...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-20 pb-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Transcript */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conversation</CardTitle>
              </CardHeader>
              <CardContent>
                <TranscriptPanel messages={messages} />
              </CardContent>
            </Card>
          </div>

          {/* Right: Active interview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Progress */}
            <Card>
              <CardContent className="pt-4 pb-4">
                <DifficultyMeter
                  difficulty={difficulty}
                  turn={currentTurn}
                  maxTurns={MAX_TURNS}
                />
              </CardContent>
            </Card>

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
            <TTSPlayer
              audio={ttsAudio}
              text={currentQuestion}
              sessionId={sessionId}
              onPlaybackEnd={() => setTtsPlaying(false)}
            />

            {/* Last grading feedback */}
            {lastGrading && (
              <Card className="border-muted">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last answer</span>
                    <Badge variant="outline" className="text-xs">
                      {lastGrading.score}/5
                    </Badge>
                    {lastGrading.competency && (
                      <span className="text-xs text-muted-foreground">{lastGrading.competency}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{lastGrading.feedback}</p>
                  {lastCoachNote && (
                    <>
                      <Separator />
                      <p className="text-sm text-primary/80 italic">{lastCoachNote}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Answer input */}
            <Card>
              <CardContent className="pt-4">
                <AudioRecorder
                  onSubmit={handleAnswer}
                  disabled={submitting || ttsPlaying}
                />
                {submitting && (
                  <p className="text-xs text-muted-foreground mt-2 animate-pulse">
                    Friday is reviewing your answer...
                  </p>
                )}
                {error && <p className="text-xs text-destructive mt-2">{error}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
