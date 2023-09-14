/// Resources used
/// https://github.com/nodejs/undici/blob/main/lib/websocket/constants.js

/**
 * Globally Unique IDentifier unique used
 * to validate that the endpoint accepts websocket connections.
 * @see <https://www.rfc-editor.org/rfc/rfc6455.html#section-1.3>
 */
export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export const staticPropertyDescriptors: PropertyDescriptor = {
  enumerable: true,
  writable: false,
  configurable: false
}

export enum OPCODE {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xA
}

export const MESSAGE_OPCODES = [
  OPCODE.CONTINUATION,
  OPCODE.TEXT,
  OPCODE.BINARY
];

export const OPENING_OPCODES = [
  OPCODE.TEXT,
  OPCODE.BINARY
]

export enum FRAME_DATA {
  FIN = 0x80,
  MASK = 0x80,
  RSV1 = 0x40,
  RSV2 = 0x20,
  RSV3 = 0x10,
  OPCODE = 0x0F,
  LENGTH = 0x7F
}

export enum ERRORS {
  NORMAL_CLOSURE = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNACCEPTABLE = 1003,
  ENCODING_ERROR = 1007,
  POLICY_VIOLATION = 1008,
  TOO_LARGE = 1009,
  EXTENSION_ERROR = 1010,
  UNEXPECTED_CONDITION = 1011
}

export const symbols = {
  kWebSocketURL: Symbol('url'),
  kReadyState: Symbol('ready state'),
  kController: Symbol('controller'),
  kResponse: Symbol('response'),
  kBinaryType: Symbol('binary type'),
  kSentClose: Symbol('sent close'),
  kReceivedClose: Symbol('received close'),
  kByteParser: Symbol('byte parser')
}

// This is 64MB, small enough for an average VPS to handle without
// crashing from process out of memory
export const FRAME_MAX_LENGTH = 0x3ffffff;

export const DEFAULT_ERROR_CODE = 1000;
export const MIN_RESERVED_ERROR = 3000;
export const MAX_RESERVED_ERROR = 4999;

// http://www.w3.org/International/questions/qa-forms-utf-8.en.php
export const UTF8_MATCH = /^([\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})*$/;
