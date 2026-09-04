import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { SlashCommand } from '../../types/command';
import { clanRoleService, CLAN_ROLE_ID } from '../../services/clanRole.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed';
import { DEFAULT_COLORS } from '@priv/shared';

export const guildMuafiyetCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('guild-muafiyet')
    .setDescription('Guild/Klan rolü için istisna (muafiyet) yönetimi. Klanı olmasa bile rolü korur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addStringOption((opt) =>
      opt
        .setName('işlem')
        .setDescription('Yapmak istediğin işlem')
        .setRequired(true)
        .addChoices(
          { name: 'Korumaya Ekle (Rolü korur/verir)', value: 'ekle' },
          { name: 'Korumadan Çıkar (Otomatik kontrole sokar)', value: 'çıkar' },
          { name: 'Muafiyet Listesini Görüntüle', value: 'liste' }
        )
    )
    .addUserOption((opt) => opt.setName('üye').setDescription('İşlem yapılacak üye').setRequired(false)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir.', ephemeral: true });
      return;
    }

    const action = interaction.options.getString('işlem', true);
    const targetUser = interaction.options.getUser('üye');

    if (action === 'liste') {
      const userIds = clanRoleService.getExemptions(interaction.guild.id);
      if (userIds.length === 0) {
        await interaction.reply({
          embeds: [createEmbed({ title: '🛡️ Guild Muafiyet Listesi', description: 'Şu anda manuel muafiyete alınmış üye bulunmuyor.' })],
          ephemeral: true,
        });
        return;
      }

      const listText = userIds.map((id, idx) => `${idx + 1}. <@${id}> (\`${id}\`)`).join('\n');
      const embed = createEmbed({
        title: '🛡️ Guild Muafiyet Listesi',
        description: `Aşağıdaki üyeler klan rozetine sahip olmasa bile <@&${CLAN_ROLE_ID}> rolü bot tarafından **asla geri alınmaz**:\n\n${listText}`,
        color: DEFAULT_COLORS.PRIMARY as any,
        footer: { text: `Toplam ${userIds.length} üye muaf tutuluyor.` },
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (!targetUser) {
      await interaction.reply({
        embeds: [createErrorEmbed('Eksik Bilgi', 'Lütfen işlem yapılacak üyeyi seçin.')],
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (action === 'ekle') {
      clanRoleService.addExemption(interaction.guild.id, targetUser.id);

      // Üyede rol yoksa rolü de ver
      let roleText = '';
      if (member) {
        const role = interaction.guild.roles.cache.get(CLAN_ROLE_ID);
        if (role && !member.roles.cache.has(CLAN_ROLE_ID)) {
          await member.roles.add(role).catch(() => {});
          roleText = ` ve <@&${CLAN_ROLE_ID}> rolü verildi`;
        }
      }

      const embed = createSuccessEmbed(
        'Muafiyete Eklendi',
        `✅ <@${targetUser.id}> başarıyla Guild rolü muafiyetine eklendi${roleText}!\n\n_Bu üye klan rozetini taşımasa bile bot tarafından rolü asla geri alınmayacak._`
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'çıkar') {
      const removed = clanRoleService.removeExemption(interaction.guild.id, targetUser.id);
      if (!removed) {
        await interaction.reply({
          embeds: [createErrorEmbed('Kayıt Bulunamadı', `<@${targetUser.id}> zaten muafiyet listesinde değil.`)],
          ephemeral: true,
        });
        return;
      }

      // Tekrar standart denetime sok
      if (member) {
        await clanRoleService.checkAndSyncMember(member).catch(() => {});
      }

      const embed = createSuccessEmbed(
        'Muafiyetten Çıkarıldı',
        `✅ <@${targetUser.id}> muafiyet listesinden çıkarıldı. Artık standart klan/guild denetimine tabi tutulacak.`
      );
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
