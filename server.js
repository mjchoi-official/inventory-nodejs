require('dotenv').config();
const app                    = require('./src/app');
const { initializePool, closeAll } = require('./src/config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initializePool();
    app.listen(PORT, () => console.log(`✅ Inventory API running on port ${PORT}`));
  } catch (err) {
    console.error('❌ 서버 시작 실패:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n서버 종료 중...');
  await closeAll();
  process.exit(0);
});

startServer();
