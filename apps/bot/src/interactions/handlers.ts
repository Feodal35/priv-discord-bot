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
  StringSelectMenuBuilder,
  VoiceChannel,
} from 'discord.js';
import { userService } from '../services/user.service';
import { buildLeaderboardReply, LbCategory, buildCategoryButtons } from '../commands/utility/siralama';
import { buildCategoryEmbed } from '../commands/utility/yardim';
import { shopService as shopServiceForMarket } from '../services/shop.service';
import { guildService as guildServiceForMarket } from '../services/guild.service';
import { achievementService } from '../services/achievement.service';
import { shopService } from '../services/shop.service';
import { questService } from '../services/quest.service';
import { pollService } from '../services/poll.service';
import { confessionService } from '../services/confession.service';
import { gamesService } from '../services/games.service';
import { guildService } from '../services/guild.service';
import { registerService } from '../services/register.service';
import { voiceService } from '../services/voice.service';
import { giveawayService } from '../services/giveaway.service';
import { blackjackService } from '../services/blackjack.service';
import { economyService } from '../services/economy.service';
import { boosterColorService } from '../services/boosterColor.service';
import { createEmbed, createSuccessEmbed, createErrorEmbed, createWarningEmbed, createInfoEmbed } from '../utils/embed';
import { DEFAULT_COLORS, EMOJIS, RARITY, RarityType, formatCurrency, formatHours, calculateShipPercentage } from '@priv/shared';
import { createShipImage } from '../utils/canvas';
import { getShipComment, generateShipName } from '../commands/games/ship';

