"use client";

import { useState } from "react";

import { AnswerView, AskForm } from "@/components/ask";
import { Empty } from "@/components/states";
import { PageHeader } from "@/components/ui";
import type { AskAnswer } from "@/lib/types";

/** Ask ROOK (UX §5): chat-like input, structured answers. Answers stay in this tab only. */
export default function AskPage() {
  const [answers, setAnswers] = useState<AskAnswer[]>([]);
  return (
    <>
      <PageHeader
        title="Ask ROOK"
        subtitle="Answers come only from sources you can access. Every claim is labelled Fact, Inference, Recommendation or Unknown."
      />
      <AskForm onAnswer={(a) => setAnswers((prev) => [a, ...prev])} />
      <div aria-live="polite" className="mt-6 space-y-4">
        {answers.length ? (
          answers.map((a, i) => <AnswerView key={answers.length - i} a={a} />)
        ) : (
          <Empty title="Ask a question about your work.">
            Try “What changed and what should I do?”. If ROOK can&apos;t find evidence, it will say so rather than guess.
          </Empty>
        )}
      </div>
    </>
  );
}
