const RANK_LABEL: Record<number, string> = {
  0: '—',
  1: '#1',
  2: '#2',
  4: '#4',
  6: '#6',
};

const RANK_STYLES: Record<number, string> = {
  0: 'bg-gray-100 text-gray-500 border-gray-300',
  1: 'bg-white text-black border-black',
  2: 'bg-gray-200 text-gray-900 border-gray-500',
  4: 'bg-gray-600 text-white border-gray-800',
  6: 'bg-black text-white border-black',
};

interface RankBadgeProps {
  rank: number;
  inverted?: boolean; // when on a dark/selected background
  className?: string;
}

export default function RankBadge({ rank, inverted, className = '' }: RankBadgeProps) {
  const styles = inverted
    ? 'bg-white text-black border-white'
    : RANK_STYLES[rank] ?? 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <span
      className={`shrink-0 border-2 px-1 py-0.5 text-xs leading-none ${styles} ${className}`}
    >
      {RANK_LABEL[rank] ?? `#${rank}`}
    </span>
  );
}
