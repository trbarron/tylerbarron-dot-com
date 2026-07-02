// POST /api/camelUpCup/submit — multipart form: botName, author, file (.py)
//
// Fast-fails obviously invalid bots, rate-limits by IP, takes the
// single-tournament Redis lock, and dispatches the code to the
// camel-up-tournament Lambda for real validation + a 500-game run.
// Responds with { id } for the client to poll /api/camelUpCup/status.

import type { ActionFunctionArgs } from "react-router";
import { getRedisClient } from "~/utils/redis.server";
import {
  validateAuthor,
  validateBotCode,
  validateBotName,
  MAX_BOT_FILE_BYTES,
} from "~/utils/camelUpCup/validation.server";
import {
  checkSubmissionRateLimit,
  dispatchSubmission,
  isTournamentConfigured,
  releaseTournamentLock,
  tryAcquireTournamentLock,
} from "~/utils/camelUpCup/tournament.server";

const META_TTL_S = 7 * 24 * 3600;

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BOT_FILE_BYTES + 4096) {
    return Response.json({ error: "Bot file is too large (max 64 KB)." }, { status: 413 });
  }

  if (!isTournamentConfigured()) {
    return Response.json(
      { error: "Bot submissions aren't available in this environment." },
      { status: 503 }
    );
  }

  try {
    const form = await request.formData();
    const botName = form.get("botName");
    const author = form.get("author");
    const file = form.get("file");

    const nameError = validateBotName(botName);
    if (nameError) return Response.json({ error: nameError }, { status: 400 });

    const authorError = validateAuthor(author);
    if (authorError) return Response.json({ error: authorError }, { status: 400 });

    if (!(file instanceof File)) {
      return Response.json({ error: "Attach your bot as a .py file." }, { status: 400 });
    }
    const code = await file.text();
    const codeErrors = validateBotCode(code);
    if (codeErrors.length > 0) {
      return Response.json({ error: codeErrors.join(" ") }, { status: 400 });
    }

    if (!(await checkSubmissionRateLimit(request))) {
      return Response.json(
        { error: "Too many submissions from your address — try again in an hour." },
        { status: 429 }
      );
    }

    const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (!(await tryAcquireTournamentLock(request, id))) {
      return Response.json(
        { error: "A tournament is already running. Try again once it finishes (~1 hour)." },
        { status: 409 }
      );
    }

    try {
      await dispatchSubmission({
        id,
        botName: botName as string,
        author: (author as string).trim(),
        code,
      });
    } catch (err) {
      await releaseTournamentLock(id);
      console.error("Camel Up Cup dispatch error:", err);
      return Response.json(
        { error: "Couldn't start the tournament — try again shortly." },
        { status: 502 }
      );
    }

    // Poll fallback: lets /status answer "queued" before the Lambda's first
    // status write lands on the CDN.
    try {
      await getRedisClient().setex(
        `camelup:submission:${id}`,
        META_TTL_S,
        JSON.stringify({ botName, author, submitted: Date.now() })
      );
    } catch {
      // Non-fatal: status polling just starts a beat later.
    }

    return Response.json({ id });
  } catch (error) {
    console.error("Camel Up Cup submit error:", error);
    return Response.json({ error: "Failed to submit bot." }, { status: 500 });
  }
}
