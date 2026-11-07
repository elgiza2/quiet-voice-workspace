/** @doc GrokBot-style orb creature. State drives its motion: idle, thinking, tool, talking, done, error. */
import { memo } from "react";
import type { AgentColor } from "@/lib/agentsky/client";

export type OrbState = "idle" | "sleeping" | "hello" | "awakening" | "thinking" | "tool" | "talking" | "done" | "error";

export const AgentOrb = memo(function AgentOrb({
  state = "idle",
  color = "aurora",
  size = 40,
  className = "",
}: {
  state?: OrbState;
  color?: AgentColor;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`ag-orb ${className}`}
      data-state={state}
      data-agent-color={color}
      style={{ ["--s" as any]: `${size}px` }}
      role="img"
      aria-label={state}
    >
      <div className="ag-orb__halo" />
      <div className="ag-orb__dots">
        <i />
        <i />
        <i />
      </div>
      <div className="ag-orb__body" />
      <div className="ag-orb__wave-clip" aria-hidden="true">
        <div className="ag-orb__wave-orbit"><div className="ag-orb__wave"><i /><i /><i /><i /><i /><i /><i /></div></div>
      </div>
      <div className="ag-orb__eyes">
        <span className="ag-orb__eye" />
        <span className="ag-orb__eye" />
      </div>
      <span className="ag-orb__sleep" aria-hidden="true">z<span>z</span></span>
    </div>
  );
});
