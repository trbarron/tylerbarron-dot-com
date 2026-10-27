// Where the live portraits and screenshots come from. A publisher that uploads them to the bucket
// sets `assetBase` in the snapshot (CloudFront serves it from this site's own /images/*); an older
// one leaves it out and they are read from Redis through the API routes.
import type { Bot } from './types';

type Kind = 'head' | 'body';

export function portraitUrl(bot: Pick<Bot, 'name' | 'portraitVersion'>, kind: Kind, angle: number, assetBase?: string) {
  const version = bot.portraitVersion ?? '';
  if (assetBase && version)
    return `${assetBase}/portraits/${bot.name}/${kind}-${angle}-${encodeURIComponent(version)}.png`;
  return `/api/runescapeRascals/portrait/${bot.name}/${kind}?v=${encodeURIComponent(version)}${angle ? `&a=${angle}` : ''}`;
}

export function shotUrl(bot: Pick<Bot, 'name' | 'shotAt'>, assetBase?: string) {
  // The bucket copy is replaced in place; the timestamp makes browsers fetch the new one.
  return assetBase
    ? `${assetBase}/shots/${bot.name}.jpg?t=${bot.shotAt}`
    : `/api/runescapeRascals/shot/${bot.name}?t=${bot.shotAt}`;
}
