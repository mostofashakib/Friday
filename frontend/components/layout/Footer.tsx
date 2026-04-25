// Developed by Mostofa Shakib (www.mostofashakib.com)
export default function Footer() {
  return (
    <footer className="mt-20 py-10 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <span style={{ fontFamily: "var(--font-brand)", fontSize: "15px", fontWeight: 800, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.4)" }}>
          Friday
        </span>

        <p className="text-[13px] text-dimmer">
          © {new Date().getFullYear()} Friday
        </p>

        <div className="text-[13px] text-dimmer flex items-center gap-1.5 flex-wrap justify-center">
          <span>Developed by</span>
          <a
            href="https://www.vriantlabs.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-white transition-colors duration-200"
          >
            Variant Labs
          </a>
          <span>·</span>
          <a
            href="mailto:hello@vriantlabs.com"
            className="text-white/50 hover:text-white transition-colors duration-200"
          >
            hello@vriantlabs.com
          </a>
        </div>
      </div>
    </footer>
  );
}
