import dotenv from "dotenv";
dotenv.config({ path: "./.env" }); //env should be configured during the server starting time

import { createServer } from "http";
import mongoose from "mongoose";

const [{ default: app }, { default: connectDB }, { initSocket, getIO }] =
  await Promise.all([
    import("./app.js"),
    import("./database/connectDB.js"),
    import("./socket.js"),
  ]);
const PORT = Number(process.env.PORT || 8000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

for (const secretName of [
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "RESET_SECRETKEY",
]) {
  const secret = process.env[secretName];
  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) {
    throw new Error(
      `${secretName} must be configured${process.env.NODE_ENV === "production" ? " with at least 32 characters" : ""}`,
    );
  }
}
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI must be configured");
}

const server = createServer(app);

const io = initSocket(server);
getIO.set(io);

server.once("error", async (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the process using it or set PORT to a free port.`,
    );
  } else {
    console.error("HTTP server failed to start:", error);
  }

  await mongoose.disconnect();
  process.exitCode = 1;
});

try {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`server is running at port: ${PORT}`);
  });
} catch (error) {
  console.error("MONGODB CONNECTION FAILED !!", error);
  await mongoose.disconnect();
  process.exitCode = 1;
}
