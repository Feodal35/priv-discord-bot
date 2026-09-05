import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  User,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { economyService } from '../../services/economy.service';
import { guildService } from '../../services/guild.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const duelloCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('düello')
    .setDescription('Başka bir üyeye bahisli düello teklif edersin.')
    .addUserOption((opt) =>
      opt
        .setName('üye')
        .setDescription('Meydan okumak istediğin kullanıcı')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('oyun')
        .setDescription('Oynamak istediğiniz düello oyunu')
        .setRequired(true)
        .addChoices(
          { name: '🎲 Zar Düellosu (Yüksek atan kazanır)', value: 'zar' },
          { name: '🔫 Rus Ruleti (6 hazneli, 1 mermi)', value: 'rus-ruleti' },
          { name: '✂️ Taş - Kağıt - Makas (Gizli seçim)', value: 'tkm' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('bahis')
        .setDescription('Ortaya koyulacak coin miktarı')
        .setRequired(true)
        .setMinValue(100)
        .setMaxValue(100000)
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

    const guildId = interaction.guild.id;
    const challenger = interaction.user;
    const targetUser = interaction.options.getUser('üye', true);
    const gameType = interaction.options.getString('oyun', true);
    const betAmount = interaction.options.getInteger('bahis', true);
    const settings = await guildService.getGuildSettings(guildId);

    if (!settings.economyEnabled || !settings.gamesEnabled) {
      await interaction.reply({
        embeds: [createErrorEmbed('Sistem Devre Dışı', 'Bu sunucuda oyun veya ekonomi sistemi kapalı.')],
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === challenger.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Düello', 'Kendi kendine düello teklif edemezsin!')],
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Düello', 'Botlara düello teklif edemezsin!')],
        ephemeral: true,
      });
      return;
    }

    // Her iki tarafın cüzdan bakiyesini kontrol et
    const cBal = await economyService.getBalance(guildId, challenger.id);
    if (cBal.coins < betAmount) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Yetersiz Cüzdan Bakiyesi',
            `Cüzdanında **${formatCurrency(betAmount)} ${settings.currencyName}** bulunmuyor! (Mevcut cüzdan: ${formatCurrency(cBal.coins)})`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const tBal = await economyService.getBalance(guildId, targetUser.id);
    if (tBal.coins < betAmount) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Rakipte Yetersiz Bakiye',
            `<@${targetUser.id}> cüzdanında bu bahis için yeterli coin bulunmuyor! (Gereken: ${formatCurrency(betAmount)} ${settings.currencyName})`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const gameNames: Record<string, string> = {
      zar: '🎲 Zar Düellosu',
      'rus-ruleti': '🔫 Rus Ruleti',
      tkm: '✂️ Taş - Kağıt - Makas',
    };
    const gameName = gameNames[gameType] || 'Düello';

    // 1. Davet Embed'i ve Butonlar
    const inviteEmbed = createEmbed({
      title: `⚔️ Bahisli Düello Daveti! — ${gameName}`,
      description:
        `🛡️ <@${targetUser.id}>, <@${challenger.id}> sana **${formatCurrency(betAmount)} ${settings.currencyName}** değerinde düello teklif ediyor!\n\n` +
        `🎮 **Oyun Modu:** ${gameName}\n` +
        `💰 **Toplam Havuz:** ${formatCurrency(betAmount * 2)} ${settings.currencyName} *(%5 sunucu kasası vergisi düşülecektir)*\n\n` +
        `⏳ Kararını vermek için **60 saniyen** var!`,
      color: DEFAULT_COLORS.PRIMARY as any,
    });

    const inviteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`duel_accept_${challenger.id}_${targetUser.id}`)
        .setLabel('Kabul Et')
        .setEmoji('⚔️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`duel_decline_${challenger.id}_${targetUser.id}`)
        .setLabel('Reddet')
        .setEmoji('🏳️')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await interaction.reply({
      content: `<@${targetUser.id}>`,
      embeds: [inviteEmbed],
      components: [inviteRow],
      fetchReply: true,
    });

    // 60 saniyelik davet yanıt toplayıcısı
    const inviteCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    inviteCollector.on('collect', async (btnInt) => {
      if (btnInt.user.id !== targetUser.id) {
        if (btnInt.user.id === challenger.id) {
          await btnInt.reply({
            content: '❌ Kendi davetini kabul edemez veya reddedemezsin! Rakibin karar vermesi bekleniyor.',
            ephemeral: true,
          });
        } else {
          await btnInt.reply({
            content: '❌ Bu düello daveti sana ait değil!',
            ephemeral: true,
          });
        }
        return;
      }

      if (btnInt.customId.startsWith('duel_decline_')) {
        inviteCollector.stop('declined');
        await btnInt.update({
          content: `<@${challenger.id}>`,
          embeds: [
            createEmbed({
              title: '🏳️ Düello Reddedildi',
              description: `<@${targetUser.id}> düello teklifini kabul etmedi ve geri çekildi.`,
              color: DEFAULT_COLORS.DANGER as any,
            }),
          ],
          components: [],
        });
        return;
      }

      if (btnInt.customId.startsWith('duel_accept_')) {
        inviteCollector.stop('accepted');

        // Bahisleri kilitler (ACID)
        const lockRes = await economyService.lockDuelBets(guildId, challenger.id, targetUser.id, betAmount);
        if (!lockRes.success) {
          await btnInt.update({
            embeds: [createErrorEmbed('Düello Başlatılamadı', lockRes.message || 'Bakiye yetersizliği.')],
            components: [],
          });
          return;
        }

        await btnInt.deferUpdate();

        // 2. Oyun Akışı
        if (gameType === 'zar') {
          await runDiceDuel(message, guildId, challenger, targetUser, betAmount, settings.currencyName);
        } else if (gameType === 'rus-ruleti') {
          await runRussianRouletteDuel(message, guildId, challenger, targetUser, betAmount, settings.currencyName);
        } else if (gameType === 'tkm') {
          await runTkmDuel(message, guildId, challenger, targetUser, betAmount, settings.currencyName);
        }
      }
    });

    inviteCollector.on('end', async (_: any, reason: string) => {
      if (reason === 'time') {
        await message.edit({
          content: null,
          embeds: [
            createEmbed({
              title: '⌛ Düello Zaman Aşımı',
              description: `<@${targetUser.id}> 60 saniye içinde yanıt vermediği için düello iptal edildi.`,
              color: DEFAULT_COLORS.SECONDARY as any,
            }),
          ],
          components: [],
        }).catch(() => {});
      }
    });
  },
};

/**
 * 🎲 Zar Düellosu Akışı
 */
async function runDiceDuel(
  message: any,
  guildId: string,
  p1: User,
  p2: User,
  betAmount: number,
  currencyName: string
) {
  let round = 1;
  let winner: User | null = null;
  let loser: User | null = null;
  let p1Score = 0;
  let p2Score = 0;

  while (!winner) {
    p1Score = Math.floor(Math.random() * 100) + 1;
    p2Score = Math.floor(Math.random() * 100) + 1;

    const rollingEmbed = createEmbed({
      title: `🎲 Zarlar Atılıyor... ${round > 1 ? `(Tur ${round})` : ''}`,
      description:
        `🎲 <@${p1.id}> ve <@${p2.id}> zarlarını fırlattı!\n\n` +
        `⏳ *Zarlar dönüyor... Sonuçlar hesaplanıyor...*`,
      color: DEFAULT_COLORS.GOLD as any,
    });

    await message.edit({ content: null, embeds: [rollingEmbed], components: [] });
    await sleep(2000);

    if (p1Score > p2Score) {
      winner = p1;
      loser = p2;
    } else if (p2Score > p1Score) {
      winner = p2;
      loser = p1;
    } else {
      round++;
      const tieEmbed = createEmbed({
        title: '⚖️ Berabere! Zarlar Tekrar Atılıyor...',
        description: `<@${p1.id}>: **${p1Score}** 🎲\n<@${p2.id}>: **${p2Score}** 🎲\n\nZarlar eşit geldi! 1 saniye sonra tekrar atılıyor...`,
        color: DEFAULT_COLORS.WARNING as any,
      });
      await message.edit({ embeds: [tieEmbed] });
      await sleep(2000);
    }
  }

  if (!winner || !loser) return;

  // Kazananı ödüllendir
  const payout = await economyService.payoutDuelWinner(
    guildId,
    winner.id,
    loser.id,
    betAmount,
    'Zar Düellosu'
  );

  const resultEmbed = createEmbed({
    title: `🏆 ZAR DÜELLOSU KAZANANI: ${winner.username}!`,
    description:
      `🎲 **ZAR SONUÇLARI:**\n` +
      `> 👤 <@${p1.id}>: **${p1Score}**\n` +
      `> 👤 <@${p2.id}>: **${p2Score}**\n\n` +
      `🎉 **Galip:** <@${winner.id}>\n` +
      `💰 **Kazanılan Net Ödül:** +${formatCurrency(payout.netPayout)} ${currencyName}\n` +
      `📈 **Net Kar:** +${formatCurrency(payout.winnerProfit)} ${currencyName}\n` +
      `🏛️ **Sunucu Vergisi (%5):** -${formatCurrency(payout.taxPaid)} ${currencyName}`,
    color: DEFAULT_COLORS.SUCCESS as any,
    footer: { text: 'Tebrikler! Zar düellosunu şanslı oyuncu kazandı.' },
  });

  await message.edit({ embeds: [resultEmbed], components: [] });
}

/**
 * 🔫 Rus Ruleti Düellosu Akışı
 */
async function runRussianRouletteDuel(
  message: any,
  guildId: string,
  p1: User,
  p2: User,
  betAmount: number,
  currencyName: string
) {
  let chambersLeft = 6;
  const bulletPosition = Math.floor(Math.random() * 6) + 1; // 1 ile 6 arasında mermi
  let currentStep = 1;
  let turnUser = Math.random() < 0.5 ? p1 : p2;

  let gameOver = false;
  let winner: User | null = null;
  let loser: User | null = null;

  while (!gameOver) {
    const isBullet = currentStep === bulletPosition;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rr_trigger_${turnUser.id}`)
        .setLabel(`Tetiği Çek (${turnUser.username})`)
        .setEmoji('🔫')
        .setStyle(ButtonStyle.Danger)
    );

    const stepEmbed = createEmbed({
      title: `🔫 Rus Ruleti Düellosu — Sıra: ${turnUser.username}`,
      description:
        `🎯 **Kalan Hazneler:** \`${chambersLeft} / 6\`\n` +
        `👤 **Sıradaki Oyuncu:** <@${turnUser.id}>\n\n` +
        `*Soğuk namluyu şakağına daya ve aşağıdaki butona tıklayarak tetiği çek! (30 saniye)*`,
      color: 0x2f3136,
    });

    await message.edit({
      content: `<@${turnUser.id}>`,
      embeds: [stepEmbed],
      components: [row],
    });

    try {
      const btnInteraction = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i: any) => i.customId.startsWith('rr_trigger_'),
        time: 30000,
      });

      if (btnInteraction.user.id !== turnUser.id) {
        await btnInteraction.reply({
          content: '❌ Sıra sende değil! Rakibinin tetiği çekmesi gerekiyor.',
          ephemeral: true,
        });
        continue;
      }

      await btnInteraction.deferUpdate();

      if (isBullet) {
        gameOver = true;
        loser = turnUser;
        winner = turnUser.id === p1.id ? p2 : p1;

        const bangEmbed = createEmbed({
          title: '💥 GÜÜÜÜM! SİLAH PATLADI!',
          description:
            `☠️ <@${loser.id}> tetiği çektiğinde namludan kurşun fırladı!\n\n` +
            `🏆 Hayatta kalarak düelloyu kazanan: **<@${winner.id}>**!`,
          color: DEFAULT_COLORS.DANGER as any,
        });

        await message.edit({ content: null, embeds: [bangEmbed], components: [] });
        await sleep(2000);
      } else {
        // Boş çıktı
        currentStep++;
        chambersLeft--;
        turnUser = turnUser.id === p1.id ? p2 : p1;

        const clickEmbed = createEmbed({
          title: '💨 *KLİK!* Boş Çıktı!',
          description:
            `Şanslısın! Hazne boş çıktı, hayattasın.\n` +
            `Sıradaki oyuncu: **<@${turnUser.id}>** hazırlanıyor...`,
          color: DEFAULT_COLORS.SUCCESS as any,
        });

        await message.edit({ content: null, embeds: [clickEmbed], components: [] });
        await sleep(1500);
      }
    } catch {
      // 30 saniye süre bitti, sıradaki oyuncu tetiği çekmedi (Hükmen mağlup)
      gameOver = true;
      loser = turnUser;
      winner = turnUser.id === p1.id ? p2 : p1;

      const forfeitEmbed = createEmbed({
        title: '⌛ Süre Doldu! Hükmen Mağlubiyet!',
        description: `<@${loser.id}> 30 saniye boyunca tetiği çekmeye cesaret edemedi ve kaçtı!\n🏆 Düelloyu hükmen <@${winner.id}> kazandı!`,
        color: DEFAULT_COLORS.WARNING as any,
      });

      await message.edit({ content: null, embeds: [forfeitEmbed], components: [] });
      await sleep(1500);
    }
  }

  if (winner && loser) {
    const payout = await economyService.payoutDuelWinner(
      guildId,
      winner.id,
      loser.id,
      betAmount,
      'Rus Ruleti'
    );

    const finalEmbed = createEmbed({
      title: `🏆 RUS RULETİ KAZANANI: ${winner.username}!`,
      description:
        `🔫 **Hayatta Kalan:** <@${winner.id}>\n` +
        `☠️ **Vurulan / Kaçan:** <@${loser.id}>\n\n` +
        `💰 **Kazanılan Toplam Ödül:** +${formatCurrency(payout.netPayout)} ${currencyName}\n` +
        `📈 **Net Kar:** +${formatCurrency(payout.winnerProfit)} ${currencyName}\n` +
        `🏛️ **Sunucu Vergisi (%5):** -${formatCurrency(payout.taxPaid)} ${currencyName}`,
      color: DEFAULT_COLORS.SUCCESS as any,
      footer: { text: 'Rus Ruleti büyük cesaret ve şans ister!' },
    });

    await message.edit({ content: null, embeds: [finalEmbed], components: [] });
  }
}

