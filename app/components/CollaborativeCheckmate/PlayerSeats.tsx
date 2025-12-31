import type { SeatKey } from "~/types/generated";

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
  getCurrentPlayerSeat
}: PlayerSeatsProps) {
  return (
    <>
      {/* Player Seats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white  border-2 border-black  p-3 pt-0 mb-2">
          <h3 className="font-bold text-black  text-lg my-1 font-neo uppercase border-b-2 border-accent pb-1">White</h3>
          <div className="space-y-2">
            {/* White Player 1 */}
            <div
              className={`flex items-center p-2 font-neo text-black  ${players.t1p1.id === playerId ? 'bg-accent text-white ' : ''
                } ${(players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready ?
                  'border-2 border-dashed border-black  cursor-pointer hover:bg-gray-100 ' :
                  'border border-black '
                }`}
              onClick={() => ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && onTakeSeat('t1p1')}
              onKeyDown={(e) => e.key === 'Enter' && ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && onTakeSeat('t1p1')}
              role="button"
              tabIndex={0}
            >
              <div className={`w-6 h-6 rounded-full mr-2 border-2 border-black  ${players.t1p1.ready ? 'bg-green-500' : 'bg-white '
                }`}></div>
              <span>{players.t1p1.id || '< Click to Join >'}</span>
              {players.t1p1.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>

            {/* White Player 2 */}
            <div
              className={`flex items-center p-2 font-neo text-black  ${players.t1p2.id === playerId ? 'bg-accent text-white ' : ''
                } ${(players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready ?
                  'border-2 border-dashed border-black  cursor-pointer hover:bg-gray-100 ' :
                  'border border-black '
                }`}
              onClick={() => ((players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready) && onTakeSeat('t1p2')}
              onKeyDown={(e) => e.key === 'Enter' && ((players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready) && onTakeSeat('t1p2')}
              role="button"
              tabIndex={0}
            >
              <div className={`w-6 h-6 rounded-full mr-2 border-2 border-black  ${players.t1p2.ready ? 'bg-green-500' : 'bg-white '
                }`}></div>
              <span>{players.t1p2.id || '<Click to Join>'}</span>
              {players.t1p2.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>
          </div>
        </div>

        <div className="bg-white  border-2 border-black  p-3 pt-0 mb-2">
          <h3 className="font-bold text-black  text-lg my-1 font-neo uppercase border-b-2 border-accent pb-1">Black</h3>
          <div className="space-y-2">
            {/* Black Player 1 */}
            <div
              className={`flex items-center p-2 font-neo text-black  ${players.t2p1.id === playerId ? 'bg-accent text-white ' : ''
                } ${(players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready ?
                  'border-2 border-dashed border-black  cursor-pointer hover:bg-gray-100 ' :
                  'border border-black '
                }`}
              onClick={() => ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && onTakeSeat('t2p1')}
              onKeyDown={(e) => e.key === 'Enter' && ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && onTakeSeat('t2p1')}
              role="button"
              tabIndex={0}
            >
              <div className={`w-6 h-6 rounded-full mr-2 border-2 border-black  ${players.t2p1.ready ? 'bg-green-500' : 'bg-white '
                }`}></div>
              <span>{players.t2p1.id || '< Click to Join >'}</span>
              {players.t2p1.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>

            {/* Black Player 2 */}
            <div
              className={`flex items-center p-2 font-neo text-black  ${players.t2p2.id === playerId ? 'bg-accent text-white ' : ''
                } ${(players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready ?
                  'border-2 border-dashed border-black  cursor-pointer hover:bg-gray-100 ' :
                  'border border-black '
                }`}
              onClick={() => ((players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready) && onTakeSeat('t2p2')}
              onKeyDown={(e) => e.key === 'Enter' && ((players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready) && onTakeSeat('t2p2')}
              role="button"
              tabIndex={0}
            >
              <div className={`w-6 h-6 rounded-full mr-2 border-2 border-black  ${players.t2p2.ready ? 'bg-green-500' : 'bg-white '
                }`}></div>
              <span>{players.t2p2.id || '< Click to Join >'}</span>
              {players.t2p2.id === playerId && <span className="ml-2 text-xs">(You)</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Ready Up Button */}
      <div className="grid grid-cols-1 gap-2 mb-4">
        <button
          onClick={onReadyUp}
          className={`p-2 border-2 border-black  font-bold transition-colors duration-200 font-neo uppercase
            ${!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)
              ? 'bg-gray-300  text-gray-500  cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white border-green-600'
            }`}
          disabled={!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)}
        >
          Ready Up
        </button>
      </div>
    </>
  );
}
