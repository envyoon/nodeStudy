// socket/index.js
const { Server } = require("socket.io");

module.exports = (server, { sessionMiddleware }) => {
  const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true, // 개발은 true도 OK
      credentials: true,
    },
  });

  // 세션 공유
  io.engine.use(sessionMiddleware);

  // 인메모리 접속수(샘플)
  let online = 0;

  io.on("connection", (socket) => {
    online++;
    io.emit("presence", { online });

    socket.on("chat:message", (payload) => {
      const who = socket.request?.session?.user?.email || socket.request?.session?.kakao?.user?.kakao_account?.email || "User";
      socket.broadcast.emit("chat:message", {
        text: String(payload?.text || ""),
        who,
        time: new Date().toLocaleTimeString().slice(0, 5),
      });
    });

    socket.on("chat:typing", (on) => {
      const who = socket.request?.session?.user?.email || socket.request?.session?.kakao?.user?.kakao_account?.email || "상대";
      socket.broadcast.emit("chat:typing", { who, typing: !!on });
    });

    socket.on("disconnect", () => {
      online = Math.max(0, online - 1);
      io.emit("presence", { online });
    });
  });

  return io;
};
