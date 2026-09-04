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

process.on('SIGTERM', () => {
  console.log('Kapatma sinyali alındı (SIGTERM), alt süreçler durduruluyor...');
  api.kill('SIGTERM');
  bot.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Kapatma sinyali alındı (SIGINT), alt süreçler durduruluyor...');
  api.kill('SIGINT');
  bot.kill('SIGINT');
  process.exit(0);
});
