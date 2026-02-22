import { createHash, randomUUID } from "node:crypto";

export function createSyncHub() {
  const sseClients = new Map();
  const wsClients = new Set();

  const registerSseClient = (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const id = randomUUID();
    sseClients.set(id, res);
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, id })}\n\n`);

    const heartbeat = setInterval(() => {
      if (res.writableEnded) return;
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(id);
      try {
        res.end();
      } catch {
        // Ignore close race.
      }
    });
  };

  const attachWebSocketServer = (server, wsPath) => {
    server.on("upgrade", (req, socket, head) => {
      if (!req.url?.startsWith(wsPath)) return;
      if ((req.headers.upgrade || "").toLowerCase() !== "websocket") {
        socket.destroy();
        return;
      }

      const key = req.headers["sec-websocket-key"];
      if (!key || Array.isArray(key)) {
        socket.destroy();
        return;
      }

      const accept = createHash("sha1")
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "utf8")
        .digest("base64");

      socket.write(
        [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${accept}`,
          "\r\n"
        ].join("\r\n")
      );

      if (head && head.length) {
        // Ignore any unexpected buffered frames.
      }

      wsClients.add(socket);
      socket.on("close", () => wsClients.delete(socket));
      socket.on("error", () => wsClients.delete(socket));
      socket.on("end", () => wsClients.delete(socket));
      socket.on("data", (buffer) => {
        if (isCloseFrame(buffer)) {
          wsClients.delete(socket);
          try {
            socket.end();
          } catch {
            // Ignore close race.
          }
        }
      });
    });
  };

  const publish = (event) => {
    const payload = {
      id: randomUUID(),
      at: new Date().toISOString(),
      ...event
    };
    const serialized = JSON.stringify(payload);

    for (const [, res] of sseClients) {
      if (res.writableEnded) continue;
      res.write(`event: sync\ndata: ${serialized}\n\n`);
    }

    const wsFrame = encodeTextFrame(serialized);
    for (const client of wsClients) {
      if (client.destroyed || !client.writable) continue;
      client.write(wsFrame);
    }
  };

  return {
    registerSseClient,
    attachWebSocketServer,
    publish
  };
}

function encodeTextFrame(text) {
  const payload = Buffer.from(String(text || ""), "utf8");
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function isCloseFrame(buffer) {
  if (!buffer || buffer.length < 2) return false;
  const opcode = buffer[0] & 0x0f;
  return opcode === 0x08;
}
