const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "abc123",   // ← Write your MySQL password here
    database: "minisocial"
});

connection.connect((err) => {
    if (err) {
        console.log("❌ Database Connection Failed");
        console.log(err);
    } else {
        console.log("✅ Connected to MySQL Successfully");
    }
});

module.exports = connection;