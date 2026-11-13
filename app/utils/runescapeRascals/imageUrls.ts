// Where the live portraits and screenshots come from: the publisher uploads them to the bucket and
// sets `assetBase` in the snapshot (CloudFront serves it from this site's own /images/*). Without
// it the page shows its bundled portraits and no screenshots.
import type { Bot } from './types';

type Kind = 'head' | 'body';

/** One immutable object per view and version, so a new appearance is a new URL. */
export function portraitUrl(bot: Pick<Bot, 'name' | 'portraitVersion'>, kind: Kind, angle: number, assetBase: string) {
  return `${assetBase}/portraits/${bot.name}/${kind}-${angle}-${encodeURIComponent(bot.portraitVersion ?? '')}.png`;
}

/** The bucket copy is replaced in place; the timestamp makes browsers fetch the new one. */
export function shotUrl(bot: Pick<Bot, 'name' | 'shotAt'>, assetBase: string) {
  return `${assetBase}/shots/${bot.name}.jpg?t=${bot.shotAt}`;
}
