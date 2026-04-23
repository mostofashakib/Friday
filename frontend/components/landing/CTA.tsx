import Link from "next/link";

export default function CTA() {
  return (
    <section className="py-28 px-6 relative overflow-hidden">
      <div className="relative max-w-3xl mx-auto flex justify-center">
        <div
          className="card-gb w-full"
          style={{ filter: "drop-shadow(0 20px 60px rgba(10,132,255,0.18))" }}
        >
          <div className="card-gb-inner px-10 py-16 text-center relative overflow-hidden">
            {/* Top shimmer accent line */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(10,132,255,0.7), rgba(94,92,230,0.6), rgba(10,132,255,0.7), transparent)",
                backgroundSize: "200% auto",
                animation: "shimmer-gb 4s linear infinite",
              }}
            />

            <p className="text-[13px] font-semibold mb-5 tracking-widest uppercase text-accent" style={{ letterSpacing: "0.08em" }}>
              Start today — it&apos;s free
            </p>

            <h2 className="heading-lg text-gradient-white mb-5">
              Your dream job is one practice session away
            </h2>

            <p className="text-base leading-relaxed mb-10 max-w-xl mx-auto text-muted">
              Stop memorizing answers. Start building real interview instincts with an AI that
              pushes you, coaches you, and adapts to your level every single turn.
            </p>

            <Link href="/signup" className="btn-primary text-[15px] px-10 py-3.5">
              Start your first interview — it&apos;s free
            </Link>

            <p className="mt-5 text-[12px] text-dimmer">
              No credit card · No setup · Instant access
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
