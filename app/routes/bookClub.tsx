import { buildMeta } from '~/utils/seo';
export const meta = () =>
  buildMeta({
    title: 'Book Club',
    description: 'Choose your club’s next read. Two upvotes, one downvote.',
    noIndex: true,
  });
export const headers = () => ({
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
});
export { default } from '~/components/BookClub/BookClubPage';
