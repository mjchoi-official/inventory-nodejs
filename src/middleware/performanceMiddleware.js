/**
 * src/middleware/performanceMiddleware.js
 * 요청 처리 시간 측정 미들웨어
 *
 * 기능:
 *  - 각 요청의 처리 시간(ms) 측정
 *  - 응답 헤더 X-Response-Time 추가
 *  - WARN_THRESHOLD(200ms) 초과 시 경고 로그
 *  - 개발 모드에서 콘솔 상세 출력
 *  - 느린 요청 통계 누적 (메모리)
 */

const WARN_THRESHOLD_MS = parseInt(process.env.PERF_WARN_MS || '200', 10);
const isDev             = process.env.NODE_ENV === 'development';

// 느린 요청 통계 (런타임 메모리 — 재시작 시 초기화)
const slowRequestStats = {
  count:  0,
  routes: {},
};

// ─────────────────────────────────────────────
// 메인 미들웨어
// ─────────────────────────────────────────────
function track(req, res, next) {
  const startAt = process.hrtime.bigint(); // 나노초 정밀도

  // 응답 완료 후 처리
  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startAt;
    const durationMs = Number(durationNs) / 1_000_000;
    const rounded    = Math.round(durationMs * 100) / 100; // 소수점 2자리

    // 응답 헤더 추가 (이미 전송됐을 수 있으므로 try/catch)
    try {
      res.setHeader('X-Response-Time', `${rounded}ms`);
    } catch (_) { /* header already sent */ }

    const route  = `${req.method} ${req.path}`;
    const status = res.statusCode;
    const slow   = durationMs > WARN_THRESHOLD_MS;

    // 느린 요청 통계 업데이트
    if (slow) {
      slowRequestStats.count++;
      slowRequestStats.routes[route] = (slowRequestStats.routes[route] || 0) + 1;

      console.warn(
        `⚠️  [Perf] SLOW ${route} → ${status} | ${rounded}ms (임계값: ${WARN_THRESHOLD_MS}ms)`
      );
    }

    // 개발 환경: 모든 요청 로그
    if (isDev) {
      const icon = slow ? '🐢' : '⚡';
      console.log(`${icon} [Perf] ${route} → ${status} | ${rounded}ms`);
    }
  });

  next();
}

// ─────────────────────────────────────────────
// 느린 요청 통계 조회 (헬스체크 엔드포인트 등에서 사용)
// ─────────────────────────────────────────────
function getSlowRequestStats() {
  return { ...slowRequestStats };
}

// ─────────────────────────────────────────────
// 통계 초기화 (테스트 간 격리용)
// ─────────────────────────────────────────────
function resetStats() {
  slowRequestStats.count  = 0;
  slowRequestStats.routes = {};
}

module.exports = { track, getSlowRequestStats, resetStats };
