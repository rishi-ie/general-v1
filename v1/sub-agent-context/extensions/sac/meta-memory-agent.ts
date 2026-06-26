import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { assembleContextText, retrieve } from "./retrieval-pipeline";
import type { RetrievalContext } from "./types";

let config: { metaMemoryAgent?: string } = {};
let pi: ExtensionAPI | null = null;

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export async function invokeMetaMemoryAgent(
  ctx: ExtensionContext,
  question: string,
  context: RetrievalContext,
): Promise<string> {
  if (!pi) {
    log("pi not initialized, returning assembled context");
    return assembleContextText(context);
  }

  const agentName = config.metaMemoryAgent ?? "memory";
  const contextText = assembleContextText(context);

  log("invoking meta memory agent", { agent: agentName, question: question.slice(0, 50) });

  try {
    const result = await ctx.sessionManager.getSessionFile();

    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        log("meta memory agent timeout, using assembled context");
        resolve(contextText);
      }, 60000);

      ctx.ui.notify(`[sac] Synthesizing memory response...`, "info");

      if (pi) {
        pi.sendUserMessage(
          `[Memory Question] ${question}\n\n[Available Context]\n${contextText}\n\n[Task] Answer the question above using the available context. Be specific and cite sources when available. If the information is not in the context, say so honestly.`,
          { source: "extension" },
        )
          .then(() => {
            clearTimeout(timeout);
            resolve(contextText);
          })
          .catch((err) => {
            clearTimeout(timeout);
            log("meta memory agent error", { error: String(err) });
            resolve(contextText);
          });
      } else {
        clearTimeout(timeout);
        resolve(contextText);
      }
    });
  } catch (err) {
    log("invokeMetaMemoryAgent error", { error: String(err) });
    return contextText;
  }
}

export function initMetaMemoryAgentModule(cfg: { metaMemoryAgent?: string }, extensionApi: ExtensionAPI): void {
  config = cfg;
  pi = extensionApi;
}
