// /js/components/AppHeader.js - Smooth Role-Aware Navigation Header Shell
import { AppState } from '/js/state.js';
import { ROLES, PERMISSIONS, hasPermission } from '/js/roles.js';

// Global partial cache with promise memoization
const PartialCache = {
    cart: null,
    requisition: null,
    auth: null,
    fetchPromise: null
};

class AppHeader extends HTMLElement {
    constructor() {
        super();
        this._hasStateListener = false;
    }

    connectedCallback() {
        if (!this.classList.contains('block')) {
            this.classList.add('block', 'min-h-[64px]');
        }

        // Render structural shell immediately without waiting for fetch
        this.renderShell();
        this.setupAuthAndNavListeners();

        // Listen for user state changes
        if (!this._hasStateListener) {
            window.addEventListener('user-state-changed', () => this.updateUserNavState());
            this._hasStateListener = true;
        }

        // Non-blocking fetch for modals and drawers
        this.loadPartials();
    }

    async fetchPartials() {
        if (PartialCache.fetchPromise) return PartialCache.fetchPromise;

        const fetchPartial = async (path) => {
            try {
                const res = await fetch(path);
                if (!res.ok) return '';
                const text = await res.text();
                return text.trim().startsWith('<') ? text : '';
            } catch {
                return '';
            }
        };

        PartialCache.fetchPromise = Promise.all([
            PartialCache.cart ? Promise.resolve(PartialCache.cart) : fetchPartial('/partials/cart-drawer.html'),
            PartialCache.requisition ? Promise.resolve(PartialCache.requisition) : fetchPartial('/partials/requisition-drawer.html'),
            PartialCache.auth ? Promise.resolve(PartialCache.auth) : fetchPartial('/partials/auth-modal.html')
        ]).then(([cartHtml, requisitionHtml, authHtml]) => {
            PartialCache.cart = cartHtml;
            PartialCache.requisition = requisitionHtml;
            PartialCache.auth = authHtml;
            return PartialCache;
        });

        return PartialCache.fetchPromise;
    }

    async loadPartials() {
        const partials = await this.fetchPartials();
        
        let container = this.querySelector('#partials-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'partials-container';
            this.appendChild(container);
        }
        
        container.innerHTML = (partials.cart || '') + (partials.requisition || '') + (partials.auth || '');
        this.setupAuthAndNavListeners();

        window.dispatchEvent(new CustomEvent('requisition-updated'));
        window.dispatchEvent(new CustomEvent('cart-updated'));
    }

