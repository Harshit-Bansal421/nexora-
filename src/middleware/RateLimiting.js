import rateLimit from "express-rate-limit";

class Limiter {
  constructor() {}

  authLimiter() {
    return rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      message: {
        message: "too many request",
      },
      keyGenerator: (req) =>
        req._id || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });
  }

  writeLimiter() {
    return rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      message: { message: "Too many actions, slow down" },
      keyGenerator: (req) => req.user?._id || req.ip,
    });
  }

  readLimiter() {
    return rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      message: { message: "Too many requests" },
      keyGenerator: (req) => req.user?._id || req.ip,
    });
  }

  sensitiveLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 3,
      message: { message: "Too many attempts, try later" },
      keyGenerator: (req) =>
        req.user?._id ? `user-${req.user._id}` : `ip-${req.ip}`,
    });
  }
}

export default new Limiter();
