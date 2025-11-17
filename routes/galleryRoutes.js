import express from "express";
import pkg from "pg";

const router = express.Router();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ✅ Public: Get all images
router.get("/images", async (req, res) => {
  const { category = "all" } = req.query;
  try {
    let query = `SELECT id, src, title, category_key FROM gallery_images`;
    const params = [];

    if (category !== "all") {
      query += ` WHERE category_key = $1`;
      params.push(category);
    }

    // Use id instead of created_at
    query += ` ORDER BY id DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Public: Get categories
router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, title FROM gallery_categories ORDER BY CASE WHEN key='all' THEN 0 ELSE 1 END, title"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
