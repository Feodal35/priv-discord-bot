import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Sparkles, MessageSquare, Mic, Trophy, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const { user, login } = useAuth();

  return (
    <div className="min-h-screen bg-priv-bg text-white flex flex-col justify-between selection:bg-priv-accent selection:text-white">
      {/* Üst Menü */}
      <nav className="h-20 border-b border-priv-border flex items-center justify-between px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <span className="w-10 h-10 rounded-xl bg-priv-accent flex items-center justify-center font-black text-xl shadow-lg shadow-priv-accent/30">
            P
          </span>
          <span className="font-extrabold text-2xl tracking-tight">Priv Bot</span>
        </div>

        <div>
          {user ? (
            <Link
              to="/servers"
              className="bg-priv-accent hover:bg-priv-accentHover text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-priv-accent/20 flex items-center gap-2"
            >
              <span>Panele Git</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              onClick={login}
              className="bg-priv-accent hover:bg-priv-accentHover text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-lg shadow-priv-accent/20 flex items-center gap-2"
            >
              <span>Discord ile Giriş Yap</span>
            </button>
          )}
        </div>
      </nav>

      {/* Hero Alanı */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-priv-hover border border-priv-border text-xs font-semibold text-priv-accent mb-8">
          <Sparkles className="w-4 h-4" />
          <span>Priv Sunucularına Özel Sosyal Ekosistem</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Sunucunun Kendi <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Sosyal Platformu</span>
        </h1>

        <p className="text-lg md:text-xl text-priv-textMuted max-w-2xl mx-auto mb-10 leading-relaxed">
          Arkadaş gruplarınız ve priv Discord topluluğunuz için özel olarak tasarlanmış seviye, ekonomi, dinamik ses odaları, anonim itiraf, streak ve interaktif mini oyunlar!
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={login}
            className="w-full sm:w-auto bg-priv-accent hover:bg-priv-accentHover text-white px-8 py-4 rounded-2xl font-bold text-base transition shadow-xl shadow-priv-accent/25 flex items-center justify-center gap-3"
          >
            <span>Discord ile Başla</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Özellikler Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
          <div className="bg-priv-card border border-priv-border p-6 rounded-2xl">
            <div className="p-3 bg-priv-hover rounded-xl text-purple-400 w-fit mb-4">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Seviye, XP & Streak</h3>
            <p className="text-sm text-priv-textMuted">
              Spam korumalı adil XP motoru, günlük aktiflik ateşi ve özel rol ödülleri.
            </p>
          </div>

          <div className="bg-priv-card border border-priv-border p-6 rounded-2xl">
            <div className="p-3 bg-priv-hover rounded-xl text-emerald-400 w-fit mb-4">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Dinamik Geçici Ses</h3>
            <p className="text-sm text-priv-textMuted">
              Odaya girildiğinde anında açılan kişisel ses kanalları, kilit ve limit kontrol paneli.
            </p>
          </div>

          <div className="bg-priv-card border border-priv-border p-6 rounded-2xl">
            <div className="p-3 bg-priv-hover rounded-xl text-blue-400 w-fit mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">AutoMod & Güvenlik</h3>
            <p className="text-sm text-priv-textMuted">
              Spam, reklam daveti, caps ve küfür filtreleri ile 7/24 kesintisiz moderasyon.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-priv-border py-8 text-center text-xs text-priv-textMuted">
        <p>© 2026 Priv Bot Ekosistemi — Tüm hakları saklıdır. KVKK uyumlu gizlilik odaklı mimari.</p>
      </footer>
    </div>
  );
};
