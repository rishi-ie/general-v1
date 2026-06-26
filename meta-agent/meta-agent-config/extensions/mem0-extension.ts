export default function mem0Extension(
  pi: { registerCommand?: (name: string, opts: { description: string; handler: (args: string) => string | Promise<string> }) => void; on?: (event: string, cb: () => void | Promise<void>) => void }
): void {
  if (pi.registerCommand) {
    pi.registerCommand("mem0-search", {
      description: "Search persistent memory: /mem0-search <query>",
      handler: async () => {
        return "[mem0] Memory search unavailable — run: pi install npm:@mem0/pi-agent-plugin and set MEM0_API_KEY";
      },
    });
    pi.registerCommand("mem0-add", {
      description: "Add a fact to memory: /mem0-add <fact>",
      handler: async () => {
        return "[mem0] Memory add unavailable — run: pi install npm:@mem0/pi-agent-plugin and set MEM0_API_KEY";
      },
    });
    pi.registerCommand("mem0-learn", {
      description: "Digest recent conversation into memory: /mem0-learn",
      handler: async () => {
        return "[mem0] Memory learn unavailable — run: pi install npm:@mem0/pi-agent-plugin and set MEM0_API_KEY";
      },
    });
  }
}
