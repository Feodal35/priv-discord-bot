import { Collection } from 'discord.js';

export class CooldownManager {
  // commandName -> (userId -> expireTimestamp)
  private cooldowns = new Collection<string, Collection<string, number>>();

  /**
   * Cooldown kontrolü yapar.
   * @param commandName Komut adı
   * @param userId Kullanıcı ID
   * @param durationSeconds Bekleme süresi (saniye)
   * @returns { onCooldown: boolean; remainingSeconds: number }
   */
  public check(
    commandName: string,
    userId: string,
    durationSeconds: number
  ): { onCooldown: boolean; remainingSeconds: number } {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection<string, number>());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    const cooldownAmount = durationSeconds * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount;

      if (now < expirationTime) {
        const remainingSeconds = Math.ceil((expirationTime - now) / 1000);
        return { onCooldown: true, remainingSeconds };
      }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);

    return { onCooldown: false, remainingSeconds: 0 };
  }

  /**
   * Kalan süreyi Türkçe metne çevirir
   */
  public formatRemaining(remainingSeconds: number): string {
    if (remainingSeconds >= 3600) {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      return `${hours} saat ${minutes} dakika`;
    }
    if (remainingSeconds >= 60) {
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      return `${minutes} dakika ${seconds} saniye`;
    }
    return `${remainingSeconds} saniye`;
  }
}

export const cooldownManager = new CooldownManager();
