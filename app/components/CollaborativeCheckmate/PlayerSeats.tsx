import type { SeatKey } from '~/utils/collaborativeCheckmate/types';

type PlayersState = {
  [K in SeatKey]: {
    id: string | null;
    ready: boolean;
  };
};

interface PlayerSeatsProps {
  players: PlayersState;
  playerId: string | undefined;
  connected: boolean;
  onTakeSeat: (seat: SeatKey) => void;
  onReadyUp: () => void;
  getCurrentPlayerSeat: () => SeatKey | null;
}

export default function PlayerSeats({
  players,
  playerId,
  connected,
  onTakeSeat,
  onReadyUp,
  getCurrentPlayerSeat,
}: PlayerSeatsProps) {
  return (
    <>
      {/* Player Seats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="mb-2 border-2 border-black bg-white p-3 pt-0">
          <h3 className="font-neo border-accent my-1 border-b-2 pb-1 text-lg font-bold text-black uppercase">White</h3>
          <div className="space-y-2">
            {/* White Player 1 */}
            <div
              className={`font-neo flex items-center p-2 text-black ${
                players.t1p1.id === playerId ? 'bg-accent text-white' : ''
              } ${
                (players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready
                  ? 'cursor-pointer border-2 border-dashed border-black hover:bg-gray-100'
                  : 'border border-black'
              }`}
              onClick={() =>
                (players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready && onTakeSeat('t1p1')
              }
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                (players.t1p1.id === null || players.t1p1.id === playerId) &&
                !players.t1p1.ready &&
                onTakeSeat('t1p1')
              }
              role="button"
              tabIndex={0}
            >
              <div
                className={`mr-2 h-6 w-6 rounded-full border-2 border-black ${
                  players.t1p1.ready ? 'bg-green-500' : 'bg-white'
                }`}
              ></div>
              <span>{players.t1p1.id || '< Click to Join >'}</span>
              {players.t1p1.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>

            {/* White Player 2 */}
            <div
              className={`font-neo flex items-center p-2 text-black ${
                players.t1p2.id === playerId ? 'bg-accent text-white' : ''
              } ${
                (players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready
                  ? 'cursor-pointer border-2 border-dashed border-black hover:bg-gray-100'
                  : 'border border-black'
              }`}
              onClick={() =>
                (players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready && onTakeSeat('t1p2')
              }
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                (players.t1p2.id === null || players.t1p2.id === playerId) &&
                !players.t1p2.ready &&
                onTakeSeat('t1p2')
              }
              role="button"
              tabIndex={0}
            >
              <div
                className={`mr-2 h-6 w-6 rounded-full border-2 border-black ${
                  players.t1p2.ready ? 'bg-green-500' : 'bg-white'
                }`}
              ></div>
              <span>{players.t1p2.id || '<Click to Join>'}</span>
              {players.t1p2.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>
          </div>
        </div>

        <div className="mb-2 border-2 border-black bg-white p-3 pt-0">
          <h3 className="font-neo border-accent my-1 border-b-2 pb-1 text-lg font-bold text-black uppercase">Black</h3>
          <div className="space-y-2">
            {/* Black Player 1 */}
            <div
              className={`font-neo flex items-center p-2 text-black ${
                players.t2p1.id === playerId ? 'bg-accent text-white' : ''
              } ${
                (players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready
                  ? 'cursor-pointer border-2 border-dashed border-black hover:bg-gray-100'
                  : 'border border-black'
              }`}
              onClick={() =>
                (players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready && onTakeSeat('t2p1')
              }
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                (players.t2p1.id === null || players.t2p1.id === playerId) &&
                !players.t2p1.ready &&
                onTakeSeat('t2p1')
              }
              role="button"
              tabIndex={0}
            >
              <div
                className={`mr-2 h-6 w-6 rounded-full border-2 border-black ${
                  players.t2p1.ready ? 'bg-green-500' : 'bg-white'
                }`}
              ></div>
              <span>{players.t2p1.id || '< Click to Join >'}</span>
              {players.t2p1.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>

            {/* Black Player 2 */}
            <div
              className={`font-neo flex items-center p-2 text-black ${
                players.t2p2.id === playerId ? 'bg-accent text-white' : ''
              } ${
                (players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready
                  ? 'cursor-pointer border-2 border-dashed border-black hover:bg-gray-100'
                  : 'border border-black'
              }`}
              onClick={() =>
                (players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready && onTakeSeat('t2p2')
              }
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                (players.t2p2.id === null || players.t2p2.id === playerId) &&
                !players.t2p2.ready &&
                onTakeSeat('t2p2')
              }
              role="button"
              tabIndex={0}
            >
              <div
                className={`mr-2 h-6 w-6 rounded-full border-2 border-black ${
                  players.t2p2.ready ? 'bg-green-500' : 'bg-white'
                }`}
              ></div>
              <span>{players.t2p2.id || '< Click to Join >'}</span>
              {players.t2p2.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Ready Up Button */}
      <div className="mb-4 grid grid-cols-1 gap-2">
        <button
          onClick={onReadyUp}
          className={`font-neo border-2 border-black p-2 font-bold uppercase transition-colors duration-200 ${
            !connected ||
            (players.t1p1.id != playerId &&
              players.t1p2.id != playerId &&
              players.t2p1.id != playerId &&
              players.t2p2.id != playerId) ||
            (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)
              ? 'cursor-not-allowed bg-gray-300 text-gray-500'
              : 'border-green-600 bg-green-500 text-white hover:bg-green-600'
          }`}
          disabled={
            !connected ||
            (players.t1p1.id != playerId &&
              players.t1p2.id != playerId &&
              players.t2p1.id != playerId &&
              players.t2p2.id != playerId) ||
            (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)
          }
        >
          Ready Up
        </button>
      </div>
    </>
  );
}
