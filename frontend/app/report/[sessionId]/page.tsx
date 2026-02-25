"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import TranscriptPanel from "@/components/interview/TranscriptPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getReport } from "@/lib/api";
import type { ReportResponse } from "@/types";

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReport(sessionId)
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <p className="text-muted-foreground">Generating your report...</p>
        </main>
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-background pt-24 flex items-center justify-center">
          <p className="text-destructive">{error || "Report not found."}</p>
        </main>
      </>
    );
  }

  const overallPct = Math.round((report.overall_score / 5) * 100);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Interview Report</h1>
            <p className="text-muted-foreground text-sm">
              {report.session.interview_type.charAt(0).toUpperCase() + report.session.interview_type.slice(1)} interview
              {report.session.role ? ` · ${report.session.role}` : ""} ·{" "}
              {report.total_turns} questions answered
            </p>
          </div>

          {/* Overall score */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overall Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold">{report.overall_score.toFixed(1)}</span>
                <span className="text-xl text-muted-foreground mb-1">/5</span>
                <Badge
                  variant="outline"
                  className={`ml-auto ${
                    report.overall_score >= 4
                      ? "border-green-500/30 text-green-600"
                      : report.overall_score >= 3
                      ? "border-yellow-500/30 text-yellow-600"
                      : "border-red-500/30 text-red-600"
                  }`}
                >
                  {report.overall_score >= 4
                    ? "Strong"
                    : report.overall_score >= 3
                    ? "Solid"
                    : "Needs work"}
                </Badge>
              </div>
              <Progress value={overallPct} className="h-2" />
            </CardContent>
          </Card>

          {/* Competency breakdown */}
          {report.competency_scores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Competency Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.competency_scores
                  .sort((a, b) => b.score - a.score)
                  .map((c) => (
                    <div key={c.competency} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{c.competency}</span>
                        <span className="text-muted-foreground">
                          {Number(c.score).toFixed(1)}/5 · {c.attempts} answer{c.attempts !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <Progress value={Math.round((c.score / 5) * 100)} className="h-1.5" />
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Coaching notes */}
          {report.coaching_notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Coaching Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.coaching_notes.map((note, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-primary font-bold shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="leading-relaxed">{note}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Full transcript */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Full Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptPanel messages={report.messages} />
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-2">
            <Link href="/interview/setup">
              <Button>Practice again</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Back to home</Button>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
