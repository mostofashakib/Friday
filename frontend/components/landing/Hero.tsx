import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 text-center">
      <div className="max-w-4xl mx-auto">
        <Badge variant="secondary" className="mb-6 text-xs tracking-wide uppercase">
          AI-Powered Interview Practice
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          Ace Your Next Interview with an AI Coach{" "}
          <span className="text-primary">That Never Sleeps</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Friday is your personal AI interview coach. It asks adaptive questions, detects your
          knowledge gaps in real time, and gives you honest coaching — all through a natural
          voice-first conversation.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="text-base px-8">
              Start practicing free
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button size="lg" variant="outline" className="text-base px-8">
              See how it works
            </Button>
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          No credit card required · Behavioral, technical &amp; role-based interviews
        </p>
      </div>
    </section>
  );
}
