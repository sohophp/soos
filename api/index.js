import { handleRequest } from "../server/api.js";

export default function handler(req, res) {
  return handleRequest(req, res);
}

