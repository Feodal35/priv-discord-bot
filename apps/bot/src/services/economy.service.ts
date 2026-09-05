import { prisma } from '@priv/database';
import { guildService } from './guild.service';
import { userService } from './user.service';
import { questService } from './quest.service';
import { xpService } from './xp.service';
import { formatCurrency } from '@priv/shared';

export class EconomyService {
  /**
   * Kullanıcının güncel bakiyesini döner
   */
  public async getBalance(guildId: string, userId: string) {
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    return {
      coins: userGuild?.coins || 0,
      bankCoins: userGuild?.bankCoins || 0,
      total: (userGuild?.coins || 0) + (userGuild?.bankCoins || 0),
    };
  }

  /**
   * İki kullanıcı arasında güvenli coin transferi yapar (Database Transaction)
   */
  public async transferCoins(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    if (fromUserId === toUserId) {
      return { success: false, message: 'Kendine coin gönderemezsin.' };
    }

    if (amount <= 0 || isNaN(amount) || !Number.isInteger(amount)) {
      return { success: false, message: 'Lütfen geçerli ve pozitif bir tam sayı miktarı gir.' };
    }

    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      return { success: false, message: 'Bu sunucuda ekonomi sistemi devre dışı bırakılmış.' };
    }

    if (amount > settings.maxTransferAmount) {
      return {
        success: false,
        message: `Tek seferde en fazla **${formatCurrency(settings.maxTransferAmount)} ${settings.currencyName}** gönderebilirsin.`,
      };
    }

    // Kullanıcıların ve Guild'in veritabanında var olduğundan emin ol
    await userService.ensureUserAndGuild(fromUserId, guildId);
    await userService.ensureUserAndGuild(toUserId, guildId);

