import WebSocket from "tcp-websocket";

const ws = new WebSocket("wss://ws.postman-echo.com/raw");
console.info("connecting...");

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
