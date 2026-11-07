import { AgentOrb } from "@/components/agent/AgentOrb";

/** Decorative characters, never user-owned agent data. */
export default function AuthAgentOrbit() {
  return <div className="auth-agent-orbit" aria-hidden="true">
    {(["mint", "rose", "sun", "ember", "ocean", "aurora", "mono", "mint"] as const).map((color, index) =>
      <div key={`${color}-${index}`} className={`auth-agent-satellite auth-agent-satellite-${index}`}>
        <AgentOrb color={color} size={68} state="idle" />
      </div>
    )}
  </div>;
}
