import React from 'react';
import { ragColor } from '../utils/formatters';

export default function RAGBadge({ status, size = 'md' }) {
  const colors = ragColor(status);
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block rounded-full ${colors.bg} ${sizeClasses[size]}`} />
      {size === 'lg' && (
        <span className={`text-sm font-medium capitalize ${colors.text}`}>{status}</span>
      )}
    </span>
  );
}
