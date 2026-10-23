// /js/supply.js - Supply Inventory Master Console & Dynamic Size Manager
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { 
    getSupplyItems, 
    createSupplyItem, 
    updateSupplyItem, 
    issueSupplyItem,
    issueSupplyItemToMember,
    getAllUsers
} from '/js/firebase-db.js';

// Fallback image asset
const CAP_FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Roundel_of_United_States_Civil_Air_Patrol.svg/250px-Roundel_of_United_States_Civil_Air_Patrol.svg.png';

// Preset default categories
const DEFAULT_CATEGORIES = ["ABU", "OCP", "Blues", "Insignia", "Outerwear", "Headwear", "Boots", "Equipment", "General"];

let activeDirectIssueItemId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wrap page initialization inside initAuth to prevent race conditions:
    initAuth(async (user) => {
        AppState.currentUser = user;
        
        // Dispatch event so AppHeader updates its navigation links
        window.dispatchEvent(new CustomEvent('user-state-changed'));

        // Load supply data after auth completes
        await refreshSupplyData();
    });

    setupAdminFilters();
    setupImageUploadListeners();
    setupInlineCategoryEditor();
    setupDirectIssueForm();
    setupSizeManagerEvents();
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

/* --- DYNAMIC SIZE MANAGER UI LOGIC --- */
function renderSizeFormRows(stockMap = { "One Size": 0 }, mergeWithExisting = false) {
    const container = document.getElementById('size-rows-container');
    if (!container) return;

    let targetStockMap = { ...stockMap };

    // If merging, preserve existing quantities for matching sizes
    if (mergeWithExisting) {
        const currentMap = getStockMapFromFormRows();
        const mergedKeys = new Set([...Object.keys(currentMap), ...Object.keys(stockMap)]);
        targetStockMap = {};

        mergedKeys.forEach(sz => {
            targetStockMap[sz] = currentMap[sz] !== undefined ? currentMap[sz] : (stockMap[sz] || 0);
        });
    }

    const entries = Object.entries(targetStockMap);
    if (entries.length === 0) entries.push(["One Size", 0]);

    container.innerHTML = entries.map(([size, qty]) => `
        <div class="size-input-row flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <div class="flex-1">
                <input type="text" value="${size}" class="size-label-input w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 uppercase focus:ring-1 focus:ring-brand-500 focus:outline-none" placeholder="Size (e.g. S, M, L, 10.5)">
            </div>
            <div class="w-16">
                <input type="number" min="0" value="${qty}" class="size-qty-input w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-800 text-center focus:ring-1 focus:ring-brand-500 focus:outline-none" title="Quantity">
            </div>
            <button type="button" data-action="remove-size-row" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition" title="Remove Size">
                <i class="fa-solid fa-trash-can text-xs pointer-events-none"></i>
            </button>
        </div>
    `).join('');
}

function getStockMapFromFormRows() {
    const rows = document.querySelectorAll('.size-input-row');
    const stockMap = {};

    rows.forEach(row => {
        const sizeInput = row.querySelector('.size-label-input');
        const qtyInput = row.querySelector('.size-qty-input');
        const size = sizeInput?.value.trim().toUpperCase() || "One Size";
        const qty = parseInt(qtyInput?.value, 10);

        if (size) {
            stockMap[size] = !isNaN(qty) && qty >= 0 ? qty : 0;
        }
    });

    return Object.keys(stockMap).length > 0 ? stockMap : { "One Size": 0 };
}

