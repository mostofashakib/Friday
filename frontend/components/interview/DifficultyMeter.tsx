import { Progress } from "@/components/ui/progress";

interface DifficultyMeterProps {
  difficulty: number;
  turn: number;
  maxTurns: number;
}

export default function DifficultyMeter({ difficulty, turn, maxTurns }: DifficultyMeterProps) {
  const progress = Math.round((turn / maxTurns) * 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span>{turn}/{maxTurns} questions</span>
      </div>
      <Progress value={progress} className="h-1.5" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Difficulty</span>
        <span className="font-medium">{["", "Entry", "Junior", "Mid-Level", "Senior", "Staff"][difficulty]}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((d) => (
          <div
            key={d}
            className={`flex-1 h-1 rounded-full transition-colors ${
              d <= difficulty ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
