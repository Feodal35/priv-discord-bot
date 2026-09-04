import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { gamesService } from '../../services/games.service';
import { economyService } from '../../services/economy.service';
import { questService } from '../../services/quest.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS, formatCurrency } from '@priv/shared';

export const oyunCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('oyun')
    .setDescription('Mini oyunlar oynayarak eğlen ve coin kazan!')
    .addSubcommand((sub) =>
      sub
        .setName('xox')
        .setDescription('Bir arkadaşınla buton tabanlı interaktif XOX (Tic-Tac-Toe) oyna.')
        .addUserOption((opt) => opt.setName('rakip').setDescription('Karşılaşmak istediğin üye').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('tkm')
        .setDescription('Taş, Kağıt, Makas oyunu oyna.')
        .addUserOption((opt) => opt.setName('rakip').setDescription('Rakip üye (Boş bırakırsan botla oynarsın)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('yazı-tura')
        .setDescription('Coin bahsiyle yazı-tura at.')
        .addStringOption((opt) =>
          opt
            .setName('seçim')
            .setDescription('Tahminin')
            .setRequired(true)
            .addChoices({ name: 'Yazı', value: 'yazi' }, { name: 'Tura', value: 'tura' })
        )
        .addIntegerOption((opt) => opt.setName('bahis').setDescription('Bahis miktarı (Coin)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('zar')
        .setDescription('Bota karşı zar at ve yüksek atan kazansın.')
        .addIntegerOption((opt) => opt.setName('bahis').setDescription('Bahis miktarı (Coin)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('sayı-tahmini').setDescription('1 ile 100 arasında tutulan sayıyı tahmin etme oyunu başlatır.')
    ),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // 1. XOX
    if (subcommand === 'xox') {
      const opponent = interaction.options.getUser('rakip', true);
      if (opponent.id === userId) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Rakip', 'Kendine karşı XOX oynayamazsın!')],
          ephemeral: true,
        });
        return;
      }
      if (opponent.bot) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Rakip', 'Botlara karşı XOX oynayamazsın!')],
          ephemeral: true,
        });
        return;
      }

      const game = gamesService.createXoxGame(guildId, userId, opponent.id);

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let c = 0; c < 3; c++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`xox_${game.id}_${r}_${c}`)
              .setLabel('➖')
              .setStyle(ButtonStyle.Secondary)
          );
        }
        rows.push(row);
      }

      const embed = createEmbed({
        title: '❌ XOX Düellosu ⭕',
        description: `**X:** <@${userId}>\n**O:** <@${opponent.id}>\n\nSıra: <@${userId}> (**X**)`,
        color: DEFAULT_COLORS.PRIMARY,
      });

      await interaction.reply({
        content: `<@${userId}> vs <@${opponent.id}>`,
        embeds: [embed],
        components: rows,
      });
      await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1);
    }

    // 2. TAŞ KAĞIT MAKAS
    else if (subcommand === 'tkm') {
      const opponent = interaction.options.getUser('rakip');
      const opponentId = opponent ? opponent.id : 'BOT';

      if (opponent && opponent.id === userId) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Rakip', 'Kendinle oynayamazsın!')],
          ephemeral: true,
        });
        return;
      }

      const game = gamesService.createTkmGame(guildId, userId, opponentId);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`tkm_${game.id}_TAS`).setLabel('🪨 Taş').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`tkm_${game.id}_KAGIT`).setLabel('📄 Kağıt').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`tkm_${game.id}_MAKAS`).setLabel('✂️ Makas').setStyle(ButtonStyle.Primary)
      );

      const embed = createEmbed({
        title: '🪨 Taş - 📄 Kağıt - ✂️ Makas',
        description: opponentId === 'BOT'
          ? 'Bota karşı oynuyorsun! Aşağıdaki butonlardan birini seç:'
          : `<@${userId}> ile <@${opponentId}> karşı karşıya! İki taraf da seçimini butonlardan yapsın.`,
        color: DEFAULT_COLORS.INFO,
      });

      await interaction.reply({ embeds: [embed], components: [row] });
      await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1);
    }

    // 3. YAZI-TURA
    else if (subcommand === 'yazı-tura') {
      const bet = interaction.options.getInteger('bahis', true);
      const choice = interaction.options.getString('seçim', true);

      if (bet <= 0) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Bahis', 'Bahis miktarı 0\'dan büyük olmalıdır.')],
          ephemeral: true,
        });
        return;
      }

      const balance = await economyService.getBalance(guildId, userId);
      if (balance.coins < bet) {
        await interaction.reply({
          embeds: [createErrorEmbed('Yetersiz Bakiye', `Cüzdanında **${formatCurrency(balance.coins)} Coin** var, bu bahsi oynayamazsın.`)],
          ephemeral: true,
        });
        return;
      }

      const outcomes = ['yazi', 'tura'];
      const result = outcomes[Math.floor(Math.random() * outcomes.length)];
      const won = result === choice;

      if (won) {
        await economyService.modifyBalance(guildId, userId, bet, 'ADD', 'Yazı-Tura Kazancı');
        const embed = createSuccessEmbed(
          'Yazı-Tura Kazandın!',
          `🪙 Para havaya atıldı ve **${result.toUpperCase()}** geldi!\n\n🎉 Tebrikler! Bahsin olan **+${formatCurrency(bet)} Coin** kazandın!`
        );
        await interaction.reply({ embeds: [embed] });
      } else {
        await economyService.modifyBalance(guildId, userId, bet, 'REMOVE', 'Yazı-Tura Kaybı');
        const embed = createErrorEmbed(
          'Yazı-Tura Kaybettin',
          `🪙 Para havaya atıldı ve **${result.toUpperCase()}** geldi.\n\n😢 Maalesef **-${formatCurrency(bet)} Coin** kaybettin. Şansını tekrar dene!`
        );
        await interaction.reply({ embeds: [embed] });
      }

      await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1);
    }

    // 4. ZAR
    else if (subcommand === 'zar') {
      const bet = interaction.options.getInteger('bahis', true);

      if (bet <= 0) {
        await interaction.reply({
          embeds: [createErrorEmbed('Geçersiz Bahis', 'Bahis miktarı 0\'dan büyük olmalıdır.')],
          ephemeral: true,
        });
        return;
      }

      const balance = await economyService.getBalance(guildId, userId);
      if (balance.coins < bet) {
        await interaction.reply({
          embeds: [createErrorEmbed('Yetersiz Bakiye', `Cüzdanında **${formatCurrency(balance.coins)} Coin** var, bu bahsi oynayamazsın.`)],
          ephemeral: true,
        });
        return;
      }

      const userRoll = Math.floor(Math.random() * 6) + 1;
      const botRoll = Math.floor(Math.random() * 6) + 1;

      if (userRoll > botRoll) {
        await economyService.modifyBalance(guildId, userId, bet, 'ADD', 'Zar Oyunu Kazancı');
        const embed = createSuccessEmbed(
          'Zar Oyununu Kazandın!',
          `🎲 Senin Zarın: **${userRoll}**\n🤖 Botun Zarı: **${botRoll}**\n\n🎉 Tebrikler! Daha yüksek atarak **+${formatCurrency(bet)} Coin** kazandın!`
        );
        await interaction.reply({ embeds: [embed] });
      } else if (userRoll < botRoll) {
        await economyService.modifyBalance(guildId, userId, bet, 'REMOVE', 'Zar Oyunu Kaybı');
        const embed = createErrorEmbed(
          'Zar Oyununu Kaybettin',
          `🎲 Senin Zarın: **${userRoll}**\n🤖 Botun Zarı: **${botRoll}**\n\n😢 Bot daha yüksek attı ve **-${formatCurrency(bet)} Coin** kaybettin.`
        );
        await interaction.reply({ embeds: [embed] });
      } else {
        const embed = createEmbed({
          title: '🎲 Zar Berabere!',
          description: `Sen: **${userRoll}** | Bot: **${botRoll}**\n\nZarlar eşit geldiği için coin kaybetmedin.`,
          color: DEFAULT_COLORS.WARNING,
        });
        await interaction.reply({ embeds: [embed] });
      }

      await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1);
    }

    // 5. SAYI TAHMİNİ
    else if (subcommand === 'sayı-tahmini') {
      const targetNumber = Math.floor(Math.random() * 100) + 1;
      const embed = createEmbed({
        title: '🔢 Sayı Tahmin Oyunu',
        description: '1 ile 100 arasında aklımdan bir sayı tuttum!\n\nBakalım ilk kim bulacak? Sohbet kanalına tahminlerinizi yazın!',
        color: DEFAULT_COLORS.PURPLE,
        footer: { text: `Gizli Sayı Tutuldu • Bol şans!` },
      });

      await interaction.reply({ embeds: [embed] });
      await questService.incrementProgress(guildId, userId, 'PLAY_GAME', 1);
    }
  },
};
