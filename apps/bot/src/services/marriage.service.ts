import { prisma } from '@priv/database';
import { userService } from './user.service';
import { economyService } from './economy.service';
import { logger } from '../utils/logger';

export interface RingInfo {
  type: 'SILVER' | 'GOLD' | 'DIAMOND';
  name: string;
  emoji: string;
  price: number;
  description: string;
}

export const RINGS: Record<string, RingInfo> = {
  SILVER: {
    type: 'SILVER',
    name: 'Gümüş Yüzük',
    emoji: '💍',
    price: 2500,
    description: 'Sade ve zarif bir gümüş evlilik yüzüğü.',
  },
  GOLD: {
    type: 'GOLD',
    name: 'Altın Yüzük',
    emoji: '💛',
    price: 10000,
    description: 'Işıltılı ve asil saf altın evlilik yüzüğü.',
  },
  DIAMOND: {
    type: 'DIAMOND',
    name: 'Pırlanta Yüzük',
    emoji: '💎',
    price: 50000,
    description: 'Göz kamaştırıcı ve ebedi tek taş pırlanta yüzük.',
  },
};

export class MarriageService {
  private initialized = false;

  /**
   * Tablonun varlığını ve PostgreSQL indekslerini garantiye alır
   */
  public async initTable() {
    if (this.initialized) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "marriages" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "guildId" TEXT NOT NULL,
          "user1Id" TEXT NOT NULL,
          "user2Id" TEXT NOT NULL,
          "ringType" TEXT NOT NULL DEFAULT 'SILVER',
          "lovePoints" INTEGER NOT NULL DEFAULT 10,
          "jointCoins" INTEGER NOT NULL DEFAULT 0,
          "marriedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.initialized = true;
      logger.info('[MARRIAGE] Evlilik sistemi tablosu hazır.', { service: 'MARRIAGE' });
    } catch (err) {
      logger.error('[MARRIAGE] Tablo init hatası:', err);
    }
  }

  /**
   * Sunucunun marketine yüzükleri ekler (Eğer henüz eklenmemişse)
   */
  public async ensureRingsInShop(guildId: string) {
    try {
      for (const ring of Object.values(RINGS)) {
        const existing = await prisma.shopItem.findFirst({
          where: {
            guildId,
            name: ring.name,
          },
        });

        if (!existing) {
          await prisma.shopItem.create({
            data: {
              guildId,
              name: ring.name,
              description: ring.description,
              price: ring.price,
              type: 'ITEM',
              stock: -1,
              isActive: true,
            },
          });
        }
      }
    } catch (err) {
      logger.error('[MARRIAGE] Market yüzük kontrol hatası:', err);
    }
  }

  /**
   * Kullanıcının evlilik durumunu döner
   */
  public async getMarriage(guildId: string, userId: string) {
    await this.initTable();
    try {
      const marriage = await prisma.marriage.findFirst({
        where: {
          guildId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        include: {
          user1: true,
          user2: true,
        },
      });

      return marriage;
    } catch (err) {
      logger.error('[MARRIAGE] getMarriage hatası:', err);
      return null;
    }
  }

  /**
   * Kullanıcının envanterindeki en yüksek / ilk yüzüğü bulur
   */
  public async getUserRing(guildId: string, userId: string) {
    try {
      const inventory = await prisma.inventory.findMany({
        where: { guildId, userId },
        include: { item: true },
      });

      // Pırlanta > Altın > Gümüş önceliği
      const priority = ['Pırlanta Yüzük', 'Altın Yüzük', 'Gümüş Yüzük'];
      for (const ringName of priority) {
        const found = inventory.find(
          (inv) => inv.item.name === ringName && inv.quantity > 0
        );
        if (found) {
          const type: 'SILVER' | 'GOLD' | 'DIAMOND' =
            ringName === 'Pırlanta Yüzük'
              ? 'DIAMOND'
              : ringName === 'Altın Yüzük'
              ? 'GOLD'
              : 'SILVER';
          return {
            inventoryId: found.id,
            ringInfo: RINGS[type],
            quantity: found.quantity,
          };
        }
      }

      return null;
    } catch (err) {
      logger.error('[MARRIAGE] getUserRing hatası:', err);
      return null;
    }
  }

  /**
   * İki kullanıcıyı evlendirir ve yüzüğü envanterden düşer
   */
  public async marry(
    guildId: string,
    user1Id: string,
    user2Id: string,
    ringType: 'SILVER' | 'GOLD' | 'DIAMOND',
    inventoryId?: string
  ) {
    await this.initTable();
    await userService.ensureUserAndGuild(user1Id, guildId);
    await userService.ensureUserAndGuild(user2Id, guildId);

    // Yüzüğü envanterden düş
    if (inventoryId) {
      try {
        const inv = await prisma.inventory.findUnique({ where: { id: inventoryId } });
        if (inv) {
          if (inv.quantity > 1) {
            await prisma.inventory.update({
              where: { id: inventoryId },
              data: { quantity: { decrement: 1 } },
            });
          } else {
            await prisma.inventory.delete({ where: { id: inventoryId } });
          }
        }
      } catch (err) {
        logger.error('[MARRIAGE] Yüzük düşme hatası:', err);
      }
    }

    // Evlilik kaydını oluştur
    const marriage = await prisma.marriage.create({
      data: {
        guildId,
        user1Id,
        user2Id,
        ringType,
        lovePoints: 10,
        jointCoins: 0,
      },
      include: {
        user1: true,
        user2: true,
      },
    });

    return marriage;
  }

  /**
   * Boşanma işlemi: 1.000 Coin tazminat / masraf düşer, ortak kasayı 50/50 bölüştürür ve evliliği siler
   */
  public async divorce(guildId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    partnerId?: string;
    splitCoins?: number;
  }> {
    await this.initTable();
    const marriage = await this.getMarriage(guildId, userId);
    if (!marriage) {
      return { success: false, message: 'Şu anda herhangi bir evliliğin bulunmuyor.' };
    }

    const partnerId = marriage.user1Id === userId ? marriage.user2Id : marriage.user1Id;
    const courtCost = 1000;

    // Kullanıcının bakiyesi kontrolü
    const userBalance = await economyService.getBalance(guildId, userId);
    if (userBalance.coins < courtCost) {
      return {
        success: false,
        message: `Boşanma davası açabilmek ve tazminat/mahkeme masraflarını karşılayabilmek için en az **${courtCost} Coin** paran olmalıdır. (Cüzdanın: ${userBalance.coins} Coin)`,
      };
    }

    // 1.000 Coin mahkeme masrafı kes
    await economyService.modifyBalance(guildId, userId, courtCost, 'REMOVE', 'Boşanma mahkeme masrafı');

    // Ortak kasayı 50/50 bölüştür
    const jointCoins = marriage.jointCoins;
    const splitCoins = Math.floor(jointCoins / 2);

    if (splitCoins > 0) {
      await economyService.modifyBalance(guildId, userId, splitCoins, 'ADD', 'Ortak evlilik kasası tasfiyesi');
      await economyService.modifyBalance(guildId, partnerId, splitCoins, 'ADD', 'Ortak evlilik kasası tasfiyesi');
    }

    // Evliliği sonlandır
    await prisma.marriage.delete({
      where: { id: marriage.id },
    });

    return {
      success: true,
      partnerId,
      splitCoins,
      message: `Mahkeme sonuçlandı. <@${partnerId}> ile olan evliliğin resmen sonlandırıldı. Ortak kasadaki ${jointCoins} Coin eşit olarak paylaştırıldı.`,
    };
  }

  /**
   * Ortak kasaya para yatırma
   */
  public async depositJoint(guildId: string, userId: string, amount: number) {
    const marriage = await this.getMarriage(guildId, userId);
    if (!marriage) {
      return { success: false, message: 'Evli değilsin.' };
    }

    if (amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, message: 'Geçerli bir miktar girin.' };
    }

    const balance = await economyService.getBalance(guildId, userId);
    if (balance.coins < amount) {
      return { success: false, message: 'Yetersiz bakiye! Cüzdanında yeterli coin bulunmuyor.' };
    }

    await economyService.modifyBalance(guildId, userId, amount, 'REMOVE', 'Ortak evlilik kasasına para yatırma');
    const updated = await prisma.marriage.update({
      where: { id: marriage.id },
      data: {
        jointCoins: { increment: amount },
        lovePoints: { increment: 2 }, // Para yatırınca sevgi puanı da artar!
      },
    });

    return {
      success: true,
      newJointTotal: updated.jointCoins,
      message: `Ortak kasaya başarıyla **${amount} Coin** yatırıldı! Güncel kasa: **${updated.jointCoins} Coin** (+2 Aşk Puanı 💕)`,
    };
  }

  /**
   * Ortak kasadan para çekme
   */
  public async withdrawJoint(guildId: string, userId: string, amount: number) {
    const marriage = await this.getMarriage(guildId, userId);
    if (!marriage) {
      return { success: false, message: 'Evli değilsin.' };
    }

    if (amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, message: 'Geçerli bir miktar girin.' };
    }

    if (marriage.jointCoins < amount) {
      return {
        success: false,
        message: `Ortak kasada bu kadar para yok! Mevcut kasa bakiyesi: **${marriage.jointCoins} Coin**`,
      };
    }

    const updated = await prisma.marriage.update({
      where: { id: marriage.id },
      data: { jointCoins: { decrement: amount } },
    });

    await economyService.modifyBalance(guildId, userId, amount, 'ADD', 'Ortak evlilik kasasından para çekme');

    return {
      success: true,
      newJointTotal: updated.jointCoins,
      message: `Ortak kasadan **${amount} Coin** başarıyla cüzdanına çekildi! Kalan kasa: **${updated.jointCoins} Coin**`,
    };
  }

  /**
   * Aşk puanı artırma
   */
  public async addLovePoints(marriageId: string, points: number = 1) {
    try {
      await prisma.marriage.update({
        where: { id: marriageId },
        data: { lovePoints: { increment: points } },
      });
    } catch {
      /* sessiz */
    }
  }
}

export const marriageService = new MarriageService();
