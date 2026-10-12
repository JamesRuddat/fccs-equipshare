// /js/shop.js - Shop & Inventory Catalog Module
import { AppState, saveCart, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { getSupplyItems } from '/js/firebase-db.js';
import { addToRequisitionQueue } from '/js/modules/requisitionDrawer.js';
import { ROLES, PERMISSIONS, hasPermission } from '/js/roles.js';

// Fallback image asset (Civil Air Patrol Roundel)
const CAP_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Roundel_of_the_United_States_%281941%29_%E2%80%93_Civil_Air_Patrol.svg/250px-Roundel_of_the_United_States_%281941%29_%E2%80%93_Civil_Air_Patrol.svg.png';

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    setupEventListeners();
    await loadSupply();
});

async function loadSupply() {
    try {
        const items = await getSupplyItems();
        AppState.supply = items || [];
        
        updateShopStats();
        populateCategoryDropdown();
        renderShopItems();
        updateCartBadge();
    } catch (err) {
        console.error("Failed to fetch supply items:", err);
        showToast("Error loading shop supply.");
    }
}

function populateCategoryDropdown() {
    const catSelect = document.getElementById('shop-category');
    if (!catSelect) return;

    const categoriesSet = new Set();
    (AppState.supply || []).forEach(item => {
        const itemCats = Array.isArray(item.categories) ? item.categories : [item.categories || item.category].filter(Boolean);
        itemCats.forEach(c => categoriesSet.add(c));
    });

    const currentSelection = catSelect.value || 'ALL';
    catSelect.innerHTML = `<option value="ALL">All Categories</option>` + 
        Array.from(categoriesSet).map(c => `<option value="${c}" ${c === currentSelection ? 'selected' : ''}>${c}</option>`).join('');
}

function updateShopStats() {
    const totalValEl = document.getElementById('stat-total-value');
    const totalItemsEl = document.getElementById('stat-total-items');
    const totalSlotsEl = document.getElementById('stat-total-slots');
    
    const inValEl = document.getElementById('stat-in-value');
    const inItemsEl = document.getElementById('stat-in-items');
    
    const outValEl = document.getElementById('stat-out-value');
    const outItemsEl = document.getElementById('stat-out-items');

    let totalCatalogValue = 0;   // Total value/replacement cost of all items in inventory
    let totalSavingsIssued = 0;  // Total value saved by members for currently issued/requested items
    let issuedItemCount = 0;     // Number of items issued or pending pickup

    let remainingStockValue = 0; // Value of items available in supply closet
    let remainingStockUnits = 0; // Total quantity of items yet to be issued

    // 1. DEDUPLICATE AppState.supply by unique document ID
    const uniqueSupply = Array.from(
        new Map((AppState.supply || []).map(i => [i.id || i.locationCode, i])).values()
    );

    // 2. CALCULATE METRICS SINGLE-PASS
    uniqueSupply.forEach(item => {
        const unitPrice = parseFloat(item.price) || 0;
        const stockMap = item.stock || {};

        // Calculate available stock units across all sizes for this item
        const inStockQty = Object.values(stockMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);

        if (item.status === 'ISSUED' || item.status === 'REQUESTED') {
            // 1. Issued/Requested takes precedence
            totalSavingsIssued += unitPrice;
            issuedItemCount += 1;
            totalCatalogValue += unitPrice;
        } else if (inStockQty > 0 || item.status === 'IN') {
            // 2. Otherwise count in-stock items
            const qty = inStockQty > 0 ? inStockQty : 1;
            remainingStockValue += unitPrice * qty;
            remainingStockUnits += qty;
            totalCatalogValue += unitPrice * qty;
        } else if (item.status === 'OUT') {
            // 3. Out of stock items
            totalCatalogValue += unitPrice;
        }
    });

    // 3. CUT METRICS IN HALF
    const halvedCatalogValue = totalCatalogValue / 2;
    const halvedSlots = Math.floor(uniqueSupply.length / 2);
    const halvedStockUnits = Math.floor(remainingStockUnits / 2);
    const halvedStockValue = remainingStockValue / 2;
    const halvedSavingsIssued = totalSavingsIssued / 2;
    const halvedIssuedCount = Math.floor(issuedItemCount / 2);

    // 4. SAFE DOM UPDATES
    if (totalValEl) totalValEl.textContent = `$${halvedCatalogValue.toFixed(2)}`;
    if (totalSlotsEl) totalSlotsEl.textContent = halvedSlots;

    // Remaining Stock Unissued
    if (totalItemsEl) totalItemsEl.textContent = halvedStockUnits;
    if (inItemsEl) inItemsEl.textContent = halvedStockUnits;
    if (inValEl) inValEl.textContent = `$${halvedStockValue.toFixed(2)}`;

    // Member Savings (Issued Items)
    if (outValEl) outValEl.textContent = `$${halvedSavingsIssued.toFixed(2)}`;
    if (outItemsEl) outItemsEl.textContent = halvedIssuedCount;
}

