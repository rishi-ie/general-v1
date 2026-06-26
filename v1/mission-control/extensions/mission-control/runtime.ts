import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  filterByConfidence,
  formatAutoCaptureAnnouncement,
  formatAutoCaptureConfirmation,
  inferTasksFromConversation,
} from "./auto-capture.js";
import { COMMANDS } from "./constants.js";
import { FileTicketStore } from "./ticket-store.js";
import type { Ticket } from "./types.js";
import { DEFAULT_TICKET } from "./types.js";

interface RuntimeState {
  store: FileTicketStore;
  conversationBuffer: string[];
  pendingConfirmations: Map<string, { title: string; description?: string; confidence: number }>;
}

const MAX_CONVERSATION_BUFFER = 5;

function buildTicketFromArgs(args: string): Partial<Ticket> & { title: string } {
  const parts = args.trim().split(/\s+/);
  const title = parts[0] || "";
  const rest = parts.slice(1).join(" ");

  const ticket: Partial<Ticket> & { title: string } = {
    title,
    ...DEFAULT_TICKET,
  };

  const descMatch = rest.match(/--desc\s+(.+)/);
  if (descMatch) ticket.description = descMatch[1];

  const priorityMatch = rest.match(/--priority\s+(low|medium|high|critical)/);
  if (priorityMatch) ticket.priority = priorityMatch[1] as Ticket["priority"];

  const tagsMatch = rest.match(/--tags\s+(.+)/);
  if (tagsMatch) ticket.tags = tagsMatch[1].split(",").map((t) => t.trim());

  return ticket;
}

function formatTicketForDisplay(ticket: Ticket): string {
  const parts = [`[${ticket.id}]`, `"${ticket.title}"`, `| status: ${ticket.status}`, `| priority: ${ticket.priority}`];

  if (ticket.linked_plan?.phase) {
    parts.push(`| phase: ${ticket.linked_plan.phase}`);
  }

  if (ticket.subtasks.length > 0) {
    parts.push(`| subtasks: ${ticket.subtasks.length}`);
  }

  return parts.join(" ");
}

function formatTicketsForInjection(tickets: Ticket[]): string {
  if (tickets.length === 0) {
    return "No active tickets";
  }

  return tickets.map((t) => formatTicketForDisplay(t)).join("\n");
}

function formatActiveTicketsSummary(tickets: Ticket[]): {
  summary: string;
  count: number;
  inProgress: Ticket[];
  hasInProgress: boolean;
  inProgressTitles: string;
} {
  const active = tickets.filter((t) => t.status !== "done");
  const inProgress = active.filter((t) => t.status === "in_progress");

  return {
    summary: formatTicketsForInjection(active),
    count: active.length,
    inProgress,
    hasInProgress: inProgress.length > 0,
    inProgressTitles: inProgress.map((t) => t.title).join(", ") || "none",
  };
}

function buildSessionInjection(tickets: Ticket[]): string {
  const { summary, count, hasInProgress, inProgressTitles } = formatActiveTicketsSummary(tickets);

  let output = `=== MISSION CONTROL ACTIVE TICKETS ===\n`;
  output += summary + "\n";
  output += `=== ${count} active ticket(s) ===\n`;
  output += `\n`;
  output += `In progress: ${inProgressTitles}`;

  return output;
}

function parsePhaseFromPlan(planContent: string): Array<{ title: string; description: string; subtasks: string[] }> {
  const phases: Array<{ title: string; description: string; subtasks: string[] }> = [];
  const lines = planContent.split("\n");
  let currentPhase: { title: string; description: string; subtasks: string[] } | null = null;

  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+Phase\s+\d+:\s+(.+)/);
    if (phaseMatch) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = { title: phaseMatch[1].trim(), description: "", subtasks: [] };
    } else if (currentPhase && line.trim().startsWith("-")) {
      currentPhase.subtasks.push(line.trim().replace(/^-\s+/, ""));
    } else if (currentPhase && line.trim() && !line.trim().startsWith("#")) {
      currentPhase.description += (currentPhase.description ? " " : "") + line.trim();
    }
  }

  if (currentPhase) phases.push(currentPhase);
  return phases;
}

