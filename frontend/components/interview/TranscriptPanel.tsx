import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Message } from "@/types";

interface TranscriptPanelProps {
  messages: Message[];
}

const scoreColor = (score: number) => {
  if (score >= 4) return "bg-green-500/10 text-green-600 border-green-500/20";
  if (score >= 3) return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
  return "bg-red-500/10 text-red-600 border-red-500/20";
};

export default function TranscriptPanel({ messages }: TranscriptPanelProps) {
  if (messages.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Your conversation will appear here.
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-2">
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`rounded-lg p-3 text-sm ${
            msg.role === "interviewer"
              ? "bg-muted"
              : msg.role === "coach"
              ? "bg-primary/5 border border-primary/10"
              : "bg-background border border-border"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {msg.role === "interviewer" ? "Friday" : msg.role === "coach" ? "Coach" : "You"}
              </span>
              {msg.score != null && (
                <Badge variant="outline" className={`text-xs ${scoreColor(msg.score)}`}>
                  {msg.score}/5
                </Badge>
              )}
              {msg.competency && (
                <span className="text-xs text-muted-foreground">{msg.competency}</span>
              )}
              {msg.is_followup && (
                <Badge variant="secondary" className="text-xs">Follow-up</Badge>
              )}
            </div>
            <p className="leading-relaxed">{msg.content}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
