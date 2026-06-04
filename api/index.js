import { handleRequest } from "../server/api.js";

export default function handler(req, res) {
  const path = Array.isArray(req.query?.path) ? req.query.path.join("/") : req.query?.path;
  if (path) {
    const url = new URL(req.url || "/api/index", "http://127.0.0.1");
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    req.url = `/api/${String(path).replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
  }
  return handleRequest(req, res);
}
