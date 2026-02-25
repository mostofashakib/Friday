import { Card, CardContent } from "@/components/ui/card";
import { Brain, Mic, TrendingUp, Zap, Target, Shield } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Adaptive Difficulty",
    description:
      "Friday calibrates question difficulty in real time based on your performance. Nail an answer? Questions get harder. Struggle? It adjusts to build your confidence.",
  },
  {
    icon: Target,
    title: "Gap Detection via RAG",
    description:
      "Our retrieval-augmented pipeline analyzes your prior responses to detect recurring knowledge gaps and surfaces targeted follow-up questions to close them.",
  },
  {
    icon: Mic,
    title: "Voice-First Interaction",
    description:
      "Speak your answers naturally. Friday listens, transcribes in real time, and responds with a human-like voice — just like a real interview.",
  },
  {
    icon: Zap,
    title: "Instant Coaching",
    description:
      "After every answer, you get a score (1–5), specific strengths and gaps, and a one-line coaching insight you can act on immediately.",
  },
  {
    icon: TrendingUp,
    title: "Competency Tracking",
    description:
      "Friday tracks your performance across competencies — problem-solving, communication, technical depth — and shows your progress over time.",
  },
  {
    icon: Shield,
    title: "Multi-Agent Intelligence",
    description:
      "Four specialized AI agents — Interviewer, Grader, Follow-up, and Coach — collaborate through a shared session memory to run a coherent, calibrated interview.",
  },
];

export default function Features() {
  return (
    <section className="py-20 px-4" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything you need to interview with confidence
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Friday isn&apos;t a question bank. It&apos;s a dynamic interview simulation built
            on state-of-the-art multi-agent AI.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <feature.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
