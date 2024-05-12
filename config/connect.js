const sql = require('mssql');

// Configure the database connection
/*
const config = {
    user: 'sw',
    password: '123456789',
    server: 'DESKTOP-4VEVDS1',
    database: 'EVCS',
    options: {
        encrypt: false,
        enableArithAbort: false
    }
};
*/

const config = {
    user: 'SA',
    password: '123456789*',
    server: 'localhost',
    database: 'EVCS_DB',
    options: {
        encrypt: false,
        enableArithAbort: false
    }
};
const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log('Connected to SQL Server');
    return pool;
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

module.exports = { sql, poolPromise };