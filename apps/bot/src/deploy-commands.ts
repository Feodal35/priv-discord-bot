import { REST, Routes } from 'discord.js';
import { config } from '@priv/config';
import { commands } from './client';
import { userContextMenus, messageContextMenus } from './interactions/contextMenus';
import { logger } from './utils/logger';

export async function clearGuildCommands(guildId: string) {
  const token = config.DISCORD_TOKEN;
  const clientId = config.DISCORD_CLIENT_ID;

  if (!token || token === 'MISSING_DISCORD_TOKEN') return;
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    // Sunucuya özel kayıtlı komutları tamamen temizle (2 tane gözükmesini önler)
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: [],
    });
    logger.info(`🧹 ${guildId} sunucusundaki eski özel komutlar temizlendi.`);
  } catch (error) {
    logger.error(`${guildId} sunucusundaki komutlar temizlenirken hata:`, error);
  }
}

export async function deployCommands(guildId?: string) {
  const token = config.DISCORD_TOKEN;
  const clientId = config.DISCORD_CLIENT_ID;

  if (!token || token === 'MISSING_DISCORD_TOKEN') {
    logger.error('DISCORD_TOKEN bulunamadı. Lütfen .env dosyasını yapılandırın.');
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
    if (guildId) {
      // Sunucu özelinde komut yükleme
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: allBodies,
      });
      logger.info(`✅ Komutlar ${guildId} sunucusuna yüklendi.`);
    } else {
      // Global komut kaydı
      logger.info(`🔄 ${allBodies.length} global komut ve menü Discord API'ye yükleniyor...`);
      await rest.put(Routes.applicationCommands(clientId), {
        body: allBodies,
      });
      logger.info(`✅ Global komutlar başarıyla yüklendi!`);
    }
  } catch (error) {
    logger.error('Komutlar yüklenirken hata oluştu:', error);
  }
}

if (require.main === module) {
  const targetGuild = process.argv[2];
  deployCommands(targetGuild);
}
