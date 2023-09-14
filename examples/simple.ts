/** Replace "../src" with "tcp-websocket". */
import TCPWebSocket from "../src";

const ws = new TCPWebSocket("wss://echo-websocket.hoppscotch.io", {
  headers: { Origin: "https://hoppscotch.io" }
});

ws.on("open", () => {
  console.info("[open]: Connected !");
});

ws.on("message", (event) => {
  console.info("[message]:", event.data);
});
