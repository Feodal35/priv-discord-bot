import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Trophy, Flame, MessageSquare, Mic, Coins } from 'lucide-react';

export const LeaderboardPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [users, setUsers] = useState<any[]>([]);
  const [category, setCategory] = useState<'xp' | 'coins' | 'messages' | 'voice' | 'streak'>('xp');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [id, category]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${id}/leaderboard?category=${category}`);
      if (res.data.success) {
        setUsers(res.data.leaderboard);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'xp', label: 'Seviye & XP', icon: Trophy },
    { key: 'coins', label: 'Cüzdan (Coin)', icon: Coins },
    { key: 'messages', label: 'Mesaj Sayısı', icon: MessageSquare },
    { key: 'voice', label: 'Ses Süresi', icon: Mic },
    { key: 'streak', label: 'Streak Serisi', icon: Flame },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Sunucu Liderlik Tablosu</h1>
        <p className="text-sm text-priv-textMuted mt-1">Sunucunun en aktif üyeleri ve sıralamaları:</p>
      </div>

      {/* Kategori Tabları */}
      <div className="flex flex-wrap gap-2 border-b border-priv-border pb-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = category === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setCategory(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                active
                  ? 'bg-priv-accent text-white shadow-md shadow-priv-accent/20'
                  : 'bg-priv-card border border-priv-border text-priv-textMuted hover:text-white hover:bg-priv-hover'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <SkeletonLoader rows={6} height="h-16" />
      ) : users.length === 0 ? (
        <div className="p-12 text-center bg-priv-card border border-priv-border rounded-2xl text-priv-textMuted text-sm">
          Henüz bu kategoride bir sıralama verisi bulunmuyor.
        </div>
      ) : (
        <div className="bg-priv-card border border-priv-border rounded-2xl overflow-hidden divide-y divide-priv-border">
          {users.map((u) => {
            const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
            const medal = medals[u.rank];

            let valueDisplay = `Seviye ${u.level} (${u.xp.toLocaleString('tr-TR')} XP)`;
            if (category === 'coins') valueDisplay = `${u.coins.toLocaleString('tr-TR')} Coin`;
            if (category === 'messages') valueDisplay = `${u.messageCount.toLocaleString('tr-TR')} mesaj`;
            if (category === 'voice') valueDisplay = `${u.voiceHours} saat`;
            if (category === 'streak') valueDisplay = `${u.streak} gün`;

            return (
              <div key={u.userId} className="p-4 flex items-center justify-between hover:bg-priv-hover/50 transition">
                <div className="flex items-center space-x-4">
                  <div className="w-8 text-center font-bold text-base text-white">
                    {medal || `#${u.rank}`}
                  </div>
                  <img
                    src={u.avatar ? `https://cdn.discordapp.com/avatars/${u.userId}/${u.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}
                    alt=""
                    className="w-10 h-10 rounded-full border border-priv-border"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-white">{u.username}</h4>
                    <span className="text-xs text-priv-textMuted">ID: {u.userId}</span>
                  </div>
                </div>

                <div className="text-sm font-extrabold text-priv-accent">
                  {valueDisplay}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
