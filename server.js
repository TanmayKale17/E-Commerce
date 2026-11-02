const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Page routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Request validation helpers
function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Product ID must be a positive integer." });
  }
  req.productId = id;
  return next();
}

function validateProduct(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "A JSON product object is required." });
  }

  const { name, description, price, image_url, category } = body;

  if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 120) {
    return res.status(400).json({ error: "Name is required and must be at most 120 characters." });
  }
  if (typeof description !== "string" || description.trim().length === 0 || description.trim().length > 2000) {
    return res.status(400).json({ error: "Description is required and must be at most 2000 characters." });
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 100000000) {
    return res.status(400).json({ error: "Price must be a valid non-negative number." });
  }
  if (typeof image_url !== "string" || image_url.trim().length === 0 || image_url.trim().length > 1000) {
    return res.status(400).json({ error: "Image URL is required and must be at most 1000 characters." });
  }

  let imageUrl;
  try {
    imageUrl = new URL(image_url.trim());
  } catch {
    return res.status(400).json({ error: "Image URL must be a valid HTTP or HTTPS URL." });
  }
  if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
    return res.status(400).json({ error: "Image URL must use HTTP or HTTPS." });
  }
  if (typeof category !== "string" || category.trim().length === 0 || category.trim().length > 60) {
    return res.status(400).json({ error: "Category is required and must be at most 60 characters." });
  }

  req.productData = {
    name: name.trim(),
    description: description.trim(),
    price,
    image_url: imageUrl.href,
    category: category.trim()
  };
  return next();
}

// READ: list/search/filter products
app.get("/api/products", (req, res, next) => {
  try {
    const q = req.query.q === undefined ? "" : req.query.q;
    const category = req.query.category === undefined ? "" : req.query.category;

    if (typeof q !== "string" || typeof category !== "string") {
      return res.status(400).json({ error: "Search and category parameters must be strings." });
    }
    if (q.trim().length > 100 || category.trim().length > 60) {
      return res.status(400).json({ error: "Search or category parameter is too long." });
    }

    const conditions = [];
    const params = {};

    if (q.trim()) {
      conditions.push("(name LIKE @query OR description LIKE @query OR category LIKE @query)");
      params.query = `%${q.trim()}%`;
    }
    if (category.trim() && category.trim() !== "All") {
      conditions.push("category = @category");
      params.category = category.trim();
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const products = db.prepare(`
      SELECT id, name, description, price, image_url, category, created_at
      FROM products ${where}
      ORDER BY id DESC
    `).all(params);

    return res.status(200).json({ count: products.length, products });
  } catch (error) {
    return next(error);
  }
});

// READ: retrieve one product
app.get("/api/products/:id", validateId, (req, res, next) => {
  try {
    const product = db.prepare(`
      SELECT id, name, description, price, image_url, category, created_at
      FROM products WHERE id = ?
    `).get(req.productId);

    if (!product) return res.status(404).json({ error: "Product not found." });
    return res.status(200).json(product);
  } catch (error) {
    return next(error);
  }
});

// CREATE: insert a product
app.post("/api/products", validateProduct, (req, res, next) => {
  try {
    const result = db.prepare(`
      INSERT INTO products (name, description, price, image_url, category)
      VALUES (@name, @description, @price, @image_url, @category)
    `).run(req.productData);

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
    return res.status(201).json({ message: "Product created successfully.", product });
  } catch (error) {
    return next(error);
  }
});

// UPDATE: replace product fields
app.put("/api/products/:id", validateId, validateProduct, (req, res, next) => {
  try {
    const result = db.prepare(`
      UPDATE products
      SET name = @name,
          description = @description,
          price = @price,
          image_url = @image_url,
          category = @category
      WHERE id = @id
    `).run({ ...req.productData, id: req.productId });

    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.productId);
    return res.status(200).json({ message: "Product updated successfully.", product });
  } catch (error) {
    return next(error);
  }
});

// DELETE: remove product
app.delete("/api/products/:id", validateId, (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.productId);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    return res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    return next(error);
  }
});

// Unknown API endpoints
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// JSON parsing and unexpected server errors
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Request body contains invalid JSON." });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`E-commerce app running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});