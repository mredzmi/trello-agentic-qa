import { NextResponse } from "next/server";

const TRELLO_API = "https://api.trello.com/1";

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

  if (actionType === "addLabelToCard" && labelName === "🤖 AI-TEST") {
    console.log(
      "AI-TEST_TRIGGERED",
      JSON.stringify({ cardName, cardId: action?.data?.card?.id })
    );
  }

  return NextResponse.json({ received: true });
}
