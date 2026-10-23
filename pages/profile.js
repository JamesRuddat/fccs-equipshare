import { getIssuedItemsForMember } from '/js/firebase-db.js';

async function loadMemberProfile(user) {
    if (!user) return;

    // Fetch items assigned to this member
    const issuedEquipment = await getIssuedItemsForMember(user.uid, user.email);

    // Update counter header: "Issued Equipment (X)"
    const countBadge = document.getElementById('issued-equipment-count');
    if (countBadge) {
        countBadge.textContent = `Issued Equipment (${issuedEquipment.length})`;
    }

    // Render list/table of issued property
    const container = document.getElementById('issued-equipment-list');
    if (!container) return;

    if (issuedEquipment.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-xs py-3">No property currently on issue.</p>`;
        return;
    }

    container.innerHTML = issuedEquipment.map(item => `
        <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl mb-2">
            <div>
                <span class="font-mono text-xs font-bold text-slate-900">${item.locationCode || 'N/A'}</span>
                <h4 class="font-bold text-sm text-slate-800">${item.title}</h4>
                <span class="text-xs font-mono text-slate-500">Size: ${item.size || item.requestedSize || 'OS'}</span>
            </div>
            <span class="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-100 text-indigo-800">ISSUED</span>
        </div>
    `).join('');
}