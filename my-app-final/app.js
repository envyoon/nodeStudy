const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const cors = require('cors');                    
require('dotenv').config();

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const mainRouter  = require('./routes/mainRouter');
const authRouter  = require('./routes/authRouter');
const talkRouter  = require('./routes/talkRouter');
const payRouter   = require('./routes/payRouter');
const autoRouter  = require('./routes/autoRouter');

const app = express();

// ▼ 외부 오리진(프론트)이 따로 있으면 여기에 적어줘 (쉼표로 여러 개)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// HTTPS 프록시(예: nginx) 뒤에 있으면 secure 쿠키 쓰려면 필요
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// 공통 미들웨어
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 정적
app.use(express.static(path.join(__dirname, 'public')));

// ★ REST도 다른 오리진에서 칠 수 있게 CORS 허용
if (ALLOWED_ORIGINS.length) {
  app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }));
}

// ★ 세션 미들웨어 (socket.io에서 공유할 거라 변수로 뺌)
const cross = ALLOWED_ORIGINS.length > 0; // 교차 오리진인지 여부
const sessionMiddleware = session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // 교차 오리진이면 SameSite=None; Secure(HTTPS 필요)
    sameSite: cross ? 'none' : 'lax',
    secure: cross ? true : false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

// 라우터
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/main', mainRouter);
app.use('/auth', authRouter);
app.use('/talk', talkRouter);
app.use('/pay', payRouter);
app.use('/auto', autoRouter);

// 404
app.use(function (req, res, next) { next(createError(404)); });

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = { app, sessionMiddleware };
