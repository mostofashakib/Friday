"use client";

type OrbState = "idle" | "ai-speaking" | "user-speaking" | "countdown";

interface VoiceOrbProps {
  state: OrbState;
  onInterrupt?: () => void;
}

const ORB_CONFIG: Record<OrbState, {
  coreGradient: string;
  coreGlow: string;
  bloomColor: string;
  outerBloomColor: string;
  animation: string;
  outerAnimation: string;
  label: string;
  subLabel: string;
  labelColor: string;
}> = {
  idle: {
    coreGradient: "radial-gradient(circle at 38% 35%, rgba(120,120,140,0.6) 0%, rgba(80,80,100,0.5) 100%)",
    coreGlow: "0 0 12px rgba(255,255,255,0.06)",
    bloomColor: "rgba(255,255,255,0.04)",
    outerBloomColor: "transparent",
    animation: "orb-idle-float 4s ease-in-out infinite",
    outerAnimation: "orb-idle-float 4s ease-in-out 0.1s infinite",
    label: "Waiting…",
    subLabel: "Friday will speak first",
    labelColor: "rgba(255,255,255,0.3)",
  },
  "ai-speaking": {
    coreGradient: "radial-gradient(circle at 38% 35%, rgba(80,160,255,0.95) 0%, rgba(10,132,255,0.85) 40%, rgba(0,80,200,0.75) 100%)",
    coreGlow: "0 0 24px rgba(10,132,255,0.5), 0 0 48px rgba(10,132,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2)",
    bloomColor: "rgba(10,132,255,0.15)",
    outerBloomColor: "rgba(10,132,255,0.06)",
    animation: "orb-breathe 2.4s ease-in-out infinite",
    outerAnimation: "orb-breathe 2.4s ease-in-out 0.1s infinite",
    label: "Friday is speaking",
    subLabel: "Tap to interrupt",
    labelColor: "rgba(10,132,255,0.9)",
  },
  "user-speaking": {
    coreGradient: "radial-gradient(circle at 38% 35%, rgba(200,180,255,0.9) 0%, rgba(140,100,255,0.8) 40%, rgba(80,40,200,0.7) 100%)",
    coreGlow: "0 0 24px rgba(140,100,255,0.5), 0 0 48px rgba(140,100,255,0.18), inset 0 1px 0 rgba(255,255,255,0.2)",
    bloomColor: "rgba(140,100,255,0.15)",
    outerBloomColor: "rgba(140,100,255,0.06)",
    animation: "orb-breathe-fast 0.85s ease-in-out infinite",
    outerAnimation: "orb-breathe-fast 0.85s ease-in-out 0.1s infinite",
    label: "Listening…",
    subLabel: "Speak your answer",
    labelColor: "rgba(180,140,255,0.9)",
  },
  countdown: {
    coreGradient: "radial-gradient(circle at 38% 35%, rgba(255,210,100,0.9) 0%, rgba(255,159,10,0.8) 40%, rgba(200,100,0,0.7) 100%)",
    coreGlow: "0 0 24px rgba(255,159,10,0.5), 0 0 48px rgba(255,159,10,0.18), inset 0 1px 0 rgba(255,255,255,0.2)",
    bloomColor: "rgba(255,159,10,0.15)",
    outerBloomColor: "rgba(255,159,10,0.06)",
    animation: "orb-breathe 2.4s ease-in-out infinite",
    outerAnimation: "orb-breathe 2.4s ease-in-out 0.1s infinite",
    label: "Almost done…",
    subLabel: "Keep talking to continue",
    labelColor: "rgba(255,159,10,0.9)",
  },
};

export default function VoiceOrb({ state, onInterrupt }: VoiceOrbProps) {
  const cfg = ORB_CONFIG[state];
  const isInterruptable = state === "ai-speaking";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Orb */}
      <button
        type="button"
        onClick={isInterruptable ? onInterrupt : undefined}
        disabled={!isInterruptable}
        className="relative flex items-center justify-center focus:outline-none"
        style={{
          width: "clamp(120px, 28vw, 180px)",
          height: "clamp(120px, 28vw, 180px)",
          cursor: isInterruptable ? "pointer" : "default",
        }}
        aria-label={isInterruptable ? "Tap to interrupt Friday" : undefined}
      >
        {/* Outer bloom */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(133px, 31vw, 200px)",
            height: "clamp(133px, 31vw, 200px)",
            background: `radial-gradient(circle, ${cfg.outerBloomColor} 0%, transparent 70%)`,
            animation: cfg.outerAnimation,
          }}
        />
        {/* Inner bloom */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(107px, 25vw, 160px)",
            height: "clamp(107px, 25vw, 160px)",
            background: `radial-gradient(circle, ${cfg.bloomColor} 0%, transparent 70%)`,
            animation: cfg.animation,
          }}
        />
        {/* Core orb */}
        <div
          className="relative rounded-full z-10"
          style={{
            width: "clamp(93px, 22vw, 140px)",
            height: "clamp(93px, 22vw, 140px)",
            background: cfg.coreGradient,
            boxShadow: cfg.coreGlow,
            animation: cfg.animation,
          }}
        />
      </button>

      {/* Labels */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[13px] font-semibold" style={{ color: cfg.labelColor }}>
          {cfg.label}
        </span>
        <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {cfg.subLabel}
        </span>
      </div>
    </div>
  );
}
