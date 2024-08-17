/// Resources used:
/// <https://github.com/nodejs/undici/blob/main/lib/websocket/websocket.js>

import crypto from "node:crypto";

import tls from "node:tls";
import net from "node:net";

import EventEmitter from "node:events";
import { create_headers, read_response } from "./http/index.js";

import Frame from "./websocket/frame.js";
import { isValidSubprotocol, maskPayload } from "./websocket/utils.js";
import StreamReader from "./streams/reader.js";
import { FRAME_DATA, OPCODE, ERRORS, FRAME_MAX_LENGTH, MESSAGE_OPCODES, OPENING_OPCODES, MIN_RESERVED_ERROR, MAX_RESERVED_ERROR, DEFAULT_ERROR_CODE, UTF8_MATCH } from "./websocket/constants.js";
import Message from "./websocket/message.js";

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

  constructor (url: string | URL, options: TCPWebSocketOptions = {}) {
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

  #stream_reader = new StreamReader()
  
  #stage = 0
  #onSocketData (data: Buffer) {
    if (this.readyState === TCPWebSocket.CONNECTING) {
      // This is the response of the HTTP handshake.
      const response = read_response(data);
      data = response.chunk;

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

    this.#stream_reader.put(data);
      
    let buffer: Buffer | null | true = true;
    
    while (buffer) {
      switch (this.#stage) {
        case 0:
          buffer = this.#stream_reader.read(1);
          if (buffer) this.#parseOpcode(buffer[0]);
          break;

        case 1:
          buffer = this.#stream_reader.read(1);
          if (buffer) this.#parseLength(buffer[0]);
          break;

        case 2:
          buffer = this.#stream_reader.read(this._frame!.lengthBytes);
          if (buffer) this.#parseExtendedLength(buffer);
          break;

        case 3:
          buffer = this.#stream_reader.read(4);
          if (buffer) {
            this.#stage = 4;
            this._frame!.maskingKey = buffer;
          }
          break;

        case 4:
          // `this._frame.length` since the rest of the buffer is the content/payload
          buffer = this.#stream_reader.read(this._frame!.length);
          if (buffer) {
            // since we read the entire buffer, we put back the stage to 0
            // to get ready to read (again from start) the next buffer.
            this.#stage = 0;
            // that's when we get the message in our TCPWebSocket.on("message")
            this.#emitFrame(buffer);
          }
          break;

        default:
          buffer = null;
      }
    }
  }

  private _frame: Frame | undefined
  #parseOpcode (octet: number): void {
    const rsvs = [FRAME_DATA.RSV1, FRAME_DATA.RSV2, FRAME_DATA.RSV3].map(rsv => (octet & rsv) === rsv);
  
    this._frame = new Frame();
  
    this._frame.final = (octet & FRAME_DATA.FIN) === FRAME_DATA.FIN;
    this._frame.opcode = (octet & FRAME_DATA.OPCODE);
    this._frame.rsv1 = rsvs[0];
    this._frame.rsv2 = rsvs[1];
    this._frame.rsv3 = rsvs[2];
  
    this.#stage = 1;
  
    // TODO: when we have extensions
    // if (!this._extensions.validFrameRsv(frame))
    //   return this._fail('protocol_error',
    //       'One or more reserved bits are on: reserved1 = ' + (frame.rsv1 ? 1 : 0) +
    //       ', reserved2 = ' + (frame.rsv2 ? 1 : 0) +
    //       ', reserved3 = ' + (frame.rsv3 ? 1 : 0));
  
    if (Object.values(OPCODE).indexOf(this._frame.opcode) < 0) {
      this.#fail(ERRORS.PROTOCOL_ERROR, `Unrecognized frame opcode: ${this._frame.opcode}`);
      return;
    }
  
    if (MESSAGE_OPCODES.indexOf(this._frame.opcode) < 0 && !this._frame.final) {
      this.#fail(ERRORS.PROTOCOL_ERROR, `Received fragmented control frame: opcode = ${this._frame.opcode}`);
      return;
    }
  
    if (this._message && OPENING_OPCODES.indexOf(this._frame.opcode) >= 0) {
      this.#fail(ERRORS.PROTOCOL_ERROR, 'Received new data frame but previous continuous frame is unfinished');
      return;
    }
  }

  #parseLength (octet: number): void {
    const frame = this._frame!;
    frame.masked = (octet & FRAME_DATA.MASK) === FRAME_DATA.MASK;
    frame.length = (octet & FRAME_DATA.LENGTH);

    if (frame.length >= 0 && frame.length <= 125) {
      this.#stage = frame.masked ? 3 : 4;
      if (!this.#checkFrameLength()) return;
    } else {
      this.#stage = 2;
      frame.lengthBytes = (frame.length === 126 ? 2 : 8);
    }

    // TODO: make requireMasking configurable
    const requireMasking = false;

    if (requireMasking && !frame.masked) {
      return this.#fail(ERRORS.UNACCEPTABLE, 'Received unmasked frame but masking is required');
    }
  }

  #parseExtendedLength (buffer: Buffer): void {
    const frame = this._frame!;
    frame.length = this.#readUInt(buffer);

    this.#stage = frame.masked ? 3 : 4;

    if (MESSAGE_OPCODES.indexOf(frame.opcode!) < 0 && frame.length > 125) {
      return this.#fail(ERRORS.PROTOCOL_ERROR, `Received control frame having too long payload: ${frame.length}`);
    }

    if (!this.#checkFrameLength()) return;
  }

  #checkFrameLength (): boolean {
    const length = this._message ? this._message.length : 0;

    if (length + this._frame!.length > FRAME_MAX_LENGTH) {
      this.#fail(ERRORS.TOO_LARGE, 'WebSocket frame length too large');
      return false;
    }

    return true;
  }

  private _message: Message | undefined
  #emitFrame (buffer: Buffer) {
    const frame  = this._frame!;
    const payload = frame.payload = maskPayload(buffer, frame.maskingKey);
    const opcode = frame.opcode;

    delete this._frame;

    if (opcode === OPCODE.CONTINUATION) {
      if (!this._message) {
        this.#fail(ERRORS.PROTOCOL_ERROR, 'Received unexpected continuation frame');
        return;
      }

      this._message.pushFrame(frame);
    }

    if (opcode === OPCODE.TEXT || opcode === OPCODE.BINARY) {
      this._message = new Message();
      this._message.pushFrame(frame);
    }

    // we emit the message
    if (this._message && frame.final && opcode && MESSAGE_OPCODES.indexOf(opcode) >= 0) {
      return this.#emitMessage(this._message);
    }
    
    if (opcode === OPCODE.CLOSE) {
      let code = (payload.length >= 2) ? payload.readUInt16BE(0) : null;
      const reason = (payload.length > 2) ? this.#encode(payload.subarray(2)) : null;

      if (
        payload.length !== 0
        && !(code && code >= MIN_RESERVED_ERROR && code <= MAX_RESERVED_ERROR)
        && (code && Object.values(ERRORS).indexOf(code) < 0)
      ) {
        code = ERRORS.PROTOCOL_ERROR;
      }

      if (payload.length > 125 || (payload.length > 2 && !reason)) {
        code = ERRORS.PROTOCOL_ERROR;
      }

      this.#shutdown(code ?? DEFAULT_ERROR_CODE, reason ?? "");
    }

    if (opcode === OPCODE.PING) {
      this.#frame(payload, OPCODE.PONG);
      this.emit('ping', { data: payload.toString() })
    }

    if (opcode === OPCODE.PONG) {
      this.emit('pong', { data: payload.toString() })
    }
  }

  #emitMessage (message: Message) {
    message.read();
    delete this._message;

    // this._extensions.processIncomingMessage(message, (error, message) => {
      // if (error) return this.#fail(ERRORS.EXTENSION_ERROR, error.message);

      let payload: Buffer | string | null = message.data!;
      if (message.opcode === OPCODE.TEXT) payload = this.#encode(payload);

      if (payload === null)
        return this.#fail(ERRORS.ENCODING_ERROR, 'Could not decode a text frame as UTF-8');
      else {
        super.emit('message', { data: payload });
      }
    // });
  }

  /** shutdown by sending an error. */
  #fail (error_code: ERRORS, message: string) {
    if (this.readyState > 1) return;
    this.#shutdown(error_code, message, true);
  }

  #shutdown (code: ERRORS, reason: string, is_error = false) {
    delete this._frame;
    delete this._message;
    this.#stage = 5;

    const sendCloseFrame = (this.readyState === TCPWebSocket.OPEN);
    this.readyState = TCPWebSocket.CLOSING;

    // this.#extensions.close(() => {
      if (sendCloseFrame) this.#frame(Buffer.from(reason), OPCODE.CLOSE, code);
      this.readyState = TCPWebSocket.CLOSED;
      
      if (is_error) this.emit('error', new Error(reason));
      super.emit('close', { code, reason });
    // });
  }

  #encode (buffer: Buffer) {
    try {
      const string = buffer.toString('binary', 0, buffer.length);
      if (!UTF8_MATCH.test(string)) return null;
    } catch {}

    return buffer.toString('utf8', 0, buffer.length);
  }

  #readUInt (buffer: Buffer) {
    if (buffer.length === 2) return buffer.readUInt16BE(0);
    return buffer.readUInt32BE(0) * 0x100000000 + buffer.readUInt32BE(4);
  }

  public send (data: string | TypedArray | ArrayBuffer | Blob): void {
    if (this.readyState === TCPWebSocket.CONNECTING) {
      throw new DOMException("connecting");
    }

    if (typeof data === "string") {
      let buffer = Buffer.from(data, "utf8");
      return this.#frame(buffer, OPCODE.TEXT);
    }
  }

  public ping (message: string | Buffer): void {
    if (this.readyState === TCPWebSocket.CONNECTING) {
      throw new DOMException("connecting");
    }

    if (typeof message === "string") {
      message = Buffer.from(message, "utf8");
    }

    return this.#frame(message, OPCODE.PING);
  }

  public pong (message: string | Buffer): void {
    if (this.readyState === TCPWebSocket.CONNECTING) {
      throw new DOMException("connecting");
    }

    if (typeof message === "string") {
      message = Buffer.from(message, "utf8");
    }

    return this.#frame(message, OPCODE.PONG);
  }

  public close (reason = "", code: number = ERRORS.NORMAL_CLOSURE): void {
    if (code !== ERRORS.NORMAL_CLOSURE && !(code >= 3000 && code < 5000)) {
      throw new DOMException("InvalidAccessError");
    }

    if (this.readyState === TCPWebSocket.CONNECTING) {
      this.readyState = TCPWebSocket.CLOSED;
      this.emit('close', { code, reason });
      this.#socket.end();
    }
    else if (this.readyState === TCPWebSocket.OPEN) {
      this.readyState = TCPWebSocket.CLOSING;
      // this.#extensions.close(() => {
        this.#frame(Buffer.from(reason, "utf8"), OPCODE.CLOSE, code);
      // });
    }
  }

  /** frame data, prepare message and send it to socket */
  #frame (buffer: Buffer, opcode: OPCODE, code?: number): void {
    // if (this.readyState <= 0) return this._queue([buffer, opcode, code]);
    if (this.readyState > 2) return;

    const message = new Message();
        
    message.rsv1 = message.rsv2 = message.rsv3 = false;
    message.opcode = opcode;
        
    let payload = buffer;

    if (typeof code === "number") {
      const payload_copy = payload;
      payload = Buffer.allocUnsafe(2 + payload_copy.length);
      payload.writeUInt16BE(code, 0);
      payload_copy.copy(payload, 2);
    }

    message.data = payload;

    // when the message is ready, we make a frame and send it to the socket.
    const onMessageReady = (message: Message) => {
      const frame = new Frame();

      frame.final   = true;
      frame.masked  = true; // we mask our messages by default
      frame.rsv1    = message.rsv1;
      frame.rsv2    = message.rsv2;
      frame.rsv3    = message.rsv3;
      frame.opcode  = message.opcode;
      frame.length  = message.data!.length;
      frame.payload = message.data!;

      frame.maskingKey = crypto.randomBytes(4);

      this.#sendFrame(frame);
    };

    if (MESSAGE_OPCODES.indexOf(message.opcode) >= 0) {
      // this._extensions.processOutgoingMessage(message, (error, message) => {
        // if (error) return this.#fail(ERRORS.EXTENSION_ERROR, error.message);
        onMessageReady(message)
      // });
    }
    else {
      onMessageReady(message);
    }
  }

  /** send the given frame to the socket. */
  #sendFrame (frame: Frame): void {
    const length = frame.length;
    const header = (length <= 125) ? 2 : (length <= 65535 ? 4 : 10);
    const offset = header + (frame.masked ? 4 : 0);
    let buffer = Buffer.allocUnsafe(offset + length);
    const masked = frame.masked ? FRAME_DATA.MASK : 0;

    buffer[0] = (frame.final ? FRAME_DATA.FIN : 0)
              | (frame.rsv1 ? FRAME_DATA.RSV1 : 0)
              | (frame.rsv2 ? FRAME_DATA.RSV2 : 0)
              | (frame.rsv3 ? FRAME_DATA.RSV3 : 0)
              | frame.opcode!;

    if (length <= 125) {
      buffer[1] = masked | length;
    }
    else if (length <= 65535) {
      buffer[1] = masked | 126;
      buffer.writeUInt16BE(length, 2);
    }
    else {
      buffer[1] = masked | 127;
      buffer.writeUInt32BE(Math.floor(length / 0x100000000), 2);
      buffer.writeUInt32BE(length % 0x100000000, 6);
    }

    frame.payload!.copy(buffer, offset);

    if (frame.masked) {
      frame.maskingKey?.copy(buffer, header);
      buffer = maskPayload(buffer, frame.maskingKey, offset);
    }

    this.#socket.write(buffer);
  }
}

export default TCPWebSocket;
