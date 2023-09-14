/// Basically a rewrite of <https://github.com/creationix/http-parser-js/blob/master/http-parser.js>
/// but in TypeScript with ES6 syntax and removed body parsing since we only need response headers for the websocket.

type StateFunctions = (
  | "RESPONSE_LINE"
  | "HEADER"
);

export interface ParseInformation {
  raw_headers: string[];
  headers: Record<string, string>
  upgrade: boolean;
  
  // filled on `RESPONSE_LINE()`
  versionMajor: number;
  versionMinor: number;
  statusCode: number;
  statusMessage: string;

  // filled somewhere
  method: typeof HTTPParser.methods[number];
  shouldKeepAlive: boolean
}

class HTTPParser {
  public static encoding: BufferEncoding = 'ascii';
  /** `maxHeaderSize` (in bytes) is configurable, but 80kb by default; */
  public static maxHeaderSize = 80 * 1024;

  public static methods = [
    'DELETE',
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'CONNECT',
    'OPTIONS',
    'TRACE',
    'COPY',
    'LOCK',
    'MKCOL',
    'MOVE',
    'PROPFIND',
    'PROPPATCH',
    'SEARCH',
    'UNLOCK',
    'BIND',
    'REBIND',
    'UNBIND',
    'ACL',
    'REPORT',
    'MKACTIVITY',
    'CHECKOUT',
    'MERGE',
    'M-SEARCH',
    'NOTIFY',
    'SUBSCRIBE',
    'UNSUBSCRIBE',
    'PATCH',
    'PURGE',
    'MKCALENDAR',
    'LINK',
    'UNLINK',
    'SOURCE',
  ] as const;

  private state: StateFunctions;
  private info: ParseInformation;

  private line: string;
  private isChunked: boolean;
  /** Value of the `Connection` header if provided. */
  private connection: string;
  /** For preventing too big headers. */
  private headerSize: number;
  private body_bytes: number | null;

  constructor () {
    this.state = "RESPONSE_LINE";

    // @ts-expect-error
    this.info = {
      raw_headers: [],
      headers: {},
      
      upgrade: false
    };

    this.line = '';
    this.isChunked = false;
    this.connection = '';
    this.headerSize = 0;
    this.body_bytes = null;
    
    // for `execute()`
    this.chunk = null;
  }

  private chunk: Buffer | null;
  private offset = 0;
  private end = 0;

  private headerState: Partial<Record<StateFunctions, boolean>> = {
    RESPONSE_LINE: true,
    HEADER: true
  };

  /** Parses the given `chunk`. */
  public execute (chunk: Buffer, start = 0, length = chunk.length): { consumed: number, informations: ParseInformation } {
    this.chunk = chunk;
    this.offset = start;
    this.end = this.offset + length;

    while (this.offset < this.end) {
      if (this[this.state]()) {
        break;
      }
    }

    this.chunk = null;
    length = this.offset - start;

    if (this.headerState[this.state]) {
      this.headerSize += length;
      if (this.headerSize > HTTPParser.maxHeaderSize) {
        throw new Error('max header size exceeded');
      }
    }

    return {
      consumed: length,
      informations: this.info
    };
  };

  private consumeLine () {
    const end = this.end;
    const chunk = this.chunk;

    if (!chunk) {
      throw new Error("empty chunk on consumeLine");
    }

    for (let i = this.offset; i < end; i++) {
      if (chunk[i] === 0x0a) { // \n
        let line = this.line + chunk.toString(HTTPParser.encoding, this.offset, i);
        if (line.charAt(line.length - 1) === '\r') {
          line = line.substring(0, line.length - 1);
        }

        this.line = '';
        this.offset = i + 1;

        return line;
      }
    }

    // line split over multiple chunks.
    this.line += chunk.toString(HTTPParser.encoding, this.offset, this.end);
    this.offset = this.end;
  };

  #response_exp = /^HTTP\/(\d)\.(\d) (\d{3}) ?(.*)$/;
  private RESPONSE_LINE (): void {
    const line = this.consumeLine();
    if (!line) {
      return;
    }

    const match = this.#response_exp.exec(line);
    if (!match) {
      throw new ParseError('HPE_INVALID_CONSTANT');
    }

    this.info.versionMajor = +match[1];
    this.info.versionMinor = +match[2];
    this.info.statusCode = +match[3];
    this.info.statusMessage = match[4];

    // Implied zero length.
    if ((this.info.statusCode / 100 | 0) === 1 || this.info.statusCode === 204 || this.info.statusCode === 304) {
      this.body_bytes = 0;
    }

    // We step over the next step: "HEADER".
    this.state = "HEADER";
  };

