import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Users, MessageSquare, Mic, Coins, Zap, ShieldAlert } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [id]);

  const fetchStats = async () => {
    try {
      const res = await api.get(`/guilds/${id}/stats`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonLoader rows={1} height="h-28" />
          <SkeletonLoader rows={1} height="h-28" />
          <SkeletonLoader rows={1} height="h-28" />
          <SkeletonLoader rows={1} height="h-28" />
        </div>
        <SkeletonLoader rows={1} height="h-80" />
      </div>
    );
  }

  const { overview, activityChart, recentLogs } = data || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Genel Bakış</h1>
        <p className="text-sm text-priv-textMuted mt-1">Sunucu aktivitesi, ses saatleri ve ekonomi verileri:</p>
      </div>

      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Toplam Üye"
          value={overview?.memberCount || 0}
          icon={Users}
          color="text-indigo-400"
          subtitle={`${overview?.activeUsersCount || 0} aktif kullanıcı`}
        />
        <StatCard
          title="Toplam Mesaj"
          value={overview?.totalMessages?.toLocaleString('tr-TR') || 0}
          icon={MessageSquare}
          color="text-emerald-400"
          subtitle="Tüm kanallar toplamı"
        />
        <StatCard
          title="Ses Süresi"
          value={`${overview?.totalVoiceHours || 0} Saat`}
          icon={Mic}
          color="text-purple-400"
          subtitle="Aktif ses odaları"
        />
        <StatCard
          title="Dönen Ekonomi"
          value={`${overview?.totalCoins?.toLocaleString('tr-TR') || 0} 🪙`}
          icon={Coins}
          color="text-amber-400"
          subtitle="Kullanıcı bakiyeleri"
        />
      </div>

      {/* Aktivite Grafiği (Recharts) */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl">
        <h3 className="text-base font-bold text-white mb-6">Haftalık Sohbet ve Ses İstatistiği</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activityChart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#272A38" />
              <XAxis dataKey="day" stroke="#949BA4" />
              <YAxis stroke="#949BA4" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#161821',
                  borderColor: '#272A38',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Legend wrapperStyle={{ color: '#949BA4' }} />
              <Bar dataKey="messages" name="Mesaj Sayısı" fill="#5865F2" radius={[6, 6, 0, 0]} />
              <Bar dataKey="voiceMinutes" name="Ses (Dakika)" fill="#57F287" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Son Olaylar Tablosu */}
      <div className="bg-priv-card border border-priv-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-priv-border flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Son Moderasyon Olayları</h3>
          <ShieldAlert className="w-4 h-4 text-priv-textMuted" />
        </div>

        {recentLogs?.length === 0 ? (
          <div className="p-8 text-center text-sm text-priv-textMuted">
            Henüz gerçekleşen bir moderasyon kaydı bulunmuyor.
          </div>
        ) : (
          <div className="divide-y divide-priv-border">
            {recentLogs?.map((log: any) => (
              <div key={log.id} className="p-4 flex items-center justify-between text-sm hover:bg-priv-hover/50 transition">
                <div className="flex items-center space-x-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    {log.action}
                  </span>
                  <span className="text-white font-medium">{log.target}</span>
                  <span className="text-priv-textMuted text-xs">• Sebep: {log.reason || 'Belirtilmedi'}</span>
                </div>
                <div className="text-xs text-priv-textMuted">
                  Yetkili: <span className="text-white">{log.moderator}</span> ({log.date})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
