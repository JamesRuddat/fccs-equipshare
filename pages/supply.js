// /js/supply.js - Supply Inventory Master Console & Bulk Import Manager
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { 
    getSupplyItems, 
    createSupplyItem, 
    updateSupplyItem, 
    issueSupplyItem 
} from '/js/firebase-db.js';

// Fallback image asset
const CAP_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Roundel_of_United_States_Civil_Air_Patrol.svg/250px-Roundel_of_United_States_Civil_Air_Patrol.svg.png';

// Preset default categories
const DEFAULT_CATEGORIES = ["ABU", "OCP", "Blues", "Insignia", "Outerwear", "Headwear", "Boots", "Equipment", "General"];

document.addEventListener('DOMContentLoaded', () => {
    initAuth(async (user) => {
        AppState.currentUser = user;
        await refreshSupplyData();
    });

    setupAdminFilters();
    setupImageUploadListeners();
    setupInlineCategoryEditor();

    refreshSupplyData();
});

/* --- DATA NORMALIZATION & VALIDATION --- */
function formatLocationCode(input) {
    if (!input) return "";
    const cleaned = String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{2}\d{2}$/.test(cleaned)) {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    }
    return input.toUpperCase().trim();
}

function isValidLocationCode(code) {
    return /^[A-Z]{2}-\d{2}$/.test(code);
}

/* --- STATE SYNCHRONIZATION --- */
async function refreshSupplyData() {
    try {
        const supply = await getSupplyItems().catch(() => []);
        AppState.supply = supply || [];

        renderPendingOrdersQueue();
        renderAdminTable();
        renderCategoryCheckboxes(getSelectedCategoriesFromForm());
    } catch (err) {
        console.error("Error refreshing supply data:", err);
    }
}

/* --- CATEGORY MULTI-SELECT & INLINE EDITOR LOGIC --- */
function getAllAvailableCategories() {
    const existingCategories = new Set(DEFAULT_CATEGORIES);
    
    (AppState.supply || []).forEach(item => {
        const cats = Array.isArray(item.categories) ? item.categories : [item.categories || item.category].filter(Boolean);
        cats.forEach(c => existingCategories.add(c));
    });

    return Array.from(existingCategories);
}

function renderCategoryCheckboxes(selectedCategories = []) {
    const container = document.getElementById('category-checkboxes-container');
    if (!container) return;

    const allCategories = getAllAvailableCategories();
    const selectedArray = Array.isArray(selectedCategories) 
        ? selectedCategories 
        : String(selectedCategories || '').split(',').map(s => s.trim()).filter(Boolean);

    container.innerHTML = allCategories.map(cat => {
        const isChecked = selectedArray.includes(cat);
        return `
            <label class="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 hover:text-slate-900">
                <input type="checkbox" name="form-category-checkbox" value="${cat}" ${isChecked ? 'checked' : ''} class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
                <span>${cat}</span>
            </label>
        `;
    }).join('');
}