function registerCommands(pi: ExtensionAPI, state: RuntimeState): void {
  pi.registerCommand(COMMANDS.NEW, {
    description:
      "Create a new ticket: /ticket new <title> [--desc <description>] [--priority <level>] [--tags <tag1,tag2>]",
    handler: async (args: string) => {
      const partial = buildTicketFromArgs(args);
      if (!partial.title) {
        return "Usage: /ticket new <title> [--desc <description>] [--priority <level>] [--tags <tag1,tag2>]";
      }

      const now = new Date().toISOString();
      const ticket: Ticket = {
        id: state.store.generateId(),
        title: partial.title,
        description: partial.description ?? "",
        status: "open",
        priority: partial.priority ?? "medium",
        created: now,
        updated: now,
        subtasks: [],
        tags: partial.tags ?? [],
        extras: {},
      };

      await state.store.saveTicket(ticket);
      return `Created ticket: [${ticket.id}] "${ticket.title}" (priority: ${ticket.priority}, status: open)`;
    },
  });

  pi.registerCommand(COMMANDS.LIST, {
    description: "List all tickets: /ticket list [--status <status>] [--priority <priority>]",
    handler: async (args: string) => {
      const tickets = await state.store.getAllTickets();
      if (tickets.length === 0) {
        return "No tickets found";
      }

      let filtered = tickets;
      const statusMatch = args.match(/--status\s+(open|in_progress|done)/);
      if (statusMatch) {
        filtered = filtered.filter((t) => t.status === statusMatch[1]);
      }

      const priorityMatch = args.match(/--priority\s+(low|medium|high|critical)/);
      if (priorityMatch) {
        filtered = filtered.filter((t) => t.priority === priorityMatch[1]);
      }

      if (filtered.length === 0) {
        return "No tickets match the filter";
      }

      return filtered.map((t) => formatTicketForDisplay(t)).join("\n");
    },
  });

  pi.registerCommand(COMMANDS.SHOW, {
    description: "Show ticket details: /ticket show <id>",
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) return "Usage: /ticket show <id>";

      const ticket = await state.store.getTicket(id);
      if (!ticket) return `Ticket [${id}] not found`;

      return JSON.stringify(ticket, null, 2);
    },
  });

  pi.registerCommand(COMMANDS.UPDATE, {
    description:
      "Update ticket fields: /ticket update <id> [--status <status>] [--priority <priority>] [--title <title>] [--desc <description>]",
    handler: async (args: string) => {
      const parts = args.trim().split(/\s+/);
      const id = parts[0];
      if (!id)
        return "Usage: /ticket update <id> [--status <status>] [--priority <priority>] [--title <title>] [--desc <description>]";

      const ticket = await state.store.getTicket(id);
      if (!ticket) return `Ticket [${id}] not found`;

      const rest = parts.slice(1).join(" ");

      const statusMatch = rest.match(/--status\s+(open|in_progress|done)/);
      if (statusMatch) ticket.status = statusMatch[1] as Ticket["status"];

      const priorityMatch = rest.match(/--priority\s+(low|medium|high|critical)/);
      if (priorityMatch) ticket.priority = priorityMatch[1] as Ticket["priority"];

      const titleMatch = rest.match(/--title\s+(.+?)(?=--|$)/);
      if (titleMatch) ticket.title = titleMatch[1].trim();

      const descMatch = rest.match(/--desc\s+(.+?)(?=--|$)/);
      if (descMatch) ticket.description = descMatch[1].trim();

      ticket.updated = new Date().toISOString();
      await state.store.saveTicket(ticket);

      return `Updated ticket [${ticket.id}]: ${formatTicketForDisplay(ticket)}`;
    },
  });

  pi.registerCommand(COMMANDS.CLOSE, {
    description: "Close a ticket: /ticket close <id>",
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) return "Usage: /ticket close <id>";

      const ticket = await state.store.getTicket(id);
      if (!ticket) return `Ticket [${id}] not found`;

      ticket.status = "done";
      ticket.updated = new Date().toISOString();
      await state.store.saveTicket(ticket);

      return `Closed ticket [${ticket.id}]: "${ticket.title}"`;
    },
  });

  pi.registerCommand(COMMANDS.DELETE, {
    description: "Delete a ticket: /ticket delete <id>",
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) return "Usage: /ticket delete <id>";

      const ticket = await state.store.getTicket(id);
      if (!ticket) return `Ticket [${id}] not found`;

      await state.store.deleteTicket(id);
      return `Deleted ticket [${id}]: "${ticket.title}"`;
    },
  });

  pi.registerCommand(COMMANDS.LINK_PLAN, {
    description: "Link ticket to plan phase: /ticket link-plan <id> <phase>",
    handler: async (args: string) => {
      const parts = args.trim().split(/\s+/);
      const id = parts[0];
      const phase = parts.slice(1).join(" ");

      if (!id || !phase) return "Usage: /ticket link-plan <id> <phase>";

      const ticket = await state.store.getTicket(id);
      if (!ticket) return `Ticket [${id}] not found`;

      ticket.linked_plan = {
        plan_path: "task_plan.md",
        phase,
      };
      ticket.updated = new Date().toISOString();
      await state.store.saveTicket(ticket);

      return `Linked ticket [${ticket.id}] to phase: "${phase}"`;
    },
  });

  pi.registerCommand(COMMANDS.IMPORT, {
    description: "Import open phases from task_plan.md as tickets",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const planPath = `${ctx.cwd}/task_plan.md`;

      let planContent: string;
      try {
        const { readFileSync } = await import("node:fs");
        planContent = readFileSync(planPath, "utf-8");
      } catch {
        return "task_plan.md not found in current directory";
      }

      const phases = parsePhaseFromPlan(planContent);
      const existingTickets = await state.store.getAllTickets();
      const existingIds = new Set(existingTickets.map((t) => t.id));

      let imported = 0;
      let skipped = 0;

      for (const phase of phases) {
        const candidateId = `MC-${phase.title.toLowerCase().replace(/\s+/g, "-").substring(0, 20)}`;
        if (existingIds.has(candidateId)) {
          skipped++;
          continue;
        }

        const now = new Date().toISOString();
        const ticket: Ticket = {
          id: state.store.generateId(),
          title: phase.title,
          description: phase.description,
          status: "open",
          priority: "medium",
          created: now,
          updated: now,
          subtasks: phase.subtasks,
          tags: [],
          extras: {},
          linked_plan: {
            plan_path: "task_plan.md",
            phase: phase.title,
          },
        };

        await state.store.saveTicket(ticket);
        imported++;
      }

      return `Imported ${imported} ticket(s) from task_plan.md. ${skipped > 0 ? `Skipped ${skipped} duplicate(s).` : ""}`;
    },
  });
}

