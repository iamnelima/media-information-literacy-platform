const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.RAILWAYHOST || process.env.HOST || "localhost",
    user: process.env.USER || "root",
    password: process.env.RAILWAYPASSWORD || process.env.PASSWORD || "",
    database: process.env.RAILWAYDB || process.env.DATABASE || "miles_school",
    port: process.env.RAILWAYPORT || 3306
  });
  
  return connection;
}

module.exports = main();
