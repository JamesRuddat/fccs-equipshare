// /js/modules/cartDrawer.js - Universal Shopping Cart Drawer Module
import { AppState, saveCart, showToast } from '/js/state.js';

/**
 * Renders items inside the cart drawer and updates header/drawer badge counters.
 */
export function renderCartDrawer() {
    const container = document.getElementById('cart-items-container');
    const badgeEl = document.getElementById('cart-badge');
    const drawerCountEl = document.getElementById('cart-drawer-count');

    const cart = AppState.cart || [];
    const totalItemCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);

    // Update Header Badge & Drawer Counters
    if (badgeEl) badgeEl.textContent = totalItemCount;
    if (drawerCountEl) drawerCountEl.textContent = totalItemCount;

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">Your cart is currently empty.</p>`;
        return;
    }

    container.innerHTML = cart.map((item, index) => {
        const rawPrice = parseFloat(item.price) || 0;
        const sizeTag = item.selectedSize && item.selectedSize !== 'OS' ? ` • Size: ${item.selectedSize}` : '';
        const qty = item.quantity || 1;

        return `
            <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-100 text-xs">
                <div class="flex-1">
                    <div class="font-mono text-[11px] font-bold text-slate-900">${item.locationCode || 'N/A'}</div>
                    <div class="text-xs font-semibold text-slate-800 line-clamp-1">${item.title}</div>
                    <div class="text-[11px] text-slate-500 font-medium">${sizeTag}</div>
                    <div class="text-[11px] font-semibold text-slate-500 mt-1">
                        <span class="line-through text-slate-400">$${(rawPrice * qty).toFixed(2)}</span>
                        <span class="text-brand-600 font-extrabold ml-1">$0.00</span>
                    </div>
                </div>

                <!-- Quantity Adjuster -->
                <div class="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                    <button type="button" data-action="adjust-cart-qty" data-cart-index="${index}" data-delta="-1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition">-</button>
                    <span class="px-2 text-xs font-extrabold text-slate-800">${qty}</span>
                    <button type="button" data-action="adjust-cart-qty" data-cart-index="${index}" data-delta="1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition">+</button>
                </div>

                <!-- Delete Button -->
                <button type="button" data-action="remove-cart-item" data-cart-index="${index}" class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove item">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Initializes listeners for cart events across all pages.
 */
export function setupCartDrawer() {
    // Re-render when cart-updated event dispatches globally
    window.addEventListener('cart-updated', () => {
        renderCartDrawer();
    });

    // Document-level event delegation (captures clicks on dynamic elements inside <app-header>)
    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#btn-cart-toggle');
        const closeBtn = e.target.closest('#btn-close-cart-drawer');
        const clearBtn = e.target.closest('#btn-clear-cart');
        const proceedBtn = e.target.closest('#btn-proceed-picklist');

        const removeBtn = e.target.closest('[data-action="remove-cart-item"]');
        const qtyBtn = e.target.closest('[data-action="adjust-cart-qty"]');

        const drawer = document.getElementById('cart-drawer');

        // Toggle / Close Drawer
        if (toggleBtn) {
            e.preventDefault();
            renderCartDrawer();
            drawer?.classList.remove('hidden');
        } else if (closeBtn) {
            e.preventDefault();
            drawer?.classList.add('hidden');
        } else if (e.target === drawer) {
            drawer.classList.add('hidden');
        }

        // Cart Actions
        if (removeBtn) {
            e.preventDefault();
            const index = parseInt(removeBtn.dataset.cartIndex, 10);
            if (AppState.cart && index >= 0) {
                const removed = AppState.cart.splice(index, 1)[0];
                saveCart();
                if (removed) showToast(`Removed ${removed.title} from cart.`);
            }
        } else if (qtyBtn) {
            e.preventDefault();
            const index = parseInt(qtyBtn.dataset.cartIndex, 10);
            const delta = parseInt(qtyBtn.dataset.delta, 10);
            if (AppState.cart && index >= 0) {
                const newQty = (AppState.cart[index].quantity || 1) + delta;
                if (newQty <= 0) {
                    AppState.cart.splice(index, 1);
                } else {
                    AppState.cart[index].quantity = newQty;
                }
                saveCart();
            }
        } else if (clearBtn) {
            e.preventDefault();
            AppState.cart = [];
            saveCart();
            showToast("Cart cleared.");
        } else if (proceedBtn) {
            e.preventDefault();
            drawer?.classList.add('hidden');
            window.location.href = '/pages/order.html';
        }
    });

    // Initial render call
    renderCartDrawer();
}