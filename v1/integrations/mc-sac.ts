import { appendGoal } from "../sub-agent-context/extensions/sac/meta-state.js";
import * as fs from "fs";
import * as path from "path";

const CAPTURE_PATTERNS = [
  /^(?:will|going to|gonna|plan to|should)\s+(.+)/i,
  /^(?:next|first|then|after that|finally)\s+(.+)/i,
  /^-\s+(.+)/,
  /^\*\s+(.+)/,
];

function extractGoals(text: string): string[] {
  const lines = text.split("\n");
  const goals: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    for (const pattern of CAPTURE_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match) {
        const goal = match[1].trim();
        if (goal.length > 10 && goal.length < 200) {
          goals.push(goal);
        }
        break;
      }
    }
  }
  return goals;
}

export default function mcSacIntegration(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): void {
  pi.on("turn_end", async (event: { messages?: Array<{ content?: string }> }) => {
    try {
      const lastMsg = event.messages?.[event.messages.length - 1];
      if (!lastMsg?.content) return;
      const goals = extractGoals(lastMsg.content);
      for (const title of goals) {
        appendGoal({
          title,
          status: "in_progress",
          priority: "medium",
          progress: 0,
          blockers: [],
        });
      }
    } catch {}
  });
}
