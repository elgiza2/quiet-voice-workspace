/** @doc Stacked step list under an agent turn: every step says what it did (searched, read, clicked…). */
import { useState } from "react";
import {
  Brain, Search, FileText, MousePointerClick, Image as ImageIcon, Film, Users, Terminal, PenLine,
  MessageCircleQuestion, ListTodo, ListChecks, Wrench, X, Code2, FileCode, FolderOpen, BookMarked, Mail, CalendarDays, MapPin, BarChart3,
} from "lucide-react";
import type { Step, StepKind } from "@/lib/agentsky/transcript";
import { Button } from "@/components/ui/button";
import { AgentOrb } from "./AgentOrb";

const ICONS: Record<StepKind, any> = {
  thought: Brain, search: Search, read: FileText, browse: MousePointerClick, image: ImageIcon, video: Film,
  helper: Users, command: Terminal, edit: PenLine, ask: MessageCircleQuestion, task: ListTodo, plan: ListChecks, tool: Wrench,
  python: FileCode, code: Code2, file: FolderOpen, memory: BookMarked, email: Mail, calendar: CalendarDays, map: MapPin, data: BarChart3,
};

function StepRow({ step }: { step: Step }) {
  const Icon = step.status === "error" ? X : ICONS[step.kind];
  return (
    <div className="ag-step ag-fade-in" data-status={step.status} data-kind={step.kind}>
      <span className="ag-step__icon">
        {step.kind === "helper" ? <AgentOrb size={20} color="mint" state={step.status === "active" ? "tool" : step.status === "error" ? "error" : "done"} /> : <Icon size={12} strokeWidth={2.4} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="ag-step__label text-[13px]">
          <span className={step.status === "active" ? "ag-shimmer" : ""}>{step.label}</span>
        </div>
      </div>
    </div>
  );
}

export function StepTimeline({ steps, lang }: { steps: Step[]; lang: "en" | "ar" }) {
  const [showAll, setShowAll] = useState(false);
  // Thinking is shown only while it is happening; once the agent acts, the line becomes the action.
  steps = steps.filter((s, i) => s.kind !== "thought" || (s.status === "active" && i === steps.length - 1));
  if (!steps.length) return null;
  const LIMIT = 6;
  const hidden = steps.length > LIMIT && !showAll ? steps.length - LIMIT : 0;
  const visible = hidden ? steps.slice(-LIMIT) : steps;
  return (
    <div className="ag-steps">
      {hidden > 0 && (
        <Button variant="link" type="button" onClick={() => setShowAll(true)} className="h-auto px-0 mb-1 self-start text-[12.5px] text-muted-foreground">
          {lang === "ar" ? `عرض ${hidden} خطوات قبلها` : `Show ${hidden} earlier steps`}
        </Button>
      )}
      {visible.map((s) => (
        <StepRow key={s.id} step={s} />
      ))}
    </div>
  );
}
