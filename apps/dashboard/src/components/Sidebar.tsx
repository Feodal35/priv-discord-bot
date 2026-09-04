import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Coins,
  Trophy,
  ScrollText,
  Activity,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const links = [
    { to: `/server/${id}`, label: 'Genel Bakış', icon: LayoutDashboard, end: true },
    { to: `/server/${id}/settings`, label: 'Sunucu Ayarları', icon: Settings },
    { to: `/server/${id}/automod`, label: 'Moderasyon & AutoMod', icon: ShieldAlert },
    { to: `/server/${id}/economy`, label: 'Ekonomi & Mağaza', icon: Coins },
    { to: `/server/${id}/leaderboard`, label: 'Liderlik Tablosu', icon: Trophy },
    { to: `/server/${id}/logs`, label: 'Denetim Logları', icon: ScrollText },
    { to: `/server/${id}/admin`, label: 'Bot Durumu', icon: Activity },
  ];

  return (
    <aside className="w-64 bg-priv-card border-r border-priv-border flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-1">
        <p className="text-xs font-semibold text-priv-textMuted uppercase tracking-wider px-3 mb-2">
          YÖNETİM MENÜSÜ
        </p>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-priv-accent text-white shadow-lg shadow-priv-accent/20'
                    : 'text-priv-textMuted hover:text-white hover:bg-priv-hover'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
};
