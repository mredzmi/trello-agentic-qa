import { NextResponse } from "next/server";

const TRELLO_API = "https://api.trello.com/1";
const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

async function trelloJson(path: string, init?: RequestInit) {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    throw new Error("Missing TRELLO_API_KEY or TRELLO_TOKEN");
  }

  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${TRELLO_API}${path}${separator}key=${encodeURIComponent(
      key
    )}&token=${encodeURIComponent(token)}`,
    { ...init, cache: "no-store" }
  );

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Trello API ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
}

async function generateTestCases(cardName: string, description: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const prompt = `You are an expert Senior QA Engineer and test automation architect.

Analyse this Trello user story and acceptance criteria.

CARD:
${cardName}

DESCRIPTION:
${description || "(No description provided)"}

Generate practical software test cases covering:
1. Positive scenarios
2. Negative scenarios
3. Validation and boundary cases
4. Regression considerations

Return concise Markdown suitable for posting directly as a Trello comment.

Use this structure:

## 🧪 AI Generated Test Cases

| ID | Scenario | Preconditions | Steps | Expected Result | Priority |
|---|---|---|---|---|---|

Then add a short "### QA Notes" section with important gaps, assumptions, or additional edge cases.

Do not invent application behaviour that is not supported by the story; clearly mark assumptions.`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input: prompt,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `OpenAI API ${res.status}: ${JSON.stringify(data)}`
    );
  }

  const output = Array.isArray(data.output)
    ? data.output
        .flatMap((item: any) => item.content || [])
        .filter((item: any) => item.type === "output_text")
        .map((item: any) => item.text)
        .join("\n")
        .trim()
    : "";

  if (!output) {
    throw new Error("OpenAI returned no text output");
  }

  return output;
}

export async function GET() {
  return new Response("Trello Agentic QA webhook is alive", { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  console.log("TRELLO_WEBHOOK", JSON.stringify(body));

  const action = body?.action;
  const actionType = action?.type;
  const labelName = action?.data?.label?.name;
  const cardName = action?.data?.card?.name;
  const cardId = action?.data?.card?.id;

  console.log(
    "TRELLO_ACTION",
    JSON.stringify({ actionType, labelName, cardName })
  );

  const isAiTest =
    actionType === "addLabelToCard" &&
    typeof labelName === "string" &&
    labelName.trim().toUpperCase().includes("AI-TEST");

  if (!isAiTest) {
    return NextResponse.json({ received: true, triggered: false });
  }

  console.log(
    "AI-TEST_TRIGGERED",
    JSON.stringify({ cardName, cardId, labelName })
  );

  try {
    if (!cardId) {
      throw new Error("Missing Trello card ID");
    }

    const card = await trelloJson(
      `/cards/${encodeURIComponent(cardId)}?fields=name,desc,url`
    );

    console.log(
      "AI_QA_CARD_LOADED",
      JSON.stringify({ cardId, name: card.name })
    );

    const testCases = await generateTestCases(
      card.name || cardName || "Untitled card",
      card.desc || ""
    );

    await trelloJson(
      `/cards/${encodeURIComponent(cardId)}/actions/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testCases,
        }),
      }
    );

    console.log(
      "AI_QA_COMMENT_POSTED",
      JSON.stringify({ cardId, cardName: card.name })
    );

    return NextResponse.json({
      received: true,
      triggered: true,
      ai: true,
      cardId,
      message: "AI test cases generated and posted to Trello",
    });
  } catch (error) {
    console.error("AI_QA_ERROR", error);

    return NextResponse.json(
      {
        received: true,
        triggered: true,
        ai: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
