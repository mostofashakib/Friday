import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://interviewwithfriday.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Friday — AI Mock Interview Coach | Behavioral Interview Practice",
    template: "%s | Friday",
  },
  description:
    "Friday is an AI-powered mock interview coach with a five-agent pipeline that adapts to your skill level. Practice behavioral interviews with real-time grading, voice interaction, and personalized coaching anchored to your GitHub profile, resume, and target role.",
  keywords: [
    "AI interview coach",
    "AI mock interview",
    "behavioral interview practice",
    "interview preparation AI",
    "AI interview feedback",
    "mock interview simulator",
    "job interview practice",
    "interview coaching tool",
    "STAR format interview practice",
    "adaptive interview questions",
    "software engineer interview prep",
    "leadership interview questions",
    "problem solving interview",
    "voice interview simulator",
    "LangGraph multi-agent interview",
    "Claude AI interview coach",
  ],
  authors: [{ name: "Variant Labs", url: "https://www.vriantlabs.com" }],
  creator: "Variant Labs",
  publisher: "Variant Labs",
  category: "Technology",
  applicationName: "Friday",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Friday — AI Mock Interview Coach",
    description:
      "Practice behavioral interviews with an AI that adapts to you in real time. Real-time grading, voice interaction, and personalized questions anchored to your GitHub, resume, and target role.",
    url: SITE_URL,
    siteName: "Friday",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Friday — AI Mock Interview Coach",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Friday — AI Mock Interview Coach",
    description:
      "Practice behavioral interviews with an AI that adapts to you. Real-time grading, voice interaction, and coaching anchored to your actual background.",
    images: ["/og-image.png"],
    creator: "@vriantlabs",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Friday",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Interview Preparation",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Friday is an AI mock interview coach powered by a five-agent LangGraph pipeline. It conducts adaptive behavioral interviews, grades every answer 1–5 in real time, detects recurring knowledge gaps via RAG, and produces specific per-turn coaching notes with voice interaction.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Adaptive behavioral interview practice across 9 competencies",
        "Real-time AI grading: score, competency label, strengths, and gaps",
        "Voice-first interaction — ElevenLabs TTS questions, Web Speech API answers",
        "Personalized candidate profiling from GitHub, Google Scholar, resume, and job descriptions",
        "Five-agent LangGraph pipeline: Interviewer, Grader, Clarifier, Followup, Coach",
        "RAG-powered gap detection using Supabase pgvector",
        "Coach-driven session state: competency banning, question budgets, and turn directives",
        "Session reports with per-competency scores and coaching notes",
      ],
      provider: {
        "@type": "Organization",
        name: "Variant Labs",
        url: "https://www.vriantlabs.com",
        email: "hello@vriantlabs.com",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Friday?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Friday is an AI-powered mock interview coach that conducts adaptive behavioral interviews using a five-agent LangGraph pipeline. It grades every answer on a 1–5 scale, identifies which competency was tested, and provides specific coaching feedback in real time. Difficulty adjusts automatically based on your rolling performance score.",
          },
        },
        {
          "@type": "Question",
          name: "What interview types does Friday support?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Friday supports behavioral interviews across nine competencies: leadership, conflict resolution, communication, problem-solving, ownership, collaboration, adaptability, growth mindset, and execution. Each competency has a curated question bank at five difficulty levels.",
          },
        },
        {
          "@type": "Question",
          name: "How does Friday personalize interview questions?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Friday builds a candidate profile from up to four sources before the first question: your GitHub profile (repositories fetched and LLM-summarized), Google Scholar publications, an uploaded resume (PDF or text), and a job posting URL. All context is injected into the Interviewer agent so every question is anchored to your real background.",
          },
        },
        {
          "@type": "Question",
          name: "How does Friday grade interview answers?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A dedicated Grader AI agent scores each answer 1–5, identifies the competency tested, lists strengths, and pinpoints concrete gaps. Scores drive conditional routing: 1–2 triggers the Clarifier (probing question), 3–4 triggers the Followup agent (RAG gap detection), and 5 goes straight to the Coach for a harder next question.",
          },
        },
        {
          "@type": "Question",
          name: "What AI model powers Friday?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Friday uses Anthropic Claude as its default LLM, with a multi-provider manager that also supports OpenAI, Google Gemini, and local Ollama models. The pipeline runs on LangGraph with five specialized agents and native Anthropic tool-use loops.",
          },
        },
        {
          "@type": "Question",
          name: "Does Friday support voice interaction?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Questions are synthesized into speech using ElevenLabs TTS and returned as base64 MP3 audio with each API response. Answers can be transcribed in real time using the browser's Web Speech API, with a text-input fallback. You can interrupt TTS playback mid-sentence.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased bg-black text-white`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
