import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  color = 'text-priv-accent',
  subtitle,
}) => {
  return (
    <div className="bg-priv-card border border-priv-border p-5 rounded-2xl flex flex-col justify-between hover:border-priv-border/80 transition">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-priv-textMuted uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl bg-priv-hover ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-priv-textMuted mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};
