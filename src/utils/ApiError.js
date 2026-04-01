class ApiError extends Error {
  constructor(statuscode, message = "something went wrong", error = [], stack) {
    super(message);
    this.Error = error;
    this.message = message;
    this.statuscode;
    this.data = null;
    this.success = null;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ApiError;
