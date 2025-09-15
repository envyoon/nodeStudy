const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
require("dotenv").config();

const mainRouter = require("./routes/mainRouter");
const authRouter = require("./routes/authRouter");
const talkRouter = require("./routes/talkRouter");
const payRouter = require("./routes/payRouter");
const autoRouter = require("./routes/autoRouter");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// 공통 미들웨어
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const sessionMiddleware = session({
  name: "sid",
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

// 라우터
app.use("/main", mainRouter);
app.use("/auth", authRouter);
app.use("/talk", talkRouter);
app.use("/pay", payRouter);
app.use("/auto", autoRouter);

// 404
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = { app, sessionMiddleware };
