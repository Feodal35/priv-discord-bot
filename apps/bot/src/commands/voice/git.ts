import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits,
  VoiceBasedChannel,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { createEmbed, createErrorEmbed, createSuccessEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const gitCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('git')
    .setDescription('Bir üyenin bulunduğu ses kanalına gitmek için istek gönderir.')
    .addUserOption((opt) => opt.setName('üye').setDescription('Yanına gitmek istediğin üye').setRequired(true)),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const targetUser = interaction.options.getUser('üye', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz İstek', 'Kendi yanına gitme isteği gönderemezsin.')],
        ephemeral: true,
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({
        embeds: [createErrorEmbed('Geçersiz İstek', 'Botların ses odasına gidemezsin.')],
        ephemeral: true,
      });
      return;
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member?.voice.channel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Seste Değilsin', 'Bu komutu kullanmak için bir ses kanalında olmalısın!')],
        ephemeral: true,
      });
      return;
    }

    if (!targetMember?.voice.channel) {
      await interaction.reply({
        embeds: [createErrorEmbed('Üye Seste Değil', `<@${targetUser.id}> şu anda herhangi bir ses kanalında değil.`)],
        ephemeral: true,
      });
      return;
    }

    if (member.voice.channelId === targetMember.voice.channelId) {
      await interaction.reply({
        embeds: [createErrorEmbed('Zaten Aynı Odadasınız', `<@${targetUser.id}> ile zaten aynı ses kanalındasınız!`)],
        ephemeral: true,
      });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.MoveMembers)) {
      await interaction.reply({
        embeds: [createErrorEmbed('Yetki Hatası', 'Botun sunucuda `Üyeleri Taşı` yetkisi bulunmuyor.')],
        ephemeral: true,
      });
      return;
    }

    const targetVoice = targetMember.voice.channel as VoiceBasedChannel;

    // Eğer çağıranın zaten "MoveMembers" yetkisi varsa doğrudan taşınsın
    if (member.permissions.has(PermissionFlagsBits.MoveMembers)) {
      await member.voice.setChannel(targetVoice).catch(() => {});
      await interaction.reply({
        embeds: [
          createSuccessEmbed(
            'Odaya Gidildi',
            `👑 Yetkili olduğun için doğrudan <@${targetUser.id}> üyesinin bulunduğu **${targetVoice.name}** odasına taşındın!`
          ),
        ],
      });
      return;
    }

    // Yetkisi olmayanlar için oylamalı / butonlu istek
    const acceptBtn = new ButtonBuilder()
      .setCustomId(`git_accept_${interaction.id}`)
      .setLabel('Kabul Et')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);

    const declineBtn = new ButtonBuilder()
      .setCustomId(`git_decline_${interaction.id}`)
      .setLabel('Reddet')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);

    const embed = createEmbed({
      title: '🎙️ Ses Odasına Gitme İsteği',
      description: `👋 <@${targetUser.id}>, <@${interaction.user.id}> senin bulunduğun **${targetVoice.name}** ses odasına gelmek istiyor.\n\nKabul ediyor musun?`,
      color: DEFAULT_COLORS.PRIMARY as any,
      footer: { text: 'Yanıtlamak için 60 saniyen var.' },
    });

    const response = await interaction.reply({
      content: `<@${targetUser.id}>`,
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000,
    });

    collector.on('collect', async (i) => {
      // Yalnızca hedef kullanıcı butonlara tıklayabilir
      if (i.user.id !== targetUser.id) {
        await i.reply({
          content: '⚠️ Bu istek sana gönderilmedi, butonları yalnızca davet edilen üye kullanabilir.',
          ephemeral: true,
        });
        return;
      }

      if (i.customId === `git_accept_${interaction.id}`) {
        // İstek sahibinin hala seste olup olmadığını kontrol et
        const refreshedMember = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
        const refreshedTarget = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);

        if (!refreshedMember?.voice.channel) {
          await i.update({
            content: null,
            embeds: [createErrorEmbed('İptal Edildi', `<@${interaction.user.id}> artık bir ses kanalında olmadığı için işlem iptal edildi.`)],
            components: [],
          });
          return;
        }

        if (!refreshedTarget?.voice.channel) {
          await i.update({
            content: null,
            embeds: [createErrorEmbed('İptal Edildi', `<@${targetUser.id}> ses kanalından ayrıldığı için işlem iptal edildi.`)],
            components: [],
          });
          return;
        }

        try {
          await refreshedMember.voice.setChannel(refreshedTarget.voice.channel);
          await i.update({
            content: null,
            embeds: [
              createSuccessEmbed(
                'İstek Kabul Edildi!',
                `✅ <@${targetUser.id}> isteği kabul etti! <@${interaction.user.id}> başarıyla **${refreshedTarget.voice.channel.name}** odasına taşındı. 🎧`
              ),
            ],
            components: [],
          });
        } catch (err) {
          await i.update({
            content: null,
            embeds: [createErrorEmbed('Hata', 'Kullanıcı taşınırken bir yetki veya kanal hatası oluştu.')],
            components: [],
          });
        }
      } else if (i.customId === `git_decline_${interaction.id}`) {
        await i.update({
          content: null,
          embeds: [
            createEmbed({
              title: '❌ İstek Reddedildi',
              description: `<@${targetUser.id}>, <@${interaction.user.id}> üyesinin odaya gelme isteğini reddetti.`,
              color: DEFAULT_COLORS.DANGER as any,
            }),
          ],
          components: [],
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        const timeoutRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          acceptBtn.setDisabled(true),
          declineBtn.setDisabled(true)
        );
        await interaction.editReply({
          embeds: [
            createEmbed({
              title: '⏰ İstek Zaman Aşımına Uğradı',
              description: `<@${targetUser.id}> 60 saniye içinde yanıt vermediği için ses gitme isteği iptal edildi.`,
              color: DEFAULT_COLORS.SECONDARY as any,
            }),
          ],
          components: [timeoutRow],
        }).catch(() => {});
      }
    });
  },
};
