// db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '15.164.226.81',
    port: 3306,
    user: 'study',
    password: '1234',
    database: 'CODESET_DB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
