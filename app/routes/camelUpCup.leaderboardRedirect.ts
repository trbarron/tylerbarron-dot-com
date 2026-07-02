import { redirect } from "react-router";

// The live leaderboard briefly lived at /camel-up-cup/leaderboard before
// becoming the main /camel-up-cup page.
export function loader() {
  return redirect("/camel-up-cup", 301);
}
