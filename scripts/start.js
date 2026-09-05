const { spawn } = require('child_process');

console.log('----------------------------------------------------');
console.log('🚀 Priv Discord Bot & REST API başlatılıyor...');
console.log('----------------------------------------------------');

const api = spawn('npm', ['run', 'start:api'], { stdio: 'inherit', shell: true });
const bot = spawn('npm', ['run', 'start:bot'], { stdio: 'inherit', shell: true });

api.on('close', (code) => {
  console.log(`[API] Süreç sonlandı (Kod: ${code})`);
});

bot.on('close', (code) => {
  console.log(`[BOT] Süreç sonlandı (Kod: ${code})`);
});

function gracefulShutdown(signal) {
  console.log(`Kapatma sinyali alındı (${signal}), alt süreçler güvenli şekilde kaydedilerek durduruluyor...`);
  try { api.kill(signal); } catch (e) {}
  try { bot.kill(signal); } catch (e) {}

  // Botun tüm aktif oturumları ve verileri PostgreSQL'e kaydetmesi için 4 saniye süre tanı
  setTimeout(() => {
    process.exit(0);
  }, 4000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
