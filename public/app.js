const grid = document.getElementById("product-grid");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category");
const resultCount = document.getElementById("result-count");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modal-content");

const formatPrice = value => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(value);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function imageFallback(image) {
  image.onerror = null;
  image.src = "https://placehold.co/800x600/f2f2ed/315b45?text=Product+Image";
}

let searchTimer;
let currentRequest;
async function loadProducts() {
  if (currentRequest) currentRequest.abort();
  currentRequest = new AbortController();

  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (categorySelect.value !== "All") params.set("category", categorySelect.value);

  grid.innerHTML = '<p class="state-message">Loading products…</p>';

  try {
    const response = await fetch(`/api/products?${params.toString()}`, { signal: currentRequest.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load products.");

    resultCount.textContent = `${data.count} ${data.count === 1 ? "product" : "products"}`;
    if (data.products.length === 0) {
      grid.innerHTML = '<div class="empty-state"><strong>No products found</strong>Try another search or category.</div>';
      return;
    }

    grid.innerHTML = data.products.map(product => `
      <article class="product-card">
        <img class="product-image" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" onerror="imageFallback(this)">
        <div class="product-info">
          <span class="category">${escapeHTML(product.category)}</span>
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-description">${escapeHTML(product.description.slice(0, 92))}${product.description.length > 92 ? "…" : ""}</p>
          <div class="product-bottom">
            <span class="price">${formatPrice(product.price)}</span>
            <button class="details-button" data-product-id="${product.id}">View details ↗</button>
          </div>
        </div>
      </article>`).join("");
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    resultCount.textContent = "Catalogue unavailable";
    grid.innerHTML = '<p class="state-message">Unable to load products. Check the server and refresh the page.</p>';
  }
}

async function showDetails(id) {
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
    const product = await response.json();
    if (!response.ok) throw new Error(product.error || "Product not found.");

    modalContent.innerHTML = `
      <div class="detail-layout">
        <img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" onerror="imageFallback(this)">
        <div>
          <span class="category">${escapeHTML(product.category)}</span>
          <h2 id="modal-title">${escapeHTML(product.name)}</h2>
          <p>${escapeHTML(product.description)}</p>
          <div class="price">${formatPrice(product.price)}</div>
        </div>
      </div>`;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  } catch (error) {
    window.alert(error.message);
  }
}

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-product-id]");
  if (button) showDetails(button.dataset.productId);
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 180);
});
categorySelect.addEventListener("change", loadProducts);

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}
modal.addEventListener("click", event => {
  if (event.target.hasAttribute("data-close")) closeModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

loadProducts();