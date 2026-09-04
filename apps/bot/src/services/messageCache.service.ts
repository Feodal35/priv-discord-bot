export interface CachedMessage {
  id: string;
  guildId: string;
  channelId: string;
  authorId: string;
  authorTag: string;
  content: string;
  attachments: string[];
  createdAt: number;
}

class MessageCacheService {
  // Son 25.000 mesajı hafızada tutan yüksek performanslı LRU tarzı cache
  private cache: Map<string, CachedMessage> = new Map();
  private maxLimit = 25000;

  public set(message: {
    id: string;
    guildId?: string | null;
    channelId: string;
    author?: { id: string; tag: string } | null;
    content?: string | null;
    attachments?: any;
  }) {
    if (!message.guildId || !message.author) return;

    // Cache limiti aşılırsa en eski 1000 mesajı temizle
    if (this.cache.size >= this.maxLimit) {
      const keysToDelete = Array.from(this.cache.keys()).slice(0, 1000);
      for (const k of keysToDelete) {
        this.cache.delete(k);
      }
    }

    const attachmentUrls: string[] = [];
    if (message.attachments) {
      if (Array.isArray(message.attachments)) {
        for (const a of message.attachments) attachmentUrls.push(a.url || a.proxyURL);
      } else if (typeof message.attachments.map === 'function') {
        message.attachments.forEach((a: any) => attachmentUrls.push(a.url || a.proxyURL));
      }
    }

    this.cache.set(message.id, {
      id: message.id,
      guildId: message.guildId,
      channelId: message.channelId,
      authorId: message.author.id,
      authorTag: message.author.tag,
      content: message.content || '',
      attachments: attachmentUrls,
      createdAt: Date.now(),
    });
  }

  public get(messageId: string): CachedMessage | undefined {
    return this.cache.get(messageId);
  }

  public delete(messageId: string) {
    this.cache.delete(messageId);
  }
}

export const messageCacheService = new MessageCacheService();