function setupEventListeners() {
    const shopSearch = document.getElementById('shop-search');
    const shopCat = document.getElementById('shop-category');
    const shopStatus = document.getElementById('shop-status-filter');
    const shopSize = document.getElementById('shop-size-filter');

    if (shopSearch) shopSearch.addEventListener('input', renderShopItems);
    if (shopCat) shopCat.addEventListener('change', renderShopItems);
    if (shopStatus) shopStatus.addEventListener('change', renderShopItems);
    if (shopSize) shopSize.addEventListener('change', renderShopItems);

    const shopGrid = document.getElementById('shop-items-grid');
    if (shopGrid) {
        shopGrid.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            const cardEl = e.target.closest('[data-item-id]');

            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                
                const action = actionBtn.dataset.action;
                const itemId = actionBtn.dataset.itemId;
                const card = e.target.closest('.item-card');
                const qtyInput = card?.querySelector('.card-qty-input');
                const quantity = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;

                if (action === 'add-to-cart') {
                    const sizeSelect = card?.querySelector('.card-size-select');
                    const selectedSize = sizeSelect ? sizeSelect.value : 'OS';
                    addToCartWithDetails(itemId, selectedSize, quantity);

                } else if (action === 'add-to-requisition') {
                    const item = AppState.supply.find(i => i.id === itemId);
                    if (item) {
                        addToRequisitionQueue(item, quantity);
                    }
                }
            } else if (cardEl && !e.target.closest('select') && !e.target.closest('input')) {
                const itemId = cardEl.dataset.itemId;
                window.location.href = `/pages/item.html?id=${encodeURIComponent(itemId)}`;
            }
        });
    }

    window.addEventListener('user-state-changed', () => {
        renderShopItems();
    });

    const cartContainer = document.getElementById('cart-items-container');
    if (cartContainer) {
        cartContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-cart-item"]');
            const qtyBtn = e.target.closest('[data-action="adjust-cart-qty"]');

            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.cartIndex, 10);
                removeCartItemByIndex(index);
            } else if (qtyBtn) {
                const index = parseInt(qtyBtn.dataset.cartIndex, 10);
                const delta = parseInt(qtyBtn.dataset.delta, 10);
                adjustCartQuantity(index, delta);
            }
        });
    }

    const btnClearCart = document.getElementById('btn-clear-cart');
    const btnProceed = document.getElementById('btn-proceed-picklist');
    const btnCartToggle = document.getElementById('btn-cart-toggle');

    if (btnClearCart) btnClearCart.addEventListener('click', clearCurrentCart);
    if (btnProceed) btnProceed.addEventListener('click', proceedToPickList);
    if (btnCartToggle) btnCartToggle.addEventListener('click', toggleCartDrawer);

    window.addEventListener('cart-updated', () => {
        renderShopItems();
        updateCartBadge();
    });
}