function setupSizeManagerEvents() {
    const sizeContainer = document.getElementById('size-rows-container');
    if (sizeContainer) {
        sizeContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="remove-size-row"]');
            if (removeBtn) {
                const row = removeBtn.closest('.size-input-row');
                if (document.querySelectorAll('.size-input-row').length > 1) {
                    row.remove();
                } else {
                    showToast("An item must have at least One Size entry.");
                }
            }
        });
    }

    // Add Blank Size Row Button
    document.getElementById('btn-add-size-row')?.addEventListener('click', () => {
        const currentStock = getStockMapFromFormRows();
        currentStock[`SZ_${Object.keys(currentStock).length + 1}`] = 0;
        renderSizeFormRows(currentStock);
    });

    // Preset Size Buttons
    document.getElementById('preset-s-m-l')?.addEventListener('click', () => {
        renderSizeFormRows({ "X-Small": 0, "Small": 0, "Medium": 0, "Large": 0, "XL": 0 }, true);
    });

    document.getElementById('preset-hats')?.addEventListener('click', () => {
        const hatMap = {
            "6": 0, "6 3/8": 0, "6 1/2": 0, "6 5/8": 0, "6 3/4": 0, 
            "6 7/8": 0, "7": 0, "7 1/8": 0, "7 1/4": 0, "7 3/8": 0, 
            "7 1/2": 0, "7 5/8": 0, "7 3/4": 0, "7 7/8": 0, "8": 0
        };
        renderSizeFormRows(hatMap, true);
    });

    document.getElementById('preset-ocp')?.addEventListener('click', () => {
        const ocpMap = {
            "Extra Small - Regular": 0, "Small - Regular": 0, "Small - Short": 0, "Small - Long": 0, 
            "Medium - Regular": 0, "Medium - Short": 0, "Medium - Long": 0, 
            "Large - Regular": 0, "Large - Short": 0, "Large - Long": 0, 
            "Extra Large - Regular": 0, "Extra Large - Long": 0
        };
        renderSizeFormRows(ocpMap, true);
    });

    document.getElementById('preset-female')?.addEventListener('click', () => {
        const femaleMap = {
            "2R": 0, "4R": 0, "6R": 0, "8R": 0, 
            "10R": 0, "12R": 0, "14R": 0, "16R": 0, "18R": 0
        };
        renderSizeFormRows(femaleMap, true);
    });

    document.getElementById('preset-dress-shirts')?.addEventListener('click', () => {
        const shirtMap = {
            "14.5 / 32-33": 0, "15 / 32-33": 0, "15.5 / 32-33": 0, "15.5 / 34-35": 0,
            "16 / 32-33": 0, "16 / 34-35": 0, "16.5 / 34-35": 0, "17 / 34-35": 0
        };
        renderSizeFormRows(shirtMap, true);
    });
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
            inlineEditor?.classList.add('hidden');
            checkboxContainer?.classList.remove('hidden');
            if (labelToggle) labelToggle.textContent = 'Edit Category Names';
        } else {
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
                imgInput.value = ``;
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

    document.getElementById('admin-table-body')?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-action="edit-item"]');
        const adjustStockBtn = e.target.closest('[data-action="adjust-stock"]');
        const toggleVisBtn = e.target.closest('[data-action="toggle-visibility"]');
        const directIssueBtn = e.target.closest('[data-action="direct-issue-item"]');

        if (directIssueBtn) {
            const docId = directIssueBtn.dataset.docId;
            openDirectIssueModal(docId);
        } else if (editBtn) {
            openItemModal(editBtn.dataset.docId);
        } else if (adjustStockBtn) {
            const docId = adjustStockBtn.dataset.docId;
            const sizeKey = adjustStockBtn.dataset.sizeKey || "One Size";
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
        const deleteBtn = e.target.closest('[data-action="delete-request"]');

        if (confirmBtn) {
            const docId = confirmBtn.dataset.docId;
            try {
                await issueSupplyItem(docId);
                await refreshSupplyData();
                showToast("Item marked as ISSUED and logged to issues ledger!");
            } catch (err) {
                if (window.showAlert) {
                    window.showAlert("Failed to issue item", err.message, "error");
                }
            }
        } else if (deleteBtn) {
            const docId = deleteBtn.dataset.docId;
            const requestedSize = deleteBtn.dataset.requestedSize || "One Size";

            if (confirm("Are you sure you want to cancel and delete this order request?")) {
                try {
                    const item = (AppState.supply || []).find(i => (i.id || i.docId) === docId);
                    if (item) {
                        const stockMap = { ...(item.stock || { "One Size": 0 }) };
                        const currentQty = parseInt(stockMap[requestedSize] || 0, 10);
                        stockMap[requestedSize] = currentQty + 1;

                        await updateSupplyItem(docId, {
                            stock: stockMap,
                            status: "IN",
                            requestedByUid: null,
                            requestedByEmail: null,
                            requestedByName: null,
                            requestedPhone: null,
                            requestedSize: null,
                            requestedAt: null
                        });
                    }

                    await refreshSupplyData();
                    showToast("Order request canceled and stock returned.");
                } catch (err) {
                    console.error("Failed to cancel request:", err);
                    if (window.showAlert) {
                        window.showAlert("Failed to delete request", err.message, "error");
                    }
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

/* --- DIRECT ISSUE MODAL CONTROLLERS --- */
export async function openDirectIssueModal(itemId) {
    if (!itemId || itemId === 'undefined') {
        console.error("Direct Issue failed: Invalid or missing Item ID.");
        if (window.showAlert) window.showAlert("Issue Error", "Could not locate the document ID for this item.", "error");
        return;
    }

    activeDirectIssueItemId = itemId;
    const modal = document.getElementById('direct-issue-modal');
    const memberSelect = document.getElementById('direct-issue-member-select');
    const sizeSelect = document.getElementById('direct-issue-size-select');
    const titleEl = document.getElementById('direct-issue-item-title');

    // Find target item across AppState safely
    const item = (AppState.supply || []).find(i => (i.id || i.docId) === itemId);

    if (!item || !modal) {
        console.error(`Direct Issue failed: Item with ID ${itemId} not found in state.`);
        return;
    }

    if (titleEl) {
        titleEl.textContent = `${item.title || 'Untitled Item'} (${item.locationCode || 'N/A'})`;
    }

    const stockMap = item.stock || { "One Size": 0 };
    if (sizeSelect) {
        sizeSelect.innerHTML = Object.entries(stockMap)
            .map(([size, qty]) => `<option value="${size}" ${qty <= 0 ? 'disabled' : ''}>Size ${size} (${qty} available)</option>`)
            .join('');
    }

    try {
        const users = await getAllUsers();
        if (memberSelect) {
            if (!users || users.length === 0) {
                memberSelect.innerHTML = `<option value="">No members found</option>`;
            } else {
                memberSelect.innerHTML = `<option value="">-- Select Member --</option>` + 
                    users.map(u => {
                        const displayName = u.fullName || u.email || 'Unnamed Member';
                        const uId = u.id || u.uid;
                        return `<option value="${uId}" data-name="${displayName}" data-email="${u.email || ''}">${displayName}</option>`;
                    }).join('');
            }
        }
    } catch (err) {
        console.error("Failed to fetch member directory:", err);
        if (memberSelect) {
            memberSelect.innerHTML = `<option value="">Error loading members</option>`;
        }
    }

    modal.classList.remove('hidden');
}

function setupDirectIssueForm() {
    const modal = document.getElementById('direct-issue-modal');

    document.getElementById('btn-close-direct-issue-modal')?.addEventListener('click', closeItemModal);
    document.getElementById('btn-cancel-direct-issue-modal')?.addEventListener('click', closeItemModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeItemModal();
        });
    }

    const directIssueForm = document.getElementById('direct-issue-form');
    if (directIssueForm) {
        directIssueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeDirectIssueItemId) return;

            const memberSelect = document.getElementById('direct-issue-member-select');
            const selectedOption = memberSelect.options[memberSelect.selectedIndex];
            const sizeSelect = document.getElementById('direct-issue-size-select');
            const submitBtn = document.getElementById('btn-submit-direct-issue');

            if (!memberSelect.value) {
                if (window.showAlert) window.showAlert("Select Member", "Please select a member to receive gear.", "error");
                return;
            }

            const memberData = {
                uid: memberSelect.value,
                fullName: selectedOption.dataset.name,
                email: selectedOption.dataset.email
            };

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Issuing...`;
                }

                await issueSupplyItemToMember(activeDirectIssueItemId, memberData, sizeSelect.value);
                closeItemModal();
                await refreshSupplyData();
                showToast(`Successfully issued gear to ${memberData.fullName}!`);
            } catch (err) {
                console.error("Direct issue error:", err);
                if (window.showAlert) window.showAlert("Issue Failed", err.message, "error");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-check text-xs"></i> Confirm & Issue Gear`;
                }
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

    container.innerHTML = pending.map(item => {
        const targetId = item.id || item.docId;
        return `
            <tr class="border-b border-slate-100 hover:bg-amber-50/50 transition">
                <td class="p-2 font-mono font-bold text-slate-900">${item.locationCode || 'N/A'}</td>
                <td class="p-2 font-semibold text-slate-800">${item.title}</td>
                <td class="p-2 text-slate-700">${item.requestedByName || 'Member'}</td>
                <td class="p-2 font-mono text-xs">${item.requestedSize || 'One Size'}</td>
                <td class="p-2 text-right space-x-2">
                    <button data-action="confirm-issue" data-doc-id="${targetId}" class="bg-brand-600 hover:bg-brand-700 text-white font-bold px-3 py-1 rounded-lg text-xs transition shadow-sm">
                        <i class="fa-solid fa-hand-holding mr-1"></i> Hand Out & Issue
                    </button>
                    <button data-action="delete-request" data-doc-id="${targetId}" data-requested-size="${item.requestedSize || 'One Size'}" class="bg-red-500 hover:bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition shadow-sm" title="Cancel/Delete Request">
                        <i class="fa-solid fa-trash-can mr-1"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/* --- INLINE QUICK STOCK ADJUSTMENT --- */
async function quickAdjustItemStock(itemId, sizeKey, delta) {
    const item = (AppState.supply || []).find(i => (i.id || i.docId) === itemId);
    if (!item) return;

    const stockMap = { ...(item.stock || { "One Size": 0 }) };
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
        bodyContainer.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">No supply items found.</td></tr>`;
        return;
    }

    bodyContainer.innerHTML = filtered.map(item => {
        const itemId = item.id || item.docId;
        const stockMap = item.stock || { "One Size": 0 };
        const totalQty = Object.values(stockMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);
        const thumbSrc = item.image && item.image.trim() !== "" ? item.image : ``;
        const isHidden = item.hideFromCatalog === true || item.hideFromCatalog === 'true';
        const priceVal = parseFloat(item.price) || 0;

        const inlineStockControls = Object.entries(stockMap).map(([sz, qty]) => `
            <div class="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-mono mr-1 mb-1">
                <span class="font-bold text-slate-700">${sz}:</span>
                <span class="font-extrabold text-slate-900 mx-0.5">${qty}</span>
                <button data-action="adjust-stock" data-doc-id="${itemId}" data-size-key="${sz}" data-delta="-1" class="text-red-500 hover:text-red-700 hover:bg-slate-200 w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px]" title="Decrease 1">-</button>
                <button data-action="adjust-stock" data-doc-id="${itemId}" data-size-key="${sz}" data-delta="1" class="text-brand-600 hover:text-brand-800 hover:bg-slate-200 w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px]" title="Increase 1">+</button>
            </div>
        `).join('');

        let statusBadge = '';
        if (item.status === 'IN') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-100 text-brand-800">In Stock</span>`;
        } else if (item.status === 'REQUESTED') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">Requested</span>`;
        } else if (item.status === 'ISSUED') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Issued</span>`;
        } else if (item.status === 'VANGUARD') {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">Vanguard</span>`;
        } else {
            statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Out of Stock</span>`;
        }

        const visibilityBadge = isHidden 
            ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 inline-block">Unavailable</span>`
            : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 inline-block">Available</span>`;

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition ${isHidden ? 'bg-slate-50/60' : ''}">
                <td class="p-2 w-12">
                    <img src="${thumbSrc}" onerror="this.onerror=null; this.src='${CAP_FALLBACK_IMAGE}';" alt="" class="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-sm">
                </td>
                <td class="p-2.5 font-mono font-bold text-slate-900 text-xs">${item.locationCode || 'N/A'}</td>
                <td class="p-2.5 text-slate-600 text-xs">${item.location || 'Closet Slot'}</td>
                <td class="p-2.5 font-semibold text-slate-900 text-xs">
                    <div>${item.title || 'Untitled Item'}</div>
                </td>
                <td class="p-2.5 font-mono text-[11px] min-w-[180px]">
                    ${inlineStockControls} 
                    <div class="text-[10px] text-slate-400 font-sans mt-0.5">Total: <strong class="text-brand-600">${totalQty}</strong></div>
                </td>
                <td class="p-2.5">
                    <div class="flex flex-col items-start gap-1">
                        <div class="flex items-center gap-1.5">
                            ${statusBadge}
                            <span class="font-mono text-xs font-bold text-slate-700">$${priceVal.toFixed(2)}</span>
                        </div>
                        ${visibilityBadge}
                    </div>
                </td>
                <td class="p-2.5 text-right">
                    <div class="inline-flex items-center gap-1 justify-end">
                        ${item.vanguardUrl ? `<a href="${item.vanguardUrl}" target="_blank" class="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-amber-600 transition" title="View Vanguard Product"><i class="fa-solid fa-arrow-up-right-from-square text-xs"></i></a>` : ''}
                        
                        <button data-action="toggle-visibility" data-doc-id="${itemId}" data-current-hidden="${isHidden}" title="${isHidden ? 'Hidden from catalog' : 'Visible in catalog'}" class="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-200 text-slate-600 transition">
                            <i class="fa-solid ${isHidden ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
                        </button>
                        
                        <button data-action="direct-issue-item" data-doc-id="${itemId}" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg text-xs transition shadow-sm flex items-center gap-1">
                            <i class="fa-solid fa-hand-holding-hand text-xs"></i> Issue
                        </button>
                        
                        <button data-action="edit-item" data-doc-id="${itemId}" class="bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-bold px-2 py-1 rounded-lg border border-slate-200 text-xs transition flex items-center gap-1">
                            <i class="fa-solid fa-pen-to-square text-xs"></i> Edit
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/* --- MODAL CONTROLS & PARSING --- */
export function openItemModal(targetDocId = null) {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    document.getElementById('category-inline-editor')?.classList.add('hidden');
    document.getElementById('category-checkboxes-container')?.classList.remove('hidden');
    const labelToggle = document.getElementById('label-cat-edit-toggle');
    if (labelToggle) labelToggle.textContent = 'Edit Category Names';

    const item = (AppState.supply || []).find(i => (i.id || i.docId) === targetDocId);
    const imgPreview = document.getElementById('modal-image-preview');
    const hideCheckbox = document.getElementById('form-hide-from-catalog');

    if (targetDocId && item) {
        document.getElementById('modal-title').textContent = 'Edit Supply Item';
        document.getElementById('form-doc-id').value = item.id || item.docId;
        document.getElementById('form-location-code').value = item.locationCode || '';
        document.getElementById('form-location').value = item.location || '';
        document.getElementById('form-title').value = item.title || '';
        document.getElementById('form-price').value = item.price || '';

        renderCategoryCheckboxes(item.categories || [item.category].filter(Boolean));
        renderSizeFormRows(item.stock || { "One Size": 0 });

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
        renderSizeFormRows({ "One Size": 1 });
        if (hideCheckbox) hideCheckbox.checked = false;
        if (imgPreview) imgPreview.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

export function closeItemModal() {
    document.getElementById('item-modal')?.classList.add('hidden');
    document.getElementById('direct-issue-modal')?.classList.add('hidden');
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

    const stockMap = getStockMapFromFormRows();
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
        image: document.getElementById('form-image-path').value || ``,
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
            stockMap = { "One Size": parseInt(item.qty, 10) || 0 };
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