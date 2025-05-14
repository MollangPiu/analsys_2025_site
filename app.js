const express = require('express');
const mysql = require('mysql2/promise');
const dbConfig = require('./dbConfig');
const path = require('path');

const app = express();
const port = 3000;

// 정적 파일 제공
app.use(express.static('public'));

// MySQL 연결 풀 생성
const pool = mysql.createPool(dbConfig);

// 지정된 지역 목록
const AREA_LIST = [
    "강남역", "청담동 명품거리", "교대역", "고속터미널역", "역삼역", "압구정로데오거리", "가로수길"
];

// 메인 페이지
app.get('/', (req, res) => {
    console.log('메인 페이지 요청');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 지역 목록 조회 API
app.get('/api/areas', async (req, res) => {
    console.log('지역 목록 API 호출');
    try {
        const areas = AREA_LIST.map(area => ({ AREA_NM: area }));
        console.log('응답 데이터:', areas);
        res.json(areas);
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 인구 정보 상세 조회 API
app.get('/api/population/detail', async (req, res) => {
    console.log('인구 정보 상세 API 호출');
    try {
        const connection = await pool.getConnection();
        
        // 전체 데이터 (최근 24시간)
        const [totalData] = await connection.execute(`
            SELECT 
                DATE(PPLTN_TIME) as DATE,
                HOUR(PPLTN_TIME) as HOUR,
                MINUTE(PPLTN_TIME) as MINUTE,
                AVG(PPLTN_MIN) as AVG_PPLTN_MIN,
                AVG(PPLTN_MAX) as AVG_PPLTN_MAX,
                AREA_NM
            FROM CURRENT_POPULATION
            WHERE PPLTN_TIME >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND AREA_NM IN (${AREA_LIST.map(area => '?').join(',')})
            GROUP BY DATE(PPLTN_TIME), HOUR(PPLTN_TIME), MINUTE(PPLTN_TIME), AREA_NM
            ORDER BY DATE, HOUR, MINUTE, AREA_NM
        `, AREA_LIST);

        console.log('전체 데이터 수:', totalData.length);

        // 지역별 평균 데이터
        const [areaData] = await connection.execute(`
            SELECT 
                AREA_NM,
                DATE(PPLTN_TIME) as DATE,
                HOUR(PPLTN_TIME) as HOUR,
                AVG(PPLTN_MIN) as AVG_PPLTN_MIN,
                AVG(PPLTN_MAX) as AVG_PPLTN_MAX
            FROM CURRENT_POPULATION
            WHERE PPLTN_TIME >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND AREA_NM IN (${AREA_LIST.map(area => '?').join(',')})
            GROUP BY AREA_NM, DATE(PPLTN_TIME), HOUR(PPLTN_TIME)
            ORDER BY AREA_NM, DATE, HOUR
        `, AREA_LIST);

        console.log('지역별 데이터 수:', areaData.length);

        // 시간대별 전체 평균
        const [hourlyAvg] = await connection.execute(`
            SELECT 
                HOUR(PPLTN_TIME) as HOUR,
                AVG(PPLTN_MIN) as AVG_PPLTN_MIN,
                AVG(PPLTN_MAX) as AVG_PPLTN_MAX
            FROM CURRENT_POPULATION
            WHERE PPLTN_TIME >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            AND AREA_NM IN (${AREA_LIST.map(area => '?').join(',')})
            GROUP BY HOUR(PPLTN_TIME)
            ORDER BY HOUR
        `, AREA_LIST);

        console.log('시간대별 평균 데이터 수:', hourlyAvg.length);
        
        connection.release();

        const responseData = {
            totalData,
            areaData,
            hourlyAvg
        };

        console.log('API 응답 데이터 샘플:', {
            totalDataCount: totalData.length,
            areaDataCount: areaData.length,
            hourlyAvgCount: hourlyAvg.length,
            firstTotalData: totalData[0],
            firstAreaData: areaData[0],
            firstHourlyAvg: hourlyAvg[0]
        });

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching population detail:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 상업 정보 조회 API
app.get('/api/commercial', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(`
            SELECT RSB_LRG_CTGR, RSB_MID_CTGR, RSB_PAYMENT_LVL,
                   RSB_SH_PAYMENT_CNT, RSB_SH_PAYMENT_AMT_MIN,
                   RSB_SH_PAYMENT_AMT_MAX, RSB_MCT_TIME
            FROM COMMERCIAL_RSB
            ORDER BY RSB_MCT_TIME DESC
            LIMIT 10
        `);
        
        connection.release();
        res.json(rows);
    } catch (error) {
        console.error('Error fetching commercial data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 전체 데이터 조회 API
app.get('/api/all-data', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [populationRows] = await connection.execute(`
            SELECT AREA_NM, CONGESTION_LVL, PPLTN_MIN, PPLTN_MAX, 
                   MALE_RATE, FEMALE_RATE, PPLTN_TIME
            FROM CURRENT_POPULATION
            ORDER BY PPLTN_TIME DESC
            LIMIT 10
        `);

        const [commercialRows] = await connection.execute(`
            SELECT RSB_LRG_CTGR, RSB_MID_CTGR, RSB_PAYMENT_LVL,
                   RSB_SH_PAYMENT_CNT, RSB_SH_PAYMENT_AMT_MIN,
                   RSB_SH_PAYMENT_AMT_MAX, RSB_MCT_TIME
            FROM COMMERCIAL_RSB
            ORDER BY RSB_MCT_TIME DESC
            LIMIT 10
        `);
        
        connection.release();
        res.json({
            population: populationRows,
            commercial: commercialRows
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 