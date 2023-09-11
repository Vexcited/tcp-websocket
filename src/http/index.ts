export const makeHttpHeaders = (path: string, headers: Record<string, string>, body = ""): string => {
  const head = [
    `GET ${path} HTTP/1.1`,
    // Add every items from the headers object.
    ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),

    "", // There's a linebreak between the headers and the request's body. 

    body
  ];

  return head.join("\r\n");
};