export default function missionControlExtension(pi: ExtensionAPI): void {
  let storeInitialized = false;

  const state: RuntimeState = {
    store: new FileTicketStore(process.cwd()),
    conversationBuffer: [],
    pendingConfirmations: new Map(),
  };

  registerCommands(pi, state);

  pi.on("session_start", async (_event, ctx) => {
    if (!storeInitialized) {
      state.store = new FileTicketStore(ctx.cwd);
      storeInitialized = true;
    }
    state.conversationBuffer = [];
    const tickets = await state.store.getAllTickets();

    if (tickets.length === 0) return;

    const injection = buildSessionInjection(tickets);
    ctx.sendMessage({
      customType: "mission-control",
      content: injection,
      display: false,
    });
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const tickets = await state.store.getAllTickets();
    if (tickets.length === 0) return;

    const injection = buildSessionInjection(tickets);
    ctx.sendMessage({
      customType: "mission-control",
      content: injection,
      display: false,
    });
  });

  pi.on("turn_end", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    const recentEntries = entries.slice(-MAX_CONVERSATION_BUFFER * 2);
    const turns: Array<{ userMessage: string; agentMessage: string }> = [];

    for (let i = 0; i < recentEntries.length - 1; i += 2) {
      const userEntry = recentEntries[i];
      const agentEntry = recentEntries[i + 1];
      if (userEntry?.role === "user" && agentEntry?.role === "assistant") {
        turns.push({
          userMessage: userEntry.content || "",
          agentMessage: agentEntry.content || "",
        });
      }
    }

    if (turns.length === 0) return;

    const conversation = turns.map((t) => `User: ${t.userMessage || ""}\nAgent: ${t.agentMessage || ""}`).join("\n\n");

    const result = await inferTasksFromConversation(conversation, ctx);
    if (!result.detected || result.tasks.length === 0) return;

    const { announce, confirm } = filterByConfidence(result);

    for (const task of announce) {
      const now = new Date().toISOString();
      const ticket: Ticket = {
        id: state.store.generateId(),
        title: task.title,
        description: task.description ?? "",
        status: "open",
        priority: "medium",
        created: now,
        updated: now,
        subtasks: [],
        tags: [],
        extras: {},
        confidence: task.confidence,
      };

      await state.store.saveTicket(ticket);
      ctx.ui.notify(`Created ticket: [${ticket.id}] "${ticket.title}" (auto-captured)`, "info");
    }

    for (const task of confirm) {
      const confirmKey = `pending-${Date.now()}`;
      state.pendingConfirmations.set(confirmKey, task);
      ctx.ui.notify(
        `Task detected (${Math.round(task.confidence * 100)}% confidence): "${task.title}". Use /ticket confirm ${confirmKey} to create.`,
        "info",
      );
    }
  });

  pi.registerCommand("ticket confirm", {
    description: "Confirm auto-detected task: /ticket confirm <key>",
    handler: async (args: string) => {
      const key = args.trim();
      const task = state.pendingConfirmations.get(key);
      if (!task) return "No pending confirmation for that key";

      state.pendingConfirmations.delete(key);

      const now = new Date().toISOString();
      const ticket: Ticket = {
        id: state.store.generateId(),
        title: task.title,
        description: task.description ?? "",
        status: "open",
        priority: "medium",
        created: now,
        updated: now,
        subtasks: [],
        tags: [],
        extras: {},
        confidence: task.confidence,
      };

      await state.store.saveTicket(ticket);
      return `Created ticket: [${ticket.id}] "${ticket.title}" (confirmed)`;
    },
  });
}
