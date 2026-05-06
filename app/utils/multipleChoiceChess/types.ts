export interface MoveHistoryEntry {
  color: 'white' | 'black';
  san: string;
  uci: string;
  rank: number; // 0 = unranked fallback, otherwise 1 | 2 | 4 | 6
  fenBefore: string;
  fenAfter: string;
}
