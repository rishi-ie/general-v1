import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import missionControlExtension from './runtime.js';

export default function (pi: ExtensionAPI): void {
  missionControlExtension(pi);
}
