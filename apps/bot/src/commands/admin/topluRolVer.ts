import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  ComponentType,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { isBotOwner } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { registerService } from '../../services/register.service';
import { logService } from '../../services/log.service';
import { createProgressBar } from '@priv/shared';
import { createErrorEmbed } from '../../utils/embed';

// Kullanıcının belirttiği zorunlu kayıtsız rol ID'si (Bu roldekilere ASLA dokunulmaz!)
export const DEFAULT_UNREGISTERED_ROLE_ID = '1543035840287215767';

// Sunucu başına aynı anda yalnızca 1 toplu rol işlemi çalıştırılabilir
const activeMassRoleGuilds = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Tamamlanmak üzere';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins} dk ${secs} sn`;
  }
  return `${secs} sn`;
}

export const topluRolVerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('toplu-rol-ver')
    .setDescription('Sunucudaki üyelere güvenli, rate-limit korumalı şekilde toplu rol verir veya alır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption((opt) =>
      opt.setName('rol').setDescription('İşlem yapılacak (verilecek / alınacak) rol').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('hedef')
        .setDescription('Rolün uygulanacağı kitle')
        .setRequired(true)
        .addChoices(
          { name: '👥 Tüm Sunucu Üyeleri (Kayıtsızlar Hariç)', value: 'HERKESE' },
          { name: '🎭 Belirli Bir Role Sahip Olanlar', value: 'ROLE_OZEL' }
        )
    )
    .addRoleOption((opt) =>
      opt
        .setName('kaynak_rol')
        .setDescription('Hedef olarak "Belirli Bir Role Sahip Olanlar" seçildiyse bu rolü seçin')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('islem')
        .setDescription('Yapılacak işlem türü (Varsayılan: Rol Ver)')
        .setRequired(false)
        .addChoices(
          { name: '➕ Rolü Ekle (Ver)', value: 'VER' },
          { name: '➖ Rolü Kaldır (Al)', value: 'AL' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('gecikme')
        .setDescription('Üyeler arası bekleme süresi (ms, Varsayılan: 1200ms - Ne çok hızlı ne çok yavaş)')
        .setRequired(false)
        .setMinValue(800)
        .setMaxValue(5000)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('botlar_dahil')
        .setDescription('Botlara da rol verilsin mi? (Varsayılan: Hayır)')
        .setRequired(false)
    ),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'Bu komut yalnızca sunucularda kullanılabilir.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const isOwner = isBotOwner(interaction.user.id);
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      isOwner;

    if (!hasPerm) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetkisiz İşlem', 'Bu komutu kullanmak için **Rolleri Yönet** yetkisine sahip olmalısın.')],
        ephemeral: true,
      });
      return;
    }

    // Aktif işlem kontrolü (Mutex Lock)
    if (activeMassRoleGuilds.has(guild.id)) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'İşlem Devam Ediyor',
            'Bu sunucuda şu anda devam eden bir toplu rol işlemi bulunuyor!\nLütfen mevcut işlemin tamamlanmasını bekleyin.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const targetRole = interaction.options.getRole('rol', true);
    const hedef = interaction.options.getString('hedef', true);
    const kaynakRol = interaction.options.getRole('kaynak_rol');
    const islem = interaction.options.getString('islem') || 'VER';
    const delayMs = interaction.options.getInteger('gecikme') || 1200;
    const botlarDahil = interaction.options.getBoolean('botlar_dahil') || false;

    // Hedef rol kontrolleri
    if (targetRole.id === guild.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Rol', '@everyone rolü toplu verilemez veya alınamaz.')],
        ephemeral: true,
      });
      return;
    }

    if (targetRole.managed) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yönetilen Rol',
            `**${targetRole.name}** rolü bir entegrasyona, bota veya nitro takviyesine bağlı olduğu için bot tarafından manuel yönetilemez.`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Bot hiyerarşi kontrolü
    const botMember = guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetki Hatası', 'Botun sunucuda **Rolleri Yönet** yetkisi bulunmuyor!')],
        ephemeral: true,
      });
      return;
    }

    if (botMember.roles.highest.position <= targetRole.position) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Hiyerarşi Hatası',
            `Botun en yüksek rolü, işlem yapılmak istenen <@&${targetRole.id}> rolünden daha düşük veya eşit seviyede!\n` +
            `Lütfen Discord Sunucu Ayarları > Roller kısmından botun rolünü <@&${targetRole.id}> rolünün üstüne taşıyın.`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Yetkili hiyerarşi kontrolü (Sunucu sahibi ve bot sahibi hariç)
    const userMember = interaction.member as GuildMember;
    if (guild.ownerId !== interaction.user.id && !isOwner) {
      if (userMember.roles.highest.position <= targetRole.position) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Yetki Yetersiz',
              `Kendi en yüksek rolünden daha yüksek veya eşit seviyedeki bir rolü (<@&${targetRole.id}>) başkalarına veremez veya alamazsın.`
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    // Kaynak rol zorunluluğu kontrolü
    if (hedef === 'ROLE_OZEL') {
      if (!kaynakRol) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              'Eksik Parametre',
              'Hedef olarak **Belirli Bir Role Sahip Olanlar** seçildiğinde bir **kaynak_rol** belirtmelisin!'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (kaynakRol.id === targetRole.id && islem === 'VER') {
        await interaction.reply({
          embeds: [createErrorEmbed('Hatalı Seçim', 'Kaynak rol ile verilecek hedef rol aynı olamaz.')],
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.deferReply();

    // Hariç tutulacak roller (Zorunlu Kayıtsız ID'si + Varsa kayıt ayarlarındaki kayıtsız ID)
    const excludedRoleIds = new Set<string>([DEFAULT_UNREGISTERED_ROLE_ID]);
    const regSettings = registerService.getSettings(guild.id);
    if (regSettings?.unregisteredRoleId) {
      excludedRoleIds.add(regSettings.unregisteredRoleId);
    }

    // Üyeleri eksiksiz çek
    let allMembers;
    try {
      allMembers = await guild.members.fetch();
    } catch (err) {
      console.error('[TOPLU-ROL] Üyeler çekilirken hata:', err);
      allMembers = guild.members.cache;
    }

    const queue: GuildMember[] = [];
    let skippedUnregistered = 0;
    let alreadyHad = 0;
    let skippedBots = 0;
    let skippedNoSourceRole = 0;

    for (const [, member] of allMembers) {
      // Bot kontrolü
      if (!botlarDahil && member.user.bot) {
        skippedBots++;
        continue;
      }

      // KESİNLİKLE KAYITSIZLARI ATLA
      const isUnregistered = member.roles.cache.some((r) => excludedRoleIds.has(r.id));
      if (isUnregistered) {
        skippedUnregistered++;
        continue;
      }

      // Belirli bir role sahip olanlar filtresi
      if (hedef === 'ROLE_OZEL' && kaynakRol) {
        if (!member.roles.cache.has(kaynakRol.id)) {
          skippedNoSourceRole++;
          continue;
        }
      }

      // Zaten hedef roldeki durumu kontrol et (Gereksiz API isteğini önle)
      const hasTargetRole = member.roles.cache.has(targetRole.id);
      if (islem === 'VER' && hasTargetRole) {
        alreadyHad++;
        continue;
      }
      if (islem === 'AL' && !hasTargetRole) {
        alreadyHad++;
        continue;
      }

      queue.push(member);
    }

    // İşlem yapılacak üye yoksa
    if (queue.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('ℹ️ İşlem Yapılacak Üye Bulunamadı')
        .setDescription(
          `Belirtilen kriterlere göre güncellenecek üye bulunamadı.\n\n` +
          `• 🎯 **Hedef Rol:** <@&${targetRole.id}>\n` +
          (kaynakRol ? `• 🎭 **Kaynak Rol Filtresi:** <@&${kaynakRol.id}>\n` : '') +
          `• 🚫 **Kayıtsız Rolünde Olduğu İçin Atlanan:** \`${skippedUnregistered} üye\`\n` +
          `• ⏭️ **Zaten Durumu Uygun Olan:** \`${alreadyHad} üye\`\n` +
          `• 🤖 **Atlanan Botlar:** \`${skippedBots} bot\``
        )
        .setFooter({ text: 'Kayıtsız rolündeki üyelere güvenlik gereği asla rol verilmez.' });

      await interaction.editReply({ embeds: [emptyEmbed] });
      return;
    }

    // Sunucu kilidini aç
    activeMassRoleGuilds.add(guild.id);

    const totalToProcess = queue.length;
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let isCancelled = false;
    const startTime = Date.now();

    const stopButtonId = `stop_mass_role_${Date.now()}_${interaction.user.id}`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(stopButtonId)
        .setLabel('🛑 İşlemi Durdur')
        .setStyle(ButtonStyle.Danger)
    );

    const actionText = islem === 'VER' ? 'Rol Verme' : 'Rol Alma';
    const targetScopeText =
      hedef === 'HERKESE'
        ? '👥 Tüm Sunucu (Kayıtsızlar Hariç)'
        : `🎭 <@&${kaynakRol!.id}> Rolündekiler (Kayıtsızlar Hariç)`;

    const buildProgressEmbed = (isDone = false, wasCancelled = false) => {
      const percent = Math.min(100, Math.round((processedCount / totalToProcess) * 100));
      const bar = createProgressBar(percent, 14);
      const remainingSeconds = Math.max(0, Math.ceil(((totalToProcess - processedCount) * delayMs) / 1000));
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

      let color = 0x3498db; // Mavi (İşleniyor)
      let title = `⏳ Toplu ${actionText} Devam Ediyor...`;

      if (isDone) {
        if (wasCancelled) {
          color = 0xe67e22; // Turuncu (İptal)
          title = `🛑 Toplu ${actionText} Yönetici Tarafından Durduruldu`;
        } else {
          color = 0x2ecc71; // Yeşil (Tamamlandı)
          title = `✅ Toplu ${actionText} Başarıyla Tamamlandı!`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
          `**İşlem Bilgileri:**\n` +
          `• 🎯 **İşlem Yapılan Rol:** <@&${targetRole.id}>\n` +
          `• 👥 **Hedef Kitle:** ${targetScopeText}\n` +
          `• ⚙️ **İşlem Hızı:** Her \`${delayMs}ms\` (\`~1.2 saniye\`) - *Rate Limit Korumalı*\n\n` +
          `**İlerleme Durumu:**\n` +
          `\`${bar}\` **%${percent}** (\`${processedCount}/${totalToProcess}\`)\n\n` +
          `**Detaylı İstatistikler:**\n` +
          `• ✅ **Başarılı:** \`${successCount}\`\n` +
          `• ❌ **Hatalı:** \`${failCount}\`\n` +
          `• ⏭️ **Zaten Sahip / Atlanan:** \`${alreadyHad}\`\n` +
          `• 🚫 **Kayıtsız (Dokunulmayan):** \`${skippedUnregistered}\`\n` +
          (!isDone ? `• ⏱️ **Tahmini Kalan Süre:** \`${formatDuration(remainingSeconds)}\`` : `• ⏱️ **Toplam Süre:** \`${formatDuration(elapsedSeconds)}\``)
        )
        .setFooter({
          text: isDone
            ? 'İşlem tamamlandı • Priv Bot Güvenli Rol Sistemi'
            : 'İşlemi iptal etmek için aşağıdaki "🛑 İşlemi Durdur" butonuna basabilirsiniz.',
        })
        .setTimestamp();

      return embed;
    };

    const initialMsg = await interaction.editReply({
      embeds: [buildProgressEmbed(false)],
      components: [row],
    });

    // Durdur butonu toplayıcısı
    const collector = initialMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: Math.max(60_000, totalToProcess * delayMs * 2),
    });

    collector.on('collect', async (btn) => {
      if (btn.customId === stopButtonId) {
        const canStop =
          btn.user.id === interaction.user.id ||
          btn.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
          isBotOwner(btn.user.id);

        if (!canStop) {
          await btn.reply({ content: '❌ Bu işlemi yalnızca başlatan yetkili durdurabilir!', ephemeral: true });
          return;
        }

        isCancelled = true;
        collector.stop('cancelled');
        await btn.reply({ content: '🛑 Toplu rol işlemi durduruluyor, lütfen bekleyin...', ephemeral: true });
      }
    });

    let lastEditTime = Date.now();
    const auditReason = `Toplu ${actionText}: ${interaction.user.tag} (${interaction.user.id}) tarafından başlatıldı`;

    try {
      for (const member of queue) {
        if (isCancelled) break;

        try {
          if (islem === 'VER') {
            await member.roles.add(targetRole.id, auditReason);
          } else {
            await member.roles.remove(targetRole.id, auditReason);
          }
          successCount++;
        } catch (err: any) {
          // 429 Rate Limit Yakalama ve Otomatik Bekleme
          if (err?.status === 429 || err?.code === 429) {
            const retryAfter = (err?.rawError?.retry_after ?? 5) * 1000 + 500;
            console.warn(`[TOPLU-ROL] Rate limit alındı. ${retryAfter}ms bekleniyor...`);
            await sleep(retryAfter);

            try {
              if (islem === 'VER') {
                await member.roles.add(targetRole.id, auditReason);
              } else {
                await member.roles.remove(targetRole.id, auditReason);
              }
              successCount++;
            } catch {
              failCount++;
            }
          } else {
            failCount++;
          }
        }

        processedCount++;

        // Canlı Arayüzü Güncelle (Discord Edit Rate Limitini korumak için en az 4.5 saniyede bir veya son üye)
        const now = Date.now();
        if (now - lastEditTime >= 4500 || processedCount === totalToProcess || isCancelled) {
          lastEditTime = now;
          await interaction.editReply({
            embeds: [buildProgressEmbed(false, false)],
            components: isCancelled ? [] : [row],
          }).catch(() => {});
        }

        // Rate limit korumalı güvenli bekleme
        await sleep(delayMs);
      }
    } finally {
      activeMassRoleGuilds.delete(guild.id);
      collector.stop('finished');
    }

    // Nihai Rapor Embed'i
    const finalEmbed = buildProgressEmbed(true, isCancelled);
    await interaction.editReply({
      embeds: [finalEmbed],
      components: [],
    }).catch(() => {});

    // Moderasyon / Rol Güncelleme Logu
    await logService.logEvent(
      guild.id,
      'ROLE_UPDATE',
      `Toplu ${actionText} Gerçekleştirildi`,
      `**Yetkili:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)\n` +
      `**İşlem:** Toplu ${actionText}\n` +
      `**Uygulanan Rol:** <@&${targetRole.id}>\n` +
      `**Hedef Kapsam:** ${targetScopeText}\n` +
      `**Sonuç:** \`${successCount} başarılı\`, \`${failCount} hatalı\`, \`${alreadyHad} atlanan\`, \`${skippedUnregistered} kayıtsız korundu\`\n` +
      `**Durum:** ${isCancelled ? '🛑 Yönetici Tarafından Durduruldu' : '✅ Başarıyla Tamamlandı'}`,
      interaction.client,
      undefined,
      { color: isCancelled ? 0xe67e22 : 0x2ecc71 }
    ).catch(() => {});
  },
};
