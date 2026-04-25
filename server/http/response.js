function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id",
  };
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    ...getCorsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendBinary(response, statusCode, headers, payload) {
  const contentLength =
    typeof payload === "string"
      ? Buffer.byteLength(payload)
      : Buffer.isBuffer(payload) || payload instanceof Uint8Array
        ? payload.byteLength
        : null;

  response.writeHead(statusCode, {
    ...getCorsHeaders(),
    ...(Number.isFinite(contentLength) ? { "Content-Length": String(contentLength) } : {}),
    ...headers,
  });
  response.end(payload);
}

module.exports = {
  getCorsHeaders,
  sendBinary,
  sendJson,
};
