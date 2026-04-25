async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch (error) {
    const parseError = new Error("JSON 본문을 해석할 수 없습니다.");
    parseError.cause = error;
    throw parseError;
  }
}

async function readBinaryBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

module.exports = {
  readBinaryBody,
  readJsonBody,
};
