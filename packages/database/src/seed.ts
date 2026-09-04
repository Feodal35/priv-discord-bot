import { prisma } from './client';
import { DEFAULT_ACHIEVEMENTS } from '@priv/shared';

export async function seedDatabase() {
  console.log('[SEED] Başarımlar veritabanına işleniyor...');

  for (const ach of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      update: {
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        rarity: ach.rarity,
        requirement: ach.requirement,
        rewardCoins: ach.rewardCoins,
        rewardXp: ach.rewardXp,
      },
      create: {
        code: ach.code,
        name: ach.name,
        description: ach.description,
        icon: ach.icon,
        rarity: ach.rarity,
        requirement: ach.requirement,
        rewardCoins: ach.rewardCoins,
        rewardXp: ach.rewardXp,
      },
    });
  }

  // Varsayılan sistem görevleri
  const defaultQuests = [
    {
      title: 'Günün Sohbetçisi',
      description: 'Bugün sunucu kanallarına 25 mesaj gönder.',
      frequency: 'DAILY',
      type: 'MESSAGE_COUNT',
      targetAmount: 25,
      rewardCoins: 200,
      rewardXp: 100,
    },
    {
      title: 'Sesli Sohbet Tutkunu',
      description: 'Bugün ses kanallarında en az 30 dakika kal.',
      frequency: 'DAILY',
      type: 'VOICE_TIME',
      targetAmount: 1800, // saniye
      rewardCoins: 300,
      rewardXp: 150,
    },
    {
      title: 'Haftalık Zar Atıcı',
      description: 'Bu hafta en az 5 mini oyun oyna.',
      frequency: 'WEEKLY',
      type: 'PLAY_GAME',
      targetAmount: 5,
      rewardCoins: 750,
      rewardXp: 400,
    },
    {
      title: 'Cömert Arkadaş',
      description: 'Bir arkadaşına en az 100 Coin gönder.',
      frequency: 'WEEKLY',
      type: 'TRANSFER_COIN',
      targetAmount: 100,
      rewardCoins: 500,
      rewardXp: 250,
    },
  ];

  console.log('[SEED] Varsayılan görevler işleniyor...');
  for (const q of defaultQuests) {
    const existing = await prisma.quest.findFirst({
      where: { title: q.title, guildId: null },
    });
    if (!existing) {
      await prisma.quest.create({
        data: {
          guildId: null,
          title: q.title,
          description: q.description,
          frequency: q.frequency,
          type: q.type,
          targetAmount: q.targetAmount,
          rewardCoins: q.rewardCoins,
          rewardXp: q.rewardXp,
        },
      });
    }
  }

  console.log('[SEED] Başarıyla tamamlandı!');
}

if (require.main === module) {
  seedDatabase()
    .catch((err) => {
      console.error('[SEED HATA]', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
