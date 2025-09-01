import type { NextApiRequest, NextApiResponse } from "next";
import { getToken, getProfile } from "@/lib/lineAuth";
import jwt from "jsonwebtoken";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "No code" });
  }

  try {
    const tokenData = await getToken(code);
    const profile = await getProfile(tokenData.access_token);

    // mock: เก็บเป็น cookie JWT
    const jwtToken = jwt.sign(profile, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    res.setHeader(
      "Set-Cookie",
      `token=${jwtToken}; HttpOnly; Path=/; Max-Age=3600`
    );

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
}
