import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import mceExtension from './runtime.js';

export default function (pi: ExtensionAPI): void {
  mceExtension(pi);
}
