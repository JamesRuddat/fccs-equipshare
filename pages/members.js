// /pages/members.js - Combined Member Directory, Liabilities & Role Access Manager (Optimized)
import { ROLES } from '/js/roles.js';
import { AppState, showToast } from '/js/state.js';
import { initAuth } from '/js/auth.js';
import { 
    getSupplyItems, 
    getAllUsers, 
    updateUserRoleInDB 
} from '/js/firebase-db.js';

document.addEventListener('DOMContentLoaded', () => {
    initAuth(async (user) => {
        AppState.currentUser = user;
        await refreshMembersData();
    });

    setupTabSwitcher();
    setupMemberModalHandlers();
    setupRoleChangeListeners();

    refreshMembersData();
});

/* --- DATA SYNCHRONIZATION --- */
async function refreshMembersData() {
    try {
        const [supply, users] = await Promise.all([
            getSupplyItems().catch(() => []),
            getAllUsers().catch(() => [])
        ]);

        AppState.supply = supply || [];
        AppState.membersList = users || [];

        // Render both views in a single pass
        renderMembersGrid();
        renderUserRolesTable(AppState.membersList);
    } catch (err) {
        console.error("Error loading members and roles data:", err);
    }
}

/* --- TAB SWITCHER LOGIC --- */
function setupTabSwitcher() {
    const btnMembers = document.getElementById('btn-show-members');
    const btnRoles = document.getElementById('btn-show-roles');
    const viewMembers = document.getElementById('view-members');
    const viewRoles = document.getElementById('view-roles');

    btnMembers?.addEventListener('click', () => {
        btnMembers.className = "flex-1 md:flex-initial px-4 py-2 rounded-lg bg-white text-slate-900 shadow-sm transition text-center font-bold";
        btnRoles.className = "flex-1 md:flex-initial px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition text-center font-bold";

        viewMembers?.classList.remove('hidden');
        viewRoles?.classList.add('hidden');
    });

    btnRoles?.addEventListener('click', () => {
        btnRoles.className = "flex-1 md:flex-initial px-4 py-2 rounded-lg bg-white text-slate-900 shadow-sm transition text-center font-bold";
        btnMembers.className = "flex-1 md:flex-initial px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition text-center font-bold";

        viewRoles?.classList.remove('hidden');
        viewMembers?.classList.add('hidden');
    });
}

