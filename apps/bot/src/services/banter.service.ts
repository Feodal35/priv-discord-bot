import { Message, TextChannel } from 'discord.js';
import { logger } from '../utils/logger';

export const MAIN_CHAT_CHANNEL_ID = '1542620110882349162';

export class BanterService {
  // Global cooldown: En az 3 dakika (180.000 ms) arayla rastgele bulaşsın (nadiren ve tadında)
  private lastBanterTime = 0;
  private minCooldownMs = 3 * 60 * 1000;

  // Kullanıcı başına cooldown: Aynı kişiye 8 dakikadan önce tekrar bulaşmasın
  private userCooldowns = new Map<string, number>();
  private userCooldownMs = 8 * 60 * 1000;

  // Rastgele mesajlarda bulaşma ihtimali (%3.5)
  private randomTriggerChance = 0.035;

  // Doğrudan bota seslenildiğinde cevap verme ihtimali (%30 - yine nadir ve beklenmedik)
  private mentionTriggerChance = 0.30;

  // --- Şakacı & Laf Sokan Yanıt Havuzları ---
  private randomRoasts = [
    'Yine başladı bizimki felsefe yapmaya...',
    'Aynen kardeşim kesin öyledir, başka anlatacak hikayen var mı?',
    'Sana sormadık ama neyse, dinliyoruz hadi anlat.',
    'Biri şunu sustursun yine klavyeyi ele geçirdi.',
    'Boş yapma butonuna bassam sunucu çöker mi acaba?',
    'Ciddili soruyorum, bunu yazarken hiç utanmadın mı?',
    'Tamam en havalı sensin kral, sakin ol.',
    'Hepsini okudum ve hayatımdan 15 saniye çaldın, helal etmiyorum.',
    'Sen öyle diyorsan kesin tam tersidir.',
    'Çok konuştun kral, gel bir ses odasına sesini duyalım.',
    'Yav he he.',
    'Gözlerim kanadı bunu okurken...',
    'Masa tenisi oynamıyoruz lafları bana atıp durma.',
    'Kral sakin, alt tarafı Discord\'dasın FBI ajanı havalarına girme.',
    'Boş yapmada dünya markası resmen.',
    'Seni dinleyen olsaydı dünya daha iyi bir yer olurdu... dermişim.',
    'Bu zekayla fazla yaşamazsın sen, dikkat et kendine.',
    'Kafan güzelmiş güle güle kullan.',
    'Admin yok mu ya, şuna bir çay söylesin de sussun.',
    'Hee öyle mi olmuş kanka?',
    'Bunu yazmak için kaç saat düşündün merak ediyorum.',
    'Seninle aynı sunucuda olmak bazen büyük bir sabır testi.',
    'Tamam kral inandık, başka yalanın var mı?',
    'Biraz az konuş da kafamız dinlensin.',
    'Gruptaki IQ ortalaması bu mesajla birlikte serbest düşüşe geçti.',
    'Nazar değmesin kral, her konuda bir fikrin var maşallah.',
    'Sen konuşunca arkadan hüzünlü keman sesi geliyor.',
    'Klavye tuşlarına yazık değil mi kardeşim?',
    'Bir sus da motorun soğusun.',
    'Bunu söyleyen ilk insan olmanın gururunu mu yaşıyorsun şu an?',
  ];

  private botMentionRoasts = [
    'Adımı ağzına alma çarpılırsın kral.',
    'Ne bot diyorsun ya, iki dakika dinlenelim dedik yine çağrıldık.',
    'Buyrun efendim, kimi banlıyoruz?',
    'Bot dedin yine mesaimiz başladı, SGK yatıyor mu bari?',
    'Beni mi arıyorsun canım? Buradayım.',
    'Rahatsız etmeyin sunucu fatihiyim şu an.',
    'Bot kadar başınıza taş düşsün ne istiyorsunuz?',
    'Bana bot dedin ama senin benden daha yapay davrandığın gerçeği...',
  ];

  private greetingRoasts = [
    'Aleyküm selam da, yine mi sen geldin ya?',
    'Aleyküm selam kral, hoş geldin de uslu dur bakayım.',
    'Ve aleyküm selam, hayırdır inşallah ne oldu?',
  ];

  private questionRoasts = [
    'Kaplumbağa deden yüzünden.',
    'Çünkü hayat böyle bir yer, sorgulama bence.',
    'Google\'a yazsan saniyesinde çıkardı ama yine bana kaldın...',
    'Cevap versem anlayacak mısın sanki?',
  ];

