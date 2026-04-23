const steps = [
  {
    n: "01",
    title: "Choose your interview",
    body: "Pick behavioral, technical, or a custom role-based session. Set your starting difficulty from entry-level to staff engineer.",
    detail: "8 questions · ~20 min",
  },
  {
    n: "02",
    title: "Speak your answers",
    body: "Friday asks questions and listens in real time. It transcribes, grades, and adapts without you lifting a finger.",
    detail: "Voice + text supported",
  },
  {
    n: "03",
    title: "Get coached every turn",
    body: "After each answer you receive a score, a competency tag, specific gaps, and insight. Friday adjusts difficulty automatically.",
    detail: "Instant feedback loop",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-28 px-6 relative overflow-hidden" id="how-it-works">
      <div className="relative max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-[13px] font-semibold mb-4 tracking-widest uppercase text-accent" style={{ letterSpacing: "0.08em" }}>
            How it works
          </p>
          <h2 className="heading-lg text-gradient-white">
            Three steps. Real results.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Animated shimmer connecting line on desktop */}
          <div
            className="hidden md:block absolute top-10 pointer-events-none"
            style={{
              left: "calc(33.333% + 16px)",
              right: "calc(33.333% + 16px)",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(10,132,255,0.6), rgba(94,92,230,0.5), rgba(10,132,255,0.6), transparent)",
              backgroundSize: "200% auto",
              animation: "shimmer-gb 3s linear infinite",
            }}
          />

          {steps.map((s, i) => (
            <div key={s.n} className="card-gb-subtle" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="card-gb-subtle-inner p-7 flex flex-col">
                <div
                  className="font-black leading-none mb-5 select-none"
                  style={{
                    fontSize: "clamp(3.5rem, 6vw, 5rem)",
                    background: "linear-gradient(135deg, rgba(10,132,255,0.35), rgba(94,92,230,0.22))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.n}
                </div>
                <h3 className="text-[17px] font-semibold mb-2.5 tracking-tight" style={{ color: "rgba(255,255,255,0.92)" }}>
                  {s.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed mb-5 text-muted">
                  {s.body}
                </p>
                <span className="tag-blue mt-auto self-start" style={{ fontSize: "11px" }}>
                  {s.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
