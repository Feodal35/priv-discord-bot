# 👑 PRIV DISCORD BOT & WEB DASHBOARD EKOSİSTEMİ

Arkadaş gruplarının ve özel ("priv") toplulukların kullanımına özel geliştirilmiş; **%100 Türkçe**, modern, premium görünümlü, modüler ve production-ready seviyede Discord botu, REST API'si ve Web Yönetim Paneli (Dashboard).

---

## 🌟 Öne Çıkan Özellikler

- **👤 Zengin Profil & Sosyal Sistem:**
  - `/profil [@üye]` ile görsel seviye ilerleme çubuğu, bakiye, sıralama, ses süresi, mesaj adedi, ünvan ve rozetler.
  - İnteraktif profil butonları: `[🏆 Başarımlar]`, `[📊 İstatistik]`, `[💰 Envanter]`, `[🔥 Streak]`.
  - `/seviye`, `/başarımlar`, `/streak`.
- **⭐ XP & Seviye Motoru:**
  - 45 saniyelik anti-spam cooldown ve flood filtresi.
  - Otomatik seviye atlama kutlaması, seviye başına Coin ve Discord Rol ödülleri.
- **🔥 Günlük Streak (Ateş) Serisi:**
  - Europe/Istanbul zaman dilimi ile her gün aktiflik takibi.
  - 7, 14, 30, 60 ve 100 günlük kilometre taşı ödülleri ve özel ünvanlar.
- **🪙 Güvenli Ekonomi & Mağaza:**
  - Sunucuya özel para birimi adı ve emojisi (`🪙 Coin`).
  - `/bakiye`, `/günlük`, `/çalış`, `/görev`, `/market`, `/envanter`, `/gönder`.
  - Race-condition ve eksi bakiye korumalı **Database Transaction** mimarisi.
  - Dashboard üzerinden ürün (Rol, Rozet, Eşya vb.) ekleme/silme.
- **🎮 İnteraktif Mini Oyunlar (Buton Tabanlı):**
  - `/oyun xox @rakip`: 3x3 Discord buton gridi ile gerçek zamanlı Tic-Tac-Toe.
  - `/oyun tkm [@rakip]`: Taş, Kağıt, Makas düellosu.
  - `/oyun yazı-tura [bahis]`: Coin bahisli yazı-tura.
  - `/oyun zar [bahis]`: Bota karşı yüksek zar atma bahsi.
  - `/oyun sayı-tahmini`: 1-100 arası sayı bulma oyunu.
  - `/ship @üye`: Seeded aşk uyum yüzdesi, ilerleme çubuğu ve esprili Türkçe yorumlar.
- **🎤 Dinamik Geçici Ses Odaları (Join-to-Create):**
  - "Oda Oluştur" kanalına girildiğinde otomatik `🎤 [Kullanıcı]'nın Odası` açılır.
  - `/voice kilitle`, `/voice aç`, `/voice limit`, `/voice isim`, `/voice at` komutları.
  - Oda boşaldığında otomatik silinir; bot yeniden başladığında asılı kalan odalar temizlenir.
- **🤫 Anonim İtiraf & Canlı Anket:**
  - `/itiraf`: Discord modal penceresi ile güvenli anonim itiraf paylaşımı.
  - `/anket`: Butonlu interaktif canlı oylama.
- **🎂 Doğum Günü & ⏰ Kalıcı Hatırlatıcı:**
  - `/doğumgünü`: Günü geldiğinde otomatik kutlama ve hediye coin.
  - `/hatırlat 15dk Not`: Bot yeniden başlasa dahi veritabanından çalışan kalıcı zamanlayıcı.
- **🛡️ Moderasyon & AutoMod & Audit Log:**
  - `/uyar`, `/timeout`, `/sustur`, `/at`, `/yasakla`, `/temizle`, `/kilitle`, `/aç`.
  - Hiyerarşi güvenliği: Botun ve yetkilinin rol seviyesi kontrol edilir.
  - AutoMod: Spam, flood, reklam davet linkleri, aşırı caps ve yasaklı kelime cezalandırıcısı.
  - Detaylı Türkçe olay logları.
- **🌐 Modern Web Dashboard:**
  - Discord OAuth2 ile oturum açma (Yalnızca yetkili olunan sunucular listelenir).
  - Dark SaaS teması (Tailwind CSS).
  - Recharts ile 7 günlük mesaj ve ses aktivite grafikleri, seviye dağılımı.
  - Mağaza yönetimi, sunucu kanal bağlantıları ve AutoMod ayarları.

---

## 🏗️ Proje Mimarisi (Monorepo)

