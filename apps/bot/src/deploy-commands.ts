import { REST, Routes } from 'discord.js';
import { config } from '@priv/config';
import { commands } from './client';
import { userContextMenus, messageContextMenus } from './interactions/contextMenus';
import { logger } from './utils/logger';

/**
 * Global komutları sıfırlar.
 * Bu sayede sunucu komutlarıyla çakışıp her komutun 2 kez çıkması engellenir.
 */
export async function clearGlobalCommands() {
  const token = config.DISCORD_TOKEN;
  const clientId = config.DISCORD_CLIENT_ID;
  if (!token || token === 'MISSING_DISCORD_TOKEN') return;

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    logger.info(`🧹 Global komutlar sıfırlandı (Çift görünme engellendi).`);
  } catch (err) {
    logger.error('Global komutlar sıfırlanırken hata:', err);
  }
}

/**
 * Komutları doğrudan sunucuya (Guild) kaydeder.
 * Discord'da sunucu komutları ANINDA (0 saniyede) güncellenir ve görünür!
 */
export async function deployToGuildInstant(guildId: string) {
  const token = config.DISCORD_TOKEN;
  const clientId = config.DISCORD_CLIENT_ID;

  if (!token || token === 'MISSING_DISCORD_TOKEN') {
    logger.error('DISCORD_TOKEN bulunamadı.');
    return;
  }

  const slashCommandBodies = Array.from(commands.values()).map((c) => c.data.toJSON());
  const contextMenuBodies = [
    ...userContextMenus.map((c) => c.data.toJSON()),
    ...messageContextMenus.map((c) => c.data.toJSON()),
  ];

  const allBodies = [...slashCommandBodies, ...contextMenuBodies];
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info(`🔄 ${allBodies.length} komut ${guildId} sunucusuna anında senkronize ediliyor...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: allBodies,
    });
    logger.info(`⚡ Komutlar ${guildId} sunucusunda ANINDA aktif edildi!`);
  } catch (error) {
    logger.error(`${guildId} sunucusuna komutlar yüklenirken hata:`, error);
  }
}

export async function deployCommands(guildId?: string) {
  if (guildId) {
    await deployToGuildInstant(guildId);
  } else {
    // Global komut kaydı
    const token = config.DISCORD_TOKEN;
    const clientId = config.DISCORD_CLIENT_ID;
    if (!token || token === 'MISSING_DISCORD_TOKEN') return;

    const slashCommandBodies = Array.from(commands.values()).map((c) => c.data.toJSON());
    const contextMenuBodies = [
      ...userContextMenus.map((c) => c.data.toJSON()),
      ...messageContextMenus.map((c) => c.data.toJSON()),
    ];
    const allBodies = [...slashCommandBodies, ...contextMenuBodies];
    const rest = new REST({ version: '10' }).setToken(token);

    try {
      await rest.put(Routes.applicationCommands(clientId), { body: allBodies });
    } catch (e) {
      logger.error('Global deploy hatası:', e);
    }
  }
}

if (require.main === module) {
  const targetGuild = process.argv[2];
  if (targetGuild) {
    deployToGuildInstant(targetGuild);
  }
}