  #header_exp = /^([^: \t]+):[ \t]*((?:.*[^ \t])|)/;
  #header_continue_exp = /^[ \t]+(.*[^ \t])/;
  private parseHeader (line: string, headers: Array<string>) {
    if (line.indexOf('\r') !== -1) {
      throw new ParseError('HPE_LF_EXPECTED');
    }

    const match = this.#header_exp.exec(line);
    // headers key is always in lowercase in our implementation.
    const key = match && match[1].toLowerCase();
    
    if (key) { 
      const value = match[2]; 
      headers.push(key, value);
    }
    // Skip empty string (malformed header)
    else {
      const matchContinue = this.#header_continue_exp.exec(line);
      if (matchContinue && headers.length) {
        if (headers[headers.length - 1]) {
          headers[headers.length - 1] += ' ';
        }

        headers[headers.length - 1] += matchContinue[1];
      }
    }
  };

  private shouldKeepAlive (): boolean {
    if (this.info.versionMajor > 0 && this.info.versionMinor > 0) {
      if (this.connection.indexOf('close') !== -1) {
        return false;
      }
    }
    else if (this.connection.indexOf('keep-alive') === -1) {
      return false;
    }

    if (this.body_bytes !== null || this.isChunked) {
      return true;
    }

    return false;
  };

  private HEADER () {
    const line = this.consumeLine();
    if (typeof line === "undefined") return;

    if (line.length > 0) this.parseHeader(line, this.info.raw_headers);
    // Line is empty, means we're done parsing the headers.
    else {
      const list_headers = this.info.raw_headers;

      let hasContentLength = false;
      let currentContentLengthValue: number;
      let hasUpgradeHeader = false;

      for (let i = 0; i < list_headers.length; i += 2) {
        const key = list_headers[i]
        const value = list_headers[i + 1];

        this.info.headers[key] = value;
        
        switch (key) {
          case 'transfer-encoding':
            this.isChunked = value.toLowerCase() === 'chunked';
            break;
          case 'content-length':
            currentContentLengthValue = +value;
            if (hasContentLength) {
              // Fix duplicate Content-Length header with same values.
              // Throw error only if values are different.
              // Known issues:
              // https://github.com/request/request/issues/2091#issuecomment-328715113
              // https://github.com/nodejs/node/issues/6517#issuecomment-216263771
              if (currentContentLengthValue !== this.body_bytes) {
                throw new ParseError('HPE_UNEXPECTED_CONTENT_LENGTH');
              }
            }
            else {
              hasContentLength = true;
              this.body_bytes = currentContentLengthValue;
            }

            break;
          case 'connection':
            this.connection += value.toLowerCase();
            break;
          case 'upgrade':
            hasUpgradeHeader = true;
            break;
        }
      }
  
      // if both isChunked and hasContentLength, isChunked wins
      // This is required so the body is parsed using the chunked method, and matches
      // Chrome's behavior.  We could, maybe, ignore them both (would get chunked
      // encoding into the body), and/or disable shouldKeepAlive to be more
      // resilient.
      if (this.isChunked && hasContentLength) {
        hasContentLength = false;
        this.body_bytes = null;
      }
  
      // Logic from https://github.com/nodejs/http-parser/blob/921d5585515a153fa00e411cf144280c59b41f90/http_parser.c#L1727-L1737
      // "For responses, "Upgrade: foo" and "Connection: upgrade" are
      //   mandatory only when it is a 101 Switching Protocols response,
      //   otherwise it is purely informational, to announce support.
      if (hasUpgradeHeader && this.connection.indexOf('upgrade') !== -1) {
        this.info.upgrade = this.info.statusCode === 101;
      }
      else {
        this.info.upgrade = this.info.method === "CONNECT";
      }
  
      if (this.isChunked && this.info.upgrade) {
        this.isChunked = false;
      }
  
      this.info.shouldKeepAlive = this.shouldKeepAlive();
      return true;
    }
  };
}

export class ParseError extends Error {
  public code: string;

  constructor (code: string) {
    super("Parse error");
    this.code = code;
  }
}

export default HTTPParser;
