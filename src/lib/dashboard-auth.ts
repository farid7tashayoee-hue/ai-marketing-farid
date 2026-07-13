import type { NextRequest } from "next/server";

export function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${process.env.DASHBOARD_PASSWORD}`;
}
