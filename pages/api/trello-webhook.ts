import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).send("Trello Agentic QA webhook is alive");
  }

  if (req.method === "POST") {
    console.log("TRELLO_WEBHOOK", JSON.stringify(req.body ?? {}));
    return res.status(200).json({ received: true });
  }

  res.setHeader("Allow", ["GET", "HEAD", "POST"]);
  return res.status(405).end("Method Not Allowed");
}
