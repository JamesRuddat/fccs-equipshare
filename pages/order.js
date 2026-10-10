// /js/order.js - Pick List & Checkout Responsibility Processing
import { AppState, saveCart, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { requestSupplyItem } from '/js/firebase-db.js';

let sigCanvas, sigCtx, isSigning = false;

document.addEventListener('DOMContentLoaded', () => {
    initAuth((user) => {
        // Pre-fill user information if signed in
        if (user) {
            const nameEl = document.getElementById('officer-member-name');
            const emailEl = document.getElementById('officer-member-email');
            const phoneEl = document.getElementById('officer-member-phone');

            if (nameEl && !nameEl.value) nameEl.value = user.fullName || '';
            if (emailEl && !emailEl.value) emailEl.value = user.email || '';
            if (phoneEl && !phoneEl.value) phoneEl.value = user.phone || '';
        }
    });

    renderPickList();
    initSignatureCanvas();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-print-picklist')?.addEventListener('click', () => window.print());
    document.getElementById('btn-clear-cart')?.addEventListener('click', clearCurrentCart);
    document.getElementById('btn-clear-sig')?.addEventListener('click', clearSignature);
    document.getElementById('btn-checkout')?.addEventListener('click', finalizeCheckout);

    // Pick List Dynamic Container Delegation
    document.getElementById('picklist-items-container')?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-action="remove-item"]');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.cartIndex, 10);
            removePickListItemByIndex(index);
        }
    });
}

function renderPickList() {
    const container = document.getElementById('picklist-items-container');
    const countEl = document.getElementById('picklist-item-count');
    const totalEl = document.getElementById('picklist-total-val');

    const cart = AppState.cart || [];
    const totalQty = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);

    if (countEl) countEl.textContent = totalQty;
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-10">No items in Pick List. Return to Member Shop to browse supply.</p>`;
        if (totalEl) totalEl.textContent = '$0.00';
        return;
    }

    let totalVal = 0;
    container.innerHTML = cart.map((item, index) => {
        const rawPrice = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantity, 10) || 1;
        const itemTotalLiability = rawPrice * qty;
        totalVal += itemTotalLiability;

        const sizeTag = item.selectedSize && item.selectedSize !== 'OS' ? ` • Size: ${item.selectedSize}` : '';

        return `
            <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-100">
                <div class="flex-1">
                    <div class="font-mono text-xs font-bold text-slate-900">${item.locationCode || 'N/A'}</div>
                    <div class="text-xs font-semibold text-slate-800 line-clamp-1">${item.title || 'Untitled Item'} <span class="text-brand-600 font-extrabold">(x${qty})</span></div>
                    <div class="text-[11px] text-slate-500 font-medium">${sizeTag}</div>
                    <div class="text-[11px] font-semibold text-slate-500 mt-1">
                        <span class="line-through text-slate-400">$${itemTotalLiability.toFixed(2)}</span>
                        <span class="text-brand-600 font-extrabold ml-1">$0.00</span>
                    </div>
                </div>
                <button data-action="remove-item" data-cart-index="${index}" class="text-red-500 hover:text-red-700 text-xs p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove Item">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.textContent = `$${totalVal.toFixed(2)}`;
}

function removePickListItemByIndex(index) {
    if (!AppState.cart || index < 0 || index >= AppState.cart.length) return;

    AppState.cart.splice(index, 1);
    saveCart();
    renderPickList();
}

function clearCurrentCart() {
    AppState.cart = [];
    saveCart();
    renderPickList();
    showToast("Pick list cleared.");
}

/* --- SIGNATURE CANVAS LOGIC --- */
function initSignatureCanvas() {
    sigCanvas = document.getElementById('signature-canvas');
    if (!sigCanvas) return;

    sigCanvas.width = sigCanvas.offsetWidth || 350;
    sigCanvas.height = sigCanvas.offsetHeight || 112;

    sigCtx = sigCanvas.getContext('2d');
    sigCtx.lineWidth = 2;
    sigCtx.strokeStyle = '#0f172a';

    const startDraw = (e) => {
        isSigning = true;
        const pos = getCanvasPos(e);
        sigCtx.beginPath();
        sigCtx.moveTo(pos.x, pos.y);
        document.getElementById('sig-placeholder')?.classList.add('hidden');
    };

    const draw = (e) => {
        if (!isSigning) return;
        const pos = getCanvasPos(e);
        sigCtx.lineTo(pos.x, pos.y);
        sigCtx.stroke();
    };

    const stopDraw = () => { isSigning = false; };

    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    sigCanvas.addEventListener('mouseup', stopDraw);
    sigCanvas.addEventListener('mouseleave', stopDraw);

    sigCanvas.addEventListener('touchstart', (e) => { startDraw(e.touches[0]); e.preventDefault(); });
    sigCanvas.addEventListener('touchmove', (e) => { draw(e.touches[0]); e.preventDefault(); });
    sigCanvas.addEventListener('touchend', stopDraw);
}

function getCanvasPos(evt) {
    const rect = sigCanvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

function clearSignature() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        document.getElementById('sig-placeholder')?.classList.remove('hidden');
    }
}

async function finalizeCheckout() {
    const name = document.getElementById('officer-member-name')?.value?.trim();
    const phone = document.getElementById('officer-member-phone')?.value?.trim();
    const email = document.getElementById('officer-member-email')?.value?.trim();

    if (!name || !email) {
        alert("Please provide member Full Name and Email.");
        return;
    }

    if (!AppState.cart || AppState.cart.length === 0) {
        alert("Pick basket is empty. Add items before checking out.");
        return;
    }

    const memberData = {
        fullName: name,
        email: email,
        phone: phone || ''
    };

    try {
        const checkoutPromises = [];

        AppState.cart.forEach(item => {
            const qty = parseInt(item.quantity, 10) || 1;
            const size = item.selectedSize || 'OS';

            for (let i = 0; i < qty; i++) {
                // Call requestSupplyItem instead of checkoutSupplyItem
                checkoutPromises.push(requestSupplyItem(item.id, memberData, size));
            }
        });

        await Promise.all(checkoutPromises);

        // Clear cart and notify components
        AppState.cart = [];
        saveCart();
        window.dispatchEvent(new CustomEvent('cart-updated'));
        
        showToast("Equipment requested for " + name);
        window.location.href = '/pages/confirmation.html';
    } catch (err) {
        console.error("Checkout error:", err);
        alert("Failed to complete request: " + err.message);
    }
}