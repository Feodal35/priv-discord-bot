import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { marriageService } from '../../services/marriage.service';
import { createEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const evlenCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('evlen')
    .setDescription('Sevdiğin bir üyeye romantik bir evlenme teklifi gönderir.')
    .addUserOption((opt) =>
      opt
        .setName('üye')
        .setDescription('Evlenme teklifi etmek istediğin kullanıcı')
        .setRequired(true)
    ),
  cooldown: 15,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda geçerlidir.', ephemeral: true });
      return;
    }

    const guildId = interaction.guild.id;
    const author = interaction.user;
    const targetUser = interaction.options.getUser('üye', true);

    if (targetUser.id === author.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Teklif', 'Kendine evlenme teklifi edemezsin!')],
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz Teklif', 'Botlarla evlenemezsin!')],
        ephemeral: true,
      });
      return;
    }

    // Market yüzüklerini kontrol et/ekle
    await marriageService.ensureRingsInShop(guildId);

    // 1. Zaten evli mi kontrolü
    const authorMarriage = await marriageService.getMarriage(guildId, author.id);
    if (authorMarriage) {
      const partnerId = authorMarriage.user1Id === author.id ? authorMarriage.user2Id : authorMarriage.user1Id;
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Zaten Evlisin!',
            `Sen zaten şu anda <@${partnerId}> ile evlisin! Yeni bir evlilik yapabilmek için önce \`/boşan\` komutunu kullanmalısın.`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const targetMarriage = await marriageService.getMarriage(guildId, targetUser.id);
    if (targetMarriage) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Kişi Zaten Evli',
            `<@${targetUser.id}> şu anda zaten başka biriyle evli!`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // 2. Yüzük kontrolü
    const userRing = await marriageService.getUserRing(guildId, author.id);
    if (!userRing) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            'Evlilik Yüzüğü Gerekli!',
            `💍 Evlenme teklifi edebilmek için envanterinde bir **Evlilik Yüzüğü** olmalıdır!\n\n` +
            `Marketteki (\`/market\`) yüzük seçenekleri:\n` +
            `• 💍 **Gümüş Yüzük:** 2.500 Coin\n` +
            `• 💛 **Altın Yüzük:** 10.000 Coin\n` +
            `• 💎 **Pırlanta Yüzük:** 50.000 Coin\n\n` +
            `Yüzüğü satın aldıktan sonra tekrar teklif edebilirsin!`
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const ring = userRing.ringInfo;

    // 3. Teklif Mesajı ve Butonlar
    const embed = createEmbed({
      title: '💍 Romantik Bir Evlenme Teklifi!',
      description:
        `💖 <@${targetUser.id}>, <@${author.id}> sana **${ring.emoji} ${ring.name}** ile evlenme teklifi ediyor!\n\n` +
        `*"Seninle birlikte bir ömür geçirmek, aynı ses odalarında XP boostları kazanmak ve aşk dolu bir yuva kurmak istiyorum..."*\n\n` +
        `⏳ Kararını vermek için **60 saniyen** var!`,
      color: ring.type === 'DIAMOND' ? 0x00ffff : ring.type === 'GOLD' ? 0xffd700 : 0xff2a6d,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`marry_accept_${author.id}_${targetUser.id}`)
        .setLabel('Evet, Kabul Ediyorum!')
        .setEmoji('💍')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`marry_reject_${author.id}_${targetUser.id}`)
        .setLabel('Üzgünüm, Reddediyorum')
        .setEmoji('💔')
        .setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await interaction.reply({
      content: `<@${targetUser.id}>`,
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // 60 saniyelik collector
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on('collect', async (btnInt) => {
      if (btnInt.user.id !== targetUser.id) {
        await btnInt.reply({
          content: '❌ Bu teklif sana yapılmadı! Sadece teklif edilen kişi yanıtlayabilir.',
          ephemeral: true,
        });
        return;
      }

      if (btnInt.customId.startsWith('marry_accept_')) {
        // Yüzüğü kontrol et ve evlendir
        const currentRing = await marriageService.getUserRing(guildId, author.id);
        if (!currentRing) {
          await btnInt.reply({
            content: '❌ Teklif sahibinin envanterinde artık yüzük bulunmuyor.',
            ephemeral: true,
          });
          collector.stop('no_ring');
          return;
        }

        await marriageService.marry(
          guildId,
          author.id,
          targetUser.id,
          currentRing.ringInfo.type,
          currentRing.inventoryId
        );

        const successEmbed = createEmbed({
          title: '🎉 TEBRİKLER! YENİ BİR AİLE KURULDU! 💍',
          description:
            `🎊 <@${targetUser.id}> teklifi sevinçle **KABUL ETTİ**!\n\n` +
            `❤️ <@${author.id}> ve <@${targetUser.id}> artık resmen evli bir çift!\n\n` +
            `✨ **Kazanılan Ayrıcalıklar:**\n` +
            `• 🔊 **Aşk Boostu:** Aynı ses odasındayken **+%50 daha fazla XP** ve her dakika **+1 Aşk Puanı** kazanırsınız!\n` +
            `• 📜 **/evlilik:** Evlilik cüzdanınızı görüntüleyebilir ve ortak kasanızı yönetebilirsiniz.\n` +
            `• ${currentRing.ringInfo.emoji} Takılan Yüzük: **${currentRing.ringInfo.name}**\n\n` +
            `*Bir yastıkta kocayın!* 🎉🥂`,
          color: DEFAULT_COLORS.SUCCESS,
        });

        await btnInt.update({
          content: null,
          embeds: [successEmbed],
          components: [],
        });
        collector.stop('accepted');
      } else if (btnInt.customId.startsWith('marry_reject_')) {
        const rejectEmbed = createEmbed({
          title: '💔 Teklif Reddedildi...',
          description: `<@${targetUser.id}>, <@${author.id}> tarafından yapılan evlilik teklifini nazikçe reddetti.\n\n*Yüzük sahibinde kaldı.*`,
          color: DEFAULT_COLORS.DANGER,
        });

        await btnInt.update({
          content: null,
          embeds: [rejectEmbed],
          components: [],
        });
        collector.stop('rejected');
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        const timeoutEmbed = createEmbed({
          title: '⏳ Süre Doldu',
          description: `<@${targetUser.id}> 60 saniye içinde yanıt vermediği için teklif zaman aşımına uğradı.`,
          color: DEFAULT_COLORS.WARNING,
        });
        await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
      }
    });
  },
};
