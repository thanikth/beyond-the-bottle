import type { NextApiRequest, NextApiResponse } from "next";
import { getLineLoginUrl } from "@/lib/lineAuth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = getLineLoginUrl();
  res.redirect(url);
}
