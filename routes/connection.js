const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const railwayURL = `mysql://${process.env.USER}:${process.env.RAILWAYPASSWORD}@${process.env.RAILWAYHOST}:${process.env.RAILWAYPORT}/${process.env.RAILWAYDB}`;
  const connection = await mysql.createConnection(railwayURL);

  return connection;
}

module.exports = main();
