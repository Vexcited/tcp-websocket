# `tcp-websocket`

Was originally made to resolve this [Bun](https://bun.sh/) issue: <https://github.com/oven-sh/bun/issues/4529> (even if it's closed, the issue still persists...)

Instead of using `node:http` or `node:https`, we use plain TCP sockets to communicate, even for the HTTP request handshake.

Bun support is main priority but it should also support Node.
Even though the Node support is kind of experimental.

## Getting started

```bash
bun add tcp-websocket
```

```typescript
import TCPWebSocket from "tcp-websocket";

const ws = new TCPWebSocket("wss://ws.postman-echo.com/raw");

ws.on("open", () => {
  console.info("[open]: connected !\n");
  
  const data = "hello world!";
  ws.send(data);
  console.info("[send::message]:", data);
});

ws.once("message", (event) => {
  console.info("[receive::message]:", event.data);

  console.info("\n[info]: will close in 5 seconds...");
  setTimeout(() => ws.close(), 5_000)
});

ws.on("close", (event) => {
  console.info(`[close(${event.code})]: ${event.reason || "[no reason provided]"}`)
});
```

You can find more examples @ [`./examples`](./examples/).

## API

> Warning: `TCPWebSocket` class is not fully compatible with the [`WebSocket` interface](https://websockets.spec.whatwg.org/#the-websocket-interface), yet.

## Why not use those libraries ?

Packages using `node:http` or `node:https` to make the request handshake
will fail in Bun since their implementation is kinda broken.

| Package name on NPM | Issues with Bun |
| ------------------- | --------------- |
| [`ws`](https://www.npmjs.com/package/ws) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/websockets/ws/blob/7460049ff0a61bef8d5eda4b1d5c8170bc7d6b6f/lib/websocket.js#L715) |
| [`websocket`](https://www.npmjs.com/package/websocket) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/theturtle32/WebSocket-Node/blob/cce6d468986dd356a52af5630fd8ed5726ba5b7a/lib/WebSocketClient.js#L254) |
| [`websocket-stream`](https://www.npmjs.com/package/websocket-stream) | Uses the `ws` package internally, see `ws`. [Source](https://github.com/maxogden/websocket-stream/blob/feeb372ff530621d6df85cb85d4bee03b879c54d/stream.js#L5) |
| [`undici`](https://npmjs.com/package/undici) | Bun patches `undici` under the hood, resulting in it being useless to us. A fork might work though. [Source 1](https://github.com/oven-sh/bun/blob/b124ba056cfdafad7828f86a852a83722f17f8a5/src/js/thirdparty/undici.js), [Source 2](https://github.com/oven-sh/bun/blob/b124ba056cfdafad7828f86a852a83722f17f8a5/src/bun.js/bindings/Undici.cpp) |
| [`websocket-driver`](https://www.npmjs.com/package/websocket-driver) | Works with Bun, but last update was 3 years ago with no TS declarations and ES5 syntax. This package reuses a lot of code from this package. |

## Development

```bash
git clone https://github.com/Vexcited/tcp-websocket

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
- <https://developer.mozilla.org/docs/Web/API/WebSocket>
