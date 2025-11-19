import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import contactRoutes from "./routes/contactRoutes.js";

dotenv.config();

// ⭐ Use your dedicated DB file (THIS FIXES SSL ISSUE)
import pool from "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "3mb" }));

// Root route for testing
app.get("/", (req, res) => {
  res.send("Nallore Backend API is running...");
});

// ========== ADMIN AUTH ==========
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// =========================================================
// 🔵 GALLERY ROUTES (Public + Admin)
// =========================================================

// Get gallery categories
app.get("/api/gallery/categories", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT key, title FROM gallery_categories ORDER BY CASE WHEN key='all' THEN 0 ELSE 1 END, title"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get images
app.get("/api/gallery/images", async (req, res) => {
  const { category = "all" } = req.query;

  try {
    let sql = "SELECT id, src, title, category_key FROM gallery_images";
    const params = [];

    if (category !== "all") {
      sql += " WHERE category_key = $1";
      params.push(category);
    }

    sql += " ORDER BY id DESC";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gallery upload
app.post("/api/admin/gallery", requireAdmin, async (req, res) => {
  const { src, title, category_key } = req.body;
  if (!src || !title || !category_key) {
    return res.status(400).json({ error: "src, title, category_key required" });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO gallery_images (src, title, category_key) VALUES ($1,$2,$3) RETURNING *",
      [src, title, category_key]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gallery update
app.put("/api/admin/gallery/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { src, title, category_key } = req.body;

  if (!src && !title && !category_key) {
    return res.status(400).json({ error: "nothing to update" });
  }

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (src) { fields.push(`src = $${i++}`); values.push(src); }
    if (title) { fields.push(`title = $${i++}`); values.push(title); }
    if (category_key) { fields.push(`category_key = $${i++}`); values.push(category_key); }

    values.push(id);

    const sql = `UPDATE gallery_images SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (!rows.length) return res.status(404).json({ error: "not found" });

    res.json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Gallery delete
app.delete("/api/admin/gallery/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM gallery_images WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ deleted: rowCount > 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================================================
// 🔵 EVENTS ROUTES (Public + Admin)
// =========================================================

// Public events
app.get("/api/events", async (req, res) => {
  const { upcoming, limit } = req.query;

  try {
    let sql =
      "SELECT id, title, date, location, category, image FROM events ORDER BY date ASC";

    if (upcoming === "true") {
      sql =
        "SELECT id, title, date, location, category, image FROM events WHERE date >= CURRENT_DATE ORDER BY date ASC";
    }

    if (limit) sql += ` LIMIT ${parseInt(limit, 10) || 3}`;

    const { rows } = await pool.query(sql);
    res.json(rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ⭐ ADMIN GET ALL EVENTS
app.get("/api/admin/events", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, date, location, category, image FROM events ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create event
app.post("/api/admin/events", requireAdmin, async (req, res) => {
  const { title, date, location, category, image } = req.body;

  if (!title) return res.status(400).json({ error: "title required" });

  try {
    const { rows } = await pool.query(
      "INSERT INTO events (title, date, location, category, image) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [title, date || null, location || null, category || null, image || null]
    );
    res.status(201).json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update event
app.put("/api/admin/events/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, date, location, category, image } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (title) { fields.push(`title = $${i++}`); values.push(title); }
    if (date) { fields.push(`date = $${i++}`); values.push(date); }
    if (location) { fields.push(`location = $${i++}`); values.push(location); }
    if (category) { fields.push(`category = $${i++}`); values.push(category); }
    if (image) { fields.push(`image = $${i++}`); values.push(image); }

    if (!fields.length) return res.status(400).json({ error: "nothing to update" });

    values.push(id);

    const sql = `UPDATE events SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (!rows.length) return res.status(404).json({ error: "not found" });

    res.json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete event
app.delete("/api/admin/events/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM events WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ deleted: rowCount > 0 });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================================================
// 🔵 BLOG ROUTES (Public + Admin)
// =========================================================

// Public blog list
app.get("/api/blog", async (req, res) => {
  const limit = req.query.limit
    ? ` LIMIT ${parseInt(req.query.limit, 10)}`
    : "";

  try {
    const { rows } = await pool.query(
      `SELECT id, title, content, thumbnail, author, created_at FROM blogs ORDER BY created_at DESC${limit}`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public blog by ID
app.get("/api/blog/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, content, thumbnail, author, created_at FROM blogs WHERE id = $1",
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: "not found" });

    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ⭐ ADMIN GET ALL BLOGS
app.get("/api/admin/blog", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, content, thumbnail, author, created_at FROM blogs ORDER BY id DESC"
    );
    res.json(rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create blog
app.post("/api/admin/blog", requireAdmin, async (req, res) => {
  const { title, content, thumbnail, author } = req.body;

  if (!title || !content)
    return res.status(400).json({ error: "title and content required" });

  try {
    const { rows } = await pool.query(
      "INSERT INTO blogs (title, content, thumbnail, author) VALUES ($1,$2,$3,$4) RETURNING *",
      [title, content, thumbnail || null, author || null]
    );

    res.status(201).json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update blog
app.put("/api/admin/blog/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, thumbnail, author } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (title) { fields.push(`title = $${i++}`); values.push(title); }
    if (content) { fields.push(`content = $${i++}`); values.push(content); }
    if (thumbnail) { fields.push(`thumbnail = $${i++}`); values.push(thumbnail); }
    if (author) { fields.push(`author = $${i++}`); values.push(author); }

    if (!fields.length)
      return res.status(400).json({ error: "nothing to update" });

    values.push(id);

    const sql = `UPDATE blogs SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (!rows.length)
      return res.status(404).json({ error: "not found" });

    res.json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete blog
app.delete("/api/admin/blog/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM blogs WHERE id = $1", [
      req.params.id,
    ]);
    res.json({ deleted: rowCount > 0 });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================================================
// 🔵 TEAM ROUTES (Public + Admin)
// =========================================================

// Public team list
app.get("/api/team", async (req, res) => {
  const { level } = req.query;

  try {
    if (level) {
      const { rows } = await pool.query(
        "SELECT id, name, role, level, image, description FROM team_members WHERE level = $1 ORDER BY id",
        [level]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      "SELECT id, name, role, level, image, description FROM team_members ORDER BY level, id"
    );

    res.json(rows);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create team member
app.post("/api/admin/team", requireAdmin, async (req, res) => {
  const { name, role, level, image, description } = req.body;

  if (!name || !level)
    return res.status(400).json({ error: "name and level required" });

  try {
    const { rows } = await pool.query(
      "INSERT INTO team_members (name, role, level, image, description) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, role || null, level, image || null, description || null]
    );

    res.status(201).json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update team member
app.put("/api/admin/team/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, role, level, image, description } = req.body;

  try {
    const fields = [];
    const values = [];
    let i = 1;

    if (name) { fields.push(`name = $${i++}`); values.push(name); }
    if (role) { fields.push(`role = $${i++}`); values.push(role); }
    if (level) { fields.push(`level = $${i++}`); values.push(level); }
    if (image) { fields.push(`image = $${i++}`); values.push(image); }
    if (description) { fields.push(`description = $${i++}`); values.push(description); }

    if (!fields.length)
      return res.status(400).json({ error: "nothing to update" });

    values.push(id);

    const sql = `UPDATE team_members SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);

    if (!rows.length)
      return res.status(404).json({ error: "not found" });

    res.json(rows[0]);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete team member
app.delete("/api/admin/team/:id", requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM team_members WHERE id = $1",
      [req.params.id]
    );

    res.json({ deleted: rowCount > 0 });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
//  ADMIN LOGIN
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;

  if (password !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Invalid password" });
  }

  res.json({ token: process.env.ADMIN_TOKEN });
});

// ⭐ MOVE THIS ABOVE app.listen()
app.use("/api/contact", contactRoutes);

// ⭐ KEEP LISTEN AT LAST ALWAYS
app.listen(process.env.PORT || 5000, () => {
  console.log(`API Running on PORT ${process.env.PORT || 5000}`);
});

