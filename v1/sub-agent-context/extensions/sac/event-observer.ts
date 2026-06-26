import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { EventType, ObservedEvent } from "./types";

export type EventHandler = (event: ObservedEvent) => void | Promise<void>;

export class EventObserver {
  private handlers: EventHandler[] = [];
  private sessionId = "";

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  async emit(
    type: EventType,
    content: string,
    ctx: ExtensionContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const event: ObservedEvent = {
      type,
      timestamp: Date.now(),
      content: content.slice(0, 2000),
      session_id: this.sessionId || ctx.sessionManager.getSessionFile() || "unknown",
      session_entry_id: undefined,
      project: undefined,
      tags: [],
      metadata,
    };

    for (const handler of this.handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[sac] event handler error:`, err);
      }
    }
  }

  async emitFromToolResult(toolName: string, result: unknown, ctx: ExtensionContext): Promise<void> {
    const content = typeof result === "string" ? result : JSON.stringify(result).slice(0, 2000);
    await this.emit("tool_output", content, ctx, { toolName });
  }

  async emitUserMessage(content: string, ctx: ExtensionContext): Promise<void> {
    await this.emit("user_message", content, ctx);
  }

  async emitAgentResponse(content: string, ctx: ExtensionContext): Promise<void> {
    await this.emit("agent_response", content, ctx);
  }

  async emitDecision(content: string, ctx: ExtensionContext, metadata?: Record<string, unknown>): Promise<void> {
    await this.emit("decision", content, ctx, metadata);
  }

  async emitGoalUpdate(content: string, ctx: ExtensionContext, metadata?: Record<string, unknown>): Promise<void> {
    await this.emit("goal_update", content, ctx, metadata);
  }

  async emitSessionStart(ctx: ExtensionContext): Promise<void> {
    await this.emit("session_start", "Session started", ctx);
  }

  async emitSessionShutdown(ctx: ExtensionContext): Promise<void> {
    await this.emit("session_shutdown", "Session ending", ctx);
  }
}

export function createEventObserver(): EventObserver {
  return new EventObserver();
}

export function classifyContent(content: string): { tags: string[]; project?: string } {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  if (lower.includes("implement") || lower.includes("code") || lower.includes("function")) {
    tags.push("implementation");
  }
  if (lower.includes("test") || lower.includes("spec")) {
    tags.push("testing");
  }
  if (lower.includes("review") || lower.includes("feedback")) {
    tags.push("review");
  }
  if (lower.includes("deploy") || lower.includes("release")) {
    tags.push("deployment");
  }
  if (lower.includes("bug") || lower.includes("fix") || lower.includes("error")) {
    tags.push("bugfix");
  }
  if (lower.includes("feature") || lower.includes("add")) {
    tags.push("feature");
  }
  if (lower.includes("docs") || lower.includes("document")) {
    tags.push("documentation");
  }
  if (lower.includes("refactor") || lower.includes("cleanup")) {
    tags.push("refactor");
  }
  if (lower.includes("decision") || lower.includes("decided") || lower.includes("chose")) {
    tags.push("decision");
  }

  const projectMatch = content.match(/project[:\s]+([A-Za-z0-9_\-]+)/i);
  const project = projectMatch ? projectMatch[1] : undefined;

  return { tags, project };
}
