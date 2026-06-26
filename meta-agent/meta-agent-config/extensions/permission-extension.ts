export default function permissionExtension(
  pi: { registerCommand?: (name: string, opts: { description: string; handler: (args: string) => string | Promise<string> }) => void; on?: (event: string, cb: () => void | Promise<void>) => void }
): void {
  if (pi.registerCommand) {
    pi.registerCommand("permission", {
      description: "Request elevated permission or check status: /permission <tool> [--reason <reason>] | status",
      handler: async (args: string) => {
        if (args.includes("status")) {
          return "[permission] No active grants. System ready.";
        }
        return "[permission] Permission system unavailable — run: pi install npm:pi-permission-system";
      },
    });
  }
}
