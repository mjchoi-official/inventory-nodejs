/**
 * src/config/cache.js
 * Redis 캐시 레이어
 *
 * 특징:
 *  - Redis 연결 실패 시 에러를 throw하지 않고 경고만 출력 (Graceful Degradation)
 *  - TTL 기본 300초 (5분)
 *  - 패턴 삭제 지원 (KEYS 명령 → 소규모 패턴 무효화용)
 *  - 테스트 환경: Redis 없이도 동작 (null 반환 / no-op)
 */

let redis = null;
let redisEnabled = false;

// ─────────────────────────────────────────────
// Redis 클라이언트 초기화 (앱 시작 시 1회 호출)
// ─────────────────────────────────────────────
async function initializeCache() {
  // 테스트 환경 또는 REDIS_ENABLED=false 이면 캐시 비활성화
  if (process.env.NODE_ENV === 'test' || process.env.REDIS_ENABLED === 'false') {
    console.log('ℹ️  [Cache] Redis 비활성화 (테스트 모드 또는 REDIS_ENABLED=false)');
    return;
  }

  try {
    const { createClient } = require('redis');

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    redis = createClient({
      socket: {
        host,
        port,
        connectTimeout: 3000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('⚠️  [Cache] Redis 재연결 포기 — 캐시 없이 진행');
            redisEnabled = false;
            return false; // 재연결 중단
          }
          return Math.min(retries * 500, 2000);
        },
      },
    });

    redis.on('error', (err) => {
      console.warn('⚠️  [Cache] Redis 오류:', err.message);
      redisEnabled = false;
    });

    redis.on('connect', () => {
      console.log(`✅ [Cache] Redis 연결 성공 (${host}:${port})`);
      redisEnabled = true;
    });

    redis.on('ready', () => { redisEnabled = true; });
    redis.on('end',   () => { redisEnabled = false; });

    await redis.connect();
  } catch (err) {
    console.warn('⚠️  [Cache] Redis 초기화 실패 — 캐시 없이 진행:', err.message);
    redis        = null;
    redisEnabled = false;
  }
}

// ─────────────────────────────────────────────
// 캐시 GET
//   @returns {any|null} 파싱된 값 또는 null (미스/에러)
// ─────────────────────────────────────────────
async function getCache(key) {
  if (!redisEnabled || !redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`⚠️  [Cache] GET 오류 (${key}):`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 캐시 SET
//   @param {number} ttl 초 단위 (기본 300초)
// ─────────────────────────────────────────────
async function setCache(key, value, ttl = 300) {
  if (!redisEnabled || !redis) return;
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  } catch (err) {
    console.warn(`⚠️  [Cache] SET 오류 (${key}):`, err.message);
  }
}

// ─────────────────────────────────────────────
// 캐시 DELETE (단일 키)
// ─────────────────────────────────────────────
async function deleteCache(key) {
  if (!redisEnabled || !redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`⚠️  [Cache] DELETE 오류 (${key}):`, err.message);
  }
}

// ─────────────────────────────────────────────
// 캐시 패턴 삭제
//   예: deleteCacheByPattern('inventory:user:42:*')
//   주의: KEYS는 소규모 데이터셋에만 적합
//         대규모라면 SCAN 방식으로 교체 필요
// ─────────────────────────────────────────────
async function deleteCacheByPattern(pattern) {
  if (!redisEnabled || !redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return;
    // 한 번에 삭제 (Pipeline과 동일 효과)
    await redis.del(keys);
    console.log(`🗑️  [Cache] 패턴 삭제: ${pattern} (${keys.length}건)`);
  } catch (err) {
    console.warn(`⚠️  [Cache] PATTERN DELETE 오류 (${pattern}):`, err.message);
  }
}

// ─────────────────────────────────────────────
// Redis 연결 종료 (앱 종료 시)
// ─────────────────────────────────────────────
async function closeCache() {
  if (redis && redisEnabled) {
    try {
      await redis.quit();
      console.log('✅ [Cache] Redis 연결 종료');
    } catch (err) {
      console.warn('⚠️  [Cache] 종료 오류:', err.message);
    }
  }
  redis        = null;
  redisEnabled = false;
}

// ─────────────────────────────────────────────
// 상태 조회 (헬스체크 등에서 활용)
// ─────────────────────────────────────────────
function isCacheEnabled() {
  return redisEnabled;
}

module.exports = {
  initializeCache,
  getCache,
  setCache,
  deleteCache,
  deleteCacheByPattern,
  closeCache,
  isCacheEnabled,
};