export async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId, user, guild } = interaction;
  if (!guild) return;

  // -2. BOOSTER ÖZEL RENK PANELİ BUTONLARI
  if (customId.startsWith('booster_color_')) {
    await boosterColorService.handleButton(interaction);
    return;
  }

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

  // -0.45. ÇEKİLİŞ KATIL BUTONU
  if (customId.startsWith('giveaway_join_')) {
    const giveawayId = customId.replace('giveaway_join_', '');
    const member = (interaction.member as GuildMember) || (await guild.members.fetch(user.id).catch(() => null));
    if (!member) {
      await interaction.reply({ content: '❌ Kullanıcı bilgisi alınamadı.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await giveawayService.toggleJoin(giveawayId, member, interaction.client);
    await interaction.editReply({ content: result.message });
    return;
  }

  // -0.42. BLACKJACK BUTONLARI (Hit / Stand)
  if (customId.startsWith('bj_hit_') || customId.startsWith('bj_stand_')) {
    const isHit = customId.startsWith('bj_hit_');
    const gameId = isHit ? customId.replace('bj_hit_', '') : customId.replace('bj_stand_', '');

    const game = blackjackService.getGame(gameId);
    if (!game) {
      await interaction.reply({ content: '❌ Bu oyunun süresi dolmuş veya bulunamadı.', ephemeral: true });
      return;
    }

    if (game.userId !== user.id) {
      await interaction.reply({ content: '❌ Bu oyun oturumu size ait değil!', ephemeral: true });
      return;
    }

    if (game.isFinished) {
      await interaction.reply({ content: '⚠️ Bu oyun zaten bitti.', ephemeral: true });
      return;
    }

    if (isHit) {
      const res = blackjackService.hit(gameId);
      const pScore = blackjackService.calculateScore(res.game.playerCards);

      if (res.game.isFinished) {
        let winAmount = 0;
        if (!res.busted) {
          const dScore = blackjackService.calculateScore(res.game.dealerCards);
          if (dScore > 21 || pScore > dScore) {
            winAmount = res.game.bet * 2;
            await economyService.modifyBalance(guild.id, user.id, winAmount, 'ADD', 'Blackjack Kazancı');
          } else if (pScore === dScore) {
            winAmount = res.game.bet;
            await economyService.modifyBalance(guild.id, user.id, winAmount, 'ADD', 'Blackjack Beraberlik İadesi');
          }
        }

        const embed = createEmbed({
          title: '🃏 Blackjack (21) — Sonuç',
          description:
            `**Senin Elin:** ${blackjackService.formatHand(res.game.playerCards)} (\`${pScore}\`)\n` +
            `**Krupiyenin Eli:** ${blackjackService.formatHand(res.game.dealerCards)} (\`${blackjackService.calculateScore(res.game.dealerCards)}\`)\n\n` +
            `${res.game.statusText}` +
            (winAmount > 0 ? `\n\n💰 **Kazanılan / İade:** \`+${formatCurrency(winAmount)} Coin\`` : ''),
          color: res.busted ? DEFAULT_COLORS.DANGER : DEFAULT_COLORS.SUCCESS,
        });

        await interaction.update({ embeds: [embed], components: [] });
      } else {
        const dScore = blackjackService.calculateScore([res.game.dealerCards[0]]);
        const embed = createEmbed({
          title: '🃏 Blackjack (21)',
          description:
            `**Senin Elin:** ${blackjackService.formatHand(res.game.playerCards)} (\`${pScore}\`)\n` +
            `**Krupiyenin Eli:** ${blackjackService.formatHand(res.game.dealerCards, true)} (\`${dScore} + ?\`)\n\n` +
            `💰 **Mevcut Bahis:** \`${formatCurrency(res.game.bet)} Coin\`\n\n` +
            `Kart çekmek için **Kart Çek (Hit)**, elinizde kalmak için **Pas (Stand)** butonuna basın!`,
          color: DEFAULT_COLORS.PRIMARY,
        });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`bj_hit_${res.game.id}`)
            .setLabel('Kart Çek (Hit)')
            .setEmoji('🃏')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`bj_stand_${res.game.id}`)
            .setLabel('Pas (Stand)')
            .setEmoji('🛑')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      }
      return;
    } else {
      const res = blackjackService.stand(gameId);
      const pScore = blackjackService.calculateScore(res.game.playerCards);
      const dScore = blackjackService.calculateScore(res.game.dealerCards);

      let winAmount = 0;
      if (dScore > 21 || pScore > dScore) {
        winAmount = res.game.bet * 2;
        await economyService.modifyBalance(guild.id, user.id, winAmount, 'ADD', 'Blackjack Kazancı');
      } else if (pScore === dScore) {
        winAmount = res.game.bet;
        await economyService.modifyBalance(guild.id, user.id, winAmount, 'ADD', 'Blackjack Beraberlik İadesi');
      }

      const embed = createEmbed({
        title: '🃏 Blackjack (21) — Sonuç',
        description:
          `**Senin Elin:** ${blackjackService.formatHand(res.game.playerCards)} (\`${pScore}\`)\n` +
          `**Krupiyenin Eli:** ${blackjackService.formatHand(res.game.dealerCards)} (\`${dScore}\`)\n\n` +
          `${res.game.statusText}` +
          (winAmount > 0 ? `\n\n💰 **Kazanılan / İade:** \`+${formatCurrency(winAmount)} Coin\`` : ''),
        color: winAmount > 0 ? DEFAULT_COLORS.SUCCESS : DEFAULT_COLORS.DANGER,
      });

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }
  }

  // -0.4. ÖZEL SES ODASI KONTROL PANELİ BUTONLARI
  if (customId.startsWith('tempvoice_')) {
    const parts = customId.split('_');
    const action = parts[1]; // lock, limit, rename, kick, transfer
    const channelId = parts[2];

    const tempRecord = await voiceService.getTempChannel(channelId);
    if (!tempRecord) {
      await interaction.reply({
        content: '❌ Bu geçici ses odası artık mevcut değil veya kapatılmış.',
        ephemeral: true,
      });
      return;
    }

    if (tempRecord.ownerId !== user.id) {
      await interaction.reply({
        content: '❌ Bu odayı yalnızca **oda sahibi** yönetebilir!',
        ephemeral: true,
      });
      return;
    }

    const voiceChannel = (await guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
    if (!voiceChannel) {
      await interaction.reply({
        content: '❌ Ses kanalı bulunamadı.',
        ephemeral: true,
      });
      return;
    }

    if (action === 'lock') {
      const isCurrentlyLocked = tempRecord.isLocked;
      const newLockedState = !isCurrentlyLocked;

      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, {
        Connect: newLockedState ? false : null,
      });

      await voiceService.updateTempChannel(channelId, { isLocked: newLockedState });

      if (newLockedState) {
        await interaction.reply({
          content: '🔒 **Oda Kilitlendi!** Artık odaya yalnızca izin verdiğiniz kullanıcılar katılabilir.',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '🔓 **Oda Kilidi Açıldı!** Artık herkes odaya katılabilir.',
          ephemeral: true,
        });
      }
      return;
    }

    if (action === 'limit') {
      const modal = new ModalBuilder()
        .setCustomId(`tempvoice_modal_limit_${channelId}`)
        .setTitle('Oda Kişi Limiti Ayarla');

      const limitInput = new TextInputBuilder()
        .setCustomId('user_limit')
        .setLabel('Kişi Sayısı (0 sınırsız demektir)')
        .setPlaceholder('0 - 99 arası bir sayı girin (Örn: 4)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(limitInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'rename') {
      const modal = new ModalBuilder()
        .setCustomId(`tempvoice_modal_rename_${channelId}`)
        .setTitle('Oda İsmini Değiştir');

      const nameInput = new TextInputBuilder()
        .setCustomId('new_name')
        .setLabel('Yeni Oda İsmi')
        .setPlaceholder('Örn: 🎮 Sohbet & Oyun')
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(30)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
      await interaction.showModal(modal);
      return;
    }

    if (action === 'kick') {
      const otherMembers = voiceChannel.members.filter((m) => m.id !== user.id && !m.user.bot);
      if (otherMembers.size === 0) {
        await interaction.reply({
          content: '⚠️ Odanızda sizden başka kimse bulunmuyor.',
          ephemeral: true,
        });
        return;
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`tempvoice_select_kick_${channelId}`)
        .setPlaceholder('Odadan atmak istediğiniz üyeyi seçin')
        .addOptions(
          otherMembers.map((m) => ({
            label: m.displayName.substring(0, 25),
            value: m.id,
            description: m.user.tag.substring(0, 50),
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      await interaction.reply({
        content: '🚫 Odadan atmak ve girişini engellemek istediğiniz üyeyi seçin:',
        components: [row],
        ephemeral: true,
      });
      return;
    }

    if (action === 'transfer') {
      const otherMembers = voiceChannel.members.filter((m) => m.id !== user.id && !m.user.bot);
      if (otherMembers.size === 0) {
        await interaction.reply({
          content: '⚠️ Odanızda devredeceğiniz başka bir üye bulunmuyor.',
          ephemeral: true,
        });
        return;
      }

      const select = new StringSelectMenuBuilder()
        .setCustomId(`tempvoice_select_transfer_${channelId}`)
        .setPlaceholder('Oda sahipliğini devredeceğiniz üyeyi seçin')
        .addOptions(
          otherMembers.map((m) => ({
            label: m.displayName.substring(0, 25),
            value: m.id,
            description: m.user.tag.substring(0, 50),
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      await interaction.reply({
        content: '👑 Oda yöneticiliğini kime devretmek istiyorsunuz?',
        components: [row],
        ephemeral: true,
      });
      return;
    }
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

  // 9.5 SIRALAMA KATEGORİ BUTONLARI (lb_cat_)
  if (customId.startsWith('lb_cat_')) {
    const category = customId.replace('lb_cat_', '') as LbCategory;
    await interaction.deferUpdate();

    const result = await buildLeaderboardReply(
      guild.id,
      guild.name,
      guild.iconURL({ extension: 'png', size: 128 }),
      category,
      interaction.client
    );

    if (!result) {
      await interaction.followUp({ content: 'Bu kategoride henüz veri yok.', ephemeral: true });
      return;
    }

    const catRow = buildCategoryButtons(category);

    if (result.imageBuffer) {
      const attachment = new AttachmentBuilder(result.imageBuffer, { name: 'siralama.png' });
      await interaction.editReply({ embeds: [result.embed], files: [attachment], components: [catRow] });
    } else {
      await interaction.editReply({ embeds: [result.embed], components: [catRow] });
    }
    return;
  }

  // 9.6 MARKET SAYFALAMA BUTONLARI (market_prev_ / market_next_)
  if (customId.startsWith('market_prev_') || customId.startsWith('market_next_')) {
    await interaction.deferUpdate();
    const page = parseInt(customId.split('_').pop()!, 10);
    const items = await shopServiceForMarket.getShopItems(guild.id);
    const settings = await guildServiceForMarket.getGuildSettings(guild.id);

    const MPAGE_SIZE = 5;
    const mTotalPages = Math.ceil(items.length / MPAGE_SIZE);
    const mSafeP = Math.max(0, Math.min(page, mTotalPages - 1));
    const mStart = mSafeP * MPAGE_SIZE;
    const mPageItems = items.slice(mStart, mStart + MPAGE_SIZE);

    const MARKET_EMOJIS: Record<string, string> = { ROLE: '🎭', XP_BOOST: '⚡', BADGE: '🏅', RING: '💍', CUSTOM: '🎁' };
    const STOCK_COLOR = (s: number) => s === -1 ? '🟢' : s > 10 ? '🟢' : s > 0 ? '🟡' : '🔴';

    const mDesc = mPageItems.map((item, idx) => {
      const gi = mStart + idx + 1;
      const stockText = item.stock === -1 ? 'Sınırsız' : `${item.stock} Adet`;
      return (
        `**${gi}. ${MARKET_EMOJIS[item.type] || '📦'} ${item.name}**\n` +
        `> ${item.description}\n` +
        `> 💰 **Fiyat:** \`${formatCurrency(item.price)} ${settings.currencyName}\`\n` +
        `> ${STOCK_COLOR(item.stock)} **Stok:** \`${stockText}\``
      );
    }).join('\n\n');

    const { EmbedBuilder: EmbedBld } = await import('discord.js');
    const mEmbed = new EmbedBld()
      .setColor(0xf1c40f)
      .setTitle(`🛒 ${guild.name} — Sunucu Marketi`)
      .setDescription(mDesc)
      .setFooter({ text: `Sayfa ${mSafeP + 1}/${mTotalPages} • ${items.length} ürün` });

    const mBuyRow = new ActionRowBuilder<ButtonBuilder>();
    mPageItems.forEach((item) => {
      mBuyRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_buy_${item.id}`)
          .setLabel(`Satın Al`)
          .setEmoji('🛍️')
          .setStyle(item.stock === 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(item.stock === 0)
      );
    });

    const mNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`market_prev_${mSafeP - 1}`).setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(mSafeP === 0),
      new ButtonBuilder().setCustomId(`market_page_${mSafeP}`).setLabel(`📄 ${mSafeP + 1} / ${mTotalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`market_next_${mSafeP + 1}`).setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(mSafeP >= mTotalPages - 1)
    );

    const mRows = mBuyRow.components.length > 0 ? [mBuyRow, mNavRow] : [mNavRow];
    await interaction.editReply({ embeds: [mEmbed], components: mRows });
    return;
  }

  // 9.7 ENVANTER SAYFALAMA BUTONLARI (inv_prev_ / inv_next_)
  if (customId.startsWith('inv_prev_') || customId.startsWith('inv_next_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const targetUserId = parts[2];
    const page = parseInt(parts[3], 10);

    const inventory = await shopService.getInventory(guild.id, targetUserId);
    const IPAGE_SIZE = 8;
    const iTotalPages = Math.ceil(inventory.length / IPAGE_SIZE);
    const iSafeP = Math.max(0, Math.min(page, iTotalPages - 1));
    const iStart = iSafeP * IPAGE_SIZE;
    const iPageItems = inventory.slice(iStart, iStart + IPAGE_SIZE);

    const INV_EMOJIS: Record<string, string> = { ROLE: '🎭', XP_BOOST: '⚡', BADGE: '🏅', RING: '💍', CUSTOM: '🎁' };
    const iTargetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
    const iUsername = iTargetUser?.username || 'Kullanıcı';

    const iLines = iPageItems.map((inv, idx) => {
      const gi = iStart + idx + 1;
      const emoji = INV_EMOJIS[inv.item.type] || '📦';
      const qty = inv.quantity > 1 ? ` **(x${inv.quantity})**` : '';
      const dateStr = inv.purchasedAt.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
      return `**${gi}. ${emoji} ${inv.item.name}**${qty}\n> ${inv.item.description}\n> 📅 *${dateStr}*`;
    });

    const { EmbedBuilder: EmbedBld2 } = await import('discord.js');
    const iEmbed = new EmbedBld2()
      .setColor(0x5865f2)
      .setTitle(`🎒 ${iUsername} — Envanter`)
      .setDescription(iLines.join('\n\n'))
      .setThumbnail(iTargetUser?.displayAvatarURL({ extension: 'png', size: 128 }) || null)
      .setFooter({ text: `Sayfa ${iSafeP + 1}/${iTotalPages} • Toplam ${inventory.length} eşya` });

    const iNavRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`inv_prev_${targetUserId}_${iSafeP - 1}`).setLabel('◀ Önceki').setStyle(ButtonStyle.Secondary).setDisabled(iSafeP === 0),
      new ButtonBuilder().setCustomId(`inv_page_${iSafeP}`).setLabel(`📦 ${iSafeP + 1} / ${iTotalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`inv_next_${targetUserId}_${iSafeP + 1}`).setLabel('Sonraki ▶').setStyle(ButtonStyle.Secondary).setDisabled(iSafeP >= iTotalPages - 1)
    );

    await interaction.editReply({ embeds: [iEmbed], components: [iNavRow] });
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

  // ÖZEL SES ODASI MODALLARI (Limit & Yeniden Adlandırma)
  if (customId.startsWith('tempvoice_modal_limit_')) {
    const channelId = customId.replace('tempvoice_modal_limit_', '');
    const rawLimit = interaction.fields.getTextInputValue('user_limit').trim();
    const limit = parseInt(rawLimit, 10);

    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({
        content: '❌ Lütfen 0 ile 99 arasında geçerli bir sayı girin.',
        ephemeral: true,
      });
      return;
    }

    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
    if (channel) {
      await channel.setUserLimit(limit);
      await voiceService.updateTempChannel(channelId, { userLimit: limit });
      await interaction.reply({
        content: `👥 Oda kişi limiti başarıyla **${limit === 0 ? 'Sınırsız' : limit}** olarak ayarlandı!`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({ content: '❌ Ses kanalı bulunamadı.', ephemeral: true });
    }
    return;
  }

  if (customId.startsWith('tempvoice_modal_rename_')) {
    const channelId = customId.replace('tempvoice_modal_rename_', '');
    const newName = interaction.fields.getTextInputValue('new_name').trim();

    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
    if (channel) {
      await channel.setName(newName);
      await interaction.reply({
        content: `✏️ Oda adı başarıyla **${newName}** olarak değiştirildi!`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({ content: '❌ Ses kanalı bulunamadı.', ephemeral: true });
    }
    return;
  }
}

export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction) {
  const { customId, values } = interaction;

  // ÖZEL SES ODASI MENÜLERİ (At / Devret)
  if (customId.startsWith('tempvoice_select_kick_')) {
    const channelId = customId.replace('tempvoice_select_kick_', '');
    const targetUserId = values[0];

    const voiceChannel = (await interaction.guild?.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
    if (!voiceChannel) {
      await interaction.reply({ content: '❌ Ses kanalı bulunamadı.', ephemeral: true });
      return;
    }

    const targetMember = await interaction.guild?.members.fetch(targetUserId).catch(() => null);
    if (targetMember) {
      if (targetMember.voice.channelId === channelId) {
        await targetMember.voice.disconnect('Oda sahibi tarafından odadan atıldı.').catch(() => {});
      }
      await voiceChannel.permissionOverwrites.edit(targetUserId, { Connect: false }).catch(() => {});
      await interaction.reply({
        content: `🚫 <@${targetUserId}> odadan atıldı ve odaya girişi engellendi!`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
    }
    return;
  }

  if (customId.startsWith('tempvoice_select_transfer_')) {
    const channelId = customId.replace('tempvoice_select_transfer_', '');
    const targetUserId = values[0];

    const voiceChannel = (await interaction.guild?.channels.fetch(channelId).catch(() => null)) as VoiceChannel | null;
    if (!voiceChannel) {
      await interaction.reply({ content: '❌ Ses kanalı bulunamadı.', ephemeral: true });
      return;
    }

    await voiceService.updateTempChannel(channelId, { ownerId: targetUserId });

    await voiceChannel.permissionOverwrites.edit(targetUserId, {
      ManageChannels: true,
      MoveMembers: true,
      MuteMembers: true,
      DeafenMembers: true,
      Connect: true,
      Speak: true,
    }).catch(() => {});

    await interaction.reply({
      content: `👑 Oda sahipliği başarıyla <@${targetUserId}> kullanıcısına devredildi!`,
      ephemeral: true,
    });
    return;
  }

  if (customId === 'help_category_select') {
    const selected = values[0];
    const embed = buildCategoryEmbed(selected);
    if (embed) {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

