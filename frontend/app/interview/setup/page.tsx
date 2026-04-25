"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { createSession, startSession } from "@/lib/api";
import type { InterviewType } from "@/types";

const TYPES: { value: InterviewType; label: string; desc: string; icon: string }[] = [
  { value: "behavioral", label: "Behavioral", desc: "STAR-format questions on leadership, impact, and conflict.", icon: "💬" },
  // { value: "technical", label: "Technical",  desc: "Algorithms, system design, and engineering depth.", icon: "⚡" },
  // { value: "general",   label: "Role-Based", desc: "Custom questions tailored to your target role.", icon: "🎯" },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<InterviewType>("behavioral");
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [githubUsername, setGithubUsername] = useState("");
  const [scholarName, setScholarName] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setLoading(true);
    setError("");
    try {
      const { session_id } = await createSession(
        type,
        role || null,
        difficulty,
        githubUsername || undefined,
        resumeFile || undefined,
        jobUrl || undefined,
        scholarName || undefined,
      );
      if (type === "technical") {
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
      <main className="min-h-screen pt-20 sm:pt-24 pb-16 px-4 sm:px-6">
        <div className="relative max-w-xl mx-auto">
          <div className="mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2" style={{ letterSpacing: "-0.035em" }}>
              Set up your interview
            </h1>
            <p className="text-[15px] text-muted">Choose a format and let Friday calibrate to your level.</p>
          </div>

          <div className="space-y-4">
            {/* Interview type */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner p-5 space-y-3">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Interview type
                </p>
                <div className="space-y-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-4 transition-all duration-200"
                      style={{
                        background: type === t.value ? "rgba(10,132,255,0.1)" : "rgba(255,255,255,0.02)",
                        border: type === t.value ? "1px solid rgba(10,132,255,0.35)" : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: type === t.value ? "0 0 0 1px rgba(10,132,255,0.1) inset" : "none",
                      }}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: type === t.value ? "#fff" : "rgba(255,255,255,0.75)" }}>
                          {t.label}
                        </p>
                        <p className="text-[12px] mt-0.5 text-muted">{t.desc}</p>
                      </div>
                      {type === t.value && (
                        <div
                          className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "#0A84FF", boxShadow: "0 2px 8px rgba(10,132,255,0.4)" }}
                        >
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target role */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wider mb-3 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Target role{" "}
                  <span className="normal-case font-normal" style={{ letterSpacing: 0, color: "rgba(255,255,255,0.2)" }}>optional</span>
                </p>
                <input
                  type="text" value={role} onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer at a fintech startup"
                  className="input-glass px-4 py-2.5 text-[14px]"
                />
              </div>
            </div>

            {/* Difficulty */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wider mb-3 text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Starting difficulty
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setDifficulty(v)}
                      className={`px-4 py-2 text-[12px] sm:text-[13px] font-medium transition-all duration-200 ${difficulty === v ? "btn-primary" : "btn-ghost"}`}
                      style={{ borderRadius: "12px" }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] mt-3 text-dimmer">Friday auto-calibrates difficulty as you progress.</p>
              </div>
            </div>

            {/* Personalization */}
            <div className="card-gb-subtle">
              <div className="card-gb-subtle-inner p-5 space-y-4">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-dimmer" style={{ letterSpacing: "0.07em" }}>
                  Personalize your interview{" "}
                  <span className="normal-case font-normal" style={{ letterSpacing: 0, color: "rgba(255,255,255,0.2)" }}>optional</span>
                </p>
                <p className="text-[12px] text-dimmer -mt-2">
                  Share your GitHub or resume so Friday can tailor questions to your background.
                </p>

                {/* GitHub username */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    GitHub username
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium"
                      style={{ color: "rgba(255,255,255,0.25)" }}
                    >
                      github.com/
                    </span>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value.replace(/^@/, ""))}
                      placeholder="yourusername"
                      className="input-glass pl-26 pr-4 py-2.5 text-[14px]"
                    />
                  </div>
                </div>

                {/* Google Scholar name */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Google Scholar name
                  </label>
                  <input
                    type="text"
                    value={scholarName}
                    onChange={(e) => setScholarName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="input-glass px-4 py-2.5 text-[14px]"
                  />
                  <p className="text-[11px] mt-1.5 text-dimmer">
                    Enter your name as it appears on Google Scholar to pull your publications.
                  </p>
                </div>

                {/* Job posting URL */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Job posting URL
                  </label>
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                    placeholder="https://jobs.company.com/role/..."
                    className="input-glass px-4 py-2.5 text-[14px]"
                  />
                  <p className="text-[11px] mt-1.5 text-dimmer">
                    Friday will pull the job description to tailor questions to what this company is looking for.
                  </p>
                </div>

                {/* Resume upload */}
                <div>
                  <label className="text-[12px] font-medium block mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Resume
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) setResumeFile(file);
                    }}
                    className="w-full rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-all duration-200 cursor-pointer select-none"
                    style={{
                      background: isDragOver
                        ? "rgba(10,132,255,0.12)"
                        : resumeFile
                        ? "rgba(10,132,255,0.07)"
                        : "rgba(255,255,255,0.02)",
                      border: isDragOver
                        ? "1px dashed rgba(10,132,255,0.6)"
                        : resumeFile
                        ? "1px solid rgba(10,132,255,0.25)"
                        : "1px dashed rgba(255,255,255,0.1)",
                    }}
                  >
                    <span className="text-base">{resumeFile ? "📄" : "⬆️"}</span>
                    <div className="min-w-0 flex-1">
                      {resumeFile ? (
                        <>
                          <p className="text-[13px] font-medium truncate" style={{ color: "rgba(255,255,255,0.8)" }}>
                            {resumeFile.name}
                          </p>
                          <p className="text-[11px] text-dimmer">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[13px] text-dimmer">
                            {isDragOver ? "Drop to upload" : "Click or drag to upload"}
                          </p>
                          <p className="text-[11px] text-dimmer opacity-60">PDF or text file</p>
                        </>
                      )}
                    </div>
                    {resumeFile && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setResumeFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="ml-auto text-[11px] px-2 py-0.5 rounded-md transition-colors shrink-0"
                        style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-[13px] rounded-xl px-4 py-3" style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleStart}
              disabled={loading}
              className="btn-primary w-full py-3.5 text-[15px]"
              style={{ borderRadius: "16px" }}
            >
              {loading
                ? (githubUsername || scholarName || resumeFile || jobUrl ? "Personalizing your interview…" : "Starting…")
                : "Start interview →"}
            </button>

            {(githubUsername || scholarName || resumeFile || jobUrl) && !loading && (
              <p className="text-center text-[12px] text-dimmer">
                Friday will analyze your{" "}
                {[githubUsername && "GitHub profile", scholarName && "research papers", resumeFile && "resume", jobUrl && "job posting"].filter(Boolean).join(", ")}{" "}
                to personalize your questions.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
