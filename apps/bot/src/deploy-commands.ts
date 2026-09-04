import { REST, Routes } from 'discord.js';
import { config } from '@priv/config';
import { commands } from './client';
import { userContextMenus, messageContextMenus } from './interactions/contextMenus';
import { logger } from './utils/logger';

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
    logger.info(`🔄 ${allBodies.length} komut ve menü Discord API'ye yükleniyor...`);

    if (guildId) {
      // Belirli bir sunucu için anlık yükleme (Geliştirme için hızlı)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: allBodies,
      });
      logger.info(`✅ Komutlar ${guildId} sunucusuna başarıyla yüklendi!`);
    } else {
      // Global komut kaydı
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
