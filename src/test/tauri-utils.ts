import { vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { toast } from "sonner"

export const invokeMock = vi.mocked(invoke)
export const listenMock = vi.mocked(listen)
export const toastMock = vi.mocked(toast)

type Handler = (payload: unknown) => void | Promise<void>
const handlers = new Map<string, Handler>()

listenMock.mockImplementation(((event: string, handler: Handler) => {
  handlers.set(event, handler)
  return Promise.resolve(() => handlers.delete(event))
}) as typeof listen)

/** Dispatches a Tauri event to the handler registered by `listen`, awaiting it.
 * Handlers receive the real `Event<T>` shape (`{ payload }`), matching how the
 * hooks read `event.payload`. */
export async function fireTauriEvent(event: string, payload: unknown) {
  const handler = handlers.get(event)
  if (handler) await handler({ payload })
}
