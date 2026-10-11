// /js/item.js - Lightweight Controller for Item Details Page
import { AppState, saveCart, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { getSupplyItems } from '/js/firebase-db.js';

let activeItem = null;

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    await loadItemDetails();
});

async function loadItemDetails() {
    const loadingEl = document.getElementById('item-loading');
    const showcaseEl = document.getElementById('item-showcase');
    const errorEl = document.getElementById('item-error');

    const urlParams = new URLSearchParams(window.location.search);
    const itemCode = urlParams.get('code') || urlParams.get('id');

    if (!itemCode) {
        showError("No Item Specified", "Please choose an item from the supply catalog.");
        return;
    }

    try {
        const items = await getSupplyItems();
        AppState.supply = items || [];

        activeItem = AppState.supply.find(i => 
            String(i.locationCode).toUpperCase() === String(itemCode).toUpperCase() || i.id === itemCode
        );

        if (!activeItem) {
            showError("Item Not Found", `Tag code "${itemCode}" does not exist in active inventory.`);
            return;
        }

        bindItemData(activeItem);

        loadingEl?.classList.add('hidden');
        showcaseEl?.classList.remove('hidden');
    } catch (err) {
        console.error("Failed to load item details:", err);
        showError("Error Loading Item", "Could not fetch inventory item from server.");
    }
}

function bindItemData(item) {
    const stockMap = item.stock || { "OS": 1 };
    const stockEntries = Object.entries(stockMap);
    const totalQty = stockEntries.reduce((sum, [, qty]) => sum + (parseInt(qty, 10) || 0), 0);
    const isAvailable = totalQty > 0 && item.status !== 'VANGUARD';
    const rawPrice = parseFloat(item.price) || 0;

    // Text & Image Bindings
    document.getElementById('detail-title').textContent = item.title || 'Untitled Item';
    document.getElementById('detail-location-tag').textContent = item.locationCode || 'N/A';
    document.getElementById('detail-location').textContent = item.location || 'Main Supply Closet';
    document.getElementById('detail-categories').textContent = Array.isArray(item.categories) 
        ? item.categories.join(' • ') 
        : (item.category || 'General Supply');

    const imgEl = document.getElementById('detail-image');
    imgEl.src = item.image && item.image.trim() ? item.image : `/images/products/${item.locationCode}.jpg`;
    imgEl.onerror = () => { imgEl.src = 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800'; };

    // Status Badge Binding
    const statusBadge = document.getElementById('detail-status-badge');
    if (isAvailable) {
        statusBadge.textContent = 'In Stock';
        statusBadge.className = 'absolute top-3 right-3 text-xs font-extrabold px-3 py-1 rounded-full bg-brand-500 text-slate-950';
    } else {
        statusBadge.textContent = item.status === 'VANGUARD' ? 'Vanguard Only' : 'Out of Stock';
        statusBadge.className = 'absolute top-3 right-3 text-xs font-extrabold px-3 py-1 rounded-full bg-amber-500 text-slate-950';
    }

    // Cost Breakdown & Member Savings
    document.getElementById('detail-retail-price').textContent = `$${rawPrice.toFixed(2)}`;
    document.getElementById('detail-savings-amount').textContent = `$${rawPrice.toFixed(2)}`;

    // Size Dropdown Binding
    const sizeSelect = document.getElementById('item-size-select');
    sizeSelect.innerHTML = stockEntries.map(([size, qty]) => {
        const count = parseInt(qty, 10) || 0;
        const label = size === 'OS' ? 'Single Size' : `Size: ${size}`;
        return `<option value="${size}" ${count <= 0 ? 'disabled' : ''}>${label} (${count > 0 ? count + ' available' : 'Out of stock'})</option>`;
    }).join('');

    // Toggle In-Stock vs Vanguard Actions
    const inStockActions = document.getElementById('in-stock-actions');
    const vanguardBtn = document.getElementById('btn-vanguard-link');

    if (isAvailable) {
        inStockActions?.classList.remove('hidden');
        vanguardBtn?.classList.add('hidden');
    } else {
        inStockActions?.classList.add('hidden');
        vanguardBtn?.classList.remove('hidden');
        vanguardBtn.href = item.vanguardUrl || 'https://www.vanguardmil.com';
    }

    // Bind Add to Cart Event
    document.getElementById('btn-add-to-cart-detail').onclick = () => {
    const sizeSelect = document.getElementById('item-size-select');
    const selectedSize = sizeSelect ? sizeSelect.value : 'OS';
    const qtyInput = document.getElementById('detail-qty-input');
    const quantity = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;

    addToCart(item, selectedSize, quantity);
};
}

function addToCart(item, selectedSize, quantity) {
    if (!AppState.cart) AppState.cart = [];

    const existingIndex = AppState.cart.findIndex(
        c => c.locationCode === item.locationCode && c.selectedSize === selectedSize
    );

    if (existingIndex >= 0) {
        AppState.cart[existingIndex].quantity += quantity;
        showToast(`Updated quantity for ${item.title} (${selectedSize})!`);
    } else {
        AppState.cart.push({
            ...item,
            selectedSize: selectedSize,
            quantity: quantity
        });
        showToast(`Added ${quantity}x ${item.title} (${selectedSize}) to cart!`);
    }

    saveCart();
    window.dispatchEvent(new CustomEvent('cart-updated'));
}

function showError(title, message) {
    document.getElementById('item-loading')?.classList.add('hidden');
    document.getElementById('item-showcase')?.classList.add('hidden');
    
    const errorEl = document.getElementById('item-error');
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
    errorEl?.classList.remove('hidden');
}