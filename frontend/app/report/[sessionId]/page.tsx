"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import { getReport } from "@/lib/api";
import type { ReportResponse } from "@/types";

const scoreColor = (s: number) =>
  s >= 4 ? "#30D158" : s >= 3 ? "#FF9F0A" : "#FF453A";
const scoreBg = (s: number) =>
  s >= 4 ? "rgba(48,209,88,0.1)" : s >= 3 ? "rgba(255,159,10,0.1)" : "rgba(255,69,58,0.1)";
const scoreBorder = (s: number) =>
  s >= 4 ? "rgba(48,209,88,0.2)" : s >= 3 ? "rgba(255,159,10,0.2)" : "rgba(255,69,58,0.2)";
const scoreLabel = (s: number) =>
  s >= 4 ? "Strong" : s >= 3 ? "Solid" : "Needs work";
const scoreGradient = (s: number) =>
  s >= 4
    ? "linear-gradient(90deg, #0A84FF, #30D158)"
    : s >= 3
    ? "linear-gradient(90deg, #0A84FF, #FF9F0A)"
    : "linear-gradient(90deg, #5E5CE6, #FF453A)";

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReport(sessionId)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

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
              <span className="text-lg">📊</span>
            </div>
            <p className="text-[14px] text-muted">Generating your report…</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <p className="text-[14px]" style={{ color: "#FF453A" }}>{error || "Report not found."}</p>
        </main>
      </>
    );
  }

  const overall = report.overall_score;
  const overallPct = Math.min(Math.round((overall / 5) * 100), 100);
  const typeLabel = report.session.interview_type.charAt(0).toUpperCase() + report.session.interview_type.slice(1);

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen pt-20 pb-16 px-4">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Header */}
          <div className="pt-6 pb-2">
            <div className="tag-blue mb-4" style={{ fontSize: "11px", letterSpacing: "0.06em" }}>
              Interview complete
            </div>
            <h1 className="text-[28px] font-bold text-white mb-1" style={{ letterSpacing: "-0.035em" }}>
              Your Results
            </h1>
            <p className="text-[14px] text-muted">
              {typeLabel} interview
              {report.session.role ? ` · ${report.session.role}` : ""}
              {" · "}{report.total_turns} question{report.total_turns !== 1 ? "s" : ""} answered
            </p>
          </div>

          {/* Overall score card */}
          <div className="card-gb" style={{ filter: `drop-shadow(0 8px 40px ${scoreColor(overall)}22)` }}>
            <div className="card-gb-inner p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-5 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                Overall performance
              </p>
              <div className="flex items-end gap-3 mb-5">
                <span
                  className="font-bold leading-none"
                  style={{
                    fontSize: "5.5rem",
                    color: scoreColor(overall),
                    letterSpacing: "-0.05em",
                    textShadow: `0 0 40px ${scoreColor(overall)}55`,
                  }}
                >
                  {overall.toFixed(1)}
                </span>
                <span className="text-[20px] mb-2" style={{ color: "rgba(255,255,255,0.22)" }}>/5</span>
                <div
                  className="ml-auto px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{ background: scoreBg(overall), color: scoreColor(overall), border: `1px solid ${scoreBorder(overall)}` }}
                >
                  {scoreLabel(overall)}
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${overallPct}%`, background: scoreGradient(overall) }}
                />
              </div>
            </div>
          </div>

          {/* Competency breakdown */}
          {report.competency_scores.length > 0 && (
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-5 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Competency breakdown
                </p>
                <div className="space-y-4">
                  {report.competency_scores
                    .sort((a, b) => b.score - a.score)
                    .map((c) => {
                      const pct = Math.min(Math.round((c.score / 5) * 100), 100);
                      const col = scoreColor(c.score);
                      return (
                        <div key={c.competency} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium capitalize" style={{ color: "rgba(255,255,255,0.8)" }}>
                              {c.competency}
                            </span>
                            <span className="text-[12px] text-dimmer">
                              {Number(c.score).toFixed(1)}/5
                              <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.18)" }}>
                                · {c.attempts} answer{c.attempts !== 1 ? "s" : ""}
                              </span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: col, boxShadow: `0 0 8px ${col}55` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Coaching insights */}
          {report.coaching_notes.length > 0 && (
            <div className="card-gb-purple">
              <div className="card-gb-purple-inner p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-5" style={{ color: "rgba(94,92,230,0.7)", letterSpacing: "0.07em" }}>
                  Coaching insights
                </p>
                <ul className="space-y-4">
                  {report.coaching_notes.map((note, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="text-[13px] font-bold shrink-0 w-6 text-right" style={{ color: "rgba(94,92,230,0.5)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.65)" }}>{note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Full transcript */}
          <div className="card-gb-subtle">
            <div className="card-gb-subtle-inner p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-4 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                Full transcript
              </p>
              <TranscriptPanel messages={report.messages} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Link href="/interview/setup" className="btn-primary flex-1 py-3 text-[14px] text-center">
              Practice again
            </Link>
            <Link href="/" className="btn-ghost flex-1 py-3 text-[14px] text-center">
              Back to home
            </Link>
          </div>

        </div>
      </main>
    </>
  );
}
