import express, { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import ApiError from "./utils/ApiError.js";
import { isOriginAllowed } from "./utils/originPolicy.js";
const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
}

app.set("trust proxy", trustProxyHops);
app.disable("x-powered-by");
app.use(helmet());
app.use(compression());
app.use(json({ limit: "100kb" }));
app.use(cookieParser());
app.use(urlencoded({ extended: false, limit: "30kb", parameterLimit: 100 }));

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "Origin is not allowed"));
    },
    credentials: true,
  }),
);

import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import PageRoute from "./routes/page.route.js";
import CommentRoute from "./routes/comment.route.js";
import notificationRoute from "./routes/notification.route.js";

app.use("/api/v1/users", userRoute);
app.use("/api/v1/posts", postRoute);
app.use("/api/v1/pages", PageRoute);
app.use("/api/v1/comments", CommentRoute);
app.use("/api/v1/notifications", notificationRoute);

app.use((req, res, next) => {
  next(new ApiError(404, "Route not found"));
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const statusCode =
    Number.isInteger(error.statuscode) && error.statuscode >= 400
      ? error.statuscode
      : error.name === "MulterError"
        ? error.code === "LIMIT_FILE_SIZE"
          ? 413
          : 400
        : error.name === "ValidationError" ||
            error.name === "CastError" ||
            error.type === "entity.parse.failed"
          ? 400
          : error.code === 11000
            ? 409
      : Number.isInteger(error.status) && error.status >= 400
        ? error.status
        : 500;
  const message =
    statusCode >= 500
      ? "Internal server error"
      : error.message || "Request failed";

  if (statusCode >= 500) {
    console.error("Unhandled request error:", error);
  }

  return res.status(statusCode).json({
    statuscode: statusCode,
    data: null,
    message,
    status: false,
  });
});

export default app;
