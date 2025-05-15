// app.js
const express = require('express');
const path = require('path');
const pool = require('./db');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data', async (req, res) => {
  const sql = `
    SELECT T.REG_DATE, T.REG_DATE_HOUR, T.REG_DATE_MINUTE, T.RSB_LRG_CTGR, MAX(RSB_SH_PAYMENT_AMT_MAX) AS MAX_AMT
    FROM (
      SELECT
        P.AREA_NM,
        P.REG_DATE,
        P.REG_DATE_HOUR,
        P.REG_DATE_MINUTE,
        R.RSB_LRG_CTGR,
        R.RSB_SH_PAYMENT_AMT_MAX
      FROM CURRENT_POPULATION P
      INNER JOIN COMMERCIAL_RSB R
        ON P.AREA_NM = R.AREA_NM
        AND P.REG_DATE = R.REG_DATE
        AND P.REG_DATE_HOUR = R.REG_HOUR
        AND P.REG_DATE_MINUTE = R.REG_DATE_MINUTE
        AND P.REG_DATE_MINUTE = 0
        AND P.REG_SYSDATE > SYSDATE() - INTERVAL 24 HOUR
    ) T
    GROUP BY T.REG_DATE, T.REG_DATE_HOUR, T.REG_DATE_MINUTE, T.RSB_LRG_CTGR
    ORDER BY T.REG_DATE DESC, T.REG_DATE_HOUR DESC, T.REG_DATE_MINUTE DESC
  `;

  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB query failed" });
  }
});

// index.html 용 시간대별 평균 인구 데이터 (새로운 전용 API)
app.get('/api/main-page-hourly-population', async (req, res) => {
  console.log('--- DEBUG: /api/main-page-hourly-population endpoint CALLED ---');
  try {
    const sql = `
      SELECT 
        REG_DATE, 
        REG_DATE_HOUR, 
        AVG(PPLTN_MAX) AS CNT
      FROM CURRENT_POPULATION
      WHERE TIMESTAMP(REG_DATE, MAKETIME(REG_DATE_HOUR, 0, 0)) > SYSDATE() - INTERVAL 24 HOUR
      GROUP BY REG_DATE, REG_DATE_HOUR
      ORDER BY CONCAT(REG_DATE, LPAD(REG_DATE_HOUR,2 , '0')) DESC
    `;
    console.log('[app.js /api/main-page-hourly-population] Executing SQL:', sql);
    const [rows] = await pool.query(sql);
    // --- START Enhanced Logging for new endpoint ---
    console.log(`[app.js /api/main-page-hourly-population] Query returned ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log('[app.js /api/main-page-hourly-population] First 3 rows (or fewer):');
      for (let i = 0; i < Math.min(rows.length, 3); i++) {
        const row = rows[i];
        console.log(`  Row ${i}:`, JSON.stringify(row));
        console.log(`    Property 'CNT' (uppercase): Value = ${row.CNT}, Type = ${typeof row.CNT}`);
        console.log(`    Property 'cnt' (lowercase): Value = ${row.cnt}, Type = ${typeof row.cnt}`);
      }
    } else {
      console.log('[app.js /api/main-page-hourly-population] Query returned no rows.');
    }
    // --- END Enhanced Logging for new endpoint ---
    console.log('[app.js /api/main-page-hourly-population] Full data being sent to client (first 5 rows if many):', rows.slice(0, 5));
    res.json(rows);
  } catch (err) {
    console.error('[app.js /api/main-page-hourly-population] Error:', err);
    res.status(500).json({ error: "메인 페이지 시간대별 평균 인구 데이터 조회 실패" });
  }
});

// population.html 용 시간대별 지역별 인구 데이터
app.get('/api/population', async (req, res) => {
  console.log('--- DEBUG: /api/population (for population.html by AREA_NM) endpoint CALLED ---');
  try {
    const sql = `
      SELECT
        REG_DATE,
        REG_DATE_HOUR,
        REG_DATE_MINUTE,
        AREA_NM,
        PPLTN_MAX
      FROM CURRENT_POPULATION
      WHERE TIMESTAMP(REG_DATE, MAKETIME(REG_DATE_HOUR, REG_DATE_MINUTE, 0)) > SYSDATE() - INTERVAL 24 HOUR
        AND REG_DATE_MINUTE = 0 
      ORDER BY REG_DATE DESC, REG_DATE_HOUR DESC, REG_DATE_MINUTE DESC, AREA_NM
    `;
    // console.log('실행할 SQL 쿼리 (population.html용 지역별 시간대별 인구):', sql);
    console.log('[app.js /api/population] Executing SQL for population.html (by area):', sql);
    
    const [rows] = await pool.query(sql);
        
    // --- START Logging for /api/population (by area) ---
    console.log(`[app.js /api/population] Query for population.html returned ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log('[app.js /api/population] First 3 rows for population.html (or fewer):');
      for (let i = 0; i < Math.min(rows.length, 3); i++) {
        const row = rows[i];
        console.log(`  Row ${i}:`, JSON.stringify(row));
        // This query returns PPLTN_MAX and AREA_NM, not CNT
        console.log(`    Property 'AREA_NM': Value = ${row.AREA_NM}, Type = ${typeof row.AREA_NM}`);
        console.log(`    Property 'PPLTN_MAX': Value = ${row.PPLTN_MAX}, Type = ${typeof row.PPLTN_MAX}`);
      }
    } else {
      console.log('[app.js /api/population] Query for population.html returned no rows.');
    }
    // --- END Logging for /api/population (by area) ---
    console.log('[app.js /api/population] Full data for population.html (first 5 rows if many):', rows.slice(0, 5));
    res.json(rows);
  } catch (err) {
    // console.error('population.html용 지역별 시간별 인구 조회 상세 오류:', err);
    console.error('[app.js /api/population] Error for population.html:', err);
    res.status(500).json({ error: "지역별 시간별 인구 데이터 조회 실패 (population.html)" });
  }
});

