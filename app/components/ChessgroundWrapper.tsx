import React from 'react';
import { Chessground } from 'chessground';

// Make sure to import the CSS somewhere in your app
// import 'chessground/assets/chessground.base.css';
// import 'chessground/assets/chessground.brown.css';
// import 'chessground/assets/chessground.cburnett.css';

interface ChessgroundWrapperProps {
  fen: string;
  orientation: 'white' | 'black';
  width: string;
  height: string;
  style?: React.CSSProperties;
}

const ChessgroundWrapper: React.FC<ChessgroundWrapperProps> = ({ fen, orientation, width, height, style }) => {
  const chessgroundRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (chessgroundRef.current) {
      const chessground = Chessground(chessgroundRef.current, {
        fen: fen,
        orientation: orientation,
        movable: {
          free: false,
          color: undefined,
          dests: new Map(),
        },
        draggable: {
          enabled: false,
        },
      });

      return () => {
        chessground.destroy();
      };
    }
  }, [fen, orientation]);

  return <div ref={chessgroundRef} style={{ ...style, width, height }} />;
};

export default ChessgroundWrapper;