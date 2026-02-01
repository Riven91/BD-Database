"use client";

export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers || {});
  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
