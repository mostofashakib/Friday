import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CTA() {
  return (
    <section className="py-24 px-4 text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-4xl font-bold mb-6">
          Your dream job is one practice session away
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
          Stop memorizing answers. Start building real interview instincts with an AI coach
          that pushes you, guides you, and grows with you.
        </p>
        <Link href="/signup">
          <Button size="lg" className="text-base px-10">
            Start your first interview — it&apos;s free
          </Button>
        </Link>
      </div>
    </section>
  );
}
