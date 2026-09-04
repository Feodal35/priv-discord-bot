import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

export const LogsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs(pagination.page);
  }, [id, pagination.page]);

  const fetchLogs = async (page: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/guilds/${id}/logs?page=${page}&limit=12`);
      if (res.data.success) {
        setLogs(res.data.logs);
        setPagination({ page: res.data.pagination.page, totalPages: res.data.pagination.totalPages });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Denetim & Moderasyon Logları</h1>
        <p className="text-sm text-priv-textMuted mt-1">Sunucuda gerçekleşen tüm yetkili ve AutoMod işlemleri:</p>
      </div>

      {loading ? (
        <SkeletonLoader rows={5} height="h-16" />
      ) : logs.length === 0 ? (
        <div className="p-12 text-center bg-priv-card border border-priv-border rounded-2xl text-priv-textMuted text-sm">
          Henüz sunucuda kayıtlı bir moderasyon logu bulunmuyor.
        </div>
      ) : (
        <div className="bg-priv-card border border-priv-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-priv-border">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-priv-hover/50 transition">
                <div className="flex items-center space-x-4">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                    {log.action}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white">
                      Hedef: <span className="text-indigo-400">{log.targetUser}</span>
                    </div>
                    <div className="text-xs text-priv-textMuted mt-0.5">
                      Sebep: {log.reason || 'Belirtilmedi'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-white">
                    Yetkili: <span className="font-semibold">{log.moderatorUser}</span>
                  </div>
                  <div className="text-xs text-priv-textMuted mt-0.5">{log.createdAt}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Sayfalama */}
          <div className="p-4 border-t border-priv-border flex items-center justify-between">
            <span className="text-xs text-priv-textMuted">
              Sayfa {pagination.page} / {pagination.totalPages || 1}
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                className="p-2 rounded-lg bg-priv-hover border border-priv-border text-priv-textMuted hover:text-white disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                className="p-2 rounded-lg bg-priv-hover border border-priv-border text-priv-textMuted hover:text-white disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
