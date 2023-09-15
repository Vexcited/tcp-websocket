// Outside of this repository, replace "../src" with "tcp-websocket".
import TCPWebSocket from "../src";

const ws = new TCPWebSocket("wss://ws.postman-echo.com/raw");

ws.on("open", () => {
  console.info("[open]: connected !\n");
  
  const data = "hello world!";
  ws.send(data);
  console.info("[send::message]:", data);
});

ws.once("message", (event) => {
  console.info("[receive::message]:", event.data);

  console.info("\n[info]: will close in 5 seconds...");
  setTimeout(() => ws.close(), 5_000)
});

ws.on("close", (event) => {
  console.info(`[close(${event.code})]: ${event.reason || "[no reason provided]"}`)
});
