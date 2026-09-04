import React from 'react';

export const SkeletonLoader: React.FC<{ rows?: number; height?: string }> = ({
  rows = 3,
  height = 'h-12',
}) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`bg-priv-hover/60 rounded-xl ${height} w-full`} />
      ))}
    </div>
  );
};
