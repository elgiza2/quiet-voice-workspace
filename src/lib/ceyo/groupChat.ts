export type GroupMember = { id: string; name: string; instructions: string | null };

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

/** Who answers this turn: @mentioned members first; otherwise every member (max 4), coordinator last so it can wrap up. */
export function pickSpeakers(members: GroupMember[], coordinatorId: string | null, userText: string): GroupMember[] {
  const text = norm(userText);
  const mentioned = members.filter((m) => text.includes(`@${norm(m.name)}`));
  if (mentioned.length) return mentioned.slice(0, 4);
  const others = members.filter((m) => m.id !== coordinatorId);
  const coord = members.find((m) => m.id === coordinatorId);
  const list = [...others.slice(0, coord ? 3 : 4), ...(coord ? [coord] : [])];
  return list.length ? list : members.slice(0, 1);
}

export function groupMemberPrompt(groupName: string, me: GroupMember, members: GroupMember[], earlier: string[]) {
  const roster = members.map((m) => `- ${m.name}${m.id === me.id ? " (you)" : ""}`).join("\n");
  return `You are ${me.name}, one member of the team chat "${groupName}" — like a WhatsApp group of colleagues. Speak only as yourself, in first person, in the user's language, briefly and naturally, from your own role and skills. You may address teammates with @Name to hand off, ask or agree. Do not repeat what teammates already said; add only your own contribution. Never write speaker tags or speak for others. If you truly have nothing useful to add, reply exactly PASS.\nTeam:\n${roster}${earlier.length ? `\n\nTeammates already said this turn:\n${earlier.join("\n\n")}` : ""}`;
}