  private shutUpRoasts = [
    'Sen kime emir veriyon ya klavye delikanlısı?',
    'Beni susturacak üye daha sunucuya girmedi.',
    'Biraz daha artistlik yaparsan timeout butonuyla tanışırsın.',
  ];

  private moneyRoasts = [
    'Kafan sadece paraya çalışıyor, git `/kumar` oyna da batışını izleyelim.',
    'Zenginin parası züğürdün çenesini yorarmış.',
    'Bakiye sıfırlanmış gibi bir havan var kral, hayırdır?',
  ];

  private loveRoasts = [
    'Aşk meşk boş işler kral, gel ses odasına takılalım.',
    'Yine birileri aşk acısı çekiyor, mendil getireyim mi?',
    'Manita dedin de bizim sunucudakiler sana bakar mı sence?',
  ];

  private capsRoasts = [
    'Caps Lock tuşun mu takıldı bağırıp durma kulağımız patladı.',
    'Sakin ol şampiyon, yangından mal mı kaçırıyorsun?',
  ];

  /**
   * Ana sohbet mesajlarını inceler ve çok nadiren şakacı / laf sokucu cevaplar verir.
   */
  public async handleMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;
    if (message.channelId !== MAIN_CHAT_CHANNEL_ID) return false;

    const content = message.content.trim();
    if (!content || content.length < 2) return false;

    // Komutları pas geç
    if (content.startsWith('/') || content.startsWith('!') || content.startsWith('.')) return false;

    const now = Date.now();

    // Global cooldown kontrolü
    if (now - this.lastBanterTime < this.minCooldownMs) return false;

    // Kullanıcı cooldown kontrolü
    const lastUserTime = this.userCooldowns.get(message.author.id) || 0;
    if (now - lastUserTime < this.userCooldownMs) return false;

    const lower = content.toLocaleLowerCase('tr-TR');
    let response: string | null = null;

    // 1. Bot mention veya "bot" kelimesi geçti mi?
    const isBotMentioned =
      message.mentions.has(message.client.user?.id || '') ||
      /\b(bot|priv|metro|yapay zeka|ai)\b/i.test(lower);

    if (isBotMentioned) {
      if (Math.random() < this.mentionTriggerChance) {
        response = this.getRandomItem(this.botMentionRoasts);
      }
    } else if (/^(sa|sea|selam|selamun aleykum|merhaba|slm)\b/i.test(lower)) {
      if (Math.random() < 0.15) {
        response = this.getRandomItem(this.greetingRoasts);
      }
    } else if (/\b(neden|niye|nasi|nasıl|niçin)\b/i.test(lower)) {
      if (Math.random() < 0.10) {
        response = this.getRandomItem(this.questionRoasts);
      }
    } else if (/\b(sus|kes|kes sesini|kes be|kapa ceneni)\b/i.test(lower)) {
      if (Math.random() < 0.20) {
        response = this.getRandomItem(this.shutUpRoasts);
      }
    } else if (/\b(para|coin|kumar|fakir|zengin)\b/i.test(lower)) {
      if (Math.random() < 0.10) {
        response = this.getRandomItem(this.moneyRoasts);
      }
    } else if (/\b(aşk|ask|sevgili|manita|sevgi|ayrıldık)\b/i.test(lower)) {
      if (Math.random() < 0.10) {
        response = this.getRandomItem(this.loveRoasts);
      }
    } else if (content.length > 8 && content === content.toUpperCase() && /[A-ZĞÜŞİÖÇ]/.test(content)) {
      if (Math.random() < 0.20) {
        response = this.getRandomItem(this.capsRoasts);
      }
    } else {
      // Genel rastgele laf sokma (nadiren: %3.5 ihtimal)
      if (Math.random() < this.randomTriggerChance) {
        response = this.getRandomItem(this.randomRoasts);
      }
    }

    if (!response) return false;

    // Zamanlayıcıları güncelle
    this.lastBanterTime = now;
    this.userCooldowns.set(message.author.id, now);

    // Kısa bir yazıyor... (typing) gecikmesi vererek daha doğal hissettir
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping().catch(() => {});
      }
      setTimeout(async () => {
        await message.reply({ content: response! }).catch(() => {});
      }, 1200);
      return true;
    } catch (err) {
      logger.error('[BANTER] Şakacı yanıt gönderme hatası:', err);
      return false;
    }
  }

  private getRandomItem(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

export const banterService = new BanterService();
