import type { LoaderFunctionArgs } from "react-router";
import { isRedisAvailable } from "~/utils/redis.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const host =
        request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

    try {
        const url = new URL("/", `http://${host}`);
        // if we can connect to the database and make a simple query
        // and make a HEAD request to ourselves, then we're good.
        const [redisReady] = await Promise.all([
            isRedisAvailable(),
            fetch(url.toString(), { method: "HEAD" }).then((r) => {
                if (!r.ok) return Promise.reject(r);
            }),
        ]);

        if (!redisReady) {
            return new Response("Redis NOT READY", { status: 503 });
        }

        return new Response("OK");
    } catch (error: unknown) {
        console.log("healthcheck ❌", { error });
        return new Response("ERROR", { status: 500 });
    }
}
