# `bun-tcp-websocket`

Was made to resolve this [Bun](https://bun.sh/) issue: <https://github.com/oven-sh/bun/issues/4529>

## Usage

```bash
# Typings are included
bun add bun-tcp-websocket 
```

```typescript
import TCPWebSocket from "bun-tcp-websocket";

const ws = new TCPWebSocket("wss://echo-websocket.hoppscotch.io");
ws.on("open", () => {
  console.info("connected to websocket");
});

ws.on("message", (message) => {
  console.info("received message:", message);
});
```

## Development

```bash
git clone https://github.com/Vexcited/bun-tcp-websocket

# Install dependencies
bun install
```

The main source code is located in `./src/index.ts`.

You can run the main examples located in [`./src/examples`](./src/examples)  using `bun run ./examples/simple.ts`, for example.

## Credits

I recycled code from those librairies to write this one.

- <https://github.com/creationix/http-parser-js>
- <https://github.com/nodejs/undici>
- <https://github.com/faye/websocket-driver-node>
