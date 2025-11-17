import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,   // IMPORTANT: only this line
  },
});

pool.connect()
  .then(() => console.log("✅ PostgreSQL Connected (SSL Enabled)"))
  .catch(err => console.error("❌ DB Connection Error:", err.message));

export default pool;
