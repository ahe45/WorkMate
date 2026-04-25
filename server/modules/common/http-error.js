function createHttpError(statusCode, message, code = "", details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

module.exports = {
  createHttpError,
};