    renderShell() {
        const user = AppState.currentUser;
        const userRole = (user?.role || ROLES.MEMBER).toLowerCase().trim().replace(/\s+/g, '_');

        const canManageSupply = hasPermission(userRole, PERMISSIONS.MANAGE_SUPPLY);
        const canCheckOut = hasPermission(userRole, PERMISSIONS.CHECK_OUT_ITEMS);

        const headerNavHtml = `
            <header class="bg-slate-900 text-white sticky top-0 z-30 shadow-md no-print min-h-[64px]">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <a href="/pages/catalog.html" class="flex items-center space-x-3 cursor-pointer">
                            <img src="/assets/FCCS BW.png" alt="Logo" width="50" height="50" class="w-[50px] h-[50px]">
                            <div>
                                <span class="font-extrabold text-lg tracking-tight">EQUIP<span class="text-brand-500">SHARE</span></span>
                                <span class="block text-[11px] text-slate-400 font-medium">Unit Supply & Logistics</span>
                            </div>
                        </a>

                        <nav class="hidden md:flex space-x-1">
                            <a href="/pages/catalog.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 hover:bg-slate-800 text-slate-300">
                                <i class="fa-solid fa-store"></i>Catalog
                            </a>

                            <a href="/pages/vendors.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 hover:bg-slate-800 text-slate-300">
                                <i class="fa-solid fa-tags"></i>Vendors
                            </a>
                            
                            <div id="nav-checkout-links" class="flex items-center space-x-1">
                                ${canCheckOut ? `
                                    <a href="/pages/return.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                                        <i class="fa-solid fa-rotate-left"></i>Check-In
                                    </a>
                                ` : ''}
                            </div>

                            <div id="nav-supply-links" class="flex items-center space-x-1">
                                ${canManageSupply ? `
                                    <a href="/pages/supply.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                                        <i class="fa-solid fa-list-check"></i>Supply
                                    </a>
                                    <a href="/pages/members.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                                        <i class="fa-solid fa-users"></i>Members
                                    </a>
                                ` : ''}
                            </div>
                        </nav>

                        <div class="flex items-center space-x-3">
                            <div id="requisition-btn-wrapper">
                                ${canCheckOut ? `
                                    <button id="btn-requisition-toggle" class="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition" title="Booster Requisition List">
                                        <i class="fa-solid fa-truck-ramp-box text-xl text-amber-400"></i>
                                        <span id="requisition-badge" class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-extrabold text-[11px] rounded-full h-5 w-5 flex items-center justify-center">0</span>
                                    </button>
                                ` : ''}    
                            </div>
                        
                            <button id="btn-cart-toggle" class="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition">
                                <i class="fa-solid fa-basket-shopping text-xl"></i>
                                <span id="cart-badge" class="absolute -top-1 -right-1 bg-brand-500 text-slate-950 font-extrabold text-[11px] rounded-full h-5 w-5 flex items-center justify-center">0</span>
                            </button>

                            <div id="user-nav-container" class="border-l border-slate-700 pl-3 min-w-[80px]">
                                ${this.getUserNavContent(user)}
                            </div>

                            <button id="btn-toggle-mobile-menu" class="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none">
                                <i class="fa-solid fa-bars text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div id="mobile-menu" class="hidden md:hidden bg-slate-800 px-4 pt-2 pb-4 space-y-1 border-t border-slate-700 text-xs font-semibold">
                    <a href="/pages/catalog.html" class="block px-3 py-2 rounded-md text-white hover:bg-slate-700">
                        <i class="fa-solid fa-store w-6"></i> Catalog
                    </a>
                    <a href="/pages/vendors.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                        <i class="fa-solid fa-tags w-6"></i> Vendors
                    </a>
                    ${canCheckOut ? `
                        <a href="/pages/return.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-rotate-left w-6"></i>Check-In
                        </a>
                    ` : ''}
                    ${canManageSupply ? `
                        <a href="/pages/supply.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-list-check w-6"></i>Supply
                        </a>
                        <a href="/pages/members.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-users w-6"></i>Members
                        </a>
                    ` : ''}
                </div>
            </header>
            <div id="partials-container"></div>
        `;

        this.innerHTML = headerNavHtml;
    }

    updateUserNavState() {
        const user = AppState.currentUser;
        const userNavContainer = this.querySelector('#user-nav-container');
        
        if (userNavContainer) {
            userNavContainer.innerHTML = this.getUserNavContent(user);
        }

        const userRole = (user?.role || ROLES.MEMBER).toLowerCase().trim().replace(/\s+/g, '_');
        const canManageSupply = hasPermission(userRole, PERMISSIONS.MANAGE_SUPPLY);
        const canCheckOut = hasPermission(userRole, PERMISSIONS.CHECK_OUT_ITEMS);

        const checkoutNav = this.querySelector('#nav-checkout-links');
        if (checkoutNav) {
            checkoutNav.innerHTML = canCheckOut ? `
                <a href="/pages/return.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                    <i class="fa-solid fa-rotate-left"></i>Check-In
                </a>
            ` : '';
        }

        const supplyNav = this.querySelector('#nav-supply-links');
        if (supplyNav) {
            supplyNav.innerHTML = canManageSupply ? `
                <a href="/pages/supply.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                    <i class="fa-solid fa-list-check"></i>Supply
                </a>
                <a href="/pages/members.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                    <i class="fa-solid fa-users"></i>Members
                </a>
            ` : '';
        }

        this.setupAuthAndNavListeners();
    }

