import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      const res = await api.get(`/guilds/${id}/settings`);
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await api.put(`/guilds/${id}/settings`, settings);
      if (res.data.success) {
        setSettings(res.data.settings);
        setStatusMessage({ type: 'success', text: 'Ayarlar başarıyla güncellendi!' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Ayarlar kaydedilemedi.' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  if (loading) {
    return <SkeletonLoader rows={5} height="h-16" />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Sunucu Ayarları</h1>
          <p className="text-sm text-priv-textMuted mt-1">Bot markalama, karşılama ve kanal yapılandırmaları:</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-priv-accent hover:bg-priv-accentHover disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-priv-accent/20 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Markalama */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-6">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Bot Markalama & Görünüm</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Bot Adı
            </label>
            <input
              type="text"
              value={settings.botName || ''}
              onChange={(e) => setSettings({ ...settings, botName: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Embed Rengi (Hex Kodu)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.embedColor || '#5865F2'}
                onChange={(e) => setSettings({ ...settings, embedColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={settings.embedColor || '#5865F2'}
                onChange={(e) => setSettings({ ...settings, embedColor: e.target.value })}
                className="flex-1 bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Kanallar */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-6">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Kanal Bağlantıları (Kanal ID)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Karşılama Kanalı ID
            </label>
            <input
              type="text"
              value={settings.welcomeChannelId || ''}
              placeholder="Örn: 123456789012345678"
              onChange={(e) => setSettings({ ...settings, welcomeChannelId: e.target.value || null })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Denetim & Log Kanalı ID
            </label>
            <input
              type="text"
              value={settings.logChannelId || ''}
              placeholder="Örn: 123456789012345678"
              onChange={(e) => setSettings({ ...settings, logChannelId: e.target.value || null })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Anonim İtiraf Kanalı ID
            </label>
            <input
              type="text"
              value={settings.confessionChannelId || ''}
              placeholder="Örn: 123456789012345678"
              onChange={(e) => setSettings({ ...settings, confessionChannelId: e.target.value || null })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
              Doğum Günü Kutlama Kanalı ID
            </label>
            <input
              type="text"
              value={settings.birthdayChannelId || ''}
              placeholder="Örn: 123456789012345678"
              onChange={(e) => setSettings({ ...settings, birthdayChannelId: e.target.value || null })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent transition font-mono"
            />
          </div>
        </div>
      </div>

      {/* Mesaj Şablonları */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-6">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Mesaj Şablonları</h3>
        <div>
          <label className="block text-xs font-bold text-priv-textMuted uppercase tracking-wider mb-2">
            Karşılama Mesajı Şablonu
          </label>
          <p className="text-xs text-priv-textMuted mb-2">
            Kullanabileceğiniz değişkenler: <code className="text-priv-accent font-mono">{'{user}'}</code>,{' '}
            <code className="text-priv-accent font-mono">{'{username}'}</code>,{' '}
            <code className="text-priv-accent font-mono">{'{server}'}</code>,{' '}
            <code className="text-priv-accent font-mono">{'{memberCount}'}</code>
          </p>
          <textarea
            rows={3}
            value={settings.welcomeMessage || ''}
            onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
            className="w-full bg-priv-hover border border-priv-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-priv-accent transition"
          />
        </div>
      </div>

      {/* Feature Flags (Modül Aç/Kapa) */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Aktif Modüller</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'economyEnabled', label: '💰 Ekonomi Sistemi' },
            { key: 'levelEnabled', label: '⭐ Seviye & XP' },
            { key: 'gamesEnabled', label: '🎮 Mini Oyunlar' },
            { key: 'voiceEnabled', label: '🎤 Geçici Ses Odaları' },
            { key: 'confessionEnabled', label: '🤫 Anonim İtiraf' },
            { key: 'autoModEnabled', label: '🛡️ AutoMod Güvenlik' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center space-x-3 p-3 bg-priv-hover/60 border border-priv-border rounded-xl cursor-pointer hover:border-priv-accent/50 transition"
            >
              <input
                type="checkbox"
                checked={!!settings[item.key]}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                className="w-4 h-4 rounded text-priv-accent focus:ring-0 bg-priv-card border-priv-border"
              />
              <span className="text-xs font-semibold text-white">{item.label}</span>
            </label>
          ))}
        </div>
      </div>
    </form>
  );
};
