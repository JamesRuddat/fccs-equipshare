// /js/return.js - Enhanced Return & Item Inspection Console
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { getAllIssuedEquipment, checkinSupplyItem } from '/js/firebase-db.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth(async (user) => {
        AppState.currentUser = user;
        window.dispatchEvent(new CustomEvent('user-state-changed'));
        setupEventListeners();
        await loadOutstandingSupply();
    });
});

/**
 * Loads active issued records from the `issues` collection
 */
async function loadOutstandingSupply() {
    try {
        const items = await getAllIssuedEquipment();
        AppState.issuedItems = items || [];
        renderReturnList();
    } catch (err) {
        console.error("Failed to load issued equipment:", err);
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

    document.getElementById('btn-close-inspect-modal')?.addEventListener('click', closeInspectModal);
    document.getElementById('btn-cancel-inspect-modal')?.addEventListener('click', closeInspectModal);

    document.getElementById('checkin-inspect-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleInspectionSubmit();
    });

    document.getElementById('btn-clear-member-filter')?.addEventListener('click', () => {
        const searchInput = document.getElementById('return-search-input');
        if (searchInput) searchInput.value = '';
        document.getElementById('member-summary-card')?.classList.add('hidden');
        renderReturnList();
    });

    document.getElementById('return-items-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="open-check-in"]');
        if (btn) {
            const issueId = btn.dataset.issueId;
            openInspectModal(issueId);
        }
    });
}

function renderReturnList(filterQuery = '') {
    const container = document.getElementById('return-items-list');
    const badge = document.getElementById('checked-out-count-badge');

    const outstandingItems = AppState.issuedItems || [];
    if (badge) badge.textContent = `${outstandingItems.length} Outstanding`;

    if (!container) return;

    const filteredItems = outstandingItems.filter(item => {
        if (!filterQuery) return true;
        const matchTitle = (item.title || '').toLowerCase().includes(filterQuery);
        const matchCode = (item.locationCode || '').toLowerCase().includes(filterQuery);
        const matchMember = (
            item.issuedToName || item.issuedToEmail || ''
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
        const memberName = item.issuedToName || 'Member / Unassigned';
        const memberEmail = item.issuedToEmail || 'N/A';
        const sizeOut = item.size || 'OS';

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="p-3 font-mono font-bold text-brand-600">${item.locationCode || 'N/A'}</td>
                <td class="p-3 font-bold text-slate-900">${item.title || 'Untitled Item'}</td>
                <td class="p-3 font-mono text-xs">
                    <span class="font-extrabold text-slate-900">1x</span> 
                    <span class="text-slate-500">(${sizeOut})</span>
                </td>
                <td class="p-3 text-slate-600">
                    <div class="font-semibold text-slate-800">${memberName}</div>
                    <div class="text-[11px] text-slate-400">${memberEmail}</div>
                </td>
                <td class="p-3">
                    <span class="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded">Issued Out</span>
                </td>
                <td class="p-3 text-right">
                    <button data-action="open-check-in" data-issue-id="${item.id}" class="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ml-auto shadow-sm">
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

    const firstItem = matchingItems.find(i => i.issuedToName);

    if (queryText && firstItem) {
        const memberName = firstItem.issuedToName || 'Member';
        const memberEmail = firstItem.issuedToEmail || 'N/A';

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

function openInspectModal(issueRecordId) {
    const item = (AppState.issuedItems || []).find(i => i.id === issueRecordId);
    if (!item) return;

    const memberName = item.issuedToName || 'Member';
    const memberEmail = item.issuedToEmail || 'N/A';
    const sizeOut = item.size || 'OS';

    document.getElementById('inspect-item-id').value = item.supplyItemId || '';
    document.getElementById('inspect-location-code').value = issueRecordId; // Store issue doc ID here
    document.getElementById('inspect-tag-display').textContent = item.locationCode || 'N/A';
    document.getElementById('inspect-title-display').textContent = item.title || 'Untitled Item';
    document.getElementById('inspect-member-display').textContent = `Issued to: ${memberName} (${memberEmail})`;

    document.getElementById('inspect-returned-size').value = sizeOut;

    const qtyInput = document.getElementById('inspect-quantity');
    if (qtyInput) {
        qtyInput.value = 1;
        qtyInput.max = 1;
    }

    document.getElementById('checkin-inspect-modal')?.classList.remove('hidden');
}

function closeInspectModal() {
    document.getElementById('checkin-inspect-modal')?.classList.add('hidden');
}

async function handleInspectionSubmit() {
    const supplyItemId = document.getElementById('inspect-item-id').value;
    const issueRecordId = document.getElementById('inspect-location-code').value;
    const size = document.getElementById('inspect-returned-size').value || 'OS';
    const qty = parseInt(document.getElementById('inspect-quantity').value, 10) || 1;

    try {
        await checkinSupplyItem(issueRecordId, supplyItemId, size, qty);
        await loadOutstandingSupply();
        closeInspectModal();
        showToast(`Item (${qty}x ${size}) checked back into inventory!`);
    } catch (err) {
        console.error("Failed to check in item:", err);
        if (window.showAlert) window.showAlert("Check-in failed", err.message, "error");
    }
}