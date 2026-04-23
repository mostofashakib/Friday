import Link from "next/link";
import { AUTH_ENABLED } from "@/lib/auth-config";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-24 pb-20 overflow-hidden">
      <div className="relative max-w-4xl mx-auto text-center space-y-8 w-full">

        {/* Headline */}
        <div className="animate-fade-in space-y-3">
          <h1
            className="heading-xl animate-fade-up"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Ace your next interview
          </h1>
        </div>

        {/* Subtext */}
        <p className="animate-fade-up delay-150 text-[clamp(1rem,2vw,1.2rem)] leading-relaxed max-w-2xl mx-auto text-muted">
          Friday listens to your answers, detects knowledge gaps in real time, and adapts
          the difficulty like having a senior engineer run your interview loop.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={AUTH_ENABLED ? "/signup" : "/interview/setup"} className="btn-primary w-full sm:w-auto text-[15px] px-8 py-3">
            Start practicing free
          </Link>
          <Link href="#how-it-works" className="btn-ghost w-full sm:w-auto text-[15px] px-8 py-3">
            See how it works
          </Link>
        </div>

        {/* Social proof */}
        <p className="animate-fade-up delay-500 text-[13px] text-dimmer">
          No credit card required &nbsp;·&nbsp; Behavioral, technical &amp; role-based
        </p>

        {/* Hero centerpiece — Mini Report Dashboard */}
        <div className="animate-fade-up delay-500 flex justify-center">
          <div
            className="card-gb animate-float w-full max-w-85"
            style={{
              filter: "drop-shadow(0 24px 60px rgba(10,132,255,0.2))",
            }}
          >
            <div className="card-gb-inner" style={{ padding: "20px" }}>
              {/* Header row */}
              <div
                className="flex items-center gap-2 mb-4 pb-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.8)", letterSpacing: "-0.02em" }}>
                  Friday
                </span>
                <span
                  className="ml-auto text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ background: "rgba(48,209,88,0.12)", color: "#30D158", border: "1px solid rgba(48,209,88,0.2)" }}
                >
                  Interview complete
                </span>
              </div>

              {/* Overall score */}
              <div className="flex items-baseline gap-2 mb-4">
                <span
                  className="font-bold leading-none"
                  style={{ fontSize: "52px", color: "#30D158", letterSpacing: "-0.04em", textShadow: "0 0 40px rgba(48,209,88,0.3)" }}
                >
                  4.2
                </span>
                <span className="text-[18px]" style={{ color: "rgba(255,255,255,0.22)" }}>/5</span>
                <span
                  className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(48,209,88,0.1)", color: "#30D158", border: "1px solid rgba(48,209,88,0.18)" }}
                >
                  Strong
                </span>
              </div>

              {/* Competency bars */}
              <div className="space-y-2.5 mb-4">
                {[
                  { label: "Communication", pct: 88, color: "#30D158" },
                  { label: "Problem-solving", pct: 72, color: "#0A84FF" },
                  { label: "Technical depth", pct: 58, color: "#5E5CE6" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{bar.label}</span>
                      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{bar.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, background: bar.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Coaching note */}
              <div
                className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
                style={{
                  background: "rgba(94,92,230,0.08)",
                  border: "1px solid rgba(94,92,230,0.15)",
                  color: "rgba(94,92,230,0.85)",
                  fontStyle: "italic",
                }}
              >
                Strong framing throughout. Push for more specificity when pressed on technical decisions.
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
