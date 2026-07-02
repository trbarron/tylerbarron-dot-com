// GET /api/camelUpCup/status?id=sub-... — poll a submission's progress.
//
// The tournament Lambda writes status JSON to the CDN (no-cache); this proxy
// adds a "queued" phase before the first write lands and releases the
// single-tournament Redis lock once a terminal phase is observed.

import type { LoaderFunctionArgs } from "react-router";
import { getRedisClient } from "~/utils/redis.server";
import {
  fetchStatus,
  releaseTournamentLock,
} from "~/utils/camelUpCup/tournament.server";

const ID_RE = /^sub-[a-z0-9-]{4,40}$/;
const TERMINAL_PHASES = new Set(["complete", "rejected", "error"]);

export async function loader({ request }: LoaderFunctionArgs) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) {
    return Response.json({ error: "Invalid submission id." }, { status: 400 });
  }

  try {
    const status = await fetchStatus(request, id);

    if (status) {
      if (TERMINAL_PHASES.has(status.phase)) {
        await releaseTournamentLock(id);
      }
      return Response.json(status, {
        headers: { "cache-control": "no-store" },
      });
    }

    // No status file yet — known submission still spinning up, or unknown id.
    const meta = await getRedisClient()
      .get(`camelup:submission:${id}`)
      .catch(() => null);
    if (meta) {
      const { botName } = JSON.parse(meta);
      return Response.json(
        { id, phase: "queued", botName, gamesDone: 0, totalGames: null },
        { headers: { "cache-control": "no-store" } }
      );
    }
    return Response.json({ error: "Unknown submission." }, { status: 404 });
  } catch (error) {
    console.error("Camel Up Cup status error:", error);
    return Response.json({ error: "Failed to fetch status." }, { status: 500 });
  }
}
