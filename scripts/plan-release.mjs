import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import semanticRelease from 'semantic-release';

// Use the API's structured result, rather than parsing human-readable logs.
export async function planRelease(currentVersion, release = semanticRelease) {
  const result = await release({ dryRun: true });
  return { version: result?.nextRelease?.version ?? currentVersion, release: Boolean(result?.nextRelease) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const plan = await planRelease(pkg.version);
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan.version}\nrelease=${plan.release}\n`);
  console.log(`Build version: ${plan.version}${plan.release ? ' (release after deploy)' : ' (unchanged)'}`);
}
