"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { AUTH_ENABLED } from "@/lib/auth-config";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!AUTH_ENABLED) router.replace("/interview/setup");
  }, [router]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    if (!supabase) { setError("Auth not configured."); setLoading(false); return; }
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/interview/setup` } });
    if (error) { setError(error.message); setLoading(false); }
    else { setSuccess(true); }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 cursor-pointer"
        onClick={() => router.back()}
      >
        <div
          className="relative w-full max-w-sm text-center animate-scale-in cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-gb">
            <div className="card-gb-inner px-10 py-14">
              <div
                className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.2)" }}
              >
                <span className="text-2xl" style={{ color: "#30D158" }}>✓</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3" style={{ letterSpacing: "-0.03em" }}>Check your email</h1>
              <p className="text-[14px] leading-relaxed text-muted">
                We sent a confirmation link to{" "}
                <span className="text-white/70">{email}</span>.{" "}
                Click it to activate your account.
              </p>
              <Link href="/login" className="inline-block mt-8 text-[13px] font-medium text-accent">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 cursor-pointer"
      onClick={() => router.back()}
    >
      <div
        className="relative w-full max-w-sm animate-scale-in cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center mb-6">
            <span className="text-white font-bold text-xl" style={{ letterSpacing: "-0.03em" }}>Friday</span>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>Create your account</h1>
          <p className="text-[14px] mt-1.5 text-muted">Start practicing with your AI coach</p>
        </div>

        <div className="card-gb">
          <div className="card-gb-inner px-7 py-8">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium block" style={{ color: "rgba(255,255,255,0.55)" }} htmlFor="email">Email</label>
                <input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required placeholder="you@example.com"
                  className="input-glass px-4 py-2.5 text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium block" style={{ color: "rgba(255,255,255,0.55)" }} htmlFor="password">Password</label>
                <input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={8} placeholder="Min. 8 characters"
                  className="input-glass px-4 py-2.5 text-[14px]"
                />
              </div>
              {error && (
                <p className="text-[13px] rounded-xl px-3 py-2.5" style={{ color: "#FF6B6B", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}>
                  {error}
                </p>
              )}
              <button
                type="submit" disabled={loading}
                className="btn-primary w-full py-2.5 text-[14px] mt-1"
                style={{ borderRadius: "12px" }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[13px] mt-6 text-dimmer">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
