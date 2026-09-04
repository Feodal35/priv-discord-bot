import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Plus, Trash2, ShoppingBag, Coins, Save, CheckCircle } from 'lucide-react';

export const EconomyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: 1000,
    type: 'ROLE',
    roleId: '',
    stock: -1,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [shopRes, settingsRes] = await Promise.all([
        api.get(`/guilds/${id}/shop`),
        api.get(`/guilds/${id}/settings`),
      ]);
      if (shopRes.data.success) setItems(shopRes.data.items);
      if (settingsRes.data.success) setSettings(settingsRes.data.settings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put(`/guilds/${id}/settings`, {
        currencyName: settings.currencyName,
        currencyEmoji: settings.currencyEmoji,
        dailyReward: Number(settings.dailyReward),
        workMinReward: Number(settings.workMinReward),
        workMaxReward: Number(settings.workMaxReward),
        dailyStreakBonus: Number(settings.dailyStreakBonus),
      });
      setToast('Ekonomi ayarları başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/guilds/${id}/shop`, {
        ...newItem,
        price: Number(newItem.price),
        stock: Number(newItem.stock),
      });
      if (res.data.success) {
        setItems([res.data.item, ...items]);
        setShowAddModal(false);
        setNewItem({ name: '', description: '', price: 1000, type: 'ROLE', roleId: '', stock: -1 });
        setToast('Yeni mağaza ürünü başarıyla eklendi!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Bu ürünü mağazadan silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/guilds/${id}/shop/${itemId}`);
      setItems(items.filter((i) => i.id !== itemId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <SkeletonLoader rows={4} height="h-20" />;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Ekonomi & Mağaza</h1>
          <p className="text-sm text-priv-textMuted mt-1">Sunucu para birimi ve market ürünlerini yönetin:</p>
        </div>
      </div>

      {toast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Para Birimi Ayarları */}
      <form onSubmit={handleSaveSettings} className="bg-priv-card border border-priv-border p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-priv-border pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>Para Birimi & Kazanç Ayarları</span>
          </h3>
          <button
            type="submit"
            disabled={savingSettings}
            className="bg-priv-accent hover:bg-priv-accentHover text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingSettings ? 'Kaydediliyor...' : 'Kaydet'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Para Birimi Adı</label>
            <input
              type="text"
              value={settings.currencyName || ''}
              onChange={(e) => setSettings({ ...settings, currencyName: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Emoji</label>
            <input
              type="text"
              value={settings.currencyEmoji || '🪙'}
              onChange={(e) => setSettings({ ...settings, currencyEmoji: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Günlük Ödül</label>
            <input
              type="number"
              value={settings.dailyReward || 250}
              onChange={(e) => setSettings({ ...settings, dailyReward: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Streak Bonusu</label>
            <input
              type="number"
              value={settings.dailyStreakBonus || 50}
              onChange={(e) => setSettings({ ...settings, dailyStreakBonus: e.target.value })}
              className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
            />
          </div>
        </div>
      </form>

      {/* Mağaza Ürünleri */}
      <div className="bg-priv-card border border-priv-border rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-priv-border pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-400" />
              <span>Sunucu Mağazası Ürünleri</span>
            </h3>
            <p className="text-xs text-priv-textMuted mt-1">Üyelerin coin ile satın alabileceği roller ve rozetler:</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-priv-accent hover:bg-priv-accentHover text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-priv-accent/20"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Ürün Ekle</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-priv-textMuted">
            Henüz mağazada bir ürün bulunmuyor. "Yeni Ürün Ekle" butonuyla ilk rol veya eşyayı ekleyebilirsiniz.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-priv-hover border border-priv-border rounded-xl flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{item.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-priv-card border border-priv-border text-priv-textMuted">
                      {item.type}
                    </span>
                  </div>
                  <p className="text-xs text-priv-textMuted mt-1">{item.description}</p>
                  <p className="text-xs font-bold text-amber-400 mt-2">
                    {item.price.toLocaleString('tr-TR')} {settings.currencyName || 'Coin'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-priv-textMuted hover:text-red-400 hover:bg-priv-card rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ürün Ekleme Modalı */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddItem} className="bg-priv-card border border-priv-border rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Yeni Mağaza Ürünü Ekle</h3>
            <div>
              <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Ürün Adı</label>
              <input
                type="text"
                required
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Örn: Turuncu Rol veya VIP"
                className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Açıklama</label>
              <input
                type="text"
                required
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Örn: Sunucuda parlayan turuncu isim rengi"
                className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Fiyat (Coin)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                  className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Tür</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                  className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent"
                >
                  <option value="ROLE">Rol</option>
                  <option value="BADGE">Rozet</option>
                  <option value="TITLE">Ünvan</option>
                  <option value="COSMETIC">Kozmetik</option>
                  <option value="ITEM">Eşya</option>
                </select>
              </div>
            </div>
            {newItem.type === 'ROLE' && (
              <div>
                <label className="block text-xs font-bold text-priv-textMuted uppercase mb-1">Discord Rol ID</label>
                <input
                  type="text"
                  required
                  value={newItem.roleId}
                  onChange={(e) => setNewItem({ ...newItem, roleId: e.target.value })}
                  placeholder="Örn: 123456789012345678"
                  className="w-full bg-priv-hover border border-priv-border rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-priv-accent font-mono"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-priv-border">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-priv-textMuted hover:text-white transition"
              >
                İptal
              </button>
              <button
                type="submit"
                className="bg-priv-accent hover:bg-priv-accentHover text-white px-5 py-2 rounded-xl text-sm font-bold transition shadow-lg shadow-priv-accent/20"
              >
                Ürünü Ekle
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
