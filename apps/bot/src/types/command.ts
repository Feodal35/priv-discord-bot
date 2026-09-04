import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ContextMenuCommandInteraction,
  ContextMenuCommandBuilder,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  PermissionResolvable,
} from 'discord.js';

export interface SlashCommand {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  cooldown?: number; // Saniye cinsinden
  userPermissions?: PermissionResolvable[];
  botPermissions?: PermissionResolvable[];
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface ContextMenuCommand {
  data: ContextMenuCommandBuilder;
  userPermissions?: PermissionResolvable[];
  execute: (interaction: ContextMenuCommandInteraction) => Promise<void>;
}

export interface ButtonHandler {
  customId: string | RegExp;
  execute: (interaction: ButtonInteraction) => Promise<void>;
}

export interface ModalHandler {
  customId: string | RegExp;
  execute: (interaction: ModalSubmitInteraction) => Promise<void>;
}

export interface SelectMenuHandler {
  customId: string | RegExp;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void>;
}
