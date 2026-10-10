// /js/item.js - Single Item Showcase & Size Selection Module
import { AppState, saveCart, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { getSupplyItems } from '/js/firebase-db.js';

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    await loadItemDetails();
});

async function loadItemDetails() {
    const container = document.getElementById('item-detail-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const itemCode = urlParams.get('code') || urlParams.get('id');

    if (!itemCode) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-3"></i>
                <h2 class="text-base font-bold text-slate-800">No Item Specified</h2>
                <p class="text-xs text-slate-500 mt-1">Please select an item from the catalog.</p>
                <a href="/pages/shop.html" class="inline-block mt-4 bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs">Return to Shop</a>
            </div>
        `;
        return;
    }

    try {
        const items = await getSupplyItems();
        AppState.supply = items || [];

        const item = AppState.supply.find(i => 
            String(i.locationCode).toUpperCase() === String(itemCode).toUpperCase() || i.id === itemCode
        );

        if (!item) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <i class="fa-solid fa-box-open text-4xl text-slate-300 mb-3"></i>
                    <h2 class="text-base font-bold text-slate-800">Item Not Found</h2>
                    <p class="text-xs text-slate-500 mt-1">Tag code "${itemCode}" does not exist in active inventory.</p>
                    <a href="/pages/shop.html" class="inline-block mt-4 bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs">Back to Supply Catalog</a>
                </div>
            `;
            return;
        }

        renderItemShowcase(item);
    } catch (err) {
        console.error("Failed to load item details:", err);
        container.innerHTML = `<p class="text-center text-xs text-red-500 py-8">Failed to fetch item details.</p>`;
    }
}

function renderItemShowcase(item) {
    const container = document.getElementById('item-detail-container');
    if (!container) return;

    const stockMap = item.stock || { "OS": 1 };
    const stockEntries = Object.entries(stockMap);
    const totalQty = stockEntries.reduce((sum, [, qty]) => sum + (parseInt(qty, 10) || 0), 0);
    const isAvailable = totalQty > 0;
    const rawPrice = parseFloat(item.price) || 0;

    const thumbSrc = item.image && item.image.trim() !== "" 
        ? item.image 
        : `/images/products/${item.locationCode}.jpg`;

    // Render sizes dropdown
    let sizeSelectorHtml = '';
    if (stockEntries.length > 0) {
        sizeSelectorHtml = `
            <div>
                <label class="block text-xs font-bold text-slate-700 mb-1.5">Select Size / Variant *</label>
                <select id="item-size-select" class="w-full sm:w-64 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
                    ${stockEntries.map(([size, qty]) => {
                        const count = parseInt(qty, 10) || 0;
                        const label = size === 'OS' ? 'One Size' : `Size: ${size}`;
                        return `<option value="${size}" ${count <= 0 ? 'disabled' : ''}>${label} (${count > 0 ? count + ' available' : 'Out of stock'})</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    }

    const isInCart = (AppState.cart || []).some(c => c.locationCode === item.locationCode);

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            <!-- Left: Product Image -->
            <div class="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 h-80 sm:h-96">
                <img src="${thumbSrc}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800';" alt="${item.title}" class="w-full h-full object-cover">
                <span class="absolute top-3 left-3 font-mono text-xs font-extrabold bg-slate-900/90 text-white px-2.5 py-1 rounded-lg shadow-sm">
                    ${item.locationCode}
                </span>
                <span class="absolute top-3 right-3 text-xs font-extrabold px-3 py-1 rounded-full ${
                    isAvailable ? 'bg-brand-500 text-slate-950' : 'bg-amber-500 text-slate-950'
                }">
                    ${isAvailable ? 'In Stock' : 'Out of Stock'}
                </span>
            </div>

            <!-- Right: Product Info & Actions -->
            <div class="space-y-5">
                <div>
                    <div class="text-xs font-bold uppercase tracking-wider text-brand-600">
                        ${Array.isArray(item.categories) ? item.categories.join(' • ') : (item.category || 'General Supply')}
                    </div>
                    <h1 class="text-2xl font-extrabold text-slate-900 mt-1 leading-tight">${item.title}</h1>
                    <div class="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-2">
                        <i class="fa-solid fa-location-dot text-brand-600"></i>Location: <span class="text-slate-800 font-bold">${item.location || 'Main Supply Closet'}</span>
                    </div>
                </div>

                <!-- Liability Value -->
                <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Replacement Liability Value</div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-slate-400 line-through font-semibold">$${rawPrice.toFixed(2)}</span>
                        <span class="text-xl font-extrabold text-brand-600">$0.00</span>
                        <span class="bg-brand-100 text-brand-800 text-[10px] font-bold px-2 py-0.5 rounded-md">Issued Free (If Returned)</span>
                    </div>
                </div>

                <!-- Size Selector Dropdown -->
                ${sizeSelectorHtml}

                <!-- Quantity & Action Buttons -->
                <div class="pt-2 space-y-3">
                    ${isAvailable ? `
                        <div class="flex items-center gap-3">
                            <div class="w-24">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity</label>
                                <input type="number" id="detail-qty-input" min="1" max="99" value="1" class="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold text-xs text-center bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500">
                            </div>
                            <button id="btn-add-to-cart-detail" class="flex-1 mt-5 ${isInCart ? 'bg-slate-200 text-slate-800' : 'bg-brand-600 hover:bg-brand-700 text-white'} font-extrabold py-3.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm">
                                <i class="fa-solid ${isInCart ? 'fa-check' : 'fa-basket-shopping'}"></i> ${isInCart ? 'Added to Cart' : 'Add to Cart'}
                            </button>
                        </div>
                    ` : `
                        <a href="${item.vanguardUrl || 'https://www.vanguardmil.com'}" target="_blank" rel="noopener" class="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-center">
                            <i class="fa-solid fa-cart-shopping"></i> Requisition / Buy on Vanguard
                        </a>
                    `}
                </div>
            </div>

        </div>
    `;

    // Add to Cart Event Handler
    document.getElementById('btn-add-to-cart-detail')?.addEventListener('click', () => {
        const sizeSelect = document.getElementById('item-size-select');
        const qtyInput = document.getElementById('detail-qty-input');

        const selectedSize = sizeSelect ? sizeSelect.value : 'OS';
        const quantity = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;

        toggleCartItemDetail(item, selectedSize, quantity);
    });
}

function toggleCartItemDetail(item, selectedSize, quantity = 1) {
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
        showToast(`Added ${quantity}x ${item.title} (${selectedSize}) to pick basket!`);
    }

    saveCart();
    renderItemShowcase(item);
    
    // Update header badges
    const totalCartCount = AppState.cart.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 1), 0);
    const badge = document.getElementById('cart-badge');
    const drawerCount = document.getElementById('cart-drawer-count');

    if (badge) badge.textContent = totalCartCount;
    if (drawerCount) drawerCount.textContent = totalCartCount;
}