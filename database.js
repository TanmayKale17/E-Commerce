const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, "shop.db"));
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    image_url TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;

if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, description, price, image_url, category)
    VALUES (@name, @description, @price, @image_url, @category)
  `);

  const sampleProducts = [
    {
      name: "Wireless Headphones",
      description: "Comfortable over-ear headphones with clear sound, deep bass and long battery life. Ideal for music, calls and everyday use.",
      price: 2499,
      image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900",
      category: "Electronics"
    },
    {
      name: "Smart Watch",
      description: "A lightweight smart watch with activity tracking, notifications and a bright, easy-to-read display.",
      price: 3299,
      image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900",
      category: "Electronics"
    },
    {
      name: "Everyday Backpack",
      description: "A durable everyday backpack with a spacious main compartment, padded laptop sleeve and practical pockets.",
      price: 1599,
      image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900",
      category: "Accessories"
    },
    {
      name: "Classic Sneakers",
      description: "Versatile casual sneakers designed for daily comfort, with a clean profile that pairs with almost any outfit.",
      price: 2799,
      image_url: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=900",
      category: "Fashion"
    },
    {
      name: "Minimal Desk Lamp",
      description: "A modern desk lamp that provides focused light for reading, studying and working. Its compact design fits small desks.",
      price: 1199,
      image_url: "https://images.unsplash.com/photo-1508471174907-9a7b5e4e8f5b?w=900",
      category: "Home"
    },
    {
      name: "Ceramic Coffee Mug",
      description: "A sturdy ceramic mug with a comfortable handle, suitable for your morning coffee, tea or other hot drinks.",
      price: 399,
      image_url: "https://images.unsplash.com/photo-1514228742587-6b1558f11273?w=900",
      category: "Home"
    }
  ];

  const seedProducts = db.transaction((items) => {
    for (const item of items) insertProduct.run(item);
  });
  seedProducts(sampleProducts);
}

module.exports = db;