export function renderShopItems() {
    const container = document.getElementById('shop-items-grid');
    if (!container) return;

    const user = AppState.currentUser;
    const userRole = (user?.role || ROLES.MEMBER).toLowerCase().trim().replace(/\s+/g, '_');
    const isStaffOrOfficer = hasPermission(userRole, PERMISSIONS.CHECK_OUT_ITEMS);

    const searchTerm = (document.getElementById('shop-search')?.value || '').toLowerCase();
    const selectedCategory = document.getElementById('shop-category')?.value || 'ALL';
    const selectedStatus = document.getElementById('shop-status-filter')?.value || 'IN';
    const selectedSize = document.getElementById('shop-size-filter')?.value || 'ALL';

    const filtered = (AppState.supply || []).filter(item => {
        // NOTE: We do NOT exclude hidden items here so members can view them in the catalog.
        
        const matchSearch = (item.title || '').toLowerCase().includes(searchTerm) || 
                            (item.locationCode || '').toLowerCase().includes(searchTerm);

        const itemCategories = Array.isArray(item.categories) ? item.categories : [item.categories || item.category].filter(Boolean);
        const itemSizes = item.stock ? Object.keys(item.stock) : (Array.isArray(item.sizes) ? item.sizes : [item.size].filter(Boolean));

        const matchCat = selectedCategory === 'ALL' || itemCategories.includes(selectedCategory);
        const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
        const matchSize = selectedSize === 'ALL' || itemSizes.includes(selectedSize);

        return matchSearch && matchCat && matchStatus && matchSize;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200">
                <i class="fa-solid fa-boxes-packing text-4xl text-slate-300 mb-2"></i>
                <p class="text-sm font-semibold text-slate-600">No items match your selected filter criteria.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isHidden = item.hideFromCatalog === true || item.hideFromCatalog === 'true';
        const isAvailable = item.status === 'IN' && !isHidden;
        const vanguardUrl = item.vanguardUrl || 'https://www.vanguardmil.com/pages/civil-air-patrol-collection';
        const rawPrice = parseFloat(item.price) || 0;
        const thumbSrc = item.image && item.image.trim() !== "" ? item.image : CAP_FALLBACK_IMAGE;

        const categoryLabel = Array.isArray(item.categories) && item.categories.length > 0 
            ? item.categories.join(', ') 
            : (item.categories || item.category || 'General');

        const isInCart = (AppState.cart || []).some(c => c.id === item.id);

        const stockMap = item.stock || { "OS": 1 };
        const stockEntries = Object.entries(stockMap);
        const sizeDropdownHtml = stockEntries.length > 0 ? `
            <div class="mt-2">
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Available Items</label>
                <select class="card-size-select w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500" ${isHidden ? 'disabled' : ''}>
                    ${stockEntries.map(([sz, qty]) => {
                        const count = parseInt(qty, 10) || 0;
                        const label = sz === 'OS' ? 'Single Size' : `Size: ${sz}`;
                        return `<option value="${sz}" ${count <= 0 || isHidden ? 'disabled' : ''}>${label} (${count > 0 ? count + ' left' : 'Out of Supply'})</option>`;
                    }).join('')}
                </select>
            </div>
        ` : '';

        // Determine price tag / availability banner
        let priceDisplayHtml = '';
        let badgeHtml = '';

        if (isHidden) {
            badgeHtml = `<span class="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full z-10 bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">Squadron</span>`;
            priceDisplayHtml = `
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">Internal Unit Asset</span>
                </div>
            `;
        } else if (isAvailable) {
            badgeHtml = `<span class="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full z-10 bg-brand-500 text-slate-950">In supply</span>`;
            priceDisplayHtml = `
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-slate-400 line-through font-semibold">$${rawPrice.toFixed(2)}</span>
                    <span class="text-base font-extrabold text-brand-600">$0.00</span>
                    <span class="bg-brand-100 text-brand-800 text-[10px] font-bold px-1.5 py-0.5 rounded">FREE (If Returned)</span>
                </div>
            `;
        } else {
            badgeHtml = `<span class="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-1 rounded-full z-10 bg-amber-500 text-slate-950">Out of Supply</span>`;
            priceDisplayHtml = `
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-base font-extrabold text-slate-900">$${rawPrice.toFixed(2)}</span>
                    <span class="text-[10px] font-bold text-slate-400 uppercase">(Retail Price)</span>
                </div>
            `;
        }

        // Action footer buttons
        let actionFooterHtml = '';
        if (isHidden) {
            actionFooterHtml = `
                <button type="button" disabled class="w-full bg-slate-100 text-slate-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200 cursor-not-allowed">
                    <i class="fa-solid fa-ban"></i> In-Unit Property (Not Issued)
                </button>
            `;
        } else {
            actionFooterHtml = `
                <div class="flex items-center gap-2">
                    <div class="w-16 shrink-0">
                        <input type="number" min="1" max="99" value="1" class="card-qty-input w-full p-2 border border-slate-300 rounded-xl text-center font-bold text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500" title="Quantity">
                    </div>

                    ${isAvailable ? `
                        <button data-action="add-to-cart" data-item-id="${item.id}" class="flex-1 font-extrabold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 ${
                            isInCart 
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                                : 'bg-brand-600 hover:bg-brand-700 text-white'
                        }">
                            <i class="fa-solid ${isInCart ? 'fa-check' : 'fa-plus'}"></i> ${isInCart ? 'Added' : 'Add to Cart'}
                        </button>
                    ` : `
                        <a href="${vanguardUrl}" target="_blank" rel="noopener" class="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5">
                            <i class="fa-solid fa-cart-shopping"></i> Vanguard
                        </a>
                    `}

                    ${isStaffOrOfficer ? `
                        <button data-action="add-to-requisition" data-item-id="${item.id}" title="Add to Booster Club Requisition List" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold p-2.5 rounded-xl text-xs transition flex items-center justify-center shadow-sm shrink-0">
                            <i class="fa-solid fa-truck-ramp-box"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div data-item-id="${item.id}" class="item-card bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden flex flex-col justify-between group ${isHidden ? 'opacity-90 bg-slate-50/50' : ''}">
                <div>
                    <div class="relative p-1 flex items-center justify-center border-b border-slate-100 overflow-hidden">
                        <img src="${thumbSrc}" onerror="this.onerror=null; this.src='${CAP_FALLBACK_IMAGE}';" alt="${item.title}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300">
                        <span class="absolute top-2 left-2 font-mono text-xs font-extrabold bg-slate-900/90 text-white px-2 py-1 rounded-lg backdrop-blur-sm shadow-sm z-10">
                            ${item.locationCode}
                        </span>
                        ${badgeHtml}
                    </div>

                    <div class="p-4 space-y-2">
                        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${categoryLabel}</div>
                        <h3 class="font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-brand-600 transition">${item.title}</h3>
                        <div class="text-xs font-semibold text-slate-500"><i class="fa-solid fa-location-dot text-brand-600 mr-1"></i>${item.location || 'Storage Slot'}</div>
                        
                        ${priceDisplayHtml}
                        ${sizeDropdownHtml}
                    </div>
                </div>

                <div class="p-3 pt-0 space-y-2">
                    ${actionFooterHtml}
                </div>
            </div>
        `;
    }).join('');
}

function updateCartBadge() {
    const cartBadge = document.getElementById('cart-badge');
    const totalQty = (AppState.cart || []).reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
    if (cartBadge) cartBadge.textContent = totalQty;
}

function addToCartWithDetails(itemId, size, quantity) {
    if (!AppState.cart) AppState.cart = [];

    const item = AppState.supply.find(i => i.id === itemId);
    if (!item) return;

    // Prevent adding hidden squadron-owned items to cart
    if (item.hideFromCatalog === true || item.hideFromCatalog === 'true') {
        showToast("Squadron property items cannot be added to individual cart.");
        return;
    }

    const existingIndex = AppState.cart.findIndex(c => c.id === itemId && c.selectedSize === size);

    if (existingIndex >= 0) {
        AppState.cart[existingIndex].quantity += quantity;
    } else {
        AppState.cart.push({
            ...item,
            selectedSize: size,
            quantity: quantity
        });
    }

    saveCart();
    window.dispatchEvent(new CustomEvent('cart-updated'));
    showToast(`Added ${quantity}x ${item.title} (${size}) to cart!`);
}

function removeCartItemByIndex(index) {
    if (!AppState.cart || index < 0 || index >= AppState.cart.length) return;

    const removedItem = AppState.cart.splice(index, 1)[0];
    saveCart();
    window.dispatchEvent(new CustomEvent('cart-updated'));

    if (removedItem) {
        showToast(`Removed ${removedItem.title} from basket.`);
    }
}

function adjustCartQuantity(index, delta) {
    if (!AppState.cart || index < 0 || index >= AppState.cart.length) return;

    const newQty = (AppState.cart[index].quantity || 1) + delta;

    if (newQty <= 0) {
        removeCartItemByIndex(index);
    } else {
        AppState.cart[index].quantity = newQty;
        saveCart();
        window.dispatchEvent(new CustomEvent('cart-updated'));
    }
}

function toggleCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
        drawer.classList.toggle('hidden');
        renderCartDrawer();
    }
}

function renderCartDrawer() {
    const container = document.getElementById('cart-items-container');
    const countEl = document.getElementById('cart-drawer-count');

    const totalItemCount = (AppState.cart || []).reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
    if (countEl) countEl.textContent = totalItemCount;

    if (!container) return;

    if (!AppState.cart || AppState.cart.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">Your cart is currently empty.</p>`;
        return;
    }

    container.innerHTML = AppState.cart.map((item, index) => {
        const rawPrice = parseFloat(item.price) || 0;
        const sizeTag = item.selectedSize && item.selectedSize !== 'OS' ? ` • Size: ${item.selectedSize}` : '';
        const qty = item.quantity || 1;

        return `
            <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-100">
                <div class="flex-1">
                    <div class="font-mono text-xs font-bold text-slate-900">${item.locationCode || 'N/A'}</div>
                    <div class="text-xs font-semibold text-slate-800 line-clamp-1">${item.title}</div>
                    <div class="text-[11px] text-slate-500 font-medium">${sizeTag}</div>
                    <div class="text-[11px] font-semibold text-slate-500 mt-1">
                        <span class="line-through text-slate-400">$${(rawPrice * qty).toFixed(2)}</span>
                        <span class="text-brand-600 font-extrabold ml-1">$0.00</span>
                    </div>
                </div>

                <div class="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button data-action="adjust-cart-qty" data-cart-index="${index}" data-delta="-1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold transition">-</button>
                    <span class="px-2.5 text-xs font-extrabold text-slate-800">${qty}</span>
                    <button data-action="adjust-cart-qty" data-cart-index="${index}" data-delta="1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold transition">+</button>
                </div>

                <button data-action="remove-cart-item" data-cart-index="${index}" class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove item">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
        `;
    }).join('');
}

function clearCurrentCart() {
    AppState.cart = [];
    saveCart();
    window.dispatchEvent(new CustomEvent('cart-updated'));
    showToast("Cart cleared.");
}

function proceedToPickList() {
    window.location.href = '/pages/order.html';
}