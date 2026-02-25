"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createSession, startSession } from "@/lib/api";
import type { InterviewType } from "@/types";

const INTERVIEW_TYPES: { value: InterviewType; label: string; description: string }[] = [
  {
    value: "behavioral",
    label: "Behavioral",
    description: "STAR-format questions about past experience and soft skills.",
  },
  {
    value: "technical",
    label: "Technical",
    description: "Algorithms, system design, and engineering fundamentals.",
  },
  {
    value: "general",
    label: "Role-Based",
    description: "Custom questions tailored to a specific role or job description.",
  },
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const [type, setType] = useState<InterviewType>("behavioral");
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setLoading(true);
    setError("");
    try {
      const { session_id } = await createSession(type, role || null, difficulty);
      await startSession(session_id);
      router.push(`/interview/${session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start interview");
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Set up your interview</h1>
            <p className="text-muted-foreground">Choose the type, role, and difficulty to get started.</p>
          </div>

          <div className="space-y-6">
            {/* Interview type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interview type</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3">
                {INTERVIEW_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`text-left rounded-lg border p-4 transition-colors ${
                      type === t.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{t.description}</div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Role */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Target role</CardTitle>
                <CardDescription>Optional — helps Friday tailor questions to your goal.</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer at a fintech startup"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </CardContent>
            </Card>

            {/* Difficulty */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Starting difficulty</CardTitle>
                <CardDescription>Friday will auto-calibrate as you progress.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {[
                    { v: 1, l: "Entry" },
                    { v: 2, l: "Junior" },
                    { v: 3, l: "Mid" },
                    { v: 4, l: "Senior" },
                    { v: 5, l: "Staff" },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setDifficulty(v)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                        difficulty === v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleStart} size="lg" className="w-full" disabled={loading}>
              {loading ? "Starting interview..." : "Start interview"}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
