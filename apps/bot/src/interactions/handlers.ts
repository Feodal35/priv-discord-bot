import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  GuildMember,
} from 'discord.js';
import { userService } from '../services/user.service';
import { achievementService } from '../services/achievement.service';
import { shopService } from '../services/shop.service';
import { questService } from '../services/quest.service';
import { pollService } from '../services/poll.service';
import { confessionService } from '../services/confession.service';
import { gamesService } from '../services/games.service';
import { guildService } from '../services/guild.service';
import { registerService } from '../services/register.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed, createInfoEmbed } from '../utils/embed';
import { DEFAULT_COLORS, EMOJIS, RARITY, RarityType, formatCurrency, formatHours, calculateShipPercentage } from '@priv/shared';
import { createShipImage } from '../utils/canvas';
import { getShipComment, generateShipName } from '../commands/games/ship';

export async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId, user, guild } = interaction;
  if (!guild) return;

  // -1. KAYIT SİSTEMİ BUTONLARI (Erkek / Kız Kayıt)
  if (customId.startsWith('reg_male_') || customId.startsWith('reg_female_')) {
    const member = interaction.member as GuildMember;
    if (!registerService.isStaff(member)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const isMale = customId.startsWith('reg_male_');
    const targetUserId = isMale ? customId.replace('reg_male_', '') : customId.replace('reg_female_', '');
    const genderKey = isMale ? 'male' : 'female';
    const genderTitle = isMale ? '♂️ Erkek Kayıt' : '♀️ Kız Kayıt';

    // Modal aç (KESİNLİKLE YAŞ YOK, SADECE İSİM!)
    const modal = new ModalBuilder()
      .setCustomId(`reg_modal_${genderKey}_${targetUserId}`)
      .setTitle(genderTitle);

    const nameInput = new TextInputBuilder()
      .setCustomId('register_name')
      .setLabel('Kullanıcı İsmi (Nick)')
      .setPlaceholder(isMale ? 'Örn: Ahmet' : 'Örn: Ayşe')
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(30)
      .setRequired(true);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
    return;
  }

  // -1.1. KAYIT BİLGİSİ BUTONU (📋 Kayıt Bilgisi)
  if (customId.startsWith('reg_info_')) {
    const member = interaction.member as GuildMember;
    if (!registerService.isStaff(member)) {
      await interaction.reply({
        content: '❌ Bu bilgiyi görüntülemek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetUserId = customId.replace('reg_info_', '');
    const history = registerService.getHistory(guild.id, targetUserId);

    if (history.length > 0) {
      const last = history[0];
      const genderText = last.gender === 'MALE' ? '♂️ Erkek' : '♀️ Kız';
      const timeUnix = Math.floor(new Date(last.registeredAt).getTime() / 1000);

      const embed = createEmbed({
        title: '📋 Kullanıcı Kayıt Bilgisi',
        description:
          `**Kullanıcı:** <@${targetUserId}>\n\n` +
          `• **Kayıt Eden Yetkili:** <@${last.staffId}>\n` +
          `• **Kayıt Edilen İsim:** \`${last.name}\`\n` +
          `• **Cinsiyet:** ${genderText}\n` +
          `• **Kayıt Tarihi:** <t:${timeUnix}:f> (<t:${timeUnix}:R>)\n` +
          `• **Toplam Kayıt Sayısı:** \`${history.length}\` kez kayıt edilmiş.`,
        color: DEFAULT_COLORS.PRIMARY,
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Akıllı Fallback: Veritabanı yeniden başlama öncesine aitse veya log henüz düşmediyse üyenin sunucu rolünü tara
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    const settings = registerService.getSettings(guild.id);

    let detectedGender = 'Belirlenemedi';
    if (settings.maleRoleId && targetMember?.roles.cache.has(settings.maleRoleId)) {
      detectedGender = '♂️ Erkek';
    } else if (settings.femaleRoleId && targetMember?.roles.cache.has(settings.femaleRoleId)) {
      detectedGender = '♀️ Kız';
    } else if (targetMember) {
      // Rol isimlerinden tara
      const hasMale = targetMember.roles.cache.some((r) => ['erkek', 'boy', 'man'].some((k) => r.name.toLowerCase().includes(k)));
      const hasFemale = targetMember.roles.cache.some((r) => ['kadın', 'kadin', 'kız', 'kiz', 'girl'].some((k) => r.name.toLowerCase().includes(k)));
      if (hasMale) detectedGender = '♂️ Erkek';
      else if (hasFemale) detectedGender = '♀️ Kız';
    }

    if (targetMember && detectedGender !== 'Belirlenemedi') {
      const joinUnix = targetMember.joinedTimestamp ? Math.floor(targetMember.joinedTimestamp / 1000) : Math.floor(Date.now() / 1000);
      const embed = createEmbed({
        title: '📋 Kullanıcı Kayıt Bilgisi',
        description:
          `**Kullanıcı:** <@${targetUserId}>\n\n` +
          `• **Kayıt Edilen İsim:** \`${targetMember.displayName}\`\n` +
          `• **Cinsiyet:** ${detectedGender}\n` +
          `• **Sunucuya Katılış:** <t:${joinUnix}:f> (<t:${joinUnix}:R>)\n` +
          `• **Durum:** ✅ Sunucuda Kayıtlı Aktif Üye`,
        color: DEFAULT_COLORS.PRIMARY,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        createEmbed({
          title: '📋 Kayıt Bilgisi',
          description: `<@${targetUserId}> kullanıcısına ait henüz kaydedilmiş bir kayıt verisi veya aktif cinsiyet rolü bulunmuyor.`,
          color: DEFAULT_COLORS.PRIMARY,
        }),
      ],
      ephemeral: true,
    });
    return;
  }

  // -1.2. YENİDEN KAYDET BUTONU (🔄 Yeniden Kaydet)
  if (customId.startsWith('reg_redo_')) {
    const member = interaction.member as GuildMember;
    if (!registerService.isStaff(member)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetUserId = customId.replace('reg_redo_', '');

    // Modal aç (İsim ve Cinsiyet)
    const modal = new ModalBuilder()
      .setCustomId(`reg_modal_redo_${targetUserId}`)
      .setTitle('🔄 Yeniden Kaydet');

    const nameInput = new TextInputBuilder()
      .setCustomId('register_name')
      .setLabel('Kullanıcı İsmi (Nick)')
      .setPlaceholder('Örn: Ahmet')
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(30)
      .setRequired(true);

    const genderInput = new TextInputBuilder()
      .setCustomId('register_gender')
      .setLabel('Cinsiyet (Erkek için: E, Kız için: K)')
      .setPlaceholder('E veya K yazınız')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(10)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(genderInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // -1.3. İSİM DEĞİŞTİR BUTONU (Kayıt Sonrası)
  if (customId.startsWith('reg_change_name_')) {
    const member = interaction.member as GuildMember;
    if (!registerService.isStaff(member)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetUserId = customId.replace('reg_change_name_', '');

    const modal = new ModalBuilder()
      .setCustomId(`reg_modal_rename_${targetUserId}`)
      .setTitle('İsim Değiştir');

    const nameInput = new TextInputBuilder()
      .setCustomId('new_name')
      .setLabel('Yeni İsim (Nick)')
      .setPlaceholder('Örn: Ahmet')
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(30)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
    await interaction.showModal(modal);
    return;
  }

  // -1.4. KAYITSIZ VER BUTONU (Kayıt Sonrası)
  if (customId.startsWith('reg_to_unreg_')) {
    const staffMember = interaction.member as GuildMember;
    if (!registerService.isStaff(staffMember)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetUserId = customId.replace('reg_to_unreg_', '');
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      await interaction.reply({
        content: '❌ Kullanıcı bulunamadı veya sunucudan ayrılmış!',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await registerService.unregisterMember({
      guild,
      targetMember,
      staffMember,
    });

    await interaction.editReply({ content: result.message });
    return;
  }

  // -0.5. PANEL ROL (SELF-ROLE) BUTONLARI (Etkinlikçi vb.)
  if (customId.startsWith('self_role_')) {
    const roleId = customId.replace('self_role_', '');
    const member = (interaction.member as GuildMember) || (await guild.members.fetch(user.id).catch(() => null));

    if (!member) {
      await interaction.reply({ content: '❌ Kullanıcı bilgisi alınamadı!', ephemeral: true });
      return;
    }

    // Güvenlik: Korumalı özel roller panelden alınamaz
    const PROTECTED_ROLES = ['1543033008318316654', '1543392872504762498'];
    if (PROTECTED_ROLES.includes(roleId)) {
      await interaction.reply({
        content: '❌ Bu özel rol panel üzerinden alınamaz veya bırakılamaz!',
        ephemeral: true,
      });
      return;
    }

    const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
    if (!role) {
      await interaction.reply({
        content: '❌ Belirtilen rol sunucuda bulunamadı veya silinmiş!',
        ephemeral: true,
      });
      return;
    }

    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: '❌ Yönetici yetkisine sahip roller güvenlik nedeniyle panelden alınamaz!',
        ephemeral: true,
      });
      return;
    }

    const botMember = guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles) || botMember.roles.highest.position <= role.position) {
      await interaction.reply({
        content: `❌ Botun rol yetkisi **${role.name}** rolünü yönetmek için yetersiz! Lütfen botun rolünü roller sıralamasında bu rolün üzerine taşıyın.`,
        ephemeral: true,
      });
      return;
    }

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role.id);
        const embed = createEmbed({
          title: '🗑️ Rol Kaldırıldı',
          description: `<@&${role.id}> (**${role.name}**) rolü üzerinizden başarıyla alındı. İstediğiniz zaman tekrar butona basarak alabilirsiniz.`,
          color: DEFAULT_COLORS.WARNING,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        await member.roles.add(role.id);
        const embed = createEmbed({
          title: '✅ Rol Eklendi',
          description: `<@&${role.id}> (**${role.name}**) rolü üzerinize başarıyla verildi! Artık bildirimlerden anında haberdar olacaksınız.`,
          color: DEFAULT_COLORS.SUCCESS,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Rol işlemi sırasında bir hata oluştu: ${err.message}`,
        ephemeral: true,
      });
    }
    return;
  }

  // 0. SHIP BUTONLARI
  if (customId.startsWith('ship_retry_') || customId.startsWith('ship_swap_')) {
    await interaction.deferReply();
    const parts = customId.split('_');
    // format: ship_retry_<id1>_<id2>  or  ship_swap_<id1>_<id2>
    const id1 = parts[2];
    const id2 = parts[3];

    const u1 = await interaction.client.users.fetch(id1).catch(() => null);
    const u2 = await interaction.client.users.fetch(id2).catch(() => null);

    if (!u1 || !u2) {
      await interaction.editReply({ content: '⚠️ Kullanıcılar bulunamadı.' });
      return;
    }

    const percent = calculateShipPercentage(u1.id, u2.id);
    const { comment, emoji, color } = getShipComment(percent);
    const shipName = generateShipName(u1.username, u2.username);

    const avatar1 = u1.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar2 = u2.displayAvatarURL({ extension: 'png', size: 256 });

    let imageBuffer: Buffer | null = null;
    try {
      imageBuffer = await createShipImage(avatar1, avatar2, percent);
    } catch { /* non-fatal */ }

    const embed = createEmbed({
      title: `${emoji}  [ ${u1.username}  &  ${u2.username} ]  —  #${shipName}`,
      description: `> *${comment}*`,
      color: color as any,
      timestamp: false,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ship_retry_${u1.id}_${u2.id}`)
        .setLabel('🔄 Yeniden Dene')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`ship_swap_${u2.id}_${u1.id}`)
        .setLabel('🔀 Yer Değiştir')
        .setStyle(ButtonStyle.Secondary)
    );

    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'ship.png' });
      embed.setImage('attachment://ship.png');
      await interaction.editReply({ embeds: [embed], files: [attachment], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
    return;
  }

  // 1. PROFİL BUTONLARI
  if (customId.startsWith('profile_')) {
    const parts = customId.split('_');
    const tab = parts[1]; // achievements, stats, inventory, streak
    const targetUserId = parts[2];

    if (tab === 'achievements') {
      const uAch = await achievementService.getUserAchievements(guild.id, targetUserId);
      const fields = uAch.map((a) => {
        const r = RARITY[a.achievement.rarity as RarityType] || RARITY.COMMON;
        return {
          name: `${a.achievement.icon} ${a.achievement.name} (${r.emoji} ${r.name})`,
          value: `*${a.achievement.description}*\nKazanıldı: <t:${Math.floor(a.unlockedAt.getTime() / 1000)}:R>`,
          inline: false,
        };
      });

      const embed = createEmbed({
        title: `🏆 <@${targetUserId}> — Başarımları (${uAch.length} Adet)`,
        description: uAch.length === 0 ? 'Henüz kazanılmış bir başarım yok.' : undefined,
        color: DEFAULT_COLORS.PURPLE,
        fields: fields.slice(0, 10),
      });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (tab === 'stats') {
      const profile = await userService.getUserProfile(targetUserId, guild.id, interaction.client);
      const embed = createEmbed({
        title: `📊 ${profile.displayName} — Detaylı İstatistikler`,
        color: DEFAULT_COLORS.INFO,
        fields: [
          { name: 'Mesaj Sayısı', value: `${formatCurrency(profile.messageCount)} mesaj`, inline: true },
          { name: 'Ses Süresi', value: `${formatHours(profile.voiceHours)}`, inline: true },
          { name: 'Seviye', value: `Seviye ${profile.level}`, inline: true },
          { name: 'Toplam XP', value: `${formatCurrency(profile.xp)} XP`, inline: true },
          { name: 'Sıralama', value: `#${profile.rank}`, inline: true },
          { name: 'Streak', value: `${profile.streak} Gün`, inline: true },
        ],
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (tab === 'inventory') {
      const inv = await shopService.getInventory(guild.id, targetUserId);
      const fields = inv.map((i) => ({
        name: `${i.item.name} (x${i.quantity})`,
        value: `*${i.item.description}*`,
        inline: false,
      }));

      const embed = createEmbed({
        title: `🎒 <@${targetUserId}> — Envanter`,
        description: inv.length === 0 ? 'Envanter şu an boş.' : undefined,
        color: DEFAULT_COLORS.GOLD,
        fields: fields.slice(0, 10),
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (tab === 'streak') {
      const profile = await userService.getUserProfile(targetUserId, guild.id, interaction.client);
      const embed = createEmbed({
        title: `🔥 <@${targetUserId}> — Günlük Streak Durumu`,
        description: `Mevcut seri: **${profile.streak} Gün**\n\nSerini korumak için her gün \`/günlük\` komutunu kullan!`,
        color: DEFAULT_COLORS.GOLD,
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  }

  // 2. XOX HAMLE BUTONLARI
  if (customId.startsWith('xox_')) {
    const parts = customId.split('_');
    const gameId = `${parts[1]}_${parts[2]}_${parts[3]}`;
    const row = parseInt(parts[4], 10);
    const col = parseInt(parts[5], 10);

    const result = gamesService.makeXoxMove(gameId, user.id, row, col);
    if (!result.success || !result.game) {
      await interaction.reply({ content: `⚠️ ${result.message}`, ephemeral: true });
      return;
    }

    const game = result.game;
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let r = 0; r < 3; r++) {
      const rowBuilder = new ActionRowBuilder<ButtonBuilder>();
      for (let c = 0; c < 3; c++) {
        const val = game.board[r][c];
        const btn = new ButtonBuilder()
          .setCustomId(`xox_${game.id}_${r}_${c}`)
          .setStyle(val === 'X' ? ButtonStyle.Danger : val === 'O' ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(val !== null || game.isFinished);

        if (val === 'X') btn.setLabel('❌');
        else if (val === 'O') btn.setLabel('⭕');
        else btn.setLabel('➖');

        rowBuilder.addComponents(btn);
      }
      components.push(rowBuilder);
    }

    let statusText = '';
    if (game.isFinished) {
      if (game.winner === 'DRAW') {
        statusText = '🤝 **Oyun Berabere Bitti!**';
      } else {
        statusText = `🎉 **Tebrikler! <@${game.winner}> oyunu kazandı!** 🏆`;
      }
    } else {
      const nextUser = game.turn === 'X' ? game.playerX : game.playerO;
      statusText = `Sıra: <@${nextUser}> (**${game.turn}**)`;
    }

    const embed = createEmbed({
      title: '❌ XOX Düellosu ⭕',
      description: `**X:** <@${game.playerX}>\n**O:** <@${game.playerO}>\n\n${statusText}`,
      color: game.isFinished ? DEFAULT_COLORS.SUCCESS : DEFAULT_COLORS.PRIMARY,
    });

    await interaction.update({ embeds: [embed], components });
    return;
  }

  // 3. TAŞ KAĞIT MAKAS BUTONLARI
  if (customId.startsWith('tkm_')) {
    const parts = customId.split('_');
    const gameId = `${parts[1]}_${parts[2]}_${parts[3]}`;
    const choice = parts[4] as 'TAS' | 'KAGIT' | 'MAKAS';

    const result = gamesService.makeTkmChoice(gameId, user.id, choice);
    if (!result.success || !result.game) {
      await interaction.reply({ content: `⚠️ ${result.message}`, ephemeral: true });
      return;
    }

    const game = result.game;
    if (game.isFinished) {
      const iconMap = { TAS: '🪨 Taş', KAGIT: '📄 Kağıt', MAKAS: '✂️ Makas' };
      let outcomeText = '';
      if (game.winner === 'DRAW') {
        outcomeText = '🤝 **Berabere!** İki taraf da aynı hamleyi yaptı.';
      } else if (game.winner === 'BOT') {
        outcomeText = '🤖 **Bot kazandı!** Şansını bir dahaki sefere dene.';
      } else {
        outcomeText = `🎉 **Kazanan:** <@${game.winner}>!`;
      }

      const embed = createEmbed({
        title: '🪨 Taş - 📄 Kağıt - ✂️ Makas: Sonuç',
        description:
          `<@${game.player1}>: **${iconMap[game.p1Choice!]}**\n` +
          `${game.player2 === 'BOT' ? '🤖 Bot' : `<@${game.player2}>`}: **${iconMap[game.p2Choice!]}**\n\n` +
          outcomeText,
        color: DEFAULT_COLORS.GOLD,
      });

      await interaction.update({ embeds: [embed], components: [] });
    } else {
      await interaction.reply({ content: 'Seçimin kaydedildi! Rakibin seçmesi bekleniyor...', ephemeral: true });
    }
    return;
  }

  // 4. ANKET OYLAMA BUTONU
  if (customId.startsWith('poll_vote_')) {
    const parts = customId.split('_');
    const pollId = parts[2];
    const optionIndex = parseInt(parts[3], 10);

    const voteRes = await pollService.vote(pollId, user.id, optionIndex);
    if (!voteRes.success) {
      await interaction.reply({ content: `⚠️ ${voteRes.message}`, ephemeral: true });
      return;
    }

    const display = await pollService.getPollDisplay(pollId);
    if (display) {
      await interaction.update({ embeds: [display.embed], components: display.components });
    } else {
      await interaction.reply({ content: '✅ Oyunuz kaydedildi!', ephemeral: true });
    }
    return;
  }

  // 5. GÖREV ÖDÜLÜ TOPLAMA
  if (customId.startsWith('quest_claim_')) {
    const uqId = customId.replace('quest_claim_', '');
    const claimRes = await questService.claimQuest(guild.id, user.id, uqId);

    if (!claimRes.success) {
      await interaction.reply({ content: `⚠️ ${claimRes.message}`, ephemeral: true });
      return;
    }

    const embed = createSuccessEmbed(
      'Görev Ödülü Toplandı!',
      `🎁 **${claimRes.title}** görevi tamamlandı!\n\n**Kazanılan:** \`+${formatCurrency(claimRes.rewardCoins!)} Coin\` & \`+${formatCurrency(claimRes.rewardXp!)} XP\``
    );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // 6. MARKET ÜRÜN SATIN ALMA
  if (customId.startsWith('shop_buy_')) {
    const itemId = customId.replace('shop_buy_', '');
    const buyRes = await shopService.buyItem(guild.id, user.id, itemId, guild);

    if (!buyRes.success) {
      await interaction.reply({ content: buyRes.message, ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [createSuccessEmbed('Satın Alma Başarılı!', buyRes.message)],
      ephemeral: true,
    });
    return;
  }

  // 7. KURULUM SİHİRBAZI BUTONLARI
  if (customId === 'setup_step_2') {
    const embed = createEmbed({
      title: '🛠️ Priv Bot Kurulumu — Adım 2: Kanallar',
      description:
        'Aşağıdaki butonları kullanarak ya da `/ayarlar` komutundan kanallarınızı hızlıca bağlayabilirsiniz.\n\n' +
        'Priv Bot sunucunuzda otomatik olarak:\n' +
        '• `#priv-sohbet`\n' +
        '• `#priv-itiraf`\n' +
        '• `#priv-log`\n' +
        '• `🔊 Oda Oluştur` ses kanalı\n' +
        'kurabilir.',
      color: DEFAULT_COLORS.PRIMARY,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('setup_auto_channels').setLabel('Priv Kanallarını Otomatik Oluştur 🚀').setStyle(ButtonStyle.Success)
    );

    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId === 'setup_auto_channels') {
    await interaction.deferUpdate();

    try {
      // Kategori oluştur
      const category = await guild.channels.create({
        name: 'PRIV TOPLULUK',
        type: ChannelType.GuildCategory,
      });

      // Kanalları oluştur
      const confessionChannel = await guild.channels.create({
        name: 'priv-itiraf',
        type: ChannelType.GuildText,
        parent: category.id,
      });

      const logChannel = await guild.channels.create({
        name: 'priv-log',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: guild.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });

      const voiceCreateChannel = await guild.channels.create({
        name: '➕ Oda Oluştur',
        type: ChannelType.GuildVoice,
        parent: category.id,
      });

      // Ayarları güncelle
      await guildService.updateGuildSettings(guild.id, {
        confessionChannelId: confessionChannel.id,
        logChannelId: logChannel.id,
        tempVoiceCategoryId: category.id,
        tempVoiceCreateChannelId: voiceCreateChannel.id,
      });

      const embed = createSuccessEmbed(
        '🎉 Kurulum Başarıyla Tamamlandı!',
        `Harika! Sunucun için Priv kanalları otomatik olarak oluşturuldu:\n\n` +
        `• 🤫 İtiraf Kanalı: <#${confessionChannel.id}>\n` +
        `• 📋 Log Kanalı: <#${logChannel.id}>\n` +
        `• 🎤 Dinamik Ses: <#${voiceCreateChannel.id}>\n\n` +
        `Artık üyeleriniz \`/profil\`, \`/ekonomi\`, \`/market\`, \`/oyun\` komutlarını dilediğince kullanabilir!`
      );

      await interaction.editReply({ embeds: [embed], components: [] });
    } catch (err) {
      console.error('[HATA] Otomatik kanal kurulumunda hata:', err);
      await interaction.followUp({ content: 'Kanallar oluşturulurken bir hata meydana geldi. Botun `Kanalları Yönet` yetkisi olduğundan emin olun.', ephemeral: true });
    }
    return;
  }

  // 8. VERİLERİMİ SİL ONAY BUTONU
  if (customId.startsWith('confirm_delete_data_')) {
    const targetId = customId.replace('confirm_delete_data_', '');
    if (targetId !== user.id) {
      await interaction.reply({ content: 'Sadece kendi verilerini silebilirsin.', ephemeral: true });
      return;
    }

    await userService.deleteUserData(user.id, guild.id);
    await interaction.update({
      embeds: [createSuccessEmbed('Veriler Silindi', 'Bu sunucudaki profil, ekonomi ve seviye verilerin başarıyla tamamen silindi.')],
      components: [],
    });
    return;
  }

  if (customId.startsWith('cancel_delete_data_')) {
    await interaction.update({
      embeds: [createInfoEmbed('İptal Edildi', 'Veri silme işlemi iptal edildi.')],
      components: [],
    });
    return;
  }

  // 9. AYARLAR SEKMELERİ
  if (customId.startsWith('settings_tab_')) {
    const tab = customId.replace('settings_tab_', '');
    const settings = await guildService.getGuildSettings(guild.id);

    const embed = createEmbed({
      title: `⚙️ Ayarlar: ${tab.toUpperCase()}`,
      description: `Bu modül için yapılandırma seçenekleri aşağıdadır:\n\nDurum: **Aktif**\nSunucu: **${guild.name}**`,
      color: DEFAULT_COLORS.PRIMARY,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}

export async function handleModalInteraction(interaction: ModalSubmitInteraction) {
  const { customId, user, guild } = interaction;
  if (!guild) return;

  // İSİM DEĞİŞTİRME MODALI (reg_modal_rename_)
  if (customId.startsWith('reg_modal_rename_')) {
    const targetUserId = customId.replace('reg_modal_rename_', '');
    const newName = interaction.fields.getTextInputValue('new_name').trim();

    const staffMember = interaction.member as GuildMember;
    if (!registerService.isStaff(staffMember)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      await interaction.reply({
        content: '❌ Kullanıcı sunucuda bulunamadı!',
        ephemeral: true,
      });
      return;
    }

    const settings = registerService.getSettings(guild.id);
    let finalNick = newName;
    if (settings.tagEnabled && settings.tag) {
      finalNick = `${settings.tag} ${newName}`;
    }
    if (finalNick.length > 32) finalNick = finalNick.substring(0, 32);

    try {
      await targetMember.setNickname(finalNick);
      await interaction.reply({
        content: `✅ <@${targetUserId}> kullanıcısının ismi başarıyla \`${finalNick}\` olarak güncellendi!`,
        ephemeral: true,
      });
    } catch (e) {
      await interaction.reply({
        content: `⚠️ İsim değiştirilirken bir yetki hatası oluştu. (Botun rolü üyenin rolünden yukarıda olmalıdır).`,
        ephemeral: true,
      });
    }
    return;
  }

  // KAYIT MODALI (Erkek / Kız veya Yeniden Kaydet)
  if (customId.startsWith('reg_modal_')) {
    const parts = customId.split('_'); // reg, modal, male/female/redo, targetUserId
    const modeKey = parts[2];
    const targetUserId = parts[3];
    const name = interaction.fields.getTextInputValue('register_name');

    const staffMember = interaction.member as GuildMember;
    if (!registerService.isStaff(staffMember)) {
      await interaction.reply({
        content: '❌ Bu işlemi gerçekleştirmek için **Kayıt Yetkilisi** olmalısınız!',
        ephemeral: true,
      });
      return;
    }

    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    if (!targetMember) {
      await interaction.reply({
        content: '❌ Kaydedilecek üye sunucuda bulunamadı veya sunucudan ayrılmış!',
        ephemeral: true,
      });
      return;
    }

    let gender: 'MALE' | 'FEMALE' = 'MALE';
    if (modeKey === 'female') {
      gender = 'FEMALE';
    } else if (modeKey === 'redo') {
      try {
        const rawGender = interaction.fields.getTextInputValue('register_gender').toLowerCase().trim();
        if (rawGender.startsWith('k') || rawGender.startsWith('f')) {
          gender = 'FEMALE';
        } else {
          gender = 'MALE';
        }
      } catch {
        gender = 'MALE';
      }
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await registerService.registerMember({
      guild,
      targetMember,
      staffMember,
      name,
      gender,
      originalMessage: interaction.message,
    });

    await interaction.editReply({ content: result.message });
    return;
  }

  if (customId === 'confession_modal') {
    const content = interaction.fields.getTextInputValue('confession_text');
    await interaction.deferReply({ ephemeral: true });

    const result = await confessionService.submitConfession(guild.id, user.id, content, interaction.client);
    if (!result.success) {
      await interaction.editReply({ content: `⚠️ ${result.message}` });
      return;
    }

    await interaction.editReply({ content: `✅ ${result.message}` });
    return;
  }
}

export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
  const { customId, values } = interaction;

  if (customId === 'help_category_select') {
    const selected = values[0];

    const categoryDetails: Record<string, { title: string; desc: string }> = {
      social: {
        title: '👤 Sosyal & Profil Komutları',
        desc:
          '`/profil [@üye]` — Kişisel profil kartını, seviyeni, coinlerini ve streak serini gösterir.\n' +
          '`/seviye [@üye]` — Seviye ilerleme çubuğu ve XP detaylarını verir.\n' +
          '`/streak` — Günlük aktiflik ateş serini ve kilometre taşı ödüllerini listeler.\n' +
          '`/başarımlar [@üye]` — Kazanılan ve kilitli sunucu başarımlarını listeler.\n' +
          '`/hafıza [liste/ekle]` — Sunucunun unutulmaz dönüm noktalarını kaydeder ve görüntüler.\n' +
          '`/yılözeti [yıl]` — Sunucunun yıllık sohbet ve ses aktivitesi özetini sunar.\n' +
          '`/verilerim` — KVKK gereği sunucuda tutulan kişisel verilerini gösterir.\n' +
          '`/verilerimi-sil` — Kayıtlı verilerini kalıcı olarak siler.',
      },
      economy: {
        title: '💰 Ekonomi & Market Komutları',
        desc:
          '`/bakiye [@üye]` — Cüzdan ve banka bakiyesini gösterir.\n' +
          '`/günlük` — Günlük coin hediyesini ve streak bonusunu toplar.\n' +
          '`/çalış` — 1 saatlik cooldown ile çalışarak sunucu parası kazanır.\n' +
          '`/gönder @üye miktar` — Güvenli database transaction ile başka bir üyeye para transfer eder.\n' +
          '`/market` — Sunucu mağazasından rol, rozet veya ürün satın alır.\n' +
          '`/envanter` — Satın aldığın eşyaları ve rolleri listeler.\n' +
          '`/görev` — Günlük ve haftalık görevleri takip edip ödülleri toplar.',
      },
      games: {
        title: '🎮 Mini Oyunlar & Eğlence',
        desc:
          '`/oyun xox @rakip` — 3x3 buton gridi ile gerçek zamanlı Tic-Tac-Toe oynar.\n' +
          '`/oyun tkm [@rakip]` — Taş, Kağıt, Makas düellosu yapar.\n' +
          '`/oyun yazı-tura [seçim] [bahis]` — Bahisli yazı-tura atar.\n' +
          '`/oyun zar [bahis]` — Bota karşı yüksek zar atma bahsi oynar.\n' +
          '`/oyun sayı-tahmini` — 1-100 arası sayı bulma oyunu başlatır.\n' +
          '`/ship @üye` — İki kullanıcı arasındaki aşk uyumunu ve eğlenceli yorumu hesaplar.',
      },
      voice: {
        title: '🎤 Dinamik Ses Odası Komutları',
        desc:
          '`/voice kilitle` — Kendi geçici ses odanı yabancıların girişine kilitler.\n' +
          '`/voice aç` — Oda kilidini herkese açar.\n' +
          '`/voice limit [sayı]` — Odaya girebilecek kişi sayısını sınırlar.\n' +
          '`/voice isim [yeni_isim]` — Geçici ses odanın adını değiştirir.\n' +
          '`/voice at @üye` — Odaya izinsiz giren üyeyi odadan atar.',
      },
      moderation: {
        title: '🛡️ Moderasyon Komutları',
        desc:
          '`/uyar @üye [sebep]` — Üyeyi kurallara aykırı davranıştan uyarır.\n' +
          '`/timeout @üye [dakika]` — Üyeye geçici susturma uygular.\n' +
          '`/sustur @üye [dakika]` — Metin ve ses kanallarında susturur.\n' +
          '`/at @üye [sebep]` — Üyeyi sunucudan atar (Kick).\n' +
          '`/yasakla @üye [sebep]` — Üyeyi sunucudan kalıcı olarak banlar.\n' +
          '`/temizle [sayı]` — Kanaldan belirtilen sayıda mesajı toplu siler.\n' +
          '`/kilitle` — Kanalı mesaj yazmaya kapatır.\n' +
          '`/aç` — Kanalın mesaj kilidini kaldırır.',
      },
      utility: {
        title: '⚙️ Sunucu & Araç Komutları',
        desc:
          '`/kurulum` — Tek tıkla Priv Bot sunucu sihirbazını başlatır.\n' +
          '`/ayarlar` — Sunucu özelliklerini ve kanallarını yönetir.\n' +
          '`/sunucu` — Sunucu üye, ses ve mesaj istatistiklerini görüntüler.\n' +
          '`/sıralama` — XP, Coin, Mesaj ve Ses liderlik tablosunu listeler.\n' +
          '`/itiraf` — Tamamen anonim itiraf gönderir.\n' +
          '`/anket` — Butonlu canlı anket başlatır.\n' +
          '`/doğumgünü [gün] [ay]` — Doğum gününü kaydeder.\n' +
          '`/hatırlat [süre] [not]` — Belirlediğin süre sonra sana bildirim gönderir.',
      },
    };

    const cat = categoryDetails[selected];
    if (cat) {
      const embed = createEmbed({
        title: cat.title,
        description: cat.desc,
        color: DEFAULT_COLORS.PRIMARY,
        footer: { text: 'Priv Bot • %100 Türkçe Modüler Sistem' },
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
