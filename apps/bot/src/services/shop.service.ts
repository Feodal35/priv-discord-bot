import { prisma } from '@priv/database';
import { guildService } from './guild.service';
import { formatCurrency } from '@priv/shared';
import { Guild as DiscordGuild, GuildMember } from 'discord.js';

export class ShopService {
  public async getShopItems(guildId: string) {
    return prisma.shopItem.findMany({
      where: { guildId, isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  public async getInventory(guildId: string, userId: string) {
    return prisma.inventory.findMany({
      where: { guildId, userId },
      include: { item: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  public async buyItem(
    guildId: string,
    userId: string,
    itemId: string,
    discordGuild?: DiscordGuild
  ): Promise<{ success: boolean; message: string; roleGranted?: boolean }> {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      return { success: false, message: 'Ekonomi sistemi sunucuda devre dışı bırakılmış.' };
    }

    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item || !item.isActive || item.guildId !== guildId) {
      return { success: false, message: 'Seçilen ürün artık markette mevcut değil.' };
    }

    if (item.stock !== -1 && item.stock <= 0) {
      return { success: false, message: 'Bu ürünün stoğu tükenmiş.' };
    }

    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (!userGuild || userGuild.coins < item.price) {
      const current = userGuild?.coins || 0;
      const needed = item.price - current;
      return {
        success: false,
        message: `Yetersiz bakiye! Bu ürünü almak için **${formatCurrency(needed)} ${settings.currencyName}** daha gerekiyor. (Mevcut bakiyen: ${formatCurrency(current)} ${settings.currencyName})`,
      };
    }

    // Role kontrolü (Kullanıcıda zaten bu rol var mı?)
    if (item.type === 'ROLE' && item.roleId && discordGuild) {
      try {
        const member = await discordGuild.members.fetch(userId);
        if (member.roles.cache.has(item.roleId)) {
          return { success: false, message: 'Bu role zaten sahipsin!' };
        }
      } catch {
        // Devam et
      }
    }

    // Database transaction
    await prisma.$transaction(async (tx) => {
      // Bakiyeden düş
      await tx.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: { coins: { decrement: item.price } },
      });

      // Stok azalt
      if (item.stock > 0) {
        await tx.shopItem.update({
          where: { id: item.id },
          data: { stock: { decrement: 1 } },
        });
      }

      // Envantere ekle veya adedini artır
      const existingInv = await tx.inventory.findFirst({
        where: { guildId, userId, itemId: item.id },
      });

      if (existingInv) {
        await tx.inventory.update({
          where: { id: existingInv.id },
          data: { quantity: { increment: 1 } },
        });
      } else {
        await tx.inventory.create({
          data: {
            guildId,
            userId,
            itemId: item.id,
            quantity: 1,
          },
        });
      }

      // Transaction log
      await tx.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: -item.price,
          type: 'SHOP',
          reason: `Market Alışverişi: ${item.name}`,
        },
      });
    });

    // Rolü Discord üzerinde teslim et
    let roleGranted = false;
    if (item.type === 'ROLE' && item.roleId && discordGuild) {
      try {
        const member = await discordGuild.members.fetch(userId);
        const role = discordGuild.roles.cache.get(item.roleId);
        if (role && discordGuild.members.me?.permissions.has('ManageRoles') && discordGuild.members.me.roles.highest.position > role.position) {
          await member.roles.add(role);
          roleGranted = true;
        }
      } catch (err) {
        console.error('[HATA] Marketten rol verilemedi:', err);
      }
    }

    const roleMsg = roleGranted ? ' ve rolün başarıyla tanımlandı!' : '!';
    return {
      success: true,
      roleGranted,
      message: `Tebrikler! **${item.name}** ürününü başarıyla **${formatCurrency(item.price)} ${settings.currencyName}** karşılığında satın aldın${roleMsg}`,
    };
  }
}

export const shopService = new ShopService();
