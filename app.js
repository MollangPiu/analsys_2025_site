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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
