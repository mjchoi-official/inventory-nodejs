require('dotenv').config();
const mysql      = require('mysql2/promise');
const { Client } = require('ssh2');
const net        = require('net');
const fs         = require('fs');
const path       = require('path');

// ─────────────────────────────────────────────
// SSH 접속 설정 (.env 우선, 없으면 기본값)
// privateKey 는 실제 연결 시점(createSSHTunnel)에 lazy 로드
// — 테스트 환경에서 파일 없이도 모듈 임포트 가능
// ─────────────────────────────────────────────
function getSshConfig() {
  return {
    host:       process.env.SSH_HOST  || 'inedeath.cafe24.com',
    port:       parseInt(process.env.SSH_PORT, 10) || 22,
    username:   process.env.SSH_USER  || 'root',
    privateKey: fs.readFileSync(
      path.join(__dirname, '../../', process.env.SSH_KEY_PATH || 'ssh-key.pem')
    ),
  };
}

// ─────────────────────────────────────────────
// MariaDB 접속 설정
// ─────────────────────────────────────────────
const dbConfig = {
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME     || 'inventory',
};

// SSH 터널이 리슨할 로컬 포트
const LOCAL_TUNNEL_PORT = parseInt(process.env.TUNNEL_PORT, 10) || 13306;

let pool         = null;
let sshClient    = null;
let tunnelServer = null;

// ─────────────────────────────────────────────
// SSH 터널 생성
//   localhost:LOCAL_TUNNEL_PORT → SSH → 원격 localhost:3306
// ─────────────────────────────────────────────
function createSSHTunnel() {
  return new Promise((resolve, reject) => {
    sshClient = new Client();

    sshClient.on('ready', () => {
      console.log('✅ SSH 연결 성공');

      tunnelServer = net.createServer((localSocket) => {
        sshClient.forwardOut(
          'localhost', LOCAL_TUNNEL_PORT,
          'localhost', 3306,
          (err, sshStream) => {
            if (err) {
              console.error('❌ SSH forwardOut 실패:', err.message);
              localSocket.destroy();
              return;
            }
            localSocket.pipe(sshStream);
            sshStream.pipe(localSocket);
            sshStream.on('close', () => localSocket.destroy());
            localSocket.on('close', () => sshStream.destroy());
          }
        );
      });

      tunnelServer.listen(LOCAL_TUNNEL_PORT, '127.0.0.1', () => {
        console.log(`✅ SSH 터널 생성 완료 (127.0.0.1:${LOCAL_TUNNEL_PORT} → MariaDB:3306)`);
        resolve();
      });

      tunnelServer.on('error', reject);
    });

    sshClient.on('error', (err) => {
      console.error('❌ SSH 연결 실패:', err.message);
      reject(err);
    });

    sshClient.connect(getSshConfig());
  });
}

// ─────────────────────────────────────────────
// 연결 풀 초기화 (앱 시작 시 1회 호출)
//   NODE_ENV=test → SSH 터널 없이 직접 MySQL 연결
//
// 풀 최적화 설정:
//   connectionLimit   10  — 동시 연결 최대 수
//   waitForConnections    — 풀 소진 시 대기 (거부 X)
//   queueLimit        0   — 대기열 무제한
//   idleTimeout     60000 — 유휴 연결 60초 후 회수
//   enableKeepAlive       — TCP keep-alive (끊김 방지)
//   keepAliveInitialDelay 30000 — keep-alive 30초
//   multipleStatements false — SQL injection 방지
// ─────────────────────────────────────────────
async function initializePool() {
  if (pool) return pool;

  if (process.env.NODE_ENV === 'test') {
    // 테스트 환경: globalSetup.js 에서 이미 inventory_test DB가 준비된 상태
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || '127.0.0.1',
      port:               parseInt(process.env.DB_PORT || '3306', 10),
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASSWORD || '',
      database:           process.env.DB_NAME     || 'inventory_test',
      waitForConnections: true,
      connectionLimit:    5,
      queueLimit:         0,
      enableKeepAlive:    true,
      multipleStatements: false,
    });
    console.log('✅ [TEST] 직접 MySQL 연결 풀 생성 완료');
    return pool;
  }

  // 프로덕션: SSH 터널 경유
  await createSSHTunnel();

  pool = mysql.createPool({
    host:                    '127.0.0.1',
    port:                    LOCAL_TUNNEL_PORT,
    user:                    dbConfig.user,
    password:                dbConfig.password,
    database:                dbConfig.database,
    // ── 커넥션 풀 최적화 ──
    waitForConnections:      true,
    connectionLimit:         10,   // 최대 동시 연결 수
    queueLimit:              0,    // 대기열 무제한
    connectTimeout:          10000, // 연결 시도 최대 10초
    idleTimeout:             60000, // 유휴 연결 60초 후 회수
    // ── 안정성 ──
    enableKeepAlive:         true,  // TCP keep-alive 활성화
    keepAliveInitialDelay:   30000, // 30초 후 첫 keep-alive 패킷
    // ── 보안 ──
    multipleStatements:      false, // SQL 인젝션 방지
  });

  // 연결 확인 ping
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('✅ MariaDB 연결 풀 생성 완료 (connectionLimit: 10)');

  return pool;
}

// ─────────────────────────────────────────────
// 풀 반환 (Repository 에서 사용)
// ─────────────────────────────────────────────
function getPool() {
  if (!pool) {
    throw new Error('DB 풀 미초기화 — initializePool()을 먼저 호출하세요.');
  }
  return pool;
}

// ─────────────────────────────────────────────
// 정상 종료
// ─────────────────────────────────────────────
async function closeAll() {
  if (pool)         { await pool.end();      console.log('✅ DB 연결 풀 종료'); }
  if (tunnelServer) { tunnelServer.close();  console.log('✅ 터널 서버 종료'); }
  if (sshClient)    { sshClient.end();       console.log('✅ SSH 연결 종료'); }
  pool         = null;
  sshClient    = null;
  tunnelServer = null;
}

module.exports = { initializePool, getPool, closeAll };
