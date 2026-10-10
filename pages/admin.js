// /js/admin.js - Unified Administration, Directory, Supply Console & Pending Orders Manager
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { 
    getSupplyItems, 
    createSupplyItem, 
    updateSupplyItem, 
    issueSupplyItem,
    getAllUsers, 
    updateUserRoleInDB 
} from '/js/firebase-db.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth(async (user) => {
        AppState.currentUser = user;
        await refreshAllData();
    });

    setupTabNavigation();
    setupAdminFilters();
    setupMemberModalHandlers();
    setupImageUploadListeners();

    refreshAllData();
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
async function refreshAllData() {
    try {
        const [supply, users] = await Promise.all([
            getSupplyItems().catch(() => []),
            getAllUsers().catch(() => [])
        ]);

        AppState.supply = supply || [];
        AppState.membersList = users || [];

        renderPendingOrdersQueue();
        renderAdminTable();
        renderMembersGrid();
        renderUserRolesTable(AppState.membersList);
    } catch (err) {
        console.error("Error refreshing admin data:", err);
    }
}

/* --- TAB SWITCHING LOGIC --- */
function setupTabNavigation() {
    const tabs = [
        { btn: document.getElementById('tab-btn-supply'), content: document.getElementById('tab-content-supply') },
        { btn: document.getElementById('tab-btn-members'), content: document.getElementById('tab-content-members') },
        { btn: document.getElementById('tab-btn-roles'), content: document.getElementById('tab-content-roles') }
    ];

    tabs.forEach(({ btn, content }) => {
        if (!btn || !content) return;
        btn.addEventListener('click', () => {
            tabs.forEach(t => {
                t.btn?.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
                t.btn?.classList.add('text-slate-600');
                t.content?.classList.add('hidden');
            });
            btn.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
            btn.classList.remove('text-slate-600');
            content.classList.remove('hidden');
        });
    });
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

    const itemForm = document.getElementById('item-form');
    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleItemFormSubmit();
        });
    }

    document.getElementById('btn-close-item-modal')?.addEventListener('click', closeItemModal);
    document.getElementById('btn-cancel-item-modal')?.addEventListener('click', closeItemModal);

    // Event delegation for Supply Table (Inline Stock Adjustments & Edits)
    document.getElementById('admin-table-body')?.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-action="edit-item"]');
        const adjustStockBtn = e.target.closest('[data-action="adjust-stock"]');

        if (editBtn) {
            openItemModal(editBtn.dataset.docId || editBtn.dataset.locationCode);
        } else if (adjustStockBtn) {
            const docId = adjustStockBtn.dataset.docId;
            const sizeKey = adjustStockBtn.dataset.sizeKey || "OS";
            const delta = parseInt(adjustStockBtn.dataset.delta, 10) || 0;
            await quickAdjustItemStock(docId, sizeKey, delta);
        }
    });

    // Event delegation for Pending Member Orders Queue
    document.getElementById('pending-orders-table-body')?.addEventListener('click', async (e) => {
        const confirmBtn = e.target.closest('[data-action="confirm-issue"]');
        if (confirmBtn) {
            const docId = confirmBtn.dataset.docId;
            try {
                await issueSupplyItem(docId);
                await refreshAllData();
                showToast("Item marked as ISSUED and handed out!");
            } catch (err) {
                alert("Failed to issue item: " + err.message);
            }
        }
    });

    // Bulk Import Modal Handlers
    const bulkModal = document.getElementById('bulk-import-modal');
    const btnOpenBulk = document.getElementById('btn-open-bulk-import');
    const btnCloseBulk = document.getElementById('btn-close-bulk-modal');
    const btnCancelBulk = document.getElementById('btn-cancel-bulk-modal');
    const btnRunBulk = document.getElementById('btn-run-bulk-import');
    const btnSampleData = document.getElementById('btn-load-sample-data');

    if (btnOpenBulk) btnOpenBulk.addEventListener('click', () => bulkModal?.classList.remove('hidden'));
    if (btnCloseBulk) btnCloseBulk.addEventListener('click', () => bulkModal?.classList.add('hidden'));
    if (btnCancelBulk) btnCancelBulk.addEventListener('click', () => bulkModal?.classList.add('hidden'));

    if (btnSampleData) {
        btnSampleData.addEventListener('click', () => {
            const textarea = document.getElementById('bulk-import-textarea');
            if (textarea) textarea.value = JSON.stringify(SAMPLE_INVENTORY_ARRAY, null, 2);
        });
    }

    if (btnRunBulk) {
        btnRunBulk.addEventListener('click', async () => {
            const rawCode = document.getElementById('bulk-import-textarea')?.value;
            if (!rawCode || !rawCode.trim()) {
                alert("Please paste a JavaScript or JSON inventory array first.");
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
                await refreshAllData();
            } catch (err) {
                console.error("Bulk import parsing failed:", err);
                alert("Import failed: " + err.message);
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
        await refreshAllData();
        showToast(`Updated ${item.title} (${sizeKey}: ${newQty})`);
    } catch (err) {
        console.error("Stock adjustment failed:", err);
        alert("Could not update stock: " + err.message);
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
        const stockMap = item.stock || { "OS": 1 };
        const totalQty = Object.values(stockMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);
        const thumbSrc = item.image && item.image.trim() !== "" ? item.image : `/images/products/${item.locationCode || 'placeholder'}.jpg`;

        const inlineStockControls = Object.entries(stockMap).map(([sz, qty]) => `
            <div class="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-mono mr-1 mb-1">
                <span class="font-bold text-slate-700">${sz}:</span>
                <span class="font-extrabold text-slate-900 mx-1">${qty}</span>
                <button data-action="adjust-stock" data-doc-id="${item.id}" data-size-key="${sz}" data-delta="-1" class="text-red-500 hover:text-red-700 hover:bg-slate-200 w-4 h-4 rounded flex items-center justify-center font-bold" title="Decrease 1">-</button>
                <button data-action="adjust-stock" data-doc-id="${item.id}" data-size-key="${sz}" data-delta="1" class="text-brand-600 hover:text-brand-800 hover:bg-slate-200 w-4 h-4 rounded flex items-center justify-center font-bold" title="Increase 1">+</button>
            </div>
        `).join('');

        // Dynamic Status Badge
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

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="p-2 w-12">
                    <img src="${thumbSrc}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=100';" alt="" class="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-sm">
                </td>
                <td class="p-3 font-mono font-bold text-slate-900">${item.locationCode || 'N/A'}</td>
                <td class="p-3 text-slate-600">${item.location || 'Closet Slot'}</td>
                <td class="p-3 font-semibold text-slate-900">${item.title || 'Untitled Item'}</td>
                <td class="p-3 font-mono font-bold text-slate-900">$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                <td class="p-3 text-slate-500">${Array.isArray(item.categories) ? item.categories.join(', ') : 'General'}</td>
                <td class="p-3 font-mono text-[11px] min-w-[200px]">${inlineStockControls} <div class="text-[10px] text-slate-400 font-sans mt-0.5">Total: <strong class="text-brand-600">${totalQty}</strong></div></td>
                <td class="p-3">${statusBadge}</td>
                <td class="p-3">
                    ${item.vanguardUrl ? `<a href="${item.vanguardUrl}" target="_blank" class="text-amber-600 font-bold hover:underline">Vanguard</a>` : '<span class="text-slate-400">N/A</span>'}
                </td>
                <td class="p-3 text-right">
                    <button data-action="edit-item" data-doc-id="${item.id}" data-location-code="${item.locationCode}" class="bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-xs transition">
                        <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/* --- MODAL CONTROLS & PARSING --- */
export function openItemModal(targetIdOrCode = null) {
    const modal = document.getElementById('item-modal');
    if (!modal) return;

    const item = (AppState.supply || []).find(i => i.id === targetIdOrCode || String(i.locationCode).toUpperCase() === String(targetIdOrCode).toUpperCase());
    const imgPreview = document.getElementById('modal-image-preview');

    if (targetIdOrCode && item) {
        document.getElementById('modal-title').textContent = 'Edit Supply Item';
        document.getElementById('form-doc-id').value = item.id;
        document.getElementById('form-location-code').value = item.locationCode || '';
        document.getElementById('form-location').value = item.location || '';
        document.getElementById('form-title').value = item.title || '';
        document.getElementById('form-price').value = item.price || '';
        document.getElementById('form-categories').value = Array.isArray(item.categories) ? item.categories.join(', ') : '';

        const stockMap = item.stock || { "OS": 1 };
        if (item.isOneSize || (Object.keys(stockMap).length === 1 && Object.keys(stockMap)[0] === "OS")) {
            document.getElementById('form-sizes').value = stockMap["OS"] ?? 1;
        } else {
            document.getElementById('form-sizes').value = Object.entries(stockMap)
                .map(([sz, qty]) => `${sz}: ${qty}`)
                .join(', ');
        }

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
        if (imgPreview) imgPreview.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

export function closeItemModal() {
    document.getElementById('item-modal')?.classList.add('hidden');
}

function parseStockFromInput(inputStr) {
    if (!inputStr || !inputStr.trim()) return { "OS": 1 };

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
            if (cleanSize) stockMap[cleanSize] = !isNaN(cleanQty) && cleanQty >= 0 ? cleanQty : 1;
        } else {
            const cleanSize = part.trim().toUpperCase();
            if (cleanSize) stockMap[cleanSize] = 1;
        }
    });

    return Object.keys(stockMap).length > 0 ? stockMap : { "OS": 1 };
}

async function handleItemFormSubmit() {
    const docId = document.getElementById('form-doc-id').value;
    const rawTag = document.getElementById('form-location-code').value;
    const formattedTag = formatLocationCode(rawTag);
    document.getElementById('form-location-code').value = formattedTag;

    if (!isValidLocationCode(formattedTag)) {
        alert("Invalid Location Tag format! Please use 2 letters followed by 2 numbers (e.g. AA-00 or A1-04).");
        document.getElementById('form-location-code').focus();
        return;
    }

    const stockInputRaw = document.getElementById('form-sizes').value;
    const stockMap = parseStockFromInput(stockInputRaw);

    const itemData = {
        locationCode: formattedTag,
        location: document.getElementById('form-location').value,
        title: document.getElementById('form-title').value,
        price: parseFloat(document.getElementById('form-price').value) || 0,
        categories: document.getElementById('form-categories').value,
        stock: stockMap,
        image: document.getElementById('form-image-path').value || `/images/products/${formattedTag}.jpg`,
        vanguardUrl: document.getElementById('form-vanguard-url').value
    };

    try {
        if (docId) {
            await updateSupplyItem(docId, itemData);
        } else {
            await createSupplyItem(itemData);
        }
        await refreshAllData();
        closeItemModal();
    } catch (err) {
        alert("Failed to save item: " + err.message);
    }
}

/* --- MEMBER DIRECTORY & USER ROLES --- */
/* --- MEMBER DIRECTORY & RESPONSIBILITY LOGIC --- */
export function renderMembersGrid() {
    const container = document.getElementById('members-grid');
    if (!container) return;

    const members = AppState.membersList || [];

    if (members.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200">
                <i class="fa-solid fa-users text-4xl text-slate-300 mb-2"></i>
                <p class="text-sm font-semibold text-slate-600">No members found in directory.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = members.map(member => {
        const memberEmail = (member.email || '').toLowerCase().trim();
        const memberName = member.fullName || '';
        const memberUid = member.uid || member.id;

        // 1. Items currently ISSUED (on active loan to this member)
        const issuedItems = (AppState.supply || []).filter(item => 
            item.status === 'ISSUED' && (
                (memberUid && item.lastIssuedToUid === memberUid) ||
                (memberEmail && item.lastIssuedToEmail === memberEmail) ||
                (memberName && item.lastIssuedToName === memberName)
            )
        );

        // 2. Items REQUESTED (pending pickup at supply desk)
        const requestedItems = (AppState.supply || []).filter(item => 
            item.status === 'REQUESTED' && (
                (memberUid && item.requestedByUid === memberUid) ||
                (memberEmail && item.requestedByEmail === memberEmail) ||
                (memberName && item.requestedByName === memberName)
            )
        );

        // Calculate total monetary liability for issued property
        const totalValueOwed = issuedItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

        // Render Issued Items list HTML
        const issuedItemsHtml = issuedItems.length > 0 ? issuedItems.map(item => `
            <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                <div class="truncate pr-2">
                    <span class="font-mono font-bold text-slate-900 mr-1">[${item.locationCode || 'N/A'}]</span>
                    <span class="text-slate-700 font-medium">${item.title}</span>
                </div>
                <span class="font-mono text-slate-500 font-semibold">$${(parseFloat(item.price) || 0).toFixed(2)}</span>
            </div>
        `).join('') : `<p class="text-[11px] text-slate-400 italic py-1">No property currently on issue.</p>`;

        // Render Requested Items list HTML
        const requestedItemsHtml = requestedItems.length > 0 ? requestedItems.map(item => `
            <div class="flex items-center justify-between text-xs py-1 border-b border-amber-100/60 bg-amber-50/50 px-2 rounded">
                <div class="truncate pr-2">
                    <span class="font-mono font-bold text-amber-800 mr-1">[${item.locationCode || 'N/A'}]</span>
                    <span class="text-amber-900 font-medium">${item.title}</span>
                </div>
                <span class="text-[10px] font-bold uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Pending</span>
            </div>
        `).join('') : '';

        return `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between space-y-4">
                <div class="space-y-3">
                    <!-- Member Header -->
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 font-extrabold flex items-center justify-center text-sm shadow-inner">
                            ${(memberName || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-900 text-sm leading-tight">${memberName || 'Unnamed Member'}</h3>
                            <span class="inline-block text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md mt-0.5">
                                ${(member.role || 'member').replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>

                    <!-- Contact Details -->
                    <div class="text-xs space-y-1 text-slate-500 pt-1 border-t border-slate-100">
                        <div><i class="fa-regular fa-envelope mr-1.5 text-slate-400"></i>${member.email || 'N/A'}</div>
                        <div><i class="fa-solid fa-phone mr-1.5 text-slate-400"></i>${member.phone || 'N/A'}</div>
                    </div>

                    <!-- Pending Pickup Requests Section -->
                    ${requestedItems.length > 0 ? `
                        <div class="space-y-1 pt-2">
                            <div class="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                <i class="fa-solid fa-clock"></i> Pending Pickup Orders (${requestedItems.length})
                            </div>
                            <div class="space-y-1">
                                ${requestedItemsHtml}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Issued Equipment Breakdown -->
                    <div class="space-y-1 pt-2">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <i class="fa-solid fa-boxes-packing text-brand-600"></i> Issued Equipment (${issuedItems.length})
                        </div>
                        <div class="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                            ${issuedItemsHtml}
                        </div>
                    </div>
                </div>

                <!-- Financial Liability Footer -->
                <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between mt-2">
                    <div>
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Property On Loan</div>
                        <div class="text-xs font-extrabold text-slate-800">${issuedItems.length} Items</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Replacement Liability</div>
                        <div class="text-sm font-extrabold ${totalValueOwed > 0 ? 'text-amber-600' : 'text-slate-600'}">
                            $${totalValueOwed.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setupMemberModalHandlers() {
    document.getElementById('btn-add-member')?.addEventListener('click', () => {
        let modal = document.getElementById('new-member-modal');
        if (!modal) {
            modal = createMemberModalElement();
            document.body.appendChild(modal);
        }
        modal.classList.remove('hidden');
    });
}

function renderUserRolesTable(users) {
    const container = document.getElementById('user-roles-list');
    if (!container) return;

    container.innerHTML = (users || []).map(user => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="p-3 font-bold text-slate-900">${user.fullName || 'N/A'}</td>
            <td class="p-3 text-slate-600">${user.email || 'N/A'}</td>
            <td class="p-3 text-slate-600">${user.phone || 'N/A'}</td>
            <td class="p-3">
                <select data-action="update-user-role" data-uid="${user.uid || user.id}" class="p-1 border border-slate-300 rounded text-xs bg-white font-medium">
                    <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                    <option value="cadet_supply_officer" ${user.role === 'cadet_supply_officer' ? 'selected' : ''}>Cadet Supply Officer</option>
                    <option value="supply_officer" ${user.role === 'supply_officer' ? 'selected' : ''}>Senior Supply Officer</option>
                    <option value="cadet_commander" ${user.role === 'cadet_commander' ? 'selected' : ''}>Cadet Commander</option>
                    <option value="squadron_commander" ${user.role === 'squadron_commander' ? 'selected' : ''}>Squadron Commander</option>
                </select>
            </td>
            <td class="p-3 text-slate-400 text-[11px]">Synced with Auth</td>
        </tr>
    `).join('');
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
    } else {
        alert(`Successfully imported ${successCount} items into Firestore!`);
    }
}