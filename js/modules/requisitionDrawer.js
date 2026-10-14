import { AppState, saveRequisition, showToast } from '/js/state.js';

export function addToRequisitionQueue(item, quantity = 1) {
    if (!AppState.requisition) AppState.requisition = [];

    const parsedQty = Math.max(1, parseInt(quantity, 10) || 1);
    const existingIndex = AppState.requisition.findIndex(r => r.locationCode === item.locationCode);

    if (existingIndex >= 0) {
        AppState.requisition[existingIndex].quantity += parsedQty;
    } else {
        AppState.requisition.push({
            locationCode: item.locationCode,
            title: item.title,
            price: item.price || 0,
            quantity: parsedQty
        });
    }

    saveRequisition();
    window.dispatchEvent(new CustomEvent('requisition-updated'));
    showToast(`Added ${parsedQty}x ${item.title} to Requisition Queue.`);
}

export function renderRequisitionDrawer() {
    const container = document.getElementById('requisition-items-container');
    const countEl = document.getElementById('requisition-drawer-count');
    const badgeEl = document.getElementById('requisition-badge');

    const list = AppState.requisition || [];
    const totalCount = list.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);

    if (countEl) countEl.textContent = totalCount;
    if (badgeEl) badgeEl.textContent = totalCount;

    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">No items in requisition queue.</p>`;
        return;
    }

    container.innerHTML = list.map((item, index) => `
        <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-100 text-xs">
            <div class="flex-1">
                <div class="font-mono text-[11px] font-bold text-slate-900">${item.locationCode || 'N/A'}</div>
                <div class="text-xs font-semibold text-slate-800 line-clamp-1">${item.title}</div>
                <div class="text-[11px] font-semibold text-amber-600 mt-1">$${(parseFloat(item.price || 0) * item.quantity).toFixed(2)}</div>
            </div>

            <!-- Quantity Adjuster -->
            <div class="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                <button type="button" data-req-action="adjust-qty" data-req-index="${index}" data-delta="-1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition cursor-pointer">-</button>
                <span class="px-2 text-xs font-extrabold text-slate-800">${item.quantity}</span>
                <button type="button" data-req-action="adjust-qty" data-req-index="${index}" data-delta="1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition cursor-pointer">+</button>
            </div>

            <!-- Remove Button -->
            <button type="button" data-req-action="remove-item" data-req-index="${index}" class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer" title="Remove item">
                <i class="fa-solid fa-trash-can text-sm pointer-events-none"></i>
            </button>
        </div>
    `).join('');
}

export function setupRequisitionDrawer() {
    window.addEventListener('requisition-updated', () => {
        renderRequisitionDrawer();
    });

    document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('#btn-requisition-toggle');
        const closeBtn = e.target.closest('#btn-close-requisition-drawer');
        const removeBtn = e.target.closest('[data-req-action="remove-item"]');
        const qtyBtn = e.target.closest('[data-req-action="adjust-qty"]');

        const drawer = document.getElementById('requisition-drawer');

        if (toggleBtn) {
            e.preventDefault();
            renderRequisitionDrawer();
            drawer?.classList.remove('hidden');
            return;
        }

        if (closeBtn) {
            e.preventDefault();
            drawer?.classList.add('hidden');
            return;
        }

        if (e.target === drawer) {
            drawer.classList.add('hidden');
            return;
        }

        if (removeBtn) {
            e.preventDefault();
            const index = parseInt(removeBtn.dataset.reqIndex, 10);
            if (AppState.requisition && index >= 0) {
                AppState.requisition.splice(index, 1);
                saveRequisition();
                window.dispatchEvent(new CustomEvent('requisition-updated'));
            }
            return;
        }

        if (qtyBtn) {
            e.preventDefault();
            const index = parseInt(qtyBtn.dataset.reqIndex, 10);
            const delta = parseInt(qtyBtn.dataset.delta, 10);

            if (AppState.requisition && index >= 0) {
                const newQty = (AppState.requisition[index].quantity || 1) + delta;
                if (newQty <= 0) {
                    AppState.requisition.splice(index, 1);
                } else {
                    AppState.requisition[index].quantity = newQty;
                }
                saveRequisition();
                window.dispatchEvent(new CustomEvent('requisition-updated'));
            }
            return;
        }
    });

    // Netlify Form Handler
    const reqForm = document.getElementById('requisition-netlify-form');
    if (reqForm) {
        reqForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!AppState.requisition || AppState.requisition.length === 0) {
                showToast("Requisition list is empty!");
                return;
            }

            const itemsInput = document.getElementById('requisition-items-input');
            if (itemsInput) {
                itemsInput.value = JSON.stringify(AppState.requisition, null, 2);
            }

            const formData = new FormData(reqForm);

            try {
                const response = await fetch('/', {
                    method: 'POST',
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams(formData).toString()
                });

                if (response.ok) {
                    showToast("Requisition sent successfully!");
                    AppState.requisition = [];
                    saveRequisition();
                    window.dispatchEvent(new CustomEvent('requisition-updated'));
                    document.getElementById('requisition-drawer')?.classList.add('hidden');
                    reqForm.reset();
                } else {
                    throw new Error(`Submit failed with status: ${response.status}`);
                }
            } catch (err) {
                console.error("Netlify form error:", err);
                showToast("Failed to submit requisition.");
            }
        });
    }

    renderRequisitionDrawer();
}