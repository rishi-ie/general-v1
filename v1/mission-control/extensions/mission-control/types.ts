export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  created: string;
  updated: string;
  subtasks: string[];
  tags: string[];
  extras: Record<string, unknown>;
  linked_plan?: {
    plan_path: string;
    phase: string;
  };
  confidence?: number;
}

export interface TicketIndex {
  [ticketId: string]: string;
}

export interface TicketStore {
  getTicket(id: string): Promise<Ticket | null>;
  getAllTickets(): Promise<Ticket[]>;
  saveTicket(ticket: Ticket): Promise<void>;
  deleteTicket(id: string): Promise<void>;
  rebuildIndex(): Promise<void>;
}

export interface AutoCaptureResult {
  detected: boolean;
  tasks: Array<{
    title: string;
    description?: string;
    confidence: number;
  }>;
}

export type ConfidenceThreshold = {
  announce: number;
  confirm: number;
};

export const DEFAULT_CONFIDENCE: ConfidenceThreshold = {
  announce: 0.7,
  confirm: 0.5,
};

export const DEFAULT_TICKET: Omit<Ticket, "id" | "created" | "updated"> = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  subtasks: [],
  tags: [],
  extras: {},
};
