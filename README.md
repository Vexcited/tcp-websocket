# `tcp-websocket`

> Was originally made to resolve this [Bun](https://bun.sh/) issue: <https://github.com/oven-sh/bun/issues/4529>.

Instead of using built-in `WebSocket`, we re-use the `WebSocket` from [`undici`](https://github.com/nodejs/undici) and export it correctly in this package with the typings needed.

## Why not directly use `undici` ?

Bun patches `undici` imports under the hood, resulting in it being broken and useless to resolve the issue, see
[`undici.js`](https://github.com/oven-sh/bun/blob/b124ba056cfdafad7828f86a852a83722f17f8a5/src/js/thirdparty/undici.js) and [`Undici.cpp`](https://github.com/oven-sh/bun/blob/b124ba056cfdafad7828f86a852a83722f17f8a5/src/bun.js/bindings/Undici.cpp).

For example, if we write the following code with Bun (so, using the native `WebSocket` implementation) :

```typescript
const ws = new WebSocket("ws://localhost:8080", {
  headers: {
    "User-Agent": "hello",
    "X-My-HeADeR": "world",
    authorization: "Bearer Hello!",
    origin: "http://localhost:8080"
  }
});
```

<details>
<summary>Server code (uses Node.js and <code>ws</code> package)</summary>

```typescript
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const server = createServer();

const wss = new WebSocketServer({ server });
wss.on('connection', (_, req) => {
  const headers = {};
  // We use `req.rawHeaders` to see the case-sensitive headers.
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    headers[req.rawHeaders[i]] = req.rawHeaders[i + 1];
  }

  console.log(headers);
});

server.listen(8080);
```

</details>

We get the following headers on the server :

```typescript
{
  Host: 'localhost:8080',
  Connection: 'Upgrade',
  Upgrade: 'websocket',
  'Sec-WebSocket-Version': '13',
  'Sec-WebSocket-Key': 'RzRIg/gRTDCqu0rhOXe6OQ==',
  Authorization: 'Bearer Hello!',
  Origin: 'http://localhost:8080',
  'User-Agent': 'hello',
  'X-My-HeADeR': 'world'
}
```

As you can see, the headers are not the same as the ones we provided. `authorization` and `origin` got uppercased.

Let's now try to use `WebSocket` from `undici` directly :

```typescript
import { WebSocket } from "undici";

const ws = new WebSocket("ws://localhost:8080", {
  headers: {
    "User-Agent": "hello",
    "X-My-HeADeR": "world",
    authorization: "Bearer Hello!",
    origin: "http://localhost:8080"
  }
});
```

We get the following headers on the server :

```typescript
{
  Host: 'localhost:8080',
  Connection: 'Upgrade',
  Upgrade: 'websocket',
  'Sec-WebSocket-Version': '13',
  'Sec-WebSocket-Key': 'ND4bTHtlQ/e/CwzhJp6mFA==',
  Authorization: 'Bearer Hello!',
  Origin: 'http://localhost:8080',
  'User-Agent': 'hello',
  'X-My-HeADeR': 'world'
}
```

We get exactly the same output !
This is because [Bun internally redirects the `WebSocket` import from `undici` to the native `WebSocket` implementation](https://github.com/oven-sh/bun/blob/b124ba056cfdafad7828f86a852a83722f17f8a5/src/bun.js/bindings/Undici.cpp#L59-L61).

Let's prevent this by tweaking the imports :

```typescript
import { WebSocket } from "undici/lib/web/websocket/websocket.js";

const ws = new WebSocket("ws://localhost:8080", {
  headers: {
    "User-Agent": "hello",
    "X-My-HeADeR": "world",
    authorization: "Bearer Hello!",
    origin: "http://localhost:8080"
  }
});
```

Now, we get the following headers on the server :

```typescript
{
  host: 'localhost:8080',
  connection: 'upgrade',
  upgrade: 'websocket',
  'User-Agent': 'hello',
  'X-My-HeADeR': 'world',
  authorization: 'Bearer Hello!',
  origin: 'http://localhost:8080',
  'sec-websocket-key': 'K8JDPp71F1TYDKXujpqoxw==',
  'sec-websocket-version': '13',
  'sec-websocket-extensions': 'permessage-deflate; client_max_window_bits',
  accept: '*/*',
  'accept-language': '*',
  'sec-fetch-mode': 'websocket',
  pragma: 'no-cache',
  'cache-control': 'no-cache',
  'accept-encoding': 'gzip, deflate'
}
```

It works as expected !

Now the issue is that we're missing typings, this is what this package is for.

## Usage

```bash
npm add tcp-websocket
yarn add tcp-websocket
pnpm add tcp-websocket
bun add tcp-websocket
```

```typescript
import WebSocket from "tcp-websocket";

const ws = new WebSocket("wss://ws.postman-echo.com/raw");
console.info("connecting...")

ws.onopen = () => {
  console.info("[open]: connected");
  ws.send("hello world!");

  console.info("[open]: will close in 5 seconds...");
  setTimeout(() => ws.close(), 5_000);
};

ws.onmessage = (event) => {
  console.info("[message]:", event.data);
};

ws.onclose = (event) => {
  console.info(`[close(${event.code})]: ${event.reason || "[no reason provided]"}`);
};
```

## Why not use those libraries instead ?

Packages using `node:http` or `node:https` to make the request handshake
will fail in Bun since their implementation also tweaks the headers.

| Package name on NPM | Issues with Bun |
| ------------------- | --------------- |
| [`ws`](https://www.npmjs.com/package/ws) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/websockets/ws/blob/7460049ff0a61bef8d5eda4b1d5c8170bc7d6b6f/lib/websocket.js#L715) |
| [`websocket`](https://www.npmjs.com/package/websocket) | Uses the `node:http` and `node:https` to make the request handshake. [Source](https://github.com/theturtle32/WebSocket-Node/blob/cce6d468986dd356a52af5630fd8ed5726ba5b7a/lib/WebSocketClient.js#L254) |
| [`websocket-stream`](https://www.npmjs.com/package/websocket-stream) | Uses the `ws` package internally, see `ws`. [Source](https://github.com/maxogden/websocket-stream/blob/feeb372ff530621d6df85cb85d4bee03b879c54d/stream.js#L5) |
| [`websocket-driver`](https://www.npmjs.com/package/websocket-driver) | Works as expected with Bun and others, but last update was 3 years ago with no TS declarations and ES5 syntax. |
