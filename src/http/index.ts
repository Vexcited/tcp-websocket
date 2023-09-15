import HTTPParser from "./parser.js";

export const create_headers = (path: string, headers: Record<string, string>, body = ""): string => {
  const head = [
    `GET ${path} HTTP/1.1`,
    // Add every items from the headers object.
    ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),

    "", // There's a linebreak between the headers and the request's body. 

    body
  ];

  return head.join("\r\n");
};

export const read_response = (chunk: Buffer) => {
  const parser = new HTTPParser();
  const { consumed, informations } = parser.execute(chunk);
  
  if (consumed < chunk.length) {
    chunk = chunk.subarray(consumed);
  }
  else {
    chunk = Buffer.alloc(0);
  }

  return {
    informations,
    chunk
  }
}