function getSelectedCategoriesFromForm() {
    const checkboxes = document.querySelectorAll('input[name="form-category-checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function setupInlineCategoryEditor() {
    const btnToggle = document.getElementById('btn-toggle-cat-edit');
    const labelToggle = document.getElementById('label-cat-edit-toggle');
    const checkboxContainer = document.getElementById('category-checkboxes-container');
    const inlineEditor = document.getElementById('category-inline-editor');

    if (!btnToggle) return;

    btnToggle.addEventListener('click', () => {
        const isEditing = !inlineEditor?.classList.contains('hidden');

        if (isEditing) {
            // Switch back to Checkbox View
            inlineEditor?.classList.add('hidden');
            checkboxContainer?.classList.remove('hidden');
            if (labelToggle) labelToggle.textContent = 'Edit Category Names';
        } else {
            // Render and Switch to Inline Rename View
            renderInlineCategoryRows();
            checkboxContainer?.classList.add('hidden');
            inlineEditor?.classList.remove('hidden');
            if (labelToggle) labelToggle.textContent = 'Done Editing';
        }
    });
}

function renderInlineCategoryRows() {
    const container = document.getElementById('category-inline-editor');
    if (!container) return;

    const allCategories = getAllAvailableCategories();

    container.innerHTML = allCategories.map(cat => `
        <div class="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200">
            <input type="text" data-original="${cat}" value="${cat}" class="inline-cat-input flex-1 p-1 border border-slate-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
            <button type="button" data-action="save-inline-rename" data-original="${cat}" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[11px] font-bold transition">
                Save
            </button>
            <button type="button" data-action="delete-inline-cat" data-original="${cat}" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition" title="Delete">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');

    // Attach row events
    container.querySelectorAll('[data-action="save-inline-rename"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const oldName = btn.dataset.original;
            const row = btn.closest('div');
            const newName = row?.querySelector('.inline-cat-input')?.value.trim();

            if (!newName || newName === oldName) return;

            await renameCategoryGlobally(oldName, newName);
        });
    });

    container.querySelectorAll('[data-action="delete-inline-cat"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const catName = btn.dataset.original;
            if (confirm(`Remove "${catName}" from all items?`)) {
                await deleteCategoryGlobally(catName);
            }
        });
    });
}

async function renameCategoryGlobally(oldName, newName) {
    let count = 0;

    for (const item of AppState.supply || []) {
        const cats = Array.isArray(item.categories) ? item.categories : [item.categories || item.category].filter(Boolean);
        
        if (cats.includes(oldName)) {
            const updated = Array.from(new Set(cats.map(c => c === oldName ? newName : c)));
            try {
                await updateSupplyItem(item.id, { categories: updated });
                count++;
            } catch (err) {
                console.error(`Failed updating category for item ${item.id}:`, err);
            }
        }
    }

    await refreshSupplyData();
    renderInlineCategoryRows();
    showToast(`Renamed "${oldName}" to "${newName}" across ${count} items!`);
}

async function deleteCategoryGlobally(catName) {
    let count = 0;

    for (const item of AppState.supply || []) {
        const cats = Array.isArray(item.categories) ? item.categories : [item.categories || item.category].filter(Boolean);

        if (cats.includes(catName)) {
            const updated = cats.filter(c => c !== catName);
            try {
                await updateSupplyItem(item.id, { categories: updated.length > 0 ? updated : ["General"] });
                count++;
            } catch (err) {
                console.error(`Failed removing category for item ${item.id}:`, err);
            }
        }
    }

    await refreshSupplyData();
    renderInlineCategoryRows();
    showToast(`Removed "${catName}" from ${count} items.`);
}

/* --- FILTER & EVENT DELEGATION SETUP --- */
function setupAdminFilters() {
    const adminSearch = document.getElementById('admin-table-search');
    const adminStatus = document.getElementById('admin-status-filter');
    const btnAddItem = document.getElementById('btn-add-item-slot');

    if (adminSearch) adminSearch.addEventListener('input', renderAdminTable);
    if (adminStatus) adminStatus.addEventListener('change', renderAdminTable);

    if (btnAddItem) btnAddItem.addEventListener('click', () => openItemModal());

    const tagInput = document.getElementById('form-location-code');
    if (tagInput) {
        tagInput.addEventListener('blur', () => {
            tagInput.value = formatLocationCode(tagInput.value);
            const imgInput = document.getElementById('form-image-path');
            if (imgInput && !imgInput.value && tagInput.value) {
                imgInput.value = `/images/products/${tagInput.value}.jpg`;
            }
        });
    }

    const btnAddCat = document.getElementById('btn-add-new-category');
    if (btnAddCat) {
        btnAddCat.addEventListener('click', () => {
            const input = document.getElementById('input-new-category');
            const newCatName = input?.value.trim();
            if (!newCatName) return;

            const currentSelected = getSelectedCategoriesFromForm();
            if (!currentSelected.includes(newCatName)) {
                currentSelected.push(newCatName);
            }

            renderCategoryCheckboxes(currentSelected);
            if (input) input.value = '';
            showToast(`Added category: ${newCatName}`);
        });
    }

    const itemForm = document.getElementById('item-form');
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleItemFormSubmit();
        });
    }

    document.getElementById('btn-close-item-modal')?.addEventListener('click', closeItemModal);
    document.getElementById('btn-cancel-item-modal')?.addEventListener('click', closeItemModal);

    // Delegation targeting item.id
    document.getElementById('admin-table-body')?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-action="edit-item"]');
        const adjustStockBtn = e.target.closest('[data-action="adjust-stock"]');
        const toggleVisBtn = e.target.closest('[data-action="toggle-visibility"]');

        if (editBtn) {
            openItemModal(editBtn.dataset.docId);
        } else if (adjustStockBtn) {
            const docId = adjustStockBtn.dataset.docId;
            const sizeKey = adjustStockBtn.dataset.sizeKey || "OS";
            const delta = parseInt(adjustStockBtn.dataset.delta, 10) || 0;
            await quickAdjustItemStock(docId, sizeKey, delta);
        } else if (toggleVisBtn) {
            const docId = toggleVisBtn.dataset.docId;
            const isCurrentlyHidden = toggleVisBtn.dataset.currentHidden === 'true';
            try {
                await updateSupplyItem(docId, { hideFromCatalog: !isCurrentlyHidden });
                await refreshSupplyData();
                showToast(isCurrentlyHidden ? "Item is now available in the catalog." : "Item unavailable from catalog.");
            } catch (err) {
                console.error("Failed to toggle visibility:", err);
                if (window.showAlert) window.showAlert("Visibility Toggle Failed", err.message, "error");
            }
        }
    });

    document.getElementById('pending-orders-table-body')?.addEventListener('click', async (e) => {
        const confirmBtn = e.target.closest('[data-action="confirm-issue"]');
        if (confirmBtn) {
            const docId = confirmBtn.dataset.docId;
            try {
                await issueSupplyItem(docId);
                await refreshSupplyData();
                showToast("Item marked as ISSUED and handed out!");
            } catch (err) {
                if (window.showAlert) {
                    window.showAlert("Failed to issue item", err.message, "error");
                }
            }
        }
    });

    const bulkModal = document.getElementById('bulk-import-modal');
    const btnOpenBulk = document.getElementById('btn-open-bulk-import');
    const btnCloseBulk = document.getElementById('btn-close-bulk-modal');
    const btnCancelBulk = document.getElementById('btn-cancel-bulk-modal');
    const btnRunBulk = document.getElementById('btn-run-bulk-import');

    if (btnOpenBulk) btnOpenBulk.addEventListener('click', () => bulkModal?.classList.remove('hidden'));
    if (btnCloseBulk) btnCloseBulk.addEventListener('click', () => bulkModal?.classList.add('hidden'));
    if (btnCancelBulk) btnCancelBulk.addEventListener('click', () => bulkModal?.classList.add('hidden'));

    if (btnRunBulk) {
        btnRunBulk.addEventListener('click', async () => {
            const rawCode = document.getElementById('bulk-import-textarea')?.value;
            if (!rawCode || !rawCode.trim()) {
                if (window.showAlert) window.showAlert("Hold up", "Please paste a JavaScript or JSON inventory array first.", "error");
                return;
            }

            try {
                const itemsArray = Function(`"use strict"; return (${rawCode});`)();
                if (!Array.isArray(itemsArray)) {
                    throw new Error("Pasted content must resolve to an Array [...]");
                }

                btnRunBulk.disabled = true;
                btnRunBulk.textContent = "Importing...";

                await processBulkInventoryImport(itemsArray);

                bulkModal?.classList.add('hidden');
                document.getElementById('bulk-import-textarea').value = '';
                await refreshSupplyData();
            } catch (err) {
                console.error("Bulk import parsing failed:", err);
                if (window.showAlert) window.showAlert("Import failed", err.message, "error");
            } finally {
                btnRunBulk.disabled = false;
                btnRunBulk.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Execute Import`;
            }
        });
    }
}

/* --- IMAGE UPLOADER LOGIC --- */
function setupImageUploadListeners() {
    const fileInput = document.getElementById('form-image-file');
    const imgPreview = document.getElementById('modal-image-preview');
    const pathInput = document.getElementById('form-image-path');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Data = event.target.result;
                    if (pathInput) pathInput.value = base64Data;
                    if (imgPreview) {
                        imgPreview.src = base64Data;
                        imgPreview.classList.remove('hidden');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (pathInput) {
        pathInput.addEventListener('input', () => {
            if (imgPreview) {
                if (pathInput.value) {
                    imgPreview.src = pathInput.value;
                    imgPreview.classList.remove('hidden');
                } else {
                    imgPreview.classList.add('hidden');
                }
            }
        });
    }
}

/* --- PENDING MEMBER ORDERS QUEUE --- */
function renderPendingOrdersQueue() {
    const container = document.getElementById('pending-orders-table-body');
    if (!container) return;

    const pending = (AppState.supply || []).filter(item => item.status === 'REQUESTED');

    if (pending.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">No pending requests. All orders handed out!</td></tr>`;
        return;
    }

    container.innerHTML = pending.map(item => `
        <tr class="border-b border-slate-100 hover:bg-amber-50/50 transition">
            <td class="p-2 font-mono font-bold text-slate-900">${item.locationCode || 'N/A'}</td>
            <td class="p-2 font-semibold text-slate-800">${item.title}</td>
            <td class="p-2 text-slate-700">${item.requestedByName || 'Member'}</td>
            <td class="p-2 font-mono text-xs">${item.requestedSize || 'OS'}</td>
            <td class="p-2 text-right">
                <button data-action="confirm-issue" data-doc-id="${item.id}" class="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm">
                    <i class="fa-solid fa-hand-holding mr-1"></i> Hand Out & Issue
                </button>
            </td>
        </tr>
    `).join('');
}

/* --- INLINE QUICK STOCK ADJUSTMENT --- */
async function quickAdjustItemStock(itemId, sizeKey, delta) {
    const item = (AppState.supply || []).find(i => i.id === itemId);
    if (!item) return;

    const stockMap = { ...(item.stock || { "OS": 0 }) };
    const currentQty = parseInt(stockMap[sizeKey] || 0, 10);
    const newQty = Math.max(0, currentQty + delta);

    stockMap[sizeKey] = newQty;

    try {
        await updateSupplyItem(itemId, { stock: stockMap });
        await refreshSupplyData();
        showToast(`Updated ${item.title} (${sizeKey}: ${newQty})`);
    } catch (err) {
        console.error("Stock adjustment failed:", err);
        if (window.showAlert) window.showAlert("Could not update stock", err.message, "error");
    }
}

/* --- MAIN SUPPLY TABLE RENDERING --- */
function renderAdminTable() {
    const bodyContainer = document.getElementById('admin-table-body');
    if (!bodyContainer) return;

    const searchTerm = (document.getElementById('admin-table-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('admin-status-filter')?.value || 'ALL';

    const filtered = (AppState.supply || []).filter(item => {
        const matchSearch = String(item.title || '').toLowerCase().includes(searchTerm) || 
                            String(item.locationCode || '').toLowerCase().includes(searchTerm) ||
                            String(item.lastIssuedToName || '').toLowerCase().includes(searchTerm);
        const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        bodyContainer.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400">No supply items found.</td></tr>`;
        return;
    }

    bodyContainer.innerHTML = filtered.map(item => {
        const stockMap = item.stock || { "OS": 0 };
        const totalQty = Object.values(stockMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);
        const thumbSrc = item.image && item.image.trim() !== "" ? item.image : `/images/products/${item.locationCode || 'placeholder'}.jpg`;
        const isHidden = item.hideFromCatalog === true || item.hideFromCatalog === 'true';

        const inlineStockControls = Object.entries(stockMap).map(([sz, qty]) => `
            <div class="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-mono mr-1 mb-1">
                <span class="font-bold text-slate-700">${sz}:</span>
                <span class="font-extrabold text-slate-900 mx-1">${qty}</span>
                <button data-action="adjust-stock" data-doc-id="${item.id}" data-size-key="${sz}" data-delta="-1" class="text-red-500 hover:text-red-700 hover:bg-slate-200 w-4 h-4 rounded flex items-center justify-center font-bold" title="Decrease 1">-</button>
                <button data-action="adjust-stock" data-doc-id="${item.id}" data-size-key="${sz}" data-delta="1" class="text-brand-600 hover:text-brand-800 hover:bg-slate-200 w-4 h-4 rounded flex items-center justify-center font-bold" title="Increase 1">+</button>
            </div>
        `).join('');

        let statusBadge = '';
        if (item.status === 'IN') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-800">Stock</span>`;
        } else if (item.status === 'REQUESTED') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">Requested</span>`;
        } else if (item.status === 'ISSUED') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Issued</span>`;
        } else if (item.status === 'VANGUARD') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">Vanguard</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Out</span>`;
        }

        const visibilityBadge = isHidden 
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 inline-flex items-center gap-1"></i>Unavailable</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Available</span>`;

        const categoryText = Array.isArray(item.categories) ? item.categories.join(', ') : (item.categories || item.category || 'General');

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition ${isHidden ? 'bg-slate-50/60' : ''}">
                <td class="p-2 w-12">
                    <img src="${thumbSrc}" onerror="this.onerror=null; this.src='${CAP_FALLBACK_IMAGE}';" alt="" class="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-sm">
                </td>
                <td class="p-3 font-mono font-bold text-slate-900">${item.locationCode || 'N/A'}</td>
                <td class="p-3 text-slate-600">${item.location || 'Closet Slot'}</td>
                <td class="p-3 font-semibold text-slate-900">
                    <div>${item.title || 'Untitled Item'}</div>
                    <div class="mt-1">${visibilityBadge}</div>
                </td>
                <td class="p-3 font-mono font-bold text-slate-900">$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td class="p-3 text-slate-500">${categoryText}</td>
                <td class="p-3 font-mono text-[11px] min-w-[200px]">${inlineStockControls} <div class="text-[10px] text-slate-400 font-sans mt-0.5">Total: <strong class="text-brand-600">${totalQty}</strong></div></td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3">
                    ${item.vanguardUrl ? `<a href="${item.vanguardUrl}" target="_blank" class="text-amber-600 font-bold hover:underline">Vanguard</a>` : '<span class="text-slate-400">N/A</span>'}
                </td>
                <td class="p-3 text-right space-x-1">
                    <button data-action="toggle-visibility" data-doc-id="${item.id}" data-current-hidden="${isHidden}" title="${isHidden ? 'Hiden from being issued' : 'Can be issued'}" class="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 text-slate-600 transition">
                        <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button data-action="edit-item" data-doc-id="${item.id}" class="bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-xs transition">
                        <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/* --- MODAL CONTROLS & PARSING --- */
export function openItemModal(targetDocId = null) {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    // Reset inline editor view
    document.getElementById('category-inline-editor')?.classList.add('hidden');
    document.getElementById('category-checkboxes-container')?.classList.remove('hidden');
    const labelToggle = document.getElementById('label-cat-edit-toggle');
    if (labelToggle) labelToggle.textContent = 'Edit Category Names';

    const item = (AppState.supply || []).find(i => i.id === targetDocId);
    const imgPreview = document.getElementById('modal-image-preview');
    const hideCheckbox = document.getElementById('form-hide-from-catalog');

    if (targetDocId && item) {
        document.getElementById('modal-title').textContent = 'Edit Supply Item';
        document.getElementById('form-doc-id').value = item.id;
        document.getElementById('form-location-code').value = item.locationCode || '';
        document.getElementById('form-location').value = item.location || '';
        document.getElementById('form-title').value = item.title || '';
        document.getElementById('form-price').value = item.price || '';

        renderCategoryCheckboxes(item.categories || [item.category].filter(Boolean));

        const stockMap = item.stock || { "OS": 0 };
        if (item.isOneSize || (Object.keys(stockMap).length === 1 && Object.keys(stockMap)[0] === "OS")) {
            document.getElementById('form-sizes').value = stockMap["OS"] ?? 0;
        } else {
            document.getElementById('form-sizes').value = Object.entries(stockMap)
                .map(([sz, qty]) => `${sz}: ${qty}`)
                .join(', ');
        }

        if (hideCheckbox) hideCheckbox.checked = item.hideFromCatalog === true || item.hideFromCatalog === 'true';

        const imageVal = item.image || `/images/products/${item.locationCode}.jpg`;
        document.getElementById('form-image-path').value = imageVal;
        if (imgPreview) {
            imgPreview.src = imageVal;
            imgPreview.classList.remove('hidden');
        }

        document.getElementById('form-vanguard-url').value = item.vanguardUrl || '';
    } else {
        document.getElementById('modal-title').textContent = 'Add New Supply Item';
        document.getElementById('form-doc-id').value = '';
        document.getElementById('item-form').reset();
        renderCategoryCheckboxes([]);
        if (hideCheckbox) hideCheckbox.checked = false;
        if (imgPreview) imgPreview.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

export function closeItemModal() {
    document.getElementById('item-modal')?.classList.add('hidden');
}

function parseStockFromInput(inputStr) {
    if (!inputStr || !inputStr.trim()) return { "OS": 0 };

    const str = inputStr.trim();

    if (/^\d+$/.test(str)) {
        return { "OS": parseInt(str, 10) };
    }

    const stockMap = {};
    const parts = str.split(',');

    parts.forEach(part => {
        if (part.includes(':')) {
            const [size, qty] = part.split(':');
            const cleanSize = size.trim().toUpperCase();
            const cleanQty = parseInt(qty, 10);
            if (cleanSize) stockMap[cleanSize] = !isNaN(cleanQty) && cleanQty >= 0 ? cleanQty : 0;
        } else {
            const cleanSize = part.trim().toUpperCase();
            if (cleanSize) stockMap[cleanSize] = 0;
        }
    });

    return Object.keys(stockMap).length > 0 ? stockMap : { "OS": 0 };
}

async function handleItemFormSubmit() {
    const docId = document.getElementById('form-doc-id').value;
    const rawTag = document.getElementById('form-location-code').value;
    const formattedTag = formatLocationCode(rawTag);
    document.getElementById('form-location-code').value = formattedTag;

    if (!isValidLocationCode(formattedTag)) {
        if (window.showAlert) window.showAlert("Invalid Location Tag format!", "Please use 2 letters followed by 2 numbers (e.g. AA-00 or A1-04).", "error");
        document.getElementById('form-location-code').focus();
        return;
    }

    const stockInputRaw = document.getElementById('form-sizes').value;
    const stockMap = parseStockFromInput(stockInputRaw);
    const hideCheckbox = document.getElementById('form-hide-from-catalog');
    const selectedCategories = getSelectedCategoriesFromForm();

    const itemData = {
        locationCode: formattedTag,
        location: document.getElementById('form-location').value,
        title: document.getElementById('form-title').value,
        price: parseFloat(document.getElementById('form-price').value) || 0,
        categories: selectedCategories.length > 0 ? selectedCategories : ["General"],
        stock: stockMap,
        status: 'IN',
        hideFromCatalog: hideCheckbox ? hideCheckbox.checked : false,
        image: document.getElementById('form-image-path').value || `/images/products/${formattedTag}.jpg`,
        vanguardUrl: document.getElementById('form-vanguard-url').value
    };

    try {
        if (docId) {
            await updateSupplyItem(docId, itemData);
        } else {
            await createSupplyItem(itemData);
        }
        await refreshSupplyData();
        closeItemModal();
    } catch (err) {
        if (window.showAlert) window.showAlert("Failed to save item", err.message, "error");
    }
}

/* --- BULK IMPORT --- */
async function processBulkInventoryImport(itemsArray) {
    let successCount = 0;
    let tagCounter = 1;

    for (const item of itemsArray) {
        const tagCode = `IN-${String(tagCounter).padStart(2, '0')}`;
        tagCounter++;

        let stockMap = {};
        if (item.stock && typeof item.stock === 'object') {
            stockMap = item.stock;
        } else {
            stockMap = { "OS": parseInt(item.qty, 10) || 0 };
        }

        const payload = {
            locationCode: tagCode,
            title: item.title || "Untitled Item",
            categories: Array.isArray(item.cat) ? item.cat : [item.cat || "General"],
            stock: stockMap,
            status: 'IN',
            hideFromCatalog: !!item.hideFromCatalog,
            image: `/images/products/${tagCode}.jpg`,
            price: parseFloat(item.price) || 0,
            location: item.location || "Main Supply Closet",
            vanguardUrl: item.vanguardUrl || ""
        };

        try {
            await createSupplyItem(payload);
            successCount++;
        } catch (err) {
            console.error(`Failed to import "${item.title}":`, err);
        }
    }

    if (typeof showToast === 'function') {
        showToast(`Successfully imported ${successCount} items into Firestore!`);
    } else if (window.showAlert) {
        window.showAlert("Bulk Import Complete", `Successfully imported ${successCount} items into Firestore!`, "success");
    }
}