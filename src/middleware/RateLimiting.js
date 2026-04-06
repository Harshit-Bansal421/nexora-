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
      keyGenerator: (req) => req._id || req.headers["x-forwarded-for"] || req.socket.remoteAddress
    });
  }
}

export default new Limiter();

