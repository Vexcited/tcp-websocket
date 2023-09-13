# `tcp-websocket`

Was originally made to resolve this [Bun](https://bun.sh/) issue: <https://github.com/oven-sh/bun/issues/4529> (still not fixed)

Instead of using `node:http` or `node:https`, we use plain TCP sockets to communicate, even for the HTTP request handshake.

## Getting started

```bash
bun add tcp-websocket

# If usage within Node ¯\_(ツ)_/¯
pnpm add tcp-websocket
yarn add tcp-websocket
npm install tcp-websocket
```

```typescript
import TCPWebSocket from "bun-tcp-websocket";

const ws = new TCPWebSocket("wss://echo-websocket.hoppscotch.io");
ws.on("open", () => {
  console.info("[open] Connected!");
});

ws.on("message", (message: Buffer) => {
  console.info("[message]", message.toString("utf8"));
});
```

## API

> Warning: `TCPWebSocket` class is not fully compatible with the [`WebSocket` interface](https://websockets.spec.whatwg.org/#the-websocket-interface), yet.

## Why not use those librairies ?

Packages using `node:http` or `node:https` to make the request handshake
will fail in Bun since their implementation is kinda broken.

| Package name on NPM | Issues with Bun |
| ------------------- | --------------- |
| [`ws`](https://www.npmjs.com/package/ws) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/websockets/ws/blob/7460049ff0a61bef8d5eda4b1d5c8170bc7d6b6f/lib/websocket.js#L715) |
| [`websocket`](https://www.npmjs.com/package/websocket) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/theturtle32/WebSocket-Node/blob/cce6d468986dd356a52af5630fd8ed5726ba5b7a/lib/WebSocketClient.js#L254) |
| [`websocket-stream`](https://www.npmjs.com/package/websocket-stream) | Uses the `ws` package internally, see `ws`. [Source](https://github.com/maxogden/websocket-stream/blob/feeb372ff530621d6df85cb85d4bee03b879c54d/stream.js#L5) |
| [`undici`](https://npmjs.com/package/undici) | Uses `http2` under the hood which is currently [not implemented in Bun](https://bun.sh/docs/runtime/nodejs-apis#node-http2). [Source](https://github.com/nodejs/undici/blob/e39a6324c4474c6614cac98b8668e3d036aa6b18/lib/client.js#L1231) |
| [`websocket-driver`](https://www.npmjs.com/package/websocket-driver) | Works with Bun, but last update was 3 years ago with no TS declarations and ES5 syntax. This package reuses a lot of code from this package. |

## Development

```bash
git clone https://github.com/Vexcited/bun-tcp-websocket

# Install dependencies
bun install
```

The main source code is located in `./src/index.ts`.

You can run the main examples located in [`./src/examples`](./src/examples)  using `bun run ./examples/simple.ts`, for example.

## Credits

- <https://github.com/faye/websocket-driver-node>
- <https://github.com/creationix/http-parser-js>
- <https://github.com/websockets/ws>
- <https://github.com/nodejs/undici>

## Resources

- <https://www.rfc-editor.org/rfc/rfc6455>
- <https://websockets.spec.whatwg.org>