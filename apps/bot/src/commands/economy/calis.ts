import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createWarningEmbed } from '../../utils/embed';
import { formatCurrency } from '@priv/shared';

// 25 farklı iş kategorisi — rastgele seçilir
const JOBS: Array<{ emoji: string; title: string; action: string; multiplier: number }> = [
  { emoji: '💻', title: 'Yazılım Geliştirici', action: 'sunucu için yeni bir özellik kodladın ve deploy ettin', multiplier: 1.2 },
  { emoji: '🎨', title: 'Grafik Tasarımcı', action: 'sunucu için özel emojiler ve banner tasarladın', multiplier: 1.0 },
  { emoji: '🎵', title: 'DJ', action: 'ses kanalında saatlerce müzik yayınladın ve herkesi eğlendirdin', multiplier: 0.9 },
  { emoji: '📸', title: 'Fotoğrafçı', action: 'sunucu etkinliğini fotoğrafladın ve düzenleme yaptın', multiplier: 1.0 },
  { emoji: '🛡️', title: 'Moderatör', action: 'sunucuyu tüm kurala aykırı içeriklerden temizledin', multiplier: 1.1 },
  { emoji: '📝', title: 'İçerik Üreticisi', action: 'sunucu için blog yazısı ve duyuru metni hazırladın', multiplier: 0.95 },
  { emoji: '🎮', title: 'Oyun Organizatörü', action: 'sunucu turnuvasını organize edip ödülleri dağıttın', multiplier: 1.15 },
  { emoji: '🔧', title: 'Sistem Yöneticisi', action: 'bot ayarlarını optimize edip sunucunun performansını artırdın', multiplier: 1.2 },
  { emoji: '🎭', title: 'Etkinlik Koordinatörü', action: 'haftalık sunucu etkinliğini planladın ve yürüttün', multiplier: 1.1 },
  { emoji: '📊', title: 'Analist', action: 'sunucu büyüme raporunu hazırlayıp yöneticilere sundun', multiplier: 1.05 },
  { emoji: '🍕', title: 'Aşçı', action: 'sunucu üyelerine sanal yemek partisi düzenledin', multiplier: 0.85 },
  { emoji: '🚀', title: 'Sosyal Medya Yöneticisi', action: 'sunucuyu tanıtmak için sosyal medya içeriği oluşturdun', multiplier: 1.0 },
  { emoji: '🌟', title: 'Tanıtımcı', action: 'sunucuyu partner sunucularda tanıtarak yeni üyeler kazandırdın', multiplier: 1.25 },
  { emoji: '📚', title: 'Eğitmen', action: 'yeni üyelere sunucuyu anlatan rehber hazırladın', multiplier: 0.9 },
  { emoji: '🎯', title: 'Reklamcı', action: 'sunucu için dikkat çekici bir reklam afişi hazırladın', multiplier: 1.0 },
  { emoji: '🔍', title: 'Araştırmacı', action: 'rakip sunucuları inceleyerek yenilik önerileri sundun', multiplier: 0.95 },
  { emoji: '💡', title: 'Fikir Üreticisi', action: 'sunucu için onlarca yaratıcı fikir geliştirdin', multiplier: 0.85 },
  { emoji: '🎤', title: 'Sunucu', action: 'sunucu ses etkinliğinde ev sahipliği yaptın', multiplier: 1.1 },
  { emoji: '🛒', title: 'Market Görevlisi', action: 'sunucu marketini güncelleyip ürün açıklamalarını düzenledin', multiplier: 0.9 },
  { emoji: '⚖️', title: 'Hakem', action: 'sunucu üyeleri arasındaki anlaşmazlığı tarafsızca çözdün', multiplier: 1.05 },
  { emoji: '🎬', title: 'Video Editörü', action: 'sunucu tanıtım videosu için klip düzenleme yaptın', multiplier: 1.15 },
  { emoji: '🧹', title: 'Kanal Temizleyici', action: 'sunucu kanallarını ve rolleri düzenleyip temizledin', multiplier: 0.8 },
  { emoji: '🤝', title: 'Müzakereci', action: 'partner anlaşması için diğer sunucu yöneticileriyle görüştün', multiplier: 1.3 },
  { emoji: '🧑‍🏫', title: 'Mentor', action: 'yeni üyelere rehberlik ederek onların sunucuya ısınmalarını sağladın', multiplier: 1.0 },
  { emoji: '🔐', title: 'Güvenlik Uzmanı', action: 'sunucuya sızan raid girişimini önledin ve önlem aldın', multiplier: 1.4 },
];

// Nadir bonus eventi şansı: %8
const RARE_BONUS_CHANCE = 0.08;
const RARE_EVENTS = [
  { title: '🍀 Şanslı Gün!', desc: 'Bugün şansın açık! Patronun memnun kaldı ve ekstra prim verdi.' },
  { title: '💎 Performans Ödülü!', desc: 'Mükemmel çalışman fark edildi ve özel ödül kazandın.' },
  { title: '🎰 Beklenmedik Bahşiş!', desc: 'Bir müşteri memnuniyetinden dolayı sürpriz bahşiş bıraktı.' },
  { title: '⚡ Hız Rekoru!', desc: 'İşini rekor sürede bitirdin ve bonus ödeme aldın.' },
  { title: '🌟 Ayın Çalışanı!', desc: 'Bu ay boyunca sergilediğin performans nedeniyle ödüllendirildin.' },
];

export const calisCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('çalış')
    .setDescription('Sunucu için bir iş yaparak coin kazanırsın (1 saat bekleme süresi).'),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const settings = await guildService.getGuildSettings(interaction.guild.id);
    if (!settings.economyEnabled) {
      await interaction.reply({ content: '⚠️ Bu sunucuda ekonomi sistemi devre dışı bırakılmış.', ephemeral: true });
      return;
    }

    // Cooldown kontrolü
    const res = await economyService.claimWork(interaction.guild.id, interaction.user.id);

    if (!res.success) {
      const remainingMin = res.remainingMinutes || 0;
      const finishAt = Math.floor((Date.now() + remainingMin * 60 * 1000) / 1000);

      const embed = createWarningEmbed(
        '⏳ Dinlenme Zamanı',
        `Şu an dinleniyorsun! Tekrar çalışabilmek için biraz daha beklemelisin.\n\n` +
        `⏰ **Bir sonraki çalışma:** <t:${finishAt}:R> (<t:${finishAt}:t>)\n\n` +
        `_Bu süre zarfında \`/günlük\` veya \`/balık-tut\` deneyebilirsin!_`
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Çalışıyorsun... animasyonu
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    const workingEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${job.emoji} Çalışıyorsun...`)
      .setDescription(`**${job.title}** olarak çalışıyorsun.\n\n*${job.action}...*\n\n⏳ Biraz bekle...`)
      .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));

    await interaction.reply({ embeds: [workingEmbed] });

    // 2 saniyelik animasyon gecikmesi
    await new Promise((r) => setTimeout(r, 2000));

    // Nadir bonus eventi
    const isRare = Math.random() < RARE_BONUS_CHANCE;
    const bonusMultiplier = isRare ? 2.0 : 1.0;
    const gainedCoins = Math.round(res.gainedCoins! * job.multiplier * bonusMultiplier);

    // Veritabanındaki miktarı güncelle (fark varsa)
    const diff = gainedCoins - res.gainedCoins!;
    if (diff > 0) {
      await economyService.modifyBalance(interaction.guild.id, interaction.user.id, diff, 'ADD', 'Çalış Bonus (Multiplier)');
    }

    const rareEvent = isRare ? RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)] : null;

    const successColor = isRare ? 0xf1c40f : 0x2ecc71;

    const resultEmbed = new EmbedBuilder()
      .setColor(successColor)
      .setTitle(`${job.emoji} ${job.title} — İş Tamamlandı!`)
      .setDescription(
        `✅ **${interaction.user.username}**, bugün **${job.title}** olarak çalıştın!\n\n` +
        `📋 *"${job.action}"*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 **Kazanılan:** \`+${formatCurrency(gainedCoins)} ${settings.currencyName}\`` +
        (isRare && rareEvent ? `\n\n✨ **${rareEvent.title}**\n*${rareEvent.desc}*` : '') +
        `\n\n_Bir sonraki çalışma: \`${settings.workCooldownMinutes} dakika\` sonra_`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }))
      .setFooter({ text: `${interaction.guild.name} • Ekonomi Sistemi` })
      .setTimestamp();

    await interaction.editReply({ embeds: [resultEmbed] });
  },
};
