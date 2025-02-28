import type { WebSocket as _WST, WebSocketInit } from "undici";

// @ts-expect-error : not defined in types.
import { WebSocket as _WS } from "undici/lib/web/websocket/websocket.js";

export type { WebSocketEventMap } from "undici";
export type { WebSocketInit };

export default _WS as {
  prototype: _WST
  new (url: string | URL, protocols?: string | string[] | WebSocketInit): _WST
  readonly CLOSED: number
  readonly CLOSING: number
  readonly CONNECTING: number
  readonly OPEN: number
};
