import express, { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
const app = express();
app.use(json({ limit: "100kb" })); //Converts incoming JSON data → JavaScript object so that we can use req.body
app.use(cookieParser()); //allow cookie acess
app.use(urlencoded({ extended: true, limit: "30kb" })); //allow fetch data from form-data
app.use(express.static("public")); //try to access static data/file from public folder
app.use(helmet()); //automatically add security headers
app.use(compression()); //reduces size of response thus increasing the speed

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, //tell who can access and send request to this server
    credentials: true, //allow sesitive data
  }),
);

import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import PageRoute from "./routes/page.route.js";
import CommentRoute from "./routes/comment.route.js"

app.use("/api/v1/users", userRoute);
app.use("/api/v1/posts", postRoute);
app.use("/api/v1/pages",PageRoute);
app.use("/api/v1/comments",CommentRoute);

export default app;
