import type { LinksFunction } from '@remix-run/node';
import Chessboard from '~/components/Chessboard';
import chessgroundBase from '../styles/chessground.base.css';
import chessgroundBrown from '../styles/chessground.brown.css';
import chessgroundCburnett from '../styles/chessground.cburnett.css';

export const links: LinksFunction = () => [
    { rel: 'stylesheet', href: chessgroundBase },
    { rel: 'stylesheet', href: chessgroundBrown },
    { rel: 'stylesheet', href: chessgroundCburnett }
  ];

export default function ChessboardRoute() {
  return (
    <Chessboard 
        initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        viewOnly={true}
    />
  );
}