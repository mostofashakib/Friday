// Developed by Mostofa Shakib (www.mostofashakib.com)
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { AUTH_ENABLED } from "@/lib/auth-config";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => setUser(data.user));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,16,0.8)" : "transparent",
        backdropFilter: scrolled ? "blur(32px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(32px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(10,132,255,0.12)" : "1px solid transparent",
        boxShadow: scrolled ? "0 1px 0 rgba(94,92,230,0.08)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: "60px" }}>
        <Link href="/" className="flex items-center group">
          <span
            className="text-white/90 group-hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-brand)", fontSize: "18px", fontWeight: 800, letterSpacing: "-0.03em" }}
          >
            Friday
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/interview/setup" className="btn-primary text-[13px] px-5 py-1.5">
                Start interview
              </Link>
              <button
                onClick={handleSignOut}
                className="text-[13px] font-medium px-3 py-1.5 rounded-full text-white/40 hover:text-white/70 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : AUTH_ENABLED ? (
            <>
              <Link href="/login" className="text-[13px] font-medium px-3 py-1.5 rounded-full text-white/50 hover:text-white/80 transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary text-[13px] px-5 py-1.5">
                Get started
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