/* --- OPTIMIZED MEMBER CARDS & LIABILITIES RENDERING --- */
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

    // 1-PASS LOOKUP INDEX: Pre-group supply items by member keys (O(N) time complexity)
    const issuedMap = new Map();
    const requestedMap = new Map();

    (AppState.supply || []).forEach(item => {
        if (item.status === 'ISSUED') {
            [item.lastIssuedToUid, (item.lastIssuedToEmail || '').toLowerCase().trim(), item.lastIssuedToName]
                .filter(Boolean)
                .forEach(key => {
                    if (!issuedMap.has(key)) issuedMap.set(key, []);
                    if (!issuedMap.get(key).includes(item)) issuedMap.get(key).push(item);
                });
        } else if (item.status === 'REQUESTED') {
            [item.requestedByUid, (item.requestedByEmail || '').toLowerCase().trim(), item.requestedByName]
                .filter(Boolean)
                .forEach(key => {
                    if (!requestedMap.has(key)) requestedMap.set(key, []);
                    if (!requestedMap.get(key).includes(item)) requestedMap.get(key).push(item);
                });
        }
    });

    // RENDER GRID FROM PRE-INDEXED LOOKUP MAPS
    container.innerHTML = members.map(member => {
        const memberEmail = (member.email || '').toLowerCase().trim();
        const memberName = member.fullName || '';
        const memberUid = member.uid || member.id;

        // O(1) Map Lookups instead of O(N) array filtering
        const issuedItems = issuedMap.get(memberUid) || issuedMap.get(memberEmail) || issuedMap.get(memberName) || [];
        const requestedItems = requestedMap.get(memberUid) || requestedMap.get(memberEmail) || requestedMap.get(memberName) || [];

        const totalValueOwed = issuedItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

        const issuedItemsHtml = issuedItems.length > 0 ? issuedItems.map(item => `
            <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                <div class="truncate pr-2">
                    <span class="font-mono font-bold text-slate-900 mr-1">[${item.locationCode || 'N/A'}]</span>
                    <span class="text-slate-700 font-medium">${item.title}</span>
                </div>
                <span class="font-mono text-slate-500 font-semibold">$${(parseFloat(item.price) || 0).toFixed(2)}</span>
            </div>
        `).join('') : `<p class="text-[11px] text-slate-400 italic py-1">No property currently on issue.</p>`;

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

                    <div class="text-xs space-y-1 text-slate-500 pt-1 border-t border-slate-100">
                        <div><i class="fa-regular fa-envelope mr-1.5 text-slate-400"></i>${member.email || 'N/A'}</div>
                        <div><i class="fa-solid fa-phone mr-1.5 text-slate-400"></i>${member.phone || 'N/A'}</div>
                    </div>

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

                    <div class="space-y-1 pt-2">
                        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                            <i class="fa-solid fa-boxes-packing text-brand-600"></i> Issued Equipment (${issuedItems.length})
                        </div>
                        <div class="max-h-36 overflow-y-auto divide-y divide-slate-100 pr-1">
                            ${issuedItemsHtml}
                        </div>
                    </div>
                </div>

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

/* --- ROLES TABLE RENDERING & DATABASE UPDATES --- */
function renderUserRolesTable(users) {
    const container = document.getElementById('user-roles-list');
    if (!container) return;

    if (!users || users.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">No users found.</td></tr>`;
        return;
    }

    container.innerHTML = users.map(user => {
        const currentRole = user.role || ROLES.MEMBER;

        const roleOptions = [
            { value: ROLES.MEMBER, label: 'Member' },
            { value: ROLES.CADET_SUPPLY_OFFICER, label: 'Cadet Supply Officer' },
            { value: ROLES.SUPPLY_OFFICER, label: 'Senior Supply Officer' },
            { value: ROLES.CADET_COMMANDER, label: 'Cadet Commander' },
            { value: ROLES.SQUADRON_COMMANDER, label: 'Squadron Commander' }
        ].map(opt => `
            <option value="${opt.value}" ${currentRole === opt.value ? 'selected' : ''}>
                ${opt.label}
            </option>
        `).join('');

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                <td class="p-3 font-bold text-slate-900">${user.fullName || 'N/A'}</td>
                <td class="p-3 text-slate-600">${user.email || 'N/A'}</td>
                <td class="p-3 text-slate-600">${user.phone || 'N/A'}</td>
                <td class="p-3">
                    <select data-action="update-user-role" data-uid="${user.uid || user.id}" class="p-1 border border-slate-300 rounded text-xs bg-white font-medium">
                        ${roleOptions}
                    </select>
                </td>
                <td class="p-3 text-slate-400 text-[11px]">Synced with Auth</td>
            </tr>
        `;
    }).join('');
}

function setupRoleChangeListeners() {
    document.getElementById('user-roles-list')?.addEventListener('change', async (e) => {
        const selectEl = e.target.closest('[data-action="update-user-role"]');
        if (selectEl) {
            const uid = selectEl.dataset.uid;
            const newRole = selectEl.value;
            try {
                await updateUserRoleInDB(uid, newRole);
                showToast("User role updated successfully!");
                await refreshMembersData();
            } catch (err) {
                if (window.showAlert) {
                    window.showAlert("Failed to update role", err.message, "error");
                }
            }
        }
    });
}

/* --- ADD MEMBER MODAL CONTROLS --- */
function createMemberModalElement() {
    const modal = document.createElement('div');
    modal.id = 'new-member-modal';
    modal.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden no-print';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-900 text-base">Add Member to Directory</h3>
                <button id="btn-close-member-modal" class="text-slate-400 hover:text-slate-600 font-bold p-1">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>
            
            <form id="add-member-form" class="space-y-3">
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <input type="text" id="member-full-name" required placeholder="e.g. John Doe" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input type="email" id="member-email" required placeholder="cadet@wi055.cap.gov" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                    <input type="tel" id="member-phone" placeholder="(920) 555-0199" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                    <select id="member-role" class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500">
                        <option value="${ROLES.MEMBER}">Member / Cadet</option>
                        <option value="${ROLES.CADET_SUPPLY_OFFICER}">Cadet Supply Officer</option>
                        <option value="${ROLES.SUPPLY_OFFICER}">Senior Supply Officer</option>
                        <option value="${ROLES.CADET_COMMANDER}">Cadet Commander</option>
                        <option value="${ROLES.SQUADRON_COMMANDER}">Squadron Commander</option>
                    </select>
                </div>
                
                <div class="pt-2 flex items-center justify-end gap-2">
                    <button type="button" id="btn-cancel-member-modal" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-xl text-xs transition shadow-sm">
                        Save Member
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.querySelector('#btn-close-member-modal')?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.querySelector('#btn-cancel-member-modal')?.addEventListener('click', () => modal.classList.add('hidden'));

    modal.querySelector('#add-member-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = modal.querySelector('#member-full-name').value.trim();
        const email = modal.querySelector('#member-email').value.trim();
        const phone = modal.querySelector('#member-phone').value.trim();
        const role = modal.querySelector('#member-role').value;

        if (!fullName || !email) {
            if (window.showAlert) window.showAlert("Required Fields", "Please enter both name and email.", "warning");
            return;
        }

        try {
            const newMember = { fullName, email, phone, role };
            AppState.membersList = AppState.membersList || [];
            AppState.membersList.push(newMember);

            renderMembersGrid();
            renderUserRolesTable(AppState.membersList);

            modal.classList.add('hidden');
            modal.querySelector('#add-member-form').reset();
            showToast(`Added ${fullName} to directory!`);
        } catch (err) {
            if (window.showAlert) window.showAlert("Error", "Could not add member: " + err.message, "error");
        }
    });

    return modal;
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