/**
 * Web Worker entry for interactive Monte Carlo valuations (thin on purpose; the logic and the
 * typed protocol live in protocol.ts). No DOM-only APIs: the worker scope is typed
 * structurally instead of with the "webworker" lib, which would clash with the DOM types.
 *
 * Message in:  McRequest  { id, type: 'price' | 'solve', product, overrides?, market?, paths?, seed? }
 * Message out: McResponse { id, result } or { id, error }
 */
import { handleMcRequest, type McRequest, type McResponse } from './protocol';

interface WorkerScope {
  onmessage: ((event: { data: McRequest }) => void) | null;
  postMessage(message: McResponse): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (event) => {
  scope.postMessage(handleMcRequest(event.data));
};