/**
 * ✂️ Taş - Kağıt - Makas Düellosu Akışı
 */
async function runTkmDuel(
  message: any,
  guildId: string,
  p1: User,
  p2: User,
  betAmount: number,
  currencyName: string
) {
  let winner: User | null = null;
  let loser: User | null = null;
  let p1Choice: string | null = null;
  let p2Choice: string | null = null;
  let round = 1;

  while (!winner) {
    p1Choice = null;
    p2Choice = null;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('tkm_rock').setLabel('Taş').setEmoji('🪨').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tkm_paper').setLabel('Kağıt').setEmoji('📄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tkm_scissors').setLabel('Makas').setEmoji('✂️').setStyle(ButtonStyle.Primary)
    );

    const promptEmbed = createEmbed({
      title: `✂️ Taş - Kağıt - Makas Düellosu ${round > 1 ? `(Tur ${round})` : ''}`,
      description:
        `İki oyuncu da aşağıdaki butonlardan gizli hamlesini seçmelidir!\n\n` +
        `👤 <@${p1.id}>: *Bekleniyor...* ⏳\n` +
        `👤 <@${p2.id}>: *Bekleniyor...* ⏳\n\n` +
        `⏱️ *Seçim için 45 saniye süreniz var.*`,
      color: DEFAULT_COLORS.PRIMARY as any,
    });

    await message.edit({
      content: `<@${p1.id}> <@${p2.id}>`,
      embeds: [promptEmbed],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 45000,
    });

    await new Promise<void>((resolve) => {
      collector.on('collect', async (i: any) => {
        if (i.user.id !== p1.id && i.user.id !== p2.id) {
          await i.reply({ content: '❌ Bu düello butonları sana ait değil!', ephemeral: true });
          return;
        }

        const choice = i.customId.replace('tkm_', '');
        const choiceLabels: Record<string, string> = {
          rock: '🪨 Taş',
          paper: '📄 Kağıt',
          scissors: '✂️ Makas',
        };

        if (i.user.id === p1.id) {
          if (p1Choice) {
            await i.reply({ content: 'Seçimini zaten yaptın!', ephemeral: true });
            return;
          }
          p1Choice = choice;
          await i.reply({ content: `✅ Hamlen kaydedildi: **${choiceLabels[choice]}**`, ephemeral: true });
        } else if (i.user.id === p2.id) {
          if (p2Choice) {
            await i.reply({ content: 'Seçimini zaten yaptın!', ephemeral: true });
            return;
          }
          p2Choice = choice;
          await i.reply({ content: `✅ Hamlen kaydedildi: **${choiceLabels[choice]}**`, ephemeral: true });
        }

        // Güncelle durumu
        const updatedPrompt = createEmbed({
          title: `✂️ Taş - Kağıt - Makas Düellosu ${round > 1 ? `(Tur ${round})` : ''}`,
          description:
            `İki oyuncu da aşağıdaki butonlardan gizli hamlesini seçmelidir!\n\n` +
            `👤 <@${p1.id}>: ${p1Choice ? '✅ *Seçim yapıldı*' : '⏳ *Bekleniyor...*'}\n` +
            `👤 <@${p2.id}>: ${p2Choice ? '✅ *Seçim yapıldı*' : '⏳ *Bekleniyor...*'}\n\n` +
            `⏱️ *Seçim için kalan süre bekleniyor...*`,
          color: DEFAULT_COLORS.PRIMARY as any,
        });
        await message.edit({ embeds: [updatedPrompt] });

        if (p1Choice && p2Choice) {
          collector.stop('both_chosen');
        }
      });

      collector.on('end', async (_: any, _reason: string) => {
        resolve();
      });
    });

    if (!p1Choice && !p2Choice) {
      // İkisi de seçmedi
      await economyService.refundDuelBets(guildId, p1.id, p2.id, betAmount);
      await message.edit({
        content: null,
        embeds: [createEmbed({ title: 'Düello İptal', description: 'İki oyuncu da seçim yapmadığı için bahisler iade edildi.', color: DEFAULT_COLORS.SECONDARY as any })],
        components: [],
      });
      return;
    } else if (!p1Choice) {
      winner = p2;
      loser = p1;
    } else if (!p2Choice) {
      winner = p1;
      loser = p2;
    } else {
      // İkisi de seçti
      const choiceLabels: Record<string, string> = {
        rock: '🪨 Taş',
        paper: '📄 Kağıt',
        scissors: '✂️ Makas',
      };

      if (p1Choice === p2Choice) {
        round++;
        const tieEmbed = createEmbed({
          title: '⚖️ Hamleler Aynı! Berabere!',
          description:
            `👤 <@${p1.id}>: **${choiceLabels[p1Choice]}**\n` +
            `👤 <@${p2.id}>: **${choiceLabels[p2Choice]}**\n\n` +
            `İki oyuncu da aynı hamleyi yaptı! 2 saniye sonra yeni tur başlıyor...`,
          color: DEFAULT_COLORS.WARNING as any,
        });
        await message.edit({ embeds: [tieEmbed], components: [] });
        await sleep(2000);
      } else if (
        (p1Choice === 'rock' && p2Choice === 'scissors') ||
        (p1Choice === 'scissors' && p2Choice === 'paper') ||
        (p1Choice === 'paper' && p2Choice === 'rock')
      ) {
        winner = p1;
        loser = p2;
      } else {
        winner = p2;
        loser = p1;
      }
    }
  }

  if (winner && loser) {
    const payout = await economyService.payoutDuelWinner(
      guildId,
      winner.id,
      loser.id,
      betAmount,
      'Taş-Kağıt-Makas'
    );

    const choiceLabels: Record<string, string> = {
      rock: '🪨 Taş',
      paper: '📄 Kağıt',
      scissors: '✂️ Makas',
    };

    const finalEmbed = createEmbed({
      title: `🏆 TKM DÜELLOSU KAZANANI: ${winner.username}!`,
      description:
        `🎮 **SEÇİMLER:**\n` +
        `> 👤 <@${p1.id}>: **${p1Choice ? choiceLabels[p1Choice] : 'Seçmedi'}**\n` +
        `> 👤 <@${p2.id}>: **${p2Choice ? choiceLabels[p2Choice] : 'Seçmedi'}**\n\n` +
        `🎉 **Kazanan:** <@${winner.id}>\n` +
        `💰 **Kazanılan Net Ödül:** +${formatCurrency(payout.netPayout)} ${currencyName}\n` +
        `📈 **Net Kar:** +${formatCurrency(payout.winnerProfit)} ${currencyName}\n` +
        `🏛️ **Sunucu Vergisi (%5):** -${formatCurrency(payout.taxPaid)} ${currencyName}`,
      color: DEFAULT_COLORS.SUCCESS as any,
      footer: { text: 'Tebrikler! Taş - Kağıt - Makas düellosunu usta taktikçi kazandı.' },
    });

    await message.edit({ content: null, embeds: [finalEmbed], components: [] });
  }
}
