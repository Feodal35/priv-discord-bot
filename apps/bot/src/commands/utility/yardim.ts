import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { DEFAULT_COLORS, EMOJIS } from '@priv/shared';

const CATEGORIES: Record<string, { emoji: string; title: string; description: string; commands: Array<{ name: string; desc: string }> }> = {
  social: {
    emoji: '👤',
    title: 'Sosyal & Evlilik',
    description: 'Profil, seviye, evlilik ve sosyal komutlar',
    commands: [
      { name: '/profil', desc: 'Kendi veya başkasının profil kartını görüntüler' },
      { name: '/seviye', desc: 'XP ve seviye istatistiklerini gösterir' },
      { name: '/streak', desc: 'Günlük aktivite serisini gösterir' },
      { name: '/başarımlar', desc: 'Kazanılan rozetleri ve başarımları listeler' },
      { name: '/hafıza', desc: 'Kişisel notları ve anıları saklar' },
      { name: '/yılözeti', desc: 'Yıl bazlı aktivite özetini görüntüler' },
      { name: '/zengin', desc: 'Boost\'çulara özel sunucu isim değiştirme' },
      { name: '/evlen', desc: 'Bir üyeye evlenme teklifi gönderir (yüzük gerekli)' },
      { name: '/evlilik', desc: 'Evlilik cüzdanı ve ortak kasa yönetimi' },
      { name: '/boşan', desc: 'Boşanma davası açar ve tazminat uygular' },
    ],
  },
  economy: {
    emoji: '💰',
    title: 'Ekonomi & Market',
    description: 'Para kazanma, harcama, bankacılık ve ticaret komutları',
    commands: [
      { name: '/bakiye', desc: 'Cüzdan ve banka bakiyesini görüntüler' },
      { name: '/banka', desc: 'Banka kasasına para yatırır veya cüzdana çeker' },
      { name: '/soy', desc: 'Başka bir üyenin cüzdanını gizlice soymaya çalışır' },
      { name: '/kasa-aç', desc: 'Bronz, Gümüş veya Elmas şans sandığı açar' },
      { name: '/günlük', desc: 'Günlük ödülü toplar, streak artırır' },
      { name: '/çalış', desc: '25 farklı iş arasından coin kazanır (1s cooldown)' },
      { name: '/gönder', desc: 'Başka bir üyeye güvenli coin transferi yapar' },
      { name: '/market', desc: 'Sunucu mağazasını sayfalı görüntüler ve satın alır' },
      { name: '/envanter', desc: 'Sahip olduğun tüm eşyaları listeler' },
      { name: '/görev', desc: 'Günlük/haftalık görevleri ve ilerlemeni gösterir' },
    ],
  },
  games: {
    emoji: '🎮',
    title: 'Mini Oyunlar & Kumar',
    description: 'Şans oyunları, kart oyunları ve kullanıcı düelloları',
    commands: [
      { name: '/düello', desc: 'Üyeler arası bahisli Zar, Rus Ruleti ve TKM düellosu' },
      { name: '/balık-tut', desc: '8 farklı balık arasından yakalamaya çalış (20s cd)' },
      { name: '/slot', desc: 'Slot makinesi (50-50,000 coin), 30x\'e kadar ödül' },
      { name: '/blackjack', desc: 'Krupiyeye karşı 21 oyunu' },
      { name: '/rulet', desc: 'Renk veya sayı seçerek rulet çarkı çevir' },
      { name: '/kelime-oyun', desc: 'Kelime bulma mini oyunu' },
      { name: '/ship', desc: 'İki üye arasındaki uyum yüzdesini hesaplar' },
      { name: '/oyun', desc: 'XOX, Taş-Kağıt-Makas ve Zar oyunları' },
    ],
  },
  voice: {
    emoji: '🎤',
    title: 'Ses & Dinamik Odalar',
    description: 'Geçici ses odaları ve ses yönetimi',
    commands: [
      { name: '/voice kilitle', desc: 'Geçici odayı kilitler (sadece izinliler girebilir)' },
      { name: '/voice aç', desc: 'Kilitli odanın kilidini açar' },
      { name: '/voice limit', desc: 'Odaya kişi limiti koyar' },
      { name: '/topluçek', desc: 'Birden fazla üyeyi ses odasına çeker (Yetkili)' },
      { name: '/toplutaşı', desc: 'Birden fazla üyeyi ses odasına taşır (Yetkili)' },
    ],
  },
  moderation: {
    emoji: '🛡️',
    title: 'Moderasyon & Güvenlik',
    description: 'Üye yönetimi ve sunucu güvenlik araçları',
    commands: [
      { name: '/uyar', desc: 'Kullanıcıyı uyarır, DM ile bildirir ve log kaydı tutar' },
      { name: '/sustur', desc: 'Kullanıcıyı belirli süre sessize alır, DM ile bildirir' },
      { name: '/timeout', desc: 'Discord timeout uygular (max 28 gün), DM ile bildirir' },
      { name: '/at', desc: 'Kullanıcıyı sunucudan atar, DM ile bildirir' },
      { name: '/yasakla', desc: 'Kalıcı ban uygular, DM ile bildirir' },
      { name: '/temizle', desc: 'Kanaldaki mesajları toplu siler (isteğe bağlı üye filtresi)' },
      { name: '/sesgec', desc: 'Ses geçiş geçmişini gösterir' },
      { name: '/kilitle', desc: 'Kanalı kilitler (herkes yazamaz)' },
      { name: '/aç', desc: 'Kilitli kanalı açar' },
    ],
  },
  utility: {
    emoji: '⚙️',
    title: 'Sunucu & Araçlar',
    description: 'Sunucu araçları, duyurular ve yapılandırma',
    commands: [
      { name: '/sunucu', desc: 'Detaylı sunucu istatistiklerini gösterir (boost, üye, ekonomi)' },
      { name: '/sıralama', desc: 'Liderlik tablosu (5 kategori, anlık geçiş butonları)' },
      { name: '/anket', desc: 'Buton tabanlı interaktif anket başlatır (süreli)' },
      { name: '/say', desc: 'Sayma/hedef belirleme modu' },
      { name: '/itiraf', desc: 'Anonim itiraf paneli' },
      { name: '/doğumgünü', desc: 'Doğum günü kaydeder ve hatırlatma yapar' },
      { name: '/hatırlat', desc: 'Belirli zamanda hatırlatma koyar' },
      { name: '/çekiliş', desc: 'Çekiliş başlatır ve yönetir' },
      { name: '/rol-panel', desc: 'Kendi kendine rol alma paneli oluşturur' },
      { name: '/booster-renk', desc: 'Boost\'çulara özel renk rolü paneli' },
      { name: '/yardım', desc: 'Bu komut listesini gösterir' },
    ],
  },
};

