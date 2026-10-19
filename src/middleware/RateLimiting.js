import rateLimit, { ipKeyGenerator } from "express-rate-limit";

class Limiter {
  constructor() {
    this.limiters = new Map();
  }

  getLimiter(name, { windowMs, max, byUser = false }) {
    if (!this.limiters.has(name)) {
      this.limiters.set(
        name,
        rateLimit({
          windowMs,
          limit: max,
          standardHeaders: "draft-8",
          legacyHeaders: false,
          identifier: name,
          keyGenerator: (req) =>
            byUser && req.user?._id
              ? `user:${req.user._id}`
              : ipKeyGenerator(req.ip),
          handler: (req, res) =>
            res.status(429).json({
              statuscode: 429,
              data: null,
              message: "Too many requests. Please try again later.",
              status: false,
            }),
        }),
      );
    }
    return this.limiters.get(name);
  }

  authLimiter() {
    return this.getLimiter("auth", { windowMs: 60 * 1000, max: 10 });
  }

  writeLimiter() {
    return this.getLimiter("write", {
      windowMs: 60 * 1000,
      max: 20,
      byUser: true,
    });
  }

  readLimiter() {
    return this.getLimiter("read", {
      windowMs: 60 * 1000,
      max: 100,
      byUser: true,
    });
  }

  sensitiveLimiter() {
    return this.getLimiter("sensitive", {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
  }
}

export default new Limiter();