// 신규 API: 전체 인구 남녀 성비
app.get('/api/population/gender-ratio', async (req, res) => {
  try {
    // TODO: 실제 GENDER 컬럼이 있는 경우 쿼리 수정 필요
    // 예시: SELECT GENDER, SUM(PPLTN_CNT) as COUNT FROM POPULATION_STATS GROUP BY GENDER;
    // 현재는 성별 데이터가 없어 임시 데이터를 반환합니다.
    const genderData = [
      { gender: '남성', count: Math.floor(Math.random() * 5000) + 10000 },
      { gender: '여성', count: Math.floor(Math.random() * 5000) + 10000 }
    ];
    console.log('[app.js /api/population/gender-ratio] Gender ratio data (dummy):', genderData);
    res.json(genderData);
  } catch (err) {
    console.error('[app.js /api/population/gender-ratio] Error fetching gender ratio:', err);
    res.status(500).json({ error: "성별 비율 데이터 조회 실패" });
  }
});

// 신규 API: 전체 지역 연령대별 인구 분포
app.get('/api/population/age-distribution', async (req, res) => {
  try {
    // TODO: 실제 AGE_GROUP 컬럼이 있는 경우 쿼리 수정 필요
    // 예시: SELECT AGE_GROUP, SUM(PPLTN_CNT) as COUNT FROM POPULATION_STATS GROUP BY AGE_GROUP ORDER BY AGE_GROUP;
    // 현재는 연령대 데이터가 없어 임시 데이터를 반환합니다.
    const ageData = [
      { age_group: '10대', count: Math.floor(Math.random() * 1000) + 500 },
      { age_group: '20대', count: Math.floor(Math.random() * 2000) + 1500 },
      { age_group: '30대', count: Math.floor(Math.random() * 2500) + 2000 },
      { age_group: '40대', count: Math.floor(Math.random() * 2000) + 1800 },
      { age_group: '50대', count: Math.floor(Math.random() * 1500) + 1200 },
      { age_group: '60대 이상', count: Math.floor(Math.random() * 1000) + 800 }
    ];
    console.log('[app.js /api/population/age-distribution] Age distribution data (dummy):', ageData);
    res.json(ageData);
  } catch (err) {
    console.error('[app.js /api/population/age-distribution] Error fetching age distribution:', err);
    res.status(500).json({ error: "연령대별 인구 분포 데이터 조회 실패" });
  }
});

// 신규 API: 현재 시간 기준 지역별 인구수
app.get('/api/population/area-now', async (req, res) => {
  try {
    // 가장 최근 시간대의 지역별 평균 PPLTN_MAX를 가져옵니다.
    const sql = `
      SELECT 
        AREA_NM, 
        AVG(PPLTN_MAX) AS CNT
      FROM CURRENT_POPULATION
      WHERE (REG_DATE, REG_DATE_HOUR, REG_DATE_MINUTE) = (
        SELECT REG_DATE, REG_DATE_HOUR, REG_DATE_MINUTE 
        FROM CURRENT_POPULATION 
        ORDER BY REG_SYSDATE DESC 
        LIMIT 1
      )
      GROUP BY AREA_NM
      ORDER BY AREA_NM
    `;
    // 참고: REG_SYSDATE를 기준으로 최신 데이터를 가져오도록 했지만,
    // 더 정확하게는 REG_DATE, REG_DATE_HOUR, REG_DATE_MINUTE 조합 중 가장 최신 것을 찾아야 합니다.
    // 위 쿼리는 REG_SYSDATE가 가장 최신인 단일 시점의 데이터를 가져옵니다.
    // 만약 여러 지역 데이터가 동일 REG_SYSDATE에 업데이트 되었다면 해당 시점의 모든 지역이 나옵니다.

    console.log('[app.js /api/population/area-now] Executing SQL for current population by area:', sql);
    const [rows] = await pool.query(sql);
    console.log('[app.js /api/population/area-now] Current population by area data:', rows);
    res.json(rows);
  } catch (err) {
    console.error('[app.js /api/population/area-now] Error fetching current population by area:', err);
    res.status(500).json({ error: "지역별 현재 인구 데이터 조회 실패" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