    getUserNavContent(user) {
        return user ? `
            <div class="flex items-center gap-2">
                <div class="text-right hidden sm:block">
                    <span class="block text-xs font-extrabold text-white leading-tight">${user.fullName || 'Member'}</span>
                    <span class="block text-[10px] font-bold text-brand-400 capitalize">${(user.role || ROLES.MEMBER).replace(/_/g, ' ')}</span>
                </div>
                <button id="btn-user-logout" title="Sign Out" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg text-xs font-bold transition flex items-center gap-1">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        ` : `
            <button id="btn-open-auth-modal" class="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
        `;
    }

    setupAuthAndNavListeners() {
        const mobileBtn = this.querySelector('#btn-toggle-mobile-menu');
        if (mobileBtn) {
            mobileBtn.onclick = () => {
                this.querySelector('#mobile-menu')?.classList.toggle('hidden');
            };
        }

        const authModal = this.querySelector('#auth-modal');
        const btnOpenAuth = this.querySelector('#btn-open-auth-modal');
        if (btnOpenAuth) {
            btnOpenAuth.onclick = () => authModal?.classList.remove('hidden');
        }

        const btnCloseAuth = this.querySelector('#btn-close-auth-modal');
        if (btnCloseAuth) {
            btnCloseAuth.onclick = () => authModal?.classList.add('hidden');
        }

        if (authModal) {
            authModal.onclick = (e) => {
                if (e.target === authModal) authModal.classList.add('hidden');
            };
        }

        const btnLogout = this.querySelector('#btn-user-logout');
        if (btnLogout) {
            btnLogout.onclick = () => {
                if (window.handleUserLogout) window.handleUserLogout();
            };
        }

        const titleEl = this.querySelector('#auth-modal-title');
        const loginForm = this.querySelector('#login-form');
        const regForm = this.querySelector('#register-form');
        const resetForm = this.querySelector('#reset-password-form');
        const updateEmailForm = this.querySelector('#update-email-form');

        const showForm = (activeForm, title) => {
            [loginForm, regForm, resetForm, updateEmailForm].forEach(f => f?.classList.add('hidden'));
            activeForm?.classList.remove('hidden');
            if (titleEl) titleEl.textContent = title;
        };

        this.querySelector('#btn-goto-register')?.addEventListener('click', () => {
            showForm(regForm, 'Create an Account');
        });

        this.querySelector('#btn-goto-login-from-reg')?.addEventListener('click', () => {
            showForm(loginForm, 'Sign In to EquipShare');
        });

        this.querySelector('#btn-goto-reset')?.addEventListener('click', () => {
            showForm(resetForm, 'Reset Password');
        });

        this.querySelector('#btn-goto-login-from-reset')?.addEventListener('click', () => {
            showForm(loginForm, 'Sign In to EquipShare');
        });

        this.querySelector('#btn-goto-update-email')?.addEventListener('click', () => {
            showForm(updateEmailForm, 'Correction: Update Email');
        });

        this.querySelector('#btn-goto-login-from-update')?.addEventListener('click', () => {
            showForm(loginForm, 'Sign In to EquipShare');
        });

        if (loginForm) {
            loginForm.onsubmit = (e) => {
                e.preventDefault();
                if (window.handleUserLogin) window.handleUserLogin(e);
            };
        }

        if (regForm) {
            regForm.onsubmit = (e) => {
                e.preventDefault();
                if (window.handleUserRegister) window.handleUserRegister(e);
            };
        }

        if (resetForm) {
            resetForm.onsubmit = (e) => {
                e.preventDefault();
                if (window.handlePasswordReset) window.handlePasswordReset(e);
            };
        }

        if (updateEmailForm) {
            updateEmailForm.onsubmit = (e) => {
                e.preventDefault();
                if (window.handleUpdateEmail) window.handleUpdateEmail(e);
            };
        }
    }
}

customElements.define('app-header', AppHeader);

export { AppHeader };