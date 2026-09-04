import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC<{ serverName?: string }> = ({ serverName }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-priv-card border-b border-priv-border px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        <Link to="/servers" className="flex items-center space-x-2 font-bold text-xl text-white">
          <span className="w-8 h-8 rounded-lg bg-priv-accent flex items-center justify-center text-white text-lg">P</span>
          <span>Priv</span>
        </Link>
        {serverName && (
          <>
            <span className="text-priv-textMuted">/</span>
            <span className="text-white font-medium text-sm px-2.5 py-1 bg-priv-hover rounded-md border border-priv-border">
              {serverName}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <Link
          to="/servers"
          className="text-xs font-medium text-priv-textMuted hover:text-white px-3 py-1.5 rounded-lg border border-priv-border hover:bg-priv-hover transition flex items-center gap-1.5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Sunucu Değiştir</span>
        </Link>

        {user && (
          <div className="flex items-center space-x-3 pl-2 border-l border-priv-border">
            <img
              src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
              alt={user.username}
              className="w-8 h-8 rounded-full border border-priv-border"
            />
            <span className="text-sm font-semibold text-white hidden md:inline">{user.username}</span>
            <button
              onClick={logout}
              title="Çıkış Yap"
              className="p-1.5 text-priv-textMuted hover:text-red-400 hover:bg-priv-hover rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
