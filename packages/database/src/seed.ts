import { prisma } from './client';

export const DEFAULT_ACHIEVEMENTS = [
  {
    code: 'FIRST_STEP',
    name: 'İlk Adım',
    description: 'Sunucuya katıldın ve Priv dünyasına adım attın.',
    icon: '🌱',
    rarity: 'COMMON',
    requirement: 'Katılım',
    rewardCoins: 100,
    rewardXp: 50,
  },
  {
    code: 'CHATTERBOX',
    name: 'Geveze',
    description: 'Sunucu kanallarında toplam 100 mesaj gönderdin.',
    icon: '💬',
    rarity: 'RARE',
    requirement: '100 Mesaj',
    rewardCoins: 500,
    rewardXp: 200,
  },
  {
    code: 'MESSAGE_MASTER',
    name: '1000 Mesaj',
    description: 'Sunucuda 1000 mesaja ulaştın, gerçek bir tayfa üyesisin.',
    icon: '📜',
    rarity: 'EPIC',
    requirement: '1000 Mesaj',
    rewardCoins: 2500,
    rewardXp: 1000,
  },
  {
    code: 'NIGHT_OWL',
    name: 'Gece Kuşu',
    description: 'Gece 02:00 ile 05:00 arasında aktif olarak sohbete katıldın.',
    icon: '🦉',
    rarity: 'RARE',
    requirement: 'Gece Aktifliği',
    rewardCoins: 300,
    rewardXp: 150,
  },
  {
    code: 'VOICE_BEAST',
    name: 'Voice Canavarı',
    description: 'Ses kanallarında toplam 10 saat geçirdin.',
    icon: '🎤',
    rarity: 'RARE',
    requirement: '10 Saat Ses',
    rewardCoins: 1000,
    rewardXp: 500,
  },
  {
    code: 'VOICE_LEGEND',
    name: '100 Saat Voice',
    description: 'Ses kanallarında toplam 100 saat geçirdin, oda senin evin!',
    icon: '👑',
    rarity: 'LEGENDARY',
    requirement: '100 Saat Ses',
    rewardCoins: 10000,
    rewardXp: 5000,
  },
  {
    code: 'STREAK_WARRIOR',
    name: 'Ateşli Tayfa',
    description: '7 günlük kesintisiz streak serisine ulaştın.',
    icon: '🔥',
    rarity: 'EPIC',
    requirement: '7 Günlük Streak',
    rewardCoins: 1500,
    rewardXp: 700,
  },
  {
    code: 'LUCKY_ONE',
    name: 'Şanslı',
    description: 'Mini oyunlarda üst üste 3 kez galip geldin.',
    icon: '🎲',
    rarity: 'EPIC',
    requirement: '3 Oyun Galibiyeti',
    rewardCoins: 750,
    rewardXp: 300,
  },
  {
    code: 'OG_MEMBER',
    name: 'OG',
    description: 'Sunucuda 30 günden uzun süredir bulunuyorsun.',
    icon: '💎',
    rarity: 'LEGENDARY',
    requirement: '30 Günlük Kıdem',
    rewardCoins: 5000,
    rewardXp: 2500,
  },
];

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
