import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookie = req.headers.cookie || "";
  const token = cookie.split("token=")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!) as any;
    res.json({ ...user, points: 100 }); // mock ให้มี 100 แต้ม
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
