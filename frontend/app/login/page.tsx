"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { AUTH_ENABLED } from "@/lib/auth-config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/interview/setup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!AUTH_ENABLED) router.replace("/interview/setup");
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    if (!supabase) { setError("Auth not configured."); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); }
    else { router.push(next); }
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
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ letterSpacing: "-0.03em" }}>Welcome back</h1>
          <p className="text-[14px] mt-1.5 text-muted">Sign in to continue your practice</p>
        </div>

        <div className="card-gb">
          <div className="card-gb-inner px-7 py-8">
            <form onSubmit={handleLogin} className="space-y-4">
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
                  required placeholder="••••••••"
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
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[13px] mt-6 text-dimmer">
          No account?{" "}
          <Link href="/signup" className="font-medium text-accent">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
