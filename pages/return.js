// /js/return.js - Enhanced Return & Item Inspection Console with Quantities & Stock History
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { getSupplyItems, checkinSupplyItem } from '/js/firebase-db.js';

document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    setupEventListeners();
    await loadOutstandingSupply();
});

/**
 * Loads inventory items from Firestore and populates the return list
 */
async function loadOutstandingSupply() {
    try {
        const items = await getSupplyItems();
        AppState.supply = items || [];
        renderReturnList();
    } catch (err) {
        console.error("Failed to load supply for return:", err);
        showToast("Error loading outstanding items.");
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('return-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderReturnList(searchInput.value.trim().toLowerCase());
        });
    }

    // Modal Close handlers
    document.getElementById('btn-close-inspect-modal')?.addEventListener('click', closeInspectModal);
    document.getElementById('btn-cancel-inspect-modal')?.addEventListener('click', closeInspectModal);

    // Form Submit Handler
    document.getElementById('checkin-inspect-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleInspectionSubmit();
    });

    // Clear Member Filter Button
    document.getElementById('btn-clear-member-filter')?.addEventListener('click', () => {
        const searchInput = document.getElementById('return-search-input');
        if (searchInput) searchInput.value = '';
        document.getElementById('member-summary-card')?.classList.add('hidden');
        renderReturnList();
    });

    // Event Delegation for Check In Button Trigger
    document.getElementById('return-items-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="open-check-in"]');
        if (btn) {
            const itemId = btn.dataset.itemId;
            openInspectModal(itemId);
        }
    });
}

function renderReturnList(filterQuery = '') {
    const container = document.getElementById('return-items-list');
    const badge = document.getElementById('checked-out-count-badge');

    // Filter items with ISSUED or REQUESTED status
    const outstandingItems = (AppState.supply || []).filter(i => i.status === 'ISSUED' || i.status === 'REQUESTED' || i.status === 'OUT');
    if (badge) badge.textContent = `${outstandingItems.length} Outstanding`;

    if (!container) return;

    const filteredItems = outstandingItems.filter(item => {
        if (!filterQuery) return true;
        const matchTitle = (item.title || '').toLowerCase().includes(filterQuery);
        const matchCode = (item.locationCode || '').toLowerCase().includes(filterQuery);
        const matchMember = (
            item.lastIssuedToName || item.lastIssuedToEmail || 
            item.requestedByName || item.requestedByEmail || ''
        ).toLowerCase().includes(filterQuery);
        return matchTitle || matchCode || matchMember;
    });

    updateMemberCardSummary(filterQuery, filteredItems);

    if (filteredItems.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="p-6 text-center text-slate-400">
                    ${outstandingItems.length === 0 ? 'All supply items are currently checked into closet stock!' : 'No outstanding items match search criteria.'}
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = filteredItems.map(item => {
        const memberName = item.lastIssuedToName || item.requestedByName || 'Member';
        const memberEmail = item.lastIssuedToEmail || item.requestedByEmail || 'N/A';
        const qtyOut = item.issuedQuantity || item.requestedQuantity || 1;
        const sizeOut = item.issuedSize || item.requestedSize || 'OS';

        // History / Vanguard status check
        const isVanguardOnly = item.status === 'VANGUARD' || item.isVanguardOnly;
        const historyBadge = isVanguardOnly 
            ? `<span class="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">Vanguard Only</span>`
            : `<span class="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">In Unit Closet</span>`;

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="p-3 font-mono font-bold text-brand-600">${item.locationCode || 'N/A'}</td>
                <td class="p-3 font-bold text-slate-900">${item.title || 'Untitled Item'}</td>
                <td class="p-3 font-mono text-xs">
                    <span class="font-extrabold text-slate-900">${qtyOut}x</span> 
                    <span class="text-slate-500">(${sizeOut})</span>
                </td>
                <td class="p-3 text-slate-600">
                    <div class="font-semibold text-slate-800">${memberName}</div>
                    <div class="text-[11px] text-slate-400">${memberEmail}</div>
                </td>
                <td class="p-3">${historyBadge}</td>
                <td class="p-3 text-right">
                    <button data-action="open-check-in" data-item-id="${item.id}" class="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ml-auto shadow-sm">
                        <i class="fa-solid fa-arrow-down-to-bracket"></i> Check In
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateMemberCardSummary(queryText, matchingItems) {
    const memberCard = document.getElementById('member-summary-card');
    if (!memberCard) return;

    const firstItem = matchingItems.find(i => i.lastIssuedToName || i.requestedByName);

    if (queryText && firstItem) {
        const memberName = firstItem.lastIssuedToName || firstItem.requestedByName;
        const memberEmail = firstItem.lastIssuedToEmail || firstItem.requestedByEmail || 'N/A';

        let totalLiability = 0;
        matchingItems.forEach(i => totalLiability += (parseFloat(i.price) || 0));

        document.getElementById('member-card-name').textContent = memberName;
        document.getElementById('member-card-email').textContent = memberEmail;
        document.getElementById('member-card-liability').textContent = `$${totalLiability.toFixed(2)} Owed`;
        memberCard.classList.remove('hidden');
    } else {
        memberCard.classList.add('hidden');
    }
}

function openInspectModal(itemId) {
    const item = (AppState.supply || []).find(i => i.id === itemId);
    if (!item) return;

    const memberName = item.lastIssuedToName || item.requestedByName || 'Member';
    const memberEmail = item.lastIssuedToEmail || item.requestedByEmail || 'N/A';
    const sizeOut = item.issuedSize || item.requestedSize || 'OS';
    const qtyOut = item.issuedQuantity || item.requestedQuantity || 1;

    document.getElementById('inspect-item-id').value = item.id;
    document.getElementById('inspect-location-code').value = item.locationCode || '';
    document.getElementById('inspect-tag-display').textContent = item.locationCode || 'N/A';
    document.getElementById('inspect-title-display').textContent = item.title || 'Untitled Item';
    document.getElementById('inspect-member-display').textContent = `Issued to: ${memberName} (${memberEmail})`;
    
    document.getElementById('inspect-returned-size').value = sizeOut;
    
    const qtyInput = document.getElementById('inspect-quantity');
    if (qtyInput) {
        qtyInput.value = qtyOut;
        qtyInput.max = qtyOut;
    }

    const vanguardBadge = document.getElementById('inspect-vanguard-badge');
    if (vanguardBadge) {
        if (item.status === 'VANGUARD' || item.isVanguardOnly) {
            vanguardBadge.textContent = "Vanguard Only - Never Stocked";
            vanguardBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800";
        } else {
            vanguardBadge.textContent = "In Unit Inventory";
            vanguardBadge.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800";
        }
    }

    document.getElementById('checkin-inspect-modal')?.classList.remove('hidden');
}

function closeInspectModal() {
    document.getElementById('checkin-inspect-modal')?.classList.add('hidden');
}

async function handleInspectionSubmit() {
    const itemId = document.getElementById('inspect-item-id').value;
    const locationCode = document.getElementById('inspect-location-code').value;
    const size = document.getElementById('inspect-returned-size').value || 'OS';
    const qty = parseInt(document.getElementById('inspect-quantity').value, 10) || 1;

    if (!itemId) return;

    try {
        await checkinSupplyItem(itemId, size, qty);
        await loadOutstandingSupply();
        closeInspectModal();
        showToast(`Slot ${locationCode} (${qty}x ${size}) checked back into inventory!`);
    } catch (err) {
        console.error("Failed to check in item:", err);
        alert("Check-in failed: " + err.message);
    }
}