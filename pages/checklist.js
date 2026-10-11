// /pages/checklist.js - Civil Air Patrol Uniform Inspection Engine
import { initAuth } from '/js/auth.js';
import { AppState, showToast } from '/js/state.js';

let activeCategory = 'blues';
let checklistState = {};

const UNIFORM_CHECKLIST_DATA = {
    blues: [
        {
            title: "Headgear & Insignia",
            items: [
                { id: "b_cap", text: "Flight Cap clean, creased properly, free of lint and stains." },
                { id: "b_cap_device", text: "Cadet/Officer Flight Cap Device correctly centered on the left side, 1.5 inches from front crease." }
            ]
        },
        {
            title: "Shirt & Blouse (Class B)",
            items: [
                { id: "b_shirt_press", text: "Light blue shirt clean, ironed with military creases (2 front, 3 back)." },
                { id: "b_nametag", text: "Blue Nametag resting directly on top of the right pocket seam (Male) or centered 1 to 1.5 inches above top button (Female)." },
                { id: "b_ribbons", text: "Ribbons clean, properly ordered using CAP Ribbon Checker, resting flat on left side." },
                { id: "b_epaulets", text: "Cadet/Officer Epaulet sleeves secure on shoulder loops without sagging." },
                { id: "b_tie", text: "Tie / Tie Tab worn when required (Class A or Class B with long sleeves)." }
            ]
        },
        {
            title: "Trousers, Belt & Footwear",
            items: [
                { id: "b_pants", text: "Blues Trousers/Slacks pressed, proper length with slight break over shoe." },
                { id: "b_belt", text: "Blue cotton belt with tip matching silver buckle tip (no brass showing)." },
                { id: "b_shoes", text: "Black Dress Shoes polished to mirror shine with no scuffs." }
            ]
        }
    ],
    utility: [
        {
            title: "OCP / ABU Uniform Coat & Shirts",
            items: [
                { id: "u_shirt", text: "OCP/ABU Coat clean, un-frayed, buttons/zippers functional." },
                { id: "u_nametape", text: "CIVIL AIR PATROL & Member Name Tapes worn parallel on respective chest pockets." },
                { id: "u_patches", text: "US Flag Patch (Velcro) and CAP Emblem/Squadron Patch placed on appropriate sleeve positions." },
                { id: "u_undershirt", text: "Tan 499 (OCP) or Desert Tan (ABU) T-shirt clean and tucked in." },
                { id: "u_grade", text: "Rank Insignia (Cloth/Pin-on) correctly positioned on collar or center chest line." }
            ]
        },
        {
            title: "Pants, Boots & Blousing",
            items: [
                { id: "u_trousers", text: "Utility Trousers clean with cargo pockets buttoned/closed." },
                { id: "u_belt", text: "Coyote Brown (OCP) or Riggers Belt (ABU) properly looped through all pants tabs." },
                { id: "u_boots", text: "Coyote Brown (OCP) or Black Boots (ABU) clean, laced properly, and bloused above 3rd eyelet." }
            ]
        }
    ],
    grooming: [
        {
            title: "Male Hair & Facial Hair Standards",
            items: [
                { id: "g_male_hair", text: "Hair tapered on sides/back, not touching collar, ears, or eyebrows. Bulk <= 2 inches." },
                { id: "g_shave", text: "Clean shaven prior to inspection. Sideburns straight, ending above bottom of ear opening." }
            ]
        },
        {
            title: "Female Hair Standards",
            items: [
                { id: "g_female_hair", text: "Hair secured above bottom edge of collar. Buns/braids do not exceed 4 inches in bulk." },
                { id: "g_female_acc", text: "Hair accessories match hair color or black. No extreme dye colors." }
            ]
        },
        {
            title: "Jewelry & Accoutrements",
            items: [
                { id: "g_rings", text: "Maximum 3 rings worn total across both hands." },
                { id: "g_watch", text: "Wristwatch conservative (black, silver, brown, navy)." }
            ]
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    loadChecklistState();
    setupTabHandlers();
    renderChecklist();
});

function loadChecklistState() {
    try {
        const saved = localStorage.getItem('equipshare_uniform_checklist');
        if (saved) checklistState = JSON.parse(saved);
    } catch (e) {
        checklistState = {};
    }
}

function saveChecklistState() {
    localStorage.setItem('equipshare_uniform_checklist', JSON.stringify(checklistState));
    updateScoreMeter();
}

function setupTabHandlers() {
    const tabs = [
        { id: 'blues', btn: document.getElementById('tab-btn-blues') },
        { id: 'utility', btn: document.getElementById('tab-btn-utility') },
        { id: 'grooming', btn: document.getElementById('tab-btn-grooming') }
    ];

    tabs.forEach(({ id, btn }) => {
        btn?.addEventListener('click', () => {
            activeCategory = id;
            tabs.forEach(t => {
                t.btn?.classList.remove('bg-cap-blue', 'text-white');
                t.btn?.classList.add('bg-white', 'text-slate-600');
            });
            btn.classList.add('bg-cap-blue', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-600');
            renderChecklist();
        });
    });

    document.getElementById('btn-reset-checklist')?.addEventListener('click', () => {
        checklistState = {};
        saveChecklistState();
        renderChecklist();
        showToast("Checklist reset.");
    });
}

function renderChecklist() {
    const container = document.getElementById('checklist-sections-container');
    if (!container) return;

    const sections = UNIFORM_CHECKLIST_DATA[activeCategory] || [];

    container.innerHTML = sections.map(sec => `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 class="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center justify-between">
                <span>${sec.title}</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CAPR 39-1</span>
            </h3>
            <div class="space-y-2">
                ${sec.items.map(item => {
                    const checked = !!checklistState[item.id];
                    return `
                        <label class="flex items-start gap-3 p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition cursor-pointer">
                            <input type="checkbox" data-item-id="${item.id}" ${checked ? 'checked' : ''} 
                                class="checklist-checkbox mt-0.5 h-4 w-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300">
                            <span class="text-xs font-medium ${checked ? 'line-through text-slate-400' : 'text-slate-700'}">
                                ${item.text}
                            </span>
                        </label>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');

    // Wire Checkbox Listeners
    container.querySelectorAll('.checklist-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.itemId;
            checklistState[id] = e.target.checked;
            saveChecklistState();
            
            // Toggle strike-through text instantly
            const textSpan = e.target.closest('label')?.querySelector('span');
            if (textSpan) {
                if (e.target.checked) {
                    textSpan.classList.add('line-through', 'text-slate-400');
                    textSpan.classList.remove('text-slate-700');
                } else {
                    textSpan.classList.remove('line-through', 'text-slate-400');
                    textSpan.classList.add('text-slate-700');
                }
            }
        });
    });

    updateScoreMeter();
}

function updateScoreMeter() {
    let totalItems = 0;
    let checkedItems = 0;

    Object.values(UNIFORM_CHECKLIST_DATA).forEach(cat => {
        cat.forEach(sec => {
            sec.items.forEach(item => {
                totalItems++;
                if (checklistState[item.id]) checkedItems++;
            });
        });
    });

    const scorePct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

    const scoreText = document.getElementById('score-text');
    const countText = document.getElementById('items-checked-count');

    if (scoreText) scoreText.textContent = `${scorePct}%`;
    if (countText) countText.textContent = `${checkedItems} / ${totalItems} Ready`;
}