import { Interaction, PermissionsBitField } from 'discord.js';
import { commands } from '../client';
import { userContextMenus, messageContextMenus } from '../interactions/contextMenus';
import { handleButtonInteraction, handleModalInteraction, handleSelectMenuInteraction } from '../interactions/handlers';
import { cooldownManager } from '../utils/cooldown';
import { createErrorEmbed } from '../utils/embed';
import { logger } from '../utils/logger';

export async function onInteractionCreate(interaction: Interaction) {
  try {
    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn(`Bilinmeyen komut çağrıldı: /${interaction.commandName}`);
        return;
      }

      // Cooldown Kontrolü
      if (command.cooldown && interaction.guild) {
        const cd = cooldownManager.check(command.data.name, interaction.user.id, command.cooldown);
        if (cd.onCooldown) {
          const remainingText = cooldownManager.formatRemaining(cd.remainingSeconds);
          await interaction.reply({
            embeds: [
              createErrorEmbed(
                'Yavaşla Biraz!',
                `Bu komutu tekrar kullanabilmek için lütfen **${remainingText}** bekle.`
              ),
            ],
            ephemeral: true,
          });
          return;
        }
      }

      // Yetki Kontrolü
      if (command.userPermissions && interaction.memberPermissions) {
        for (const perm of command.userPermissions) {
          if (!interaction.memberPermissions.has(perm)) {
            await interaction.reply({
              embeds: [
                createErrorEmbed(
                  'Yetkiniz Yetersiz',
                  `Bu komutu kullanabilmek için \`${String(perm)}\` yetkisine sahip olmalısınız.`
                ),
              ],
              ephemeral: true,
            });
            return;
          }
        }
      }

      logger.command(interaction.commandName, interaction.user.id, interaction.guildId || undefined);
      await command.execute(interaction);
      return;
    }

    // 2. CONTEXT MENUS (USER)
    if (interaction.isUserContextMenuCommand()) {
      const contextCmd = userContextMenus.find((c) => c.data.name === interaction.commandName);
      if (contextCmd) {
        await contextCmd.execute(interaction);
      }
      return;
    }

    // 3. CONTEXT MENUS (MESSAGE)
    if (interaction.isMessageContextMenuCommand()) {
      const contextCmd = messageContextMenus.find((c) => c.data.name === interaction.commandName);
      if (contextCmd) {
        await contextCmd.execute(interaction);
      }
      return;
    }

    // 4. BUTTON INTERACTIONS
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    // 5. MODAL SUBMIT
    if (interaction.isModalSubmit()) {
      await handleModalInteraction(interaction);
      return;
    }

    // 6. SELECT MENU
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }
  } catch (error) {
    logger.error('Interaction sırasında beklenmeyen bir hata oluştu:', error, {
      userId: interaction.user.id,
      guildId: interaction.guildId || undefined,
    });

    const errorEmbed = createErrorEmbed(
      'Bir Hata Oluştu',
      'İşleminiz gerçekleştirilirken beklenmeyen bir sorun meydana geldi. Lütfen tekrar deneyin.'
    );

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
  }
}
