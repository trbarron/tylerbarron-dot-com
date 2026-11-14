import BookClubPage from '~/components/BookClub/BookClubPage';
export { meta, headers } from './bookClub';
export default function HostPage() {
  return <BookClubPage host />;
}
