import { NextResponse } from "next/server";

const TRELLO_API = "https://api.trello.com/1";
const BOARD_SHORTLINK = "xTd2QZ21";
const CALLBACK_URL = "https://trelloscan.vercel.app/api/trello-webhook";

async function readTrello(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function GET() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;

  if (!key || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing TRELLO_API_KEY or TRELLO_TOKEN" },
      { status: 500 }
    );
  }

  const auth = `key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;

  try {
    // Resolve the board from the authenticated user's boards first.
    const boardsRes = await fetch(
      `${TRELLO_API}/members/me/boards?fields=name,url,shortLink&${auth}`,
      { cache: "no-store" }
    );
    const boards = await readTrello(boardsRes);

    if (!boardsRes.ok || !Array.isArray(boards)) {
      return NextResponse.json(
        { ok: false, step: "list-boards", trello: boards },
        { status: boardsRes.status || 502 }
      );
    }

    const board = boards.find((b: any) => b.shortLink === BOARD_SHORTLINK);

    if (!board) {
      return NextResponse.json(
        {
          ok: false,
          step: "find-board",
          error: `Board ${BOARD_SHORTLINK} was not found for this Trello token.`,
          boards: boards.map((b: any) => ({
            id: b.id,
            name: b.name,
            shortLink: b.shortLink,
          })),
        },
        { status: 404 }
      );
    }

    const existingRes = await fetch(
      `${TRELLO_API}/boards/${board.id}/webhooks?${auth}`,
      { cache: "no-store" }
    );
    const existing = await readTrello(existingRes);

    if (existingRes.ok && Array.isArray(existing)) {
      const found = existing.find(
        (w: any) => w.callbackURL === CALLBACK_URL && w.idModel === board.id
      );

      if (found) {
        return NextResponse.json({
          ok: true,
          message: "Webhook already exists",
          webhookId: found.id,
          boardId: board.id,
          boardName: board.name,
          callbackURL: CALLBACK_URL,
        });
      }
    }

    const createRes = await fetch(`${TRELLO_API}/webhooks?${auth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callbackURL: CALLBACK_URL,
        idModel: board.id,
        active: true,
        desc: "Agentic QA - Trello AI-TEST webhook",
      }),
    });

    const created = await readTrello(createRes);

    if (!createRes.ok) {
      return NextResponse.json(
        { ok: false, step: "create-webhook", trello: created },
        { status: createRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Webhook created",
      webhookId: created.id,
      boardId: board.id,
      boardName: board.name,
      callbackURL: CALLBACK_URL,
    });
  } catch (error) {
    console.error("TRELLO_WEBHOOK_SETUP_ERROR", error);
    return NextResponse.json(
      { ok: false, error: "Webhook setup failed" },
      { status: 500 }
    );
  }
}
