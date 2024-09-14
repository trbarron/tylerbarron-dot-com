// File: app/components/ChessgroundWrapper.tsx

import React from 'react';
import Chessground from 'react-chessground';

type ChessgroundWrapperProps = {
  fen: string;
  orientation: 'white' | 'black';
  width: string;
  height: string;
  style: React.CSSProperties;
};

const ChessgroundWrapper: React.FC<ChessgroundWrapperProps> = ({ fen, orientation, width, height, style }) => {
  return (
    <Chessground
      fen={fen}
      orientation={orientation}
      animation={{ enabled: false }}
      movable={{
        free: false,
        color: undefined,
        dests: [],
      }}
      drawable={{
        enabled: true,
        visible: true,
        eraseOnClick: true,
      }}
      width={width}
      height={height}
      style={style}
    />
  );
};

export default ChessgroundWrapper;