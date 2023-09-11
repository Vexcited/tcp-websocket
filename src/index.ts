import crypto from "node:crypto";

import tls from "node:tls";
import net from "node:net";

import { EventEmitter } from "node:stream";
import { makeHttpHeaders } from "./http";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface TCPWebSocketOptions {
  headers?: Headers | Record<string, string>
}

const makeWebSocketKey = () => {
  return crypto.randomBytes(16).toString('base64');
}

class TCPWebSocket extends EventEmitter {

  public static CONNECTING = 0;
  public static OPEN = 1;
  public static CLOSING = 2;
  public static CLOSED = 3;

  #socket: net.Socket | tls.TLSSocket;

  public readonly url: URL;
  #pathname: string;
  #headers: Record<string, string>;

  public readonly extensions: string;
  public state = -1;

  constructor (uri: string | URL, options: TCPWebSocketOptions) {
    super();

    // We transform the string into an URL
    if (typeof uri === "string") {
      uri = new URL(uri);
    }

    this.url = uri;

    // We check the validity of the URL.
    const SUPPORTED_PROTOCOLS = ["ws:", "wss:"];
    if (!SUPPORTED_PROTOCOLS.includes(this.url.protocol)) {
      throw new Error(`Protocol ${this.url.protocol} is not supported.`);
    }

    // Translate `Headers` into a plain object.
    if (options.headers && options.headers instanceof Headers) {
      options.headers = Object.fromEntries(options.headers);
    }

    this.#headers = options.headers ?? {};

    // Define defaut headers.
    this.#headers["Host"] = uri.host;
    this.#headers["Upgrade"] = "websocket";
    this.#headers["Connection"] = "Upgrade";
    this.#headers["Sec-WebSocket-Version"] = "13";
    const key = makeWebSocketKey();
    this.#headers["Sec-WebSocket-Key"] = key;
  
    // We add the authentication header, in case it was passed in the URL.
    const auth = (uri.username && uri.password) ? `${uri.username}:${uri.password}` : null;
    if (auth) {
      this.#headers["Authorization"] = `Basic ${Buffer.from(auth, 'utf8').toString('base64')}`
    }

    this.#pathname = this.url.pathname + this.url.search;
    const is_secure = this.url.protocol === "wss:";

    // Take the port from the `uri` if defined, else 443 if `wss:`, 80 for `ws:`.
    const port = this.url.port ? parseInt(this.url.port) : is_secure ? 443 : 80;
    
    this.extensions = "";

    this.#socket = is_secure
      ? tls.connect(port, this.url.hostname)
      : net.connect(port, this.url.hostname);

    // Connecting state.
    this.state = 0;

    this.#socket.on("data", (buffer: Buffer) => this.#onSocketData(buffer));
    this.#socket.on("connect", () => {
      // Connected state, send HTTP handshake.
      this.state = 1;
      this.#onSocketConnection()
    });
  }
  
  #onSocketConnection () {
    this.#socket.write(makeHttpHeaders(this.#pathname, this.#headers, ""));
  }

  #onSocketData (buffer: Buffer) {
    if (this.state === 1) {
      // This is the response of the HTTP handshake.
      const response = buffer.toString("utf8");
      this.emit("open");
      this.state = 2;
      return;
    }

    // const message = buffer.toJSON();
    console.log("\ngot message:", buffer.toString());
  }
}

export default TCPWebSocket;
