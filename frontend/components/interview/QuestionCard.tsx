import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface QuestionCardProps {
  question: string;
  turn: number;
  difficulty: number;
  isFollowup?: boolean;
}

const difficultyLabel: Record<number, string> = {
  1: "Entry Level",
  2: "Junior",
  3: "Mid-Level",
  4: "Senior",
  5: "Staff / Principal",
};

const difficultyColor: Record<number, string> = {
  1: "bg-green-500/10 text-green-600 border-green-500/20",
  2: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  3: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  4: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  5: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function QuestionCard({
  question,
  turn,
  difficulty,
  isFollowup,
}: QuestionCardProps) {
  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground font-medium">
            Question {turn}
          </span>
          {isFollowup && (
            <Badge variant="outline" className="text-xs">Follow-up</Badge>
          )}
          <Badge
            variant="outline"
            className={`text-xs ml-auto ${difficultyColor[difficulty] ?? ""}`}
          >
            {difficultyLabel[difficulty] ?? "Mid-Level"}
          </Badge>
        </div>
        <p className="text-lg font-medium leading-relaxed">{question}</p>
      </CardContent>
    </Card>
  );
}
