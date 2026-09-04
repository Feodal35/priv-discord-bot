import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Server, Database, Cpu, Clock, CheckCircle } from 'lucide-react';
import { StatCard } from '../components/StatCard';

export const AdminPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystem();
  }, []);

  const fetchSystem = async () => {
    try {
      const res = await api.get('/admin/system');
      if (res.data.success) {
        setData(res.data.system);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SkeletonLoader rows={3} height="h-28" />;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours} saat ${mins} dakika`;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Bot ve Sistem Durumu</h1>
        <p className="text-sm text-priv-textMuted mt-1">Altyapı kaynakları, çalışma süresi ve veritabanı bağlantısı:</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Çalışma Süresi (Uptime)"
          value={formatUptime(data?.uptimeSeconds || 0)}
          icon={Clock}
          color="text-emerald-400"
        />
        <StatCard
          title="Bellek (RAM) Kullanımı"
          value={`${data?.memoryUsageMB || 0} MB`}
          icon={Cpu}
          color="text-indigo-400"
        />
        <StatCard
          title="Veritabanı"
          value={data?.databaseConnected ? 'Bağlı' : 'Bağlantı Yok'}
          icon={Database}
          color={data?.databaseConnected ? 'text-emerald-400' : 'text-red-400'}
        />
        <StatCard
          title="Kayıtlı Sunucu Sayısı"
          value={data?.totalGuilds || 0}
          icon={Server}
          color="text-purple-400"
        />
      </div>

      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Sistem Bilgileri</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-1 border-b border-priv-border/50">
            <span className="text-priv-textMuted">Node.js Sürümü</span>
            <span className="font-mono text-white">{data?.nodeVersion}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-priv-border/50">
            <span className="text-priv-textMuted">Platform Mimarisi</span>
            <span className="font-mono text-white">Priv Monorepo (Node.js + Prisma + TypeScript)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-priv-border/50">
            <span className="text-priv-textMuted">Son Kontrol Zamanı</span>
            <span className="font-mono text-white">{new Date(data?.timestamp).toLocaleString('tr-TR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
