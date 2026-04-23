"use client";

import { Brain, Mic, TrendingUp, Zap, Target, Shield } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Adaptive Difficulty",
    description: "Friday calibrates in real time. Nail an answer and questions get harder. Struggle, and it rebuilds your confidence before moving on.",
    color: "#0A84FF",
  },
  {
    icon: Target,
    title: "RAG Gap Detection",
    description: "Every answer is embedded and stored. The follow-up agent searches your history to surface questions that target recurring weak spots.",
    color: "#5E5CE6",
  },
  {
    icon: Mic,
    title: "Voice-First",
    description: "Speak naturally. Friday transcribes in real time with the Web Speech API and responds in a calm, clear voice via ElevenLabs TTS.",
    color: "#30D158",
  },
  {
    icon: Zap,
    title: "Instant Feedback",
    description: "Every answer gets a score 1–5, identified competency, specific strengths and gaps, and a one-line coaching note.",
    color: "#FFD60A",
  },
  {
    icon: TrendingUp,
    title: "Competency Tracking",
    description: "Rolling averages across problem-solving, communication, and technical depth — tracked per session and surfaced in your report.",
    color: "#FF6B6B",
  },
  {
    icon: Shield,
    title: "4-Agent Loop",
    description: "Interviewer, Grader, Follow-up, and Coach agents run in a shared LangGraph session, each with a distinct role and memory access.",
    color: "#FF9F0A",
  },
];

export default function Features() {
  return (
    <section className="py-28 px-6" id="features">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[13px] font-semibold mb-4 tracking-widest uppercase text-accent" style={{ letterSpacing: "0.08em" }}>
            Why Friday
          </p>
          <h2 className="heading-lg text-gradient-white mb-4">
            Everything you need to ace your interview with confidence
          </h2>
          <p className="text-base leading-relaxed text-muted">
            Friday isn&apos;t a question bank. It&apos;s a simulation built on state-of-the-art multi-agent AI.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="card-gb-subtle card-gb-subtle-lift"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <div className="card-gb-subtle-inner p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: `linear-gradient(135deg, ${f.color}22, ${f.color}10)`,
                    border: `1px solid ${f.color}28`,
                  }}
                >
                  <f.icon size={18} style={{ color: f.color }} />
                </div>
                <h3 className="text-[15px] font-semibold mb-2" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {f.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-muted">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
