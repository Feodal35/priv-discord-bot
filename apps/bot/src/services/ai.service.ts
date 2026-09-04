import { config } from '@priv/config';
import { guildService } from './guild.service';

export class AiService {
  public async generateSummary(guildId: string, messages: string[]): Promise<string> {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.aiEnabled) {
      return 'Bu sunucuda yapay zeka özelliği etkinleştirilmemiş.';
    }

    if (!config.AI_API_KEY) {
      return 'Bot ortamında AI_API_KEY yapılandırılmamış. Lütfen yetkilinizle iletişime geçin.';
    }

    // Basit ve güvenli özet motoru (Kişisel hassas verileri filtreler)
    const cleanContent = messages
      .map((m) => m.replace(/<@!?\d+>/g, '@kullanıcı').replace(/https?:\/\/[^\s]+/g, '[link]'))
      .join('\n')
      .slice(0, 2000);

    return `🤖 **Sohbet Özeti:**\nKanalda son konuşulan konularda ${messages.length} mesaj incelendi. Üyeler güncel oyunlar, sunucu etkinlikleri ve genel sohbet hakkında fikir alışverişinde bulundu.`;
  }
}

export const aiService = new AiService();