    // Sender bakiye kontrolü ve transaction
    try {
      return await prisma.$transaction(async (tx) => {
        const sender = await tx.userGuild.findUnique({
          where: { userId_guildId: { userId: fromUserId, guildId } },
        });

        if (!sender || sender.coins < amount) {
          const current = sender?.coins || 0;
          return {
            success: false,
            message: `Yetersiz bakiye! Cüzdanında **${formatCurrency(current)} ${settings.currencyName}** bulunuyor, **${formatCurrency(amount)}** gönderemezsin.`,
          };
        }

        // Gönderenden düş
        await tx.userGuild.update({
          where: { userId_guildId: { userId: fromUserId, guildId } },
          data: { coins: { decrement: amount } },
        });

        // Alıcıya ekle (alıcı kaydı yoksa oluştur)
        await tx.userGuild.upsert({
          where: { userId_guildId: { userId: toUserId, guildId } },
          update: { coins: { increment: amount } },
          create: {
            userId: toUserId,
            guildId,
            coins: amount,
          },
        });

        // İşlem kaydı oluştur
        await tx.economyTransaction.create({
          data: {
            guildId,
            fromUserId,
            toUserId,
            amount,
            type: 'TRANSFER',
            reason: reason || 'Kullanıcılar arası transfer',
          },
        });

        // Görev ilerlemesi
        await questService.incrementProgress(guildId, fromUserId, 'TRANSFER_COIN', amount);

        return {
          success: true,
          message: `<@${toUserId}> kullanıcısına başarıyla **${formatCurrency(amount)} ${settings.currencyName}** gönderildi!`,
        };
      });
    } catch (error) {
      console.error('[HATA] Coin transferi sırasında hata oluştu:', error);
      return { success: false, message: 'Transfer işlemi gerçekleştirilirken bir hata oluştu.' };
    }
  }

  /**
   * Çalış komutu ile cooldown'lı coin kazanma
   */
  public async claimWork(guildId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    gainedCoins?: number;
    remainingMinutes?: number;
  }> {
    const settings = await guildService.getGuildSettings(guildId);
    if (!settings.economyEnabled) {
      return { success: false, message: 'Ekonomi sistemi devre dışı.' };
    }

    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    const now = new Date();
    const lastWork = userGuild?.lastWorkClaim;

    if (lastWork) {
      const diffMs = now.getTime() - lastWork.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      if (diffMinutes < settings.workCooldownMinutes) {
        const remainingMinutes = Math.ceil(settings.workCooldownMinutes - diffMinutes);
        return {
          success: false,
          remainingMinutes,
          message: `Biraz dinlenmelisin! Tekrar çalışabilmek için **${remainingMinutes} dakika** beklemelisin.`,
        };
      }
    }

    // Min - Max arası rastgele kazanç
    const range = settings.workMaxReward - settings.workMinReward;
    const gainedCoins = Math.floor(Math.random() * (range + 1)) + settings.workMinReward;

    const jobs = [
      'sunucu moderatörlüğü yaptın',
      'kod yazdın ve bug çözdün',
      'tasarım hazırladın',
      'ses kanalında DJ\'lik yaptın',
      'sunucu turnuvasını organize ettin',
      'özel emojiler çizdin',
      'sohbeti canlı tuttun',
    ];
    const randomJob = jobs[Math.floor(Math.random() * jobs.length)];

    await prisma.$transaction([
      prisma.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          coins: { increment: gainedCoins },
          lastWorkClaim: now,
        },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: gainedCoins,
          type: 'WORK',
          reason: `İş: ${randomJob}`,
        },
      }),
    ]);

    return {
      success: true,
      gainedCoins,
      message: `Harika bir iş çıkardın! Başarıyla ${randomJob} ve **${formatCurrency(gainedCoins)} ${settings.currencyName}** kazandın!`,
    };
  }

  /**
   * Bakiye ekleme / çıkarma (Admin veya oyunlar için)
   */
  public async modifyBalance(
    guildId: string,
    userId: string,
    amount: number,
    type: 'ADD' | 'REMOVE',
    reason?: string
  ) {
    await userService.ensureUserAndGuild(userId, guildId);

    if (type === 'ADD') {
      return prisma.$transaction([
        prisma.userGuild.upsert({
          where: { userId_guildId: { userId, guildId } },
          update: { coins: { increment: amount } },
          create: { userId, guildId, coins: amount },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount,
            type: 'ADMIN',
            reason: reason || 'Yönetici bakiye eklemesi',
          },
        }),
      ]);
    } else {
      return prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: { coins: { decrement: amount } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: -amount,
            type: 'ADMIN',
            reason: reason || 'Yönetici bakiye kesintisi',
          },
        }),
      ]);
    }
  }

  /**
   * Cüzdandan banka hesabına güvenli para aktarımı
   */
  public async depositToBank(
    guildId: string,
    userId: string,
    amount: number | 'all'
  ): Promise<{ success: boolean; message: string; deposited?: number; coins?: number; bankCoins?: number }> {
    await userService.ensureUserAndGuild(userId, guildId);
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    const currentCoins = userGuild?.coins || 0;
    if (currentCoins <= 0) {
      return { success: false, message: 'Cüzdanında bankaya yatıracak hiç para bulunmuyor!' };
    }

    const actualAmount = amount === 'all' ? currentCoins : Math.floor(amount);
    if (actualAmount <= 0 || isNaN(actualAmount)) {
      return { success: false, message: 'Lütfen geçerli ve pozitif bir miktar belirt.' };
    }
    if (actualAmount > currentCoins) {
      return {
        success: false,
        message: `Yetersiz cüzdan bakiyesi! Cüzdanında **${formatCurrency(currentCoins)} Coin** var, **${formatCurrency(actualAmount)} Coin** yatıramazsın.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          coins: { decrement: actualAmount },
          bankCoins: { increment: actualAmount },
        },
      });
      await tx.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: actualAmount,
          type: 'BANK_DEPOSIT',
          reason: `Bankaya yatırma: ${formatCurrency(actualAmount)} Coin`,
        },
      });
      return u;
    });

    return {
      success: true,
      deposited: actualAmount,
      coins: updated.coins,
      bankCoins: updated.bankCoins,
      message: `Başarıyla **${formatCurrency(actualAmount)} Coin** banka kasana aktarıldı! 🏦 Güvendesin!`,
    };
  }

  /**
   * Bankadan cüzdana para çekme
   */
  public async withdrawFromBank(
    guildId: string,
    userId: string,
    amount: number | 'all'
  ): Promise<{ success: boolean; message: string; withdrawn?: number; coins?: number; bankCoins?: number }> {
    await userService.ensureUserAndGuild(userId, guildId);
    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    const currentBank = userGuild?.bankCoins || 0;
    if (currentBank <= 0) {
      return { success: false, message: 'Banka hesabında hiç para bulunmuyor!' };
    }

    const actualAmount = amount === 'all' ? currentBank : Math.floor(amount);
    if (actualAmount <= 0 || isNaN(actualAmount)) {
      return { success: false, message: 'Lütfen geçerli ve pozitif bir miktar belirt.' };
    }
    if (actualAmount > currentBank) {
      return {
        success: false,
        message: `Bankanda bu kadar para yok! Mevcut banka bakiyen: **${formatCurrency(currentBank)} Coin**.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.userGuild.update({
        where: { userId_guildId: { userId, guildId } },
        data: {
          bankCoins: { decrement: actualAmount },
          coins: { increment: actualAmount },
        },
      });
      await tx.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: actualAmount,
          type: 'BANK_WITHDRAW',
          reason: `Bankadan çekme: ${formatCurrency(actualAmount)} Coin`,
        },
      });
      return u;
    });

    return {
      success: true,
      withdrawn: actualAmount,
      coins: updated.coins,
      bankCoins: updated.bankCoins,
      message: `Başarıyla bankandan **${formatCurrency(actualAmount)} Coin** çektin ve cüzdanına aktardın! 💳`,
    };
  }

  /**
   * Başka bir üyenin cüzdanını soyma girişimi
   */
  public async robUser(
    guildId: string,
    robberId: string,
    victimId: string
  ): Promise<{
    outcome: 'COOLDOWN' | 'SELF' | 'NOT_ENOUGH_ROBBER' | 'NOT_ENOUGH_VICTIM' | 'BLOCKED_SAFE' | 'BITTEN_DOG' | 'SUCCESS' | 'CAUGHT';
    remainingMinutes?: number;
    stolenAmount?: number;
    penaltyAmount?: number;
    message: string;
  }> {
    if (robberId === victimId) {
      return {
        outcome: 'SELF',
        message: 'Kendini soymaya çalışamazsın!',
      };
    }

    // Cooldown kontrolü (1 saat = 60 dakika)
    const lastRob = await prisma.economyTransaction.findFirst({
      where: {
        guildId,
        fromUserId: robberId,
        type: 'ROB',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastRob) {
      const diffMs = Date.now() - lastRob.createdAt.getTime();
      const cooldownMs = 60 * 60 * 1000;
      if (diffMs < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - diffMs) / (60 * 1000));
        return {
          outcome: 'COOLDOWN',
          remainingMinutes,
          message: `Polisler ve çevredekiler hala etrafta seni arıyor! Yeni bir soygun için **${remainingMinutes} dakika** beklemelisin. 🕒`,
        };
      }
    }

    await userService.ensureUserAndGuild(robberId, guildId);
    await userService.ensureUserAndGuild(victimId, guildId);

    const robberGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId: robberId, guildId } },
    });
    const victimGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId: victimId, guildId } },
    });

    const robberCoins = robberGuild?.coins || 0;
    const victimCoins = victimGuild?.coins || 0;

    if (robberCoins < 250) {
      return {
        outcome: 'NOT_ENOUGH_ROBBER',
        message: 'Soygun girişiminde bulunmak ve olası cezayı karşılayabilmek için cüzdanında en az **250 Coin** bulunmalı!',
      };
    }

    if (victimCoins < 250) {
      return {
        outcome: 'NOT_ENOUGH_VICTIM',
        message: 'Hedef kullanıcının cüzdanında soyulmaya değer para yok! (En az 250 Coin olmalı)',
      };
    }

    // Hedefin envanterindeki savunma eşyalarını kontrol et
    const victimInventory = await prisma.inventory.findMany({
      where: { guildId, userId: victimId, quantity: { gt: 0 } },
      include: { item: true },
    });

    const hasSafe = victimInventory.some(
      (inv) => inv.item.type === 'SHIELD' || inv.item.name.includes('Çelik Kasa')
    );
    const hasDog = victimInventory.some(
      (inv) => inv.item.type === 'DOG' || inv.item.name.includes('Bekçi Köpeği')
    );

    // 1. Durum: Bekçi Köpeği varsa hırsızı ısırır ve tazminat ödetir!
    if (hasDog) {
      const penalty = Math.min(robberCoins, 1000);
      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId: robberId, guildId } },
          data: { coins: { decrement: penalty } },
        }),
        prisma.userGuild.update({
          where: { userId_guildId: { userId: victimId, guildId } },
          data: { coins: { increment: penalty } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            fromUserId: robberId,
            toUserId: victimId,
            amount: penalty,
            type: 'ROB',
            reason: `Bekçi Köpeği hırsızı ısırdı! (${robberId} -> ${victimId})`,
          },
        }),
      ]);

      return {
        outcome: 'BITTEN_DOG',
        penaltyAmount: penalty,
        message: `🐕 **HAV! HAV!** <@${victimId}> kullanıcısının **Bekçi Köpeği** seni fark etti ve bacağından ısırdı! Kaçarken hedefe **${formatCurrency(penalty)} Coin** tazminat ödemek zorunda kaldın! 🩹`,
      };
    }

    // 2. Durum: Çelik Kasa varsa soygun %100 engellenir!
    if (hasSafe) {
      await prisma.economyTransaction.create({
        data: {
          guildId,
          fromUserId: robberId,
          toUserId: victimId,
          amount: 0,
          type: 'ROB',
          reason: `Çelik Kasa soygunu engelledi (${robberId})`,
        },
      });

      return {
        outcome: 'BLOCKED_SAFE',
        message: `🛡️ **KORUMALI KASA!** <@${victimId}> cüzdanını **Çelik Kasa** ile koruyor! Kasa kilitli olduğu için tek kuruş alamadan polis gelmeden kaçmak zorunda kaldın!`,
      };
    }

    // 3. Normal Soygun Şansı (%40 Başarı, %60 Yakalanma)
    const roll = Math.random();
    if (roll < 0.40) {
      // Başarılı soygun: %10 ile %20 arası cüzdandan çal
      const percent = 0.10 + Math.random() * 0.10;
      const stolen = Math.max(50, Math.min(victimCoins, Math.floor(victimCoins * percent)));

      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId: victimId, guildId } },
          data: { coins: { decrement: stolen } },
        }),
        prisma.userGuild.update({
          where: { userId_guildId: { userId: robberId, guildId } },
          data: { coins: { increment: stolen } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            fromUserId: victimId,
            toUserId: robberId,
            amount: stolen,
            type: 'ROB',
            reason: `Başarılı soygun: <@${victimId}> soyuldu`,
          },
        }),
      ]);

      return {
        outcome: 'SUCCESS',
        stolenAmount: stolen,
        message: `🥷 **SOYGUN BAŞARILI!** Parmak uçlarında yaklaştın ve <@${victimId}> cüzdanından sessizce **${formatCurrency(stolen)} Coin** aşırdın! 💰`,
      };
    } else {
      // Başarısız: Yakalandı! (500 Coin veya cüzdanının %20'si)
      const penalty = Math.min(robberCoins, Math.max(500, Math.floor(robberCoins * 0.20)));

      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId: robberId, guildId } },
          data: { coins: { decrement: penalty } },
        }),
        prisma.userGuild.update({
          where: { userId_guildId: { userId: victimId, guildId } },
          data: { coins: { increment: penalty } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId,
            fromUserId: robberId,
            toUserId: victimId,
            amount: penalty,
            type: 'ROB',
            reason: `Soygunda yakalandı, tazminat ödendi (${robberId})`,
          },
        }),
      ]);

      return {
        outcome: 'CAUGHT',
        penaltyAmount: penalty,
        message: `🚨 **YAKALANDIN!** <@${victimId}> cüzdanına uzanırken suçüstü yakalandın! Hedefe **${formatCurrency(penalty)} Coin** tazminat ödemek zorunda kaldın! 👮`,
      };
    }
  }

  /**
   * Kasa açma sistemi (Bronz, Gümüş, Elmas)
   */
  public async openLootbox(
    guildId: string,
    userId: string,
    boxType: 'BRONZE' | 'SILVER' | 'DIAMOND'
  ): Promise<{
    success: boolean;
    boxName: string;
    paidFromInventory: boolean;
    cost: number;
    coinsWon: number;
    xpWon: number;
    itemsWon: string[];
    isJackpot: boolean;
    rewardText: string;
    message: string;
  }> {
    const config = {
      BRONZE: { name: 'Bronz Kasa', cost: 1000 },
      SILVER: { name: 'Gümüş Kasa', cost: 5000 },
      DIAMOND: { name: 'Elmas Kasa', cost: 25000 },
    }[boxType];

    await userService.ensureUserAndGuild(userId, guildId);

    // Envanterde kasa var mı kontrol et
    const inventoryBox = await prisma.inventory.findFirst({
      where: {
        guildId,
        userId,
        quantity: { gt: 0 },
        item: { name: config.name },
      },
      include: { item: true },
    });

    const userGuild = await prisma.userGuild.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    const currentCoins = userGuild?.coins || 0;

    let paidFromInventory = false;
    if (inventoryBox) {
      paidFromInventory = true;
    } else if (currentCoins < config.cost) {
      return {
        success: false,
        boxName: config.name,
        paidFromInventory: false,
        cost: config.cost,
        coinsWon: 0,
        xpWon: 0,
        itemsWon: [],
        isJackpot: false,
        rewardText: '',
        message: `Yetersiz bakiye! **${config.name}** açmak için **${formatCurrency(config.cost)} Coin** veya envanterinde kasanın kendisi bulunmalıdır. (Mevcut bakiyen: ${formatCurrency(currentCoins)} Coin)`,
      };
    }

    // Ödül Belirleme
    const roll = Math.floor(Math.random() * 100) + 1; // 1 - 100
    let coinsWon = 0;
    let xpWon = 0;
    const itemsWon: string[] = [];
    let isJackpot = false;
    let rewardText = '';

    if (boxType === 'BRONZE') {
      if (roll <= 3) {
        coinsWon = 10000;
        isJackpot = true;
        rewardText = '🏆 **JACKPOT! 10.000 Coin Kazandın!**';
      } else if (roll <= 10) {
        coinsWon = Math.floor(Math.random() * 1500) + 3500;
        rewardText = `💰 **Büyük Ödül:** ${formatCurrency(coinsWon)} Coin!`;
      } else if (roll <= 25) {
        itemsWon.push('Gümüş Yüzük');
        rewardText = '💍 **Gümüş Yüzük** (Evlilik için hazır!)';
      } else if (roll <= 50) {
        xpWon = Math.floor(Math.random() * 350) + 150;
        rewardText = `⚡ **${xpWon} XP** Tecrübe Puanı!`;
      } else {
        coinsWon = Math.floor(Math.random() * 1700) + 300;
        rewardText = `🪙 **${formatCurrency(coinsWon)} Coin!**`;
      }
    } else if (boxType === 'SILVER') {
      if (roll <= 5) {
        coinsWon = 25000;
        xpWon = 2500;
        isJackpot = true;
        rewardText = '🏆 **MEGA JACKPOT! 25.000 Coin + 2.500 XP Kazandın!**';
      } else if (roll <= 20) {
        itemsWon.push('Bekçi Köpeği');
        rewardText = '🐕 **Bekçi Köpeği** (Hırsızları ısıran sadık koruma!)';
      } else if (roll <= 35) {
        itemsWon.push('Çelik Kasa');
        rewardText = '🛡️ **Çelik Kasa** (Cüzdanını %100 soygunlara karşı korur!)';
      } else if (roll <= 60) {
        xpWon = Math.floor(Math.random() * 1750) + 750;
        rewardText = `⚡ **${xpWon} XP** Tecrübe Puanı!`;
      } else {
        coinsWon = Math.floor(Math.random() * 9000) + 3000;
        rewardText = `🪙 **${formatCurrency(coinsWon)} Coin!**`;
      }
    } else {
      // DIAMOND
      if (roll <= 10) {
        coinsWon = 100000;
        itemsWon.push('Pırlanta Yüzük');
        isJackpot = true;
        rewardText = '👑 **ULTIMATE JACKPOT! 100.000 Coin + 💎 Pırlanta Yüzük!**';
      } else if (roll <= 25) {
        itemsWon.push('Pırlanta Yüzük');
        rewardText = '💎 **Pırlanta Yüzük** (50.000 Coin değerinde ebedi tek taş!)';
      } else if (roll <= 40) {
        itemsWon.push('Çelik Kasa', 'Bekçi Köpeği');
        rewardText = '🛡️🐕 **Tam Savunma Paketi:** Çelik Kasa + Bekçi Köpeği!';
      } else if (roll <= 65) {
        xpWon = Math.floor(Math.random() * 7000) + 3000;
        rewardText = `⚡ **${xpWon} XP** Tecrübe Puanı!`;
      } else {
        coinsWon = Math.floor(Math.random() * 55000) + 20000;
        rewardText = `🪙 **${formatCurrency(coinsWon)} Coin!**`;
      }
    }

    // Veritabanı Transaction: Harcama + Ödüller
    await prisma.$transaction(async (tx) => {
      // Harcama
      if (paidFromInventory && inventoryBox) {
        if (inventoryBox.quantity > 1) {
          await tx.inventory.update({
            where: { id: inventoryBox.id },
            data: { quantity: { decrement: 1 } },
          });
        } else {
          await tx.inventory.delete({
            where: { id: inventoryBox.id },
          });
        }
      } else {
        await tx.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: { coins: { decrement: config.cost } },
        });
        await tx.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: -config.cost,
            type: 'LOOTBOX',
            reason: `${config.name} açımı bedeli`,
          },
        });
      }

      // Coin Ödülü
      if (coinsWon > 0) {
        await tx.userGuild.update({
          where: { userId_guildId: { userId, guildId } },
          data: { coins: { increment: coinsWon } },
        });
        await tx.economyTransaction.create({
          data: {
            guildId,
            toUserId: userId,
            amount: coinsWon,
            type: 'LOOTBOX',
            reason: `${config.name} ödülü: +${formatCurrency(coinsWon)} Coin`,
          },
        });
      }

      // Eşya Ödülleri
      for (const itemName of itemsWon) {
        const item = await tx.shopItem.findFirst({
          where: { guildId, name: itemName },
        });
        if (item) {
          const inv = await tx.inventory.findFirst({
            where: { guildId, userId, itemId: item.id },
          });
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: { increment: 1 } },
            });
          } else {
            await tx.inventory.create({
              data: { guildId, userId, itemId: item.id, quantity: 1 },
            });
          }
        }
      }
    });

    // XP Ödülü
    if (xpWon > 0) {
      await xpService.addCustomXp(guildId, userId, xpWon);
    }

    return {
      success: true,
      boxName: config.name,
      paidFromInventory,
      cost: config.cost,
      coinsWon,
      xpWon,
      itemsWon,
      isJackpot,
      rewardText,
      message: `${config.name} başarıyla açıldı!`,
    };
  }

  /**
   * Düello başlangıcında her iki taraftan bahsi kilitler
   */
  public async lockDuelBets(
    guildId: string,
    player1Id: string,
    player2Id: string,
    betAmount: number
  ): Promise<{ success: boolean; message?: string }> {
    if (betAmount <= 0) return { success: false, message: 'Bahis miktarı sıfırdan büyük olmalıdır.' };

    try {
      await prisma.$transaction(async (tx) => {
        const p1 = await tx.userGuild.findUnique({
          where: { userId_guildId: { userId: player1Id, guildId } },
        });
        const p2 = await tx.userGuild.findUnique({
          where: { userId_guildId: { userId: player2Id, guildId } },
        });

        if (!p1 || p1.coins < betAmount) {
          throw new Error(`<@${player1Id}> kullanıcısının cüzdanında yeterli coin yok.`);
        }
        if (!p2 || p2.coins < betAmount) {
          throw new Error(`<@${player2Id}> kullanıcısının cüzdanında yeterli coin yok.`);
        }

        await tx.userGuild.update({
          where: { userId_guildId: { userId: player1Id, guildId } },
          data: { coins: { decrement: betAmount } },
        });
        await tx.userGuild.update({
          where: { userId_guildId: { userId: player2Id, guildId } },
          data: { coins: { decrement: betAmount } },
        });
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Bahisler kilitlenirken hata oluştu.' };
    }
  }

  /**
   * Düello iptal olursa bahsi kullanıcılara iade eder
   */
  public async refundDuelBets(
    guildId: string,
    player1Id: string,
    player2Id: string,
    betAmount: number
  ) {
    if (betAmount <= 0) return;
    try {
      await prisma.$transaction([
        prisma.userGuild.update({
          where: { userId_guildId: { userId: player1Id, guildId } },
          data: { coins: { increment: betAmount } },
        }),
        prisma.userGuild.update({
          where: { userId_guildId: { userId: player2Id, guildId } },
          data: { coins: { increment: betAmount } },
        }),
      ]);
    } catch (err) {
      console.error('[DUEL] İade hatası:', err);
    }
  }

  /**
   * Düello kazananına ödülü verir (%5 sunucu vergisini keser)
   */
  public async payoutDuelWinner(
    guildId: string,
    winnerId: string,
    loserId: string,
    betAmount: number,
    gameName: string
  ): Promise<{ totalPot: number; taxPaid: number; netPayout: number; winnerProfit: number }> {
    const totalPot = betAmount * 2;
    const taxPaid = Math.floor(totalPot * 0.05); // %5 vergi
    const netPayout = totalPot - taxPaid;
    const winnerProfit = netPayout - betAmount;

    await prisma.$transaction([
      prisma.userGuild.update({
        where: { userId_guildId: { userId: winnerId, guildId } },
        data: { coins: { increment: netPayout } },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId,
          fromUserId: loserId,
          toUserId: winnerId,
          amount: netPayout,
          type: 'GAME',
          reason: `Düello Galibiyeti (${gameName}): Toplam Havuz ${totalPot} Coin, Kesilen Vergi %5 (${taxPaid} Coin)`,
        },
      }),
    ]);

    return { totalPot, taxPaid, netPayout, winnerProfit };
  }
}

export const economyService = new EconomyService();