```
discord-bot/
├── apps/
│   ├── bot/                 # Discord.js v14 Bot uygulaması
│   ├── api/                 # Express REST API (OAuth2 & Dashboard Backend)
│   └── dashboard/           # React 18 + Vite + Tailwind CSS Web Dashboard
├── packages/
│   ├── database/            # Prisma ORM şeması, istemci & seed
│   ├── shared/              # Ortak tipler, hesaplama yardımcıları & sabitler
│   └── config/              # Zod ortam değişkenleri doğrulayıcısı
├── docker-compose.yml       # PostgreSQL, Redis, Bot, API servisleri
├── Dockerfile               # Çok aşamalı (multi-stage) Docker imajı
└── .env.example             # Çevre değişkenleri şablonu
```

---

## 📋 Gereksinimler

- **Node.js**: `v20.0.0` veya üzeri (Node 22 / 24 tam uyumlu)
- **NPM**: `v9.0.0` veya üzeri
- **PostgreSQL**: `v15` veya üzeri (Yerel veya Docker üzerinden)
- **Discord Bot Token**: Discord Developer Portal üzerinden alınmış token

---

## ⚙️ Discord Developer Portal Ayarları

Botunuzun tüm özellikleriyle eksiksiz çalışabilmesi için Discord Portal'da şu adımları tamamlayın:

1. [Discord Developer Portal](https://discord.com/developers/applications) adresine gidin.
2. **"New Application"** butonuna tıklayın ve bir isim verin (Örn: `Priv`).
3. Sol menüden **"Bot"** sekmesine gelin:
   - **"Reset Token"** diyerek tokenınızı kopyalayın (`DISCORD_TOKEN`).
   - **Privileged Gateway Intents** bölümündeki 3 seçeneği de MUTLAKA açın:
     - ✅ **Presence Intent**
     - ✅ **Server Members Intent** (Karşılama, seviye rolleri ve profil için zorunlu)
     - ✅ **Message Content Intent** (AutoMod, XP ve komutlar için zorunlu)
4. Sol menüden **"OAuth2"** sekmesine gelin:
   - **Client ID** ve **Client Secret** değerlerini kopyalayın (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`).
   - **Redirects** kısmına şunu ekleyin:
     `http://localhost:4000/api/auth/callback` (Production için kendi alan adınızı yazın).
5. **URL Generator** sekmesinden bot davet linkinizi oluşturun:
   - **Scopes:** `bot`, `applications.commands`
   - **Bot Permissions:** `Administrator` (veya Manage Channels, Manage Roles, Kick Members, Ban Members, Manage Messages, Moderate Members, View Audit Log, Connect, Speak, Move Members).

---

## 🚀 Hızlı Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin

```powershell
# Windows PowerShell için:
npm.cmd install
```

### 2. Çevre Değişkenlerini Hazırlayın

`.env.example` dosyasını `.env` olarak kopyalayın ve bilgilerinizi girin:

```powershell
copy .env.example .env
```

`.env` içeriğini düzenleyin:
```env
DISCORD_TOKEN=botunuzun_tokeni
DISCORD_CLIENT_ID=application_client_id
DISCORD_CLIENT_SECRET=oauth2_client_secret
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/priv_discord_bot?schema=public
DASHBOARD_URL=http://localhost:5173
API_URL=http://localhost:4000
DISCORD_REDIRECT_URI=http://localhost:4000/api/auth/callback
```

### 3. Veritabanı Şemasını Oluşturun ve Başarımları Yükleyin

PostgreSQL veritabanınız çalışır durumdayken:

```powershell
# Prisma istemcisini oluştur
npm.cmd run db:generate

# Veritabanı tablolarını senkronize et
npm.cmd run db:push

# Başarımları ve varsayılan görevleri tohumla (seed)
npm.cmd run db:seed
```

### 4. Slash Komutlarını Discord'a Yükleyin

```powershell
npm.cmd run deploy:commands -w apps/bot
```

### 5. Uygulamaları Başlatın

**Discord Botunu Başlatmak İçin:**
```powershell
npm.cmd run dev:bot
```

**REST API Sunucusunu Başlatmak İçin:**
```powershell
npm.cmd run dev:api
```

**Web Dashboard'u Başlatmak İçin:**
```powershell
npm.cmd run dev:dashboard
```

Tarayıcınızdan `http://localhost:5173` adresine giderek kontrol panelini açabilirsiniz!

---

## 🐳 Docker ile Tek Komutta Çalıştırma

Tüm PostgreSQL veritabanını, botu ve API'yi Docker ile ayağa kaldırmak için:

```bash
docker compose up -d --build
```

---

## 🧪 Testleri Çalıştırma

Kritik iş mantığı birim testlerini çalıştırmak için:

```powershell
npm.cmd test
```

---

## 💬 İlk Kurulum Sihirbazı (/kurulum)

Botu sunucunuza ekledikten sonra bir yetkili olarak herhangi bir kanala:

```
/kurulum
```

yazarak adım adım sihirbazı başlatabilirsiniz. Sihirbazdaki **"Priv Kanallarını Otomatik Oluştur 🛠️"** butonuna basıldığında bot saniyeler içinde `#priv-itiraf`, `#priv-log` ve `➕ Oda Oluştur` ses kanallarını otomatik olarak oluşturup yetkilendirmelerini yapılandırır.

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
