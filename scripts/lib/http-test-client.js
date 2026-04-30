async function readJsonPayload(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
}

function jsonHeaders(accessToken = "") {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function request(baseUrl, resource, options = {}) {
  const response = await fetch(`${baseUrl}${resource}`, options);
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(`${resource} failed: ${payload.message || payload.error || response.status}`);
  }

  return payload;
}

async function requestExpectError(baseUrl, resource, options = {}) {
  const response = await fetch(`${baseUrl}${resource}`, options);
  const payload = await readJsonPayload(response);

  if (response.ok) {
    throw new Error(`${resource} was expected to fail.`);
  }

  return {
    payload,
    status: response.status,
  };
}

module.exports = {
  jsonHeaders,
  request,
  requestExpectError,
};