export const yardimCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('yardım')
    .setDescription('Priv Bot komutlarını ve özelliklerini kategoriler halinde listeler.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const mainEmbed = new EmbedBuilder()
      .setColor(DEFAULT_COLORS.PRIMARY as any)
      .setTitle(`${EMOJIS.SETTINGS} Priv Bot — Yardım Merkezi`)
      .setDescription(
        'Sunucumuzun sosyal ekosistemine hoş geldin! **Priv Bot**, arkadaş topluluğumuz için özel olarak geliştirilmiş premium bir Discord botudur.\n\n' +
        '📌 **Aşağıdaki kategorilerden birini seçerek komutları incele:**'
      )
      .addFields(
        { name: '👤 Sosyal & Evlilik',      value: '`/profil`, `/evlen`, `/evlilik`, `/boşan`, `/zengin`, ...', inline: true },
        { name: '💰 Ekonomi & Market',       value: '`/bakiye`, `/banka`, `/soy`, `/kasa-aç`, `/market`, ...', inline: true },
        { name: '🎮 Mini Oyunlar & Kumar',   value: '`/düello`, `/balık-tut`, `/slot`, `/blackjack`, ...', inline: true },
        { name: '🎤 Ses & Dinamik Odalar',   value: '`/topluçek`, `/toplutaşı`, `/voice`, ...', inline: true },
        { name: '🛡️ Moderasyon & Güvenlik', value: '`/uyar`, `/sustur`, `/at`, `/yasakla`, `/temizle`, ...', inline: true },
        { name: '⚙️ Sunucu & Araçlar',      value: '`/sunucu`, `/sıralama`, `/anket`, `/çekiliş`, ...', inline: true },
      )
      .setFooter({ text: 'Detaylı komut açıklamaları için aşağıdaki menüyü kullanabilirsin.' })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('help_category_select')
      .setPlaceholder('📂 Bir kategori seçerek komutları incele...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Sosyal & Evlilik').setValue('social').setEmoji('👤').setDescription('Profil, evlilik ve sosyal komutlar'),
        new StringSelectMenuOptionBuilder().setLabel('Ekonomi & Market').setValue('economy').setEmoji('💰').setDescription('Para kazanma, harcama ve ticaret'),
        new StringSelectMenuOptionBuilder().setLabel('Mini Oyunlar').setValue('games').setEmoji('🎮').setDescription('Şans oyunları ve mini aktiviteler'),
        new StringSelectMenuOptionBuilder().setLabel('Ses & Odalar').setValue('voice').setEmoji('🎤').setDescription('Geçici ses odaları ve ses yönetimi'),
        new StringSelectMenuOptionBuilder().setLabel('Moderasyon').setValue('moderation').setEmoji('🛡️').setDescription('Üye yönetimi ve güvenlik araçları'),
        new StringSelectMenuOptionBuilder().setLabel('Sunucu & Araçlar').setValue('utility').setEmoji('⚙️').setDescription('Sunucu araçları ve yapılandırma'),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({ embeds: [mainEmbed], components: [row] });
  },
};

// Handler için dışa aktarılan yardımcı fonksiyon
export function buildCategoryEmbed(categoryKey: string): EmbedBuilder | null {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return null;

  const lines = cat.commands.map((c) => `> **${c.name}** — ${c.desc}`).join('\n');

  return new EmbedBuilder()
    .setColor(DEFAULT_COLORS.PRIMARY as any)
    .setTitle(`${cat.emoji} ${cat.title}`)
    .setDescription(`*${cat.description}*\n\n${lines}`)
    .setFooter({ text: 'Priv Bot — Yardım Merkezi' });
}
