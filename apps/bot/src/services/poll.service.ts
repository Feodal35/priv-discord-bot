import { prisma } from '@priv/database';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createEmbed } from '../utils/embed';
import { DEFAULT_COLORS, createProgressBar } from '@priv/shared';

export class PollService {
  public async createPoll(
    guildId: string,
    channelId: string,
    messageId: string,
    question: string,
    options: string[],
    isAnonymous: boolean = false
  ) {
    return prisma.poll.create({
      data: {
        guildId,
        channelId,
        messageId,
        question,
        options: JSON.stringify(options),
        isAnonymous,
      },
    });
  }

  public async vote(pollId: string, userId: string, optionIndex: number) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { votes: true },
    });

    if (!poll || poll.isClosed) {
      return { success: false, message: 'Bu anket kapatılmış veya mevcut değil.' };
    }

    // Kullanıcının daha önce oyu var mı?
    const existingVote = poll.votes.find((v) => v.userId === userId);
    if (existingVote) {
      if (existingVote.optionIndex === optionIndex) {
        return { success: false, message: 'Zaten bu seçeneğe oy verdin.' };
      }
      // Oyunu güncelle
      await prisma.pollVote.update({
        where: { id: existingVote.id },
        data: { optionIndex },
      });
    } else {
      // Yeni oy ver
      await prisma.pollVote.create({
        data: {
          pollId,
          userId,
          optionIndex,
        },
      });
    }

    return { success: true };
  }

  public async getPollDisplay(pollId: string): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } | null> {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { votes: true },
    });

    if (!poll) return null;

    const options: string[] = JSON.parse(poll.options);
    const totalVotes = poll.votes.length;

    const counts: number[] = new Array(options.length).fill(0);
    for (const v of poll.votes) {
      if (v.optionIndex >= 0 && v.optionIndex < options.length) {
        counts[v.optionIndex]++;
      }
    }

    const fields = options.map((opt, idx) => {
      const count = counts[idx];
      const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const bar = createProgressBar(percent, 8);
      return {
        name: `${idx + 1}. ${opt}`,
        value: `${bar} (${count} Oy)`,
        inline: false,
      };
    });

    const embed = createEmbed({
      title: `📊 Anket: ${poll.question}`,
      description: poll.isAnonymous
        ? '*Bu ankette oylar tamamen anonimdir.*\nOy vermek için aşağıdaki butonları kullanabilirsin.'
        : 'Oy vermek için aşağıdaki butonları kullanabilirsin.',
      color: DEFAULT_COLORS.PRIMARY,
      fields,
      footer: {
        text: `Toplam ${totalVotes} oy kullanıldı ${poll.isClosed ? '• [KAPATILDI]' : ''}`,
      },
    });

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    options.forEach((opt, idx) => {
      if (idx > 0 && idx % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder<ButtonBuilder>();
      }

      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${poll.id}_${idx}`)
          .setLabel(`${idx + 1}. ${opt.slice(0, 20)}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(poll.isClosed)
      );
    });

    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    return { embed, components: rows };
  }
}

export const pollService = new PollService();
