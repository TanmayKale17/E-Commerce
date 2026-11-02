const rows = document.getElementById("admin-product-rows");
const searchInput = document.getElementById("admin-search");
const dialog = document.getElementById("product-dialog");
const form = document.getElementById("product-form");
const notice = document.getElementById("notice");
const dialogTitle = document.getElementById("dialog-title");
const saveButton = document.getElementById("save-button");

let displayedProducts = [];
let editingProductId = null;
let searchTimer = null;
let noticeTimer = null;
let searchController = null;

const formatMoney = value => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(value);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }
  return data;
}

function showNotice(message, type = "success") {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `notice ${type}`;
  noticeTimer = setTimeout(() => notice.classList.add("hidden"), 4000);
}

function updateStats(allProducts) {
  document.getElementById("total-products").textContent = allProducts.length;
  document.getElementById("total-categories").textContent =
    new Set(allProducts.map(product => product.category)).size;
  const totalValue = allProducts.reduce((sum, product) => sum + Number(product.price), 0);
  document.getElementById("catalogue-value").textContent = formatMoney(totalValue);
}

function renderRows(products) {
  displayedProducts = products;

  if (products.length === 0) {
    rows.innerHTML = '<tr><td colspan="5" class="table-state">No matching products found.</td></tr>';
  } else {
    rows.innerHTML = products.map(product => `
      <tr>
        <td>
          <div class="table-product">
            <img src="${escapeHTML(product.image_url)}" alt=""
                 onerror="this.onerror=null;this.src='https://placehold.co/80x80/f2f2ed/315b45?text=Item'">
            <div>
              <strong>${escapeHTML(product.name)}</strong>
              <small>${escapeHTML(product.description.slice(0, 72))}${product.description.length > 72 ? "…" : ""}</small>
            </div>
          </div>
        </td>
        <td><span class="category-chip">${escapeHTML(product.category)}</span></td>
        <td class="price-cell">${formatMoney(product.price)}</td>
        <td class="id-cell">#${product.id}</td>
        <td>
          <div class="row-actions">
            <button class="edit-button" type="button" data-edit-id="${product.id}">Edit</button>
            <button class="delete-button" type="button" data-delete-id="${product.id}">Delete</button>
          </div>
        </td>
      </tr>`).join("");
  }

  document.getElementById("table-count").textContent =
    `${products.length} matching product${products.length === 1 ? "" : "s"}`;
}

async function loadProducts() {
  if (searchController) searchController.abort();
  searchController = new AbortController();

  rows.innerHTML = '<tr><td colspan="5" class="table-state">Loading products…</td></tr>';

  const query = searchInput.value.trim();
  const searchParams = new URLSearchParams();
  if (query) searchParams.set("q", query);

  try {
    // Load the complete catalogue for accurate summary cards.
    const [allData, filteredData] = await Promise.all([
      api("/api/products"),
      api(`/api/products?${searchParams.toString()}`, { signal: searchController.signal })
    ]);
    updateStats(allData.products);
    renderRows(filteredData.products);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    rows.innerHTML = `<tr><td colspan="5" class="table-state error-text">${escapeHTML(error.message)}</td></tr>`;
    document.getElementById("table-count").textContent = "";
  }
}

function openDialog(product = null) {
  editingProductId = product ? product.id : null;
  dialogTitle.textContent = product ? "Edit product" : "Add product";
  saveButton.textContent = product ? "Update product" : "Create product";
  form.reset();

  if (product) {
    form.elements.name.value = product.name;
    form.elements.description.value = product.description;
    form.elements.price.value = product.price;
    form.elements.category.value = product.category;
    form.elements.image_url.value = product.image_url;
  }

  dialog.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  form.elements.name.focus();
}

function closeDialog() {
  dialog.classList.add("hidden");
  document.body.style.overflow = "";
  editingProductId = null;
  form.reset();
  saveButton.disabled = false;
  saveButton.textContent = "Create product";
}

document.getElementById("add-product-button").addEventListener("click", () => openDialog());

rows.addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (editButton) {
    const productId = Number(editButton.dataset.editId);
    const product = displayedProducts.find(item => item.id === productId);
    if (product) openDialog(product);
  }

  if (deleteButton) {
    const productId = Number(deleteButton.dataset.deleteId);
    const product = displayedProducts.find(item => item.id === productId);
    if (!product) return;

    const confirmed = window.confirm(`Delete "${product.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      await api(`/api/products/${productId}`, { method: "DELETE" });
      showNotice("Product deleted successfully.");
      await loadProducts();
    } catch (error) {
      showNotice(error.message, "error");
    }
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const payload = {
    name: form.elements.name.value.trim(),
    description: form.elements.description.value.trim(),
    price: Number(form.elements.price.value),
    category: form.elements.category.value.trim(),
    image_url: form.elements.image_url.value.trim()
  };

  const productIdBeingEdited = editingProductId;
  saveButton.disabled = true;
  saveButton.textContent = productIdBeingEdited ? "Updating…" : "Creating…";

  try {
    if (productIdBeingEdited !== null) {
      await api(`/api/products/${productIdBeingEdited}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      closeDialog();
      showNotice("Product updated successfully.");
    } else {
      await api("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      closeDialog();
      showNotice("Product created successfully.");
    }
    await loadProducts();
  } catch (error) {
    showNotice(error.message, "error");
    saveButton.disabled = false;
    saveButton.textContent = productIdBeingEdited !== null ? "Update product" : "Create product";
  }
});

dialog.addEventListener("click", event => {
  if (event.target.hasAttribute("data-dismiss")) closeDialog();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !dialog.classList.contains("hidden")) closeDialog();
});

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadProducts, 180);
});

loadProducts();