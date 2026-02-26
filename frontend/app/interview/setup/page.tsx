"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { createSession, startSession } from "@/lib/api";
import type { InterviewType } from "@/types";

const TYPES: { value: InterviewType; label: string; desc: string; icon: string }[] = [
  { value: "behavioral", label: "Behavioral",  desc: "STAR-format questions on leadership, impact, and conflict.", icon: "💬" },
  { value: "technical",  label: "Technical",   desc: "Algorithms, system design, and engineering depth.", icon: "⚡" },
  { value: "general",    label: "Role-Based",  desc: "Custom questions tailored to your target role.", icon: "🎯" },
];

const DIFFICULTIES = [
  { v: 1, l: "Entry" },
  { v: 2, l: "Junior" },
  { v: 3, l: "Mid" },
  { v: 4, l: "Senior" },
  { v: 5, l: "Staff" },
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
      if (type === "technical") {
        // Technical interviews use the coding environment — skip the LangGraph agent
        router.push(`/interview/technical/${session_id}`);
      } else {
        await startSession(session_id);
        router.push(`/interview/${session_id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start interview");
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-black pt-24 pb-16 px-6">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 50% 40% at 50% 0%, rgba(10,132,255,0.06) 0%, transparent 60%)" }}
        />
        <div className="relative max-w-xl mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Set up your interview</h1>
            <p className="text-[15px]" style={{ color: "rgba(245,245,247,0.45)" }}>Choose a format and let Friday calibrate to your level.</p>
          </div>

          <div className="space-y-5">
            {/* Type */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>Interview type</p>
              <div className="space-y-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all duration-200"
                    style={{
                      background: type === t.value ? "rgba(10,132,255,0.1)" : "rgba(255,255,255,0.02)",
                      border: type === t.value ? "1px solid rgba(10,132,255,0.3)" : "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: type === t.value ? "#fff" : "rgba(255,255,255,0.75)" }}>{t.label}</p>
                      <p className="text-[12px] mt-0.5" style={{ color: "rgba(245,245,247,0.4)" }}>{t.desc}</p>
                    </div>
                    {type === t.value && (
                      <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#0A84FF" }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Role */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>Target role <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span></p>
              <input
                type="text" value={role} onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Software Engineer at a fintech startup"
                className="input-apple w-full rounded-xl px-4 py-2.5 text-[14px]"
              />
            </div>

            {/* Difficulty */}
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-[13px] font-semibold uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.07em" }}>Starting difficulty</p>
              <div className="flex gap-2">
                {DIFFICULTIES.map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setDifficulty(v)}
                    className="flex-1 py-2 rounded-xl text-[13px] font-medium transition-all duration-200"
                    style={{
                      background: difficulty === v ? "#0A84FF" : "rgba(255,255,255,0.04)",
                      border: difficulty === v ? "1px solid transparent" : "1px solid rgba(255,255,255,0.07)",
                      color: difficulty === v ? "#fff" : "rgba(255,255,255,0.5)",
                      boxShadow: difficulty === v ? "0 2px 12px rgba(10,132,255,0.25)" : "none",
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-[12px] mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>Friday auto-calibrates difficulty as you progress.</p>
            </div>

            {error && <p className="text-[13px] rounded-xl px-4 py-3" style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}>{error}</p>}

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-[15px] font-semibold text-white transition-all duration-200 disabled:opacity-50 active:scale-[0.99]"
              style={{ background: "#0A84FF", boxShadow: "0 0 0 1px rgba(10,132,255,0.3), 0 4px 24px rgba(10,132,255,0.3)" }}
            >
              {loading ? "Starting…" : "Start interview →"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
