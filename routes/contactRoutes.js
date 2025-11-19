import express from "express";
import pool from "../config/db.js";

const router = express.Router();

// Save message (frontend)
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, email, phone, subject, message]
    );

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ success: false });
  }
});

// Get all messages (admin)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch contact messages error:", err);
    res.status(500).json({ success: false });
  }
});

// Delete message
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query("DELETE FROM contact_messages WHERE id = $1", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
