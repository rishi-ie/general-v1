import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import subAgentExtension from './runtime.js';

export default function (pi: ExtensionAPI): void {
  subAgentExtension(pi);
}
