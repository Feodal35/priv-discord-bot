import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, ArrowRight, Shield } from 'lucide-react';
import { SkeletonLoader } from '../components/SkeletonLoader';

interface GuildItem {
  id: string;
  name: string;
  icon: string | null;
  hasBot: boolean;
  inviteUrl: string;
}

export const ServerSelectPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [guilds, setGuilds] = useState<GuildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
      return;
    }
    fetchGuilds();
  }, [user, authLoading]);

  const fetchGuilds = async () => {
    try {
      const res = await api.get('/guilds');
      if (res.data.success) {
        setGuilds(res.data.guilds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-priv-bg p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Sunucunu Seç</h1>
            <p className="text-sm text-priv-textMuted mt-1">
              Yönetici olduğun ve Priv Bot'u kurabileceğin Discord sunucuları:
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3 bg-priv-card border border-priv-border px-4 py-2 rounded-xl">
              <img
                src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                className="w-8 h-8 rounded-full"
                alt=""
              />
              <span className="text-sm font-semibold text-white">{user.username}</span>
            </div>
          )}
        </div>

        {loading ? (
          <SkeletonLoader rows={4} height="h-20" />
        ) : guilds.length === 0 ? (
          <div className="bg-priv-card border border-priv-border p-12 rounded-2xl text-center">
            <Shield className="w-12 h-12 text-priv-accent mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Yönetici Olduğun Sunucu Bulunamadı</h3>
            <p className="text-sm text-priv-textMuted max-w-md mx-auto">
              Discord hesabının Yönetici veya Sunucuyu Yönet yetkisine sahip olduğu bir sunucu tespit edilemedi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guilds.map((g) => (
              <div
                key={g.id}
                className="bg-priv-card border border-priv-border p-5 rounded-2xl flex items-center justify-between hover:border-priv-accent/50 transition group"
              >
                <div className="flex items-center space-x-4">
                  {g.icon ? (
                    <img src={g.icon} alt={g.name} className="w-14 h-14 rounded-2xl border border-priv-border" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-priv-hover border border-priv-border flex items-center justify-center font-bold text-xl text-white">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-priv-accent transition">{g.name}</h3>
                    <span className="text-xs text-priv-textMuted">
                      {g.hasBot ? '🟢 Priv Bot Ekli' : '⚪ Bot henüz ekli değil'}
                    </span>
                  </div>
                </div>

                <div>
                  {g.hasBot ? (
                    <Link
                      to={`/server/${g.id}`}
                      className="bg-priv-accent hover:bg-priv-accentHover text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-priv-accent/20"
                    >
                      <span>Yönet</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <a
                      href={g.inviteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-priv-hover hover:bg-priv-border text-white border border-priv-border px-4 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Botu Ekle</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
