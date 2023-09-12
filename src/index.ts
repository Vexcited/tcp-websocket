/// Resources used:
/// <https://github.com/nodejs/undici/blob/main/lib/websocket/websocket.js>

import crypto from "node:crypto";

import tls from "node:tls";
import net from "node:net";

import { EventEmitter } from "node:stream";
import { create_headers, read_response } from "./http";
import { opcodes } from "./websocket/constants";
import { WebsocketFrameSend } from "./websocket/frame";
import { isValidSubprotocol } from "./websocket/utils";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface TCPWebSocketOptions {
  headers?: Headers | Record<string, string>;
  protocols?: string | string[];
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
  #key: string;

  // public readonly extensions: string;
  public readyState: number;

  #bufferedAmount = 0;

  constructor (url: string | URL, options: TCPWebSocketOptions) {
    super();

    // We transform the string into an URL
    if (typeof url === "string") {
      try {
        url = new URL(url);
      }
      catch (e) {
        // If converting `url` from string to URL is failure,
        // then throw a "SyntaxError" DOMException.
        throw new DOMException(e as string, 'SyntaxError');
      }
    }

    // If scheme is "http", set scheme to "ws".
    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    }
    // Otherwise, if scheme is "https", set scheme to "wss".
    else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }

    // We check the validity of the URL.
    // If fail, we throw a "SyntaxError" DOMException.
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new DOMException(
        `Expected a ws: or wss: protocol, got ${url.protocol}`,
        "SyntaxError"
      );
    }

    // When fragment is non-null, throw a "SyntaxError" DOMException.
    // See: <https://www.rfc-editor.org/rfc/rfc6455#section-3:~:text=MUST%20NOT%20be%20used%20on%20these%20URIs>
    if (url.hash || url.href.endsWith('#')) {
      throw new DOMException(
        "Got fragment",
        'SyntaxError'
      )
    }

    // If protocols is a string, set protocols to a sequence consisting of just that string.
    if (typeof options.protocols === 'string') {
      options.protocols = [options.protocols]
    }
    else if (typeof options.protocols === "undefined") {
      options.protocols = [];
    }

    // Throw if any of the values in protocols occur more than once.
    if (options.protocols.length !== new Set(options.protocols.map(p => p.toLowerCase())).size) {
      throw new DOMException('Invalid Sec-WebSocket-Protocol value', 'SyntaxError')
    }

    // Throw if protocols fail to match the requirements for elements
    // that comprise the value of `Sec-WebSocket-Protocol` fields defined.
    if (options.protocols.length > 0 && !options.protocols.every(p => isValidSubprotocol(p))) {
      throw new DOMException('Invalid Sec-WebSocket-Protocol value', 'SyntaxError')
    }

    this.url = url;

    // We now process to establish the connection to the socket
    // to make the handshake request.

    // Translate `Headers` into a plain object.
    if (options.headers && options.headers instanceof Headers) {
      options.headers = Object.fromEntries(options.headers);
    }

    this.#headers = options.headers ?? {};

    // Define defaut headers.
    this.#headers["Host"] = this.url.host;
    this.#headers["Upgrade"] = "websocket";
    this.#headers["Connection"] = "Upgrade";
    this.#headers["Sec-WebSocket-Version"] = "13";

    /**
     * We create and set the key for the websocket
     * > Nonce consisting of a randomly selected
     * > 16-byte value that has been forgiving-base64-encoded and
     * > isomorphic encoded.
     */
    this.#key = crypto.randomBytes(16).toString('base64');
    this.#headers["Sec-WebSocket-Key"] = this.#key;
  
    // TODO: We add the authentication header, in case it was passed in the URL.
    // const auth = (this.url.username && this.url.password) ? `${this.url.username}:${this.url.password}` : null;
    // if (auth) {
    //   this.#headers["Authorization"] = `Basic ${Buffer.from(auth, 'utf8').toString('base64')}`
    // }

    this.#pathname = this.url.pathname + this.url.search;
    const is_secure = this.url.protocol === "wss:";

    // Take the port from the `uri` if defined, else 443 if `wss:`, 80 for `ws:`.
    const port = this.url.port ? parseInt(this.url.port) : is_secure ? 443 : 80;
    
    this.#socket = is_secure
      ? tls.connect(port, this.url.hostname)
      : net.connect(port, this.url.hostname);

    this.readyState = TCPWebSocket.CONNECTING;

    this.#socket.on("data", (buffer: Buffer) => {
      this.#onSocketData(buffer);
    });

    this.#socket.on("connect", () => {
      if (this.readyState !== TCPWebSocket.CONNECTING) return;

      // Connected, send HTTP handshake.
      this.#socket.write(create_headers(this.#pathname, this.#headers, ""));
    });
  }

  #onSocketData (buffer: Buffer) {
    if (this.readyState === TCPWebSocket.CONNECTING) {
      // This is the response of the HTTP handshake.
      const response = read_response(buffer);
      buffer = response.chunk;

      if (response.informations.statusCode !== 101) {
        throw new Error("expected status code 101");
        // TODO: abort
      }

      if (!response.informations.upgrade) {
        throw new Error("not an upgrade");
        // TODO: abort
      }

      // const digest = createHash('sha1')
      //   .update(this.#key + WS_GUID)
      //   .digest('base64');

      // if (response.headers.get("sec-websocket-accept") !== digest) {
      //   throw new Error("Invalid Sec-WebSocket-Accept header");
      //   // TODO: abort
      // }

      this.readyState = TCPWebSocket.OPEN;
      super.emit("open", response.informations);
    }

    super.emit("message", buffer);
  }

  public send (message: string) {
    if (typeof message === "string") {
      const value = Buffer.from(message);
      const frame = new WebsocketFrameSend(value);
      const buffer = frame.createFrame(opcodes.TEXT);

      this.#bufferedAmount += value.byteLength
      this.#socket.write(buffer, () => {
        this.#bufferedAmount -= value.byteLength
      })
    }
  }
}

export default TCPWebSocket;
