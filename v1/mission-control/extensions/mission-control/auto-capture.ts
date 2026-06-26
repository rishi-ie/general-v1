import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { AUTO_CAPTURE_INFERENCE_PROMPT, CONFIDENCE } from "./constants.js";
import type { AutoCaptureResult } from "./types.js";

export async function inferTasksFromConversation(
  conversation: string,
  ctx: ExtensionContext,
): Promise<AutoCaptureResult> {
  if (!conversation.trim()) {
    return { detected: false, tasks: [] };
  }

  const prompt = AUTO_CAPTURE_INFERENCE_PROMPT.replace("{conversation}", conversation);

  try {
    const response = await ctx.model.call("memory-task-inference", {
      prompt,
    });

    const text = typeof response === "string" ? response : ((response as { content?: string }).content ?? "");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { detected: false, tasks: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      detected: parsed.detected === true,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return { detected: false, tasks: [] };
  }
}

export function filterByConfidence(result: AutoCaptureResult): {
  announce: Array<{ title: string; description?: string; confidence: number }>;
  confirm: Array<{ title: string; description?: string; confidence: number }>;
} {
  const announce: typeof result.tasks = [];
  const confirm: typeof result.tasks = [];

  for (const task of result.tasks) {
    if (task.confidence >= CONFIDENCE.announce) {
      announce.push(task);
    } else if (task.confidence >= CONFIDENCE.confirm) {
      confirm.push(task);
    }
  }

  return { announce, confirm };
}

export function formatAutoCaptureAnnouncement(
  tasks: Array<{ title: string; description?: string; confidence: number }>,
): string {
  return tasks
    .map((t) => `Created ticket: [auto-captured] "${t.title}" (confidence: ${Math.round(t.confidence * 100)}%)`)
    .join("\n");
}

export function formatAutoCaptureConfirmation(
  tasks: Array<{ title: string; description?: string; confidence: number }>,
): string {
  return tasks.map((t) => `"${t.title}" (${Math.round(t.confidence * 100)}% confidence)`).join(", ");
}
