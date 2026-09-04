import React, { useState } from 'react';
import { Shield, CheckCircle, Save } from 'lucide-react';

export const AutoModPage: React.FC = () => {
  const [rules, setRules] = useState({
    spamFilter: true,
    floodFilter: true,
    inviteFilter: true,
    linkFilter: false,
    capsLimitPercent: 70,
    action: 'WARN',
    bannedWords: 'küfür1, reklam',
  });
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToast('AutoMod güvenlik kuralları güncellendi!');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Moderasyon & AutoMod</h1>
          <p className="text-sm text-priv-textMuted mt-1">Otomatik filtreler, spam koruması ve ceza kuralları:</p>
        </div>

        <button
          type="submit"
          className="bg-priv-accent hover:bg-priv-accentHover text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-priv-accent/20 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Kuralları Kaydet</span>
        </button>
      </div>

      {toast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Otomatik Filtreler */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-4">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Otomatik Güvenlik Filtreleri</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'inviteFilter', label: 'Discord Davet Linki Koruması', desc: 'İzinsiz discord.gg linklerini anında siler.' },
            { key: 'spamFilter', label: 'Mesaj Spam Koruması', desc: 'Aynı mesajı tekrar tekrar atanları engeller.' },
            { key: 'floodFilter', label: 'Hızlı Mesaj (Flood) Koruması', desc: '5 saniyede 5+ mesaj atılmasını engeller.' },
            { key: 'linkFilter', label: 'Dış Bağlantı / Link Koruması', desc: 'Web sitesi linklerini filtreler.' },
          ].map((f) => (
            <label
              key={f.key}
              className="p-4 bg-priv-hover border border-priv-border rounded-xl flex items-start space-x-3 cursor-pointer hover:border-priv-accent/40 transition"
            >
              <input
                type="checkbox"
                checked={(rules as any)[f.key]}
                onChange={(e) => setRules({ ...rules, [f.key]: e.target.checked })}
                className="mt-1 w-4 h-4 rounded text-priv-accent focus:ring-0 bg-priv-card border-priv-border"
              />
              <div>
                <p className="text-sm font-bold text-white">{f.label}</p>
                <p className="text-xs text-priv-textMuted mt-0.5">{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Büyük Harf ve Yasaklı Kelimeler */}
      <div className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-6">
        <h3 className="text-base font-bold text-white border-b border-priv-border pb-3">Detaylı Ayarlar & Cezalar</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-2">
              Caps Lock Sınırı (%)
            </label>
            <input
              type="number"
              min={30}
              max={100}
              value={rules.capsLimitPercent}
              onChange={(e) => setRules({ ...rules, capsLimitPercent: Number(e.target.value) })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent"
            />
            <p className="text-xs text-priv-textMuted mt-1">Mesajdaki büyük harf oranı bu yüzdeyi geçerse engellenir.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-2">
              Uygulanacak Ceza
            </label>
            <select
              value={rules.action}
              onChange={(e) => setRules({ ...rules, action: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-priv-accent"
            >
              <option value="DELETE">Sadece Mesajı Sil</option>
              <option value="WARN">Mesajı Sil + Uyar</option>
              <option value="TIMEOUT">Mesajı Sil + 5 Dakika Timeout</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-priv-textMuted uppercase mb-2">
            Yasaklı Kelimeler (Virgülle ayırın)
          </label>
          <textarea
            rows={3}
            value={rules.bannedWords}
            onChange={(e) => setRules({ ...rules, bannedWords: e.target.value })}
            placeholder="Örn: yasak1, reklam, küfür"
            className="w-full bg-priv-hover border border-priv-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-priv-accent font-mono"
          />
        </div>
      </div>
    </form>
  );
};
