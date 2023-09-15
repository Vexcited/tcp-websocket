/**
 * @see https://github.com/nodejs/undici/blob/main/lib/websocket/util.js#L111
 * @see https://datatracker.ietf.org/doc/html/rfc6455
 * @see https://datatracker.ietf.org/doc/html/rfc2616
 * @see https://bugs.chromium.org/p/chromium/issues/detail?id=398407
 */
export const isValidSubprotocol = (protocol: string) => {
  // If present, this value indicates one
  // or more comma-separated subprotocol the client wishes to speak,
  // ordered by preference.  The elements that comprise this value
  // MUST be non-empty strings with characters in the range U+0021 to
  // U+007E not including separator characters as defined in
  // [RFC2616] and MUST all be unique strings.
  if (protocol.length === 0) {
    return false
  }

  for (const char of protocol) {
    const code = char.charCodeAt(0)

    if (
      code < 0x21 ||
      code > 0x7E ||
      char === '(' ||
      char === ')' ||
      char === '<' ||
      char === '>' ||
      char === '@' ||
      char === ',' ||
      char === ';' ||
      char === ':' ||
      char === '\\' ||
      char === '"' ||
      char === '/' ||
      char === '[' ||
      char === ']' ||
      char === '?' ||
      char === '=' ||
      char === '{' ||
      char === '}' ||
      code === 32 || // SP
      code === 9 // HT
    ) {
      return false
    }
  }

  return true
}

export const maskPayload = (payload: Buffer, mask: Buffer | null, offset?: number) => {
  if (!mask || mask.length === 0) return payload;
  offset = offset || 0;

  for (let i = 0, n = payload.length - offset; i < n; i++) {
    payload[offset + i] = payload[offset + i] ^ mask[i % 4];
  }
  
  return payload;
};