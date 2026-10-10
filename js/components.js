// /js/components.js - Shared Navigation Header & Footer Web Components with Role-Based Access Control
import { AppState, saveCart } from '/js/state.js';

class AppHeader extends HTMLElement {
    async connectedCallback() {
        await this.render();
        this.setupEventListeners();
        this.syncCartUI();

        // Listen for Auth state changes
        window.addEventListener('user-state-changed', async () => {
            await this.render();
            this.setupEventListeners();
            this.syncCartUI();
        });

        // Listen for Cart updates fired from shop.js or item.js
        window.addEventListener('cart-updated', () => {
            this.syncCartUI();
        });
    }

    async render() {
        const user = AppState.currentUser;

        // Elevated staff & officer roles
        const staffRoles = [
            'cadet_supply_officer', 
            'supply_officer', 
            'cadet_commander', 
            'squadron_commander', 
            'admin'
        ];
        
        const isStaffOrOfficer = user && staffRoles.includes(user.role);

        // Fetch external HTML partial templates concurrently
        const [cartHtml, requisitionHtml, authHtml] = await Promise.all([
            fetch('/partials/cart-drawer.html').then(res => res.text()).catch(() => ''),
            fetch('/partials/requisition-drawer.html').then(res => res.text()).catch(() => ''),
            fetch('/partials/auth-modal.html').then(res => res.text()).catch(() => '')
        ]);

        const headerNavHtml = `
            <header class="bg-slate-900 text-white sticky top-0 z-30 shadow-md no-print">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between h-16">
                        <!-- Brand Logo -->
                        <a href="/pages/shop.html" class="flex items-center space-x-3 cursor-pointer">
                            <div class="bg-brand-500 text-slate-900 p-2 rounded-xl font-extrabold text-xl flex items-center justify-center h-10 w-10 shadow-sm">
                                <i class="fa-solid fa-boxes-packing"></i>
                            </div>
                            <div>
                                <span class="font-extrabold text-lg tracking-tight">EQUIP<span class="text-brand-500">SHARE</span></span>
                                <span class="block text-[11px] text-slate-400 font-medium">Unit Supply & Logistics</span>
                            </div>
                        </a>

                        <!-- Navigation Links (Role-Restricted) -->
                        <nav class="hidden md:flex space-x-1">
                            <a href="/pages/shop.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 hover:bg-slate-800 text-slate-300">
                                <i class="fa-solid fa-store"></i>Supply Catalog
                            </a>
                            
                            ${isStaffOrOfficer ? `
                                <a href="/pages/return.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                                    <i class="fa-solid fa-rotate-left"></i>Check-In / Return
                                </a>
                                <a href="/pages/admin.html" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition hover:bg-slate-800 text-slate-300 flex items-center gap-2">
                                    <i class="fa-solid fa-list-check"></i>Dashboard
                                </a>
                            ` : ''}
                        </nav>

                        <!-- Header Actions & Auth Status Badge -->
                        <div class="flex items-center space-x-3">
                            ${isStaffOrOfficer ? `
                                <button id="btn-toggle-requisition-drawer" title="Booster Club Order Requisition Queue" class="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 bg-slate-800/60 border border-slate-700">
                                    <i class="fa-solid fa-truck-ramp-box text-lg text-amber-400"></i>
                                    <span class="hidden sm:inline text-xs font-bold text-slate-200">Requisition</span>
                                    <span id="requisition-badge" class="bg-amber-500 text-slate-950 font-extrabold text-[11px] rounded-full h-5 w-5 flex items-center justify-center">0</span>
                                </button>
                            ` : ''}

                            <button id="btn-cart-toggle" class="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition">
                                <i class="fa-solid fa-basket-shopping text-xl"></i>
                                <span id="cart-badge" class="absolute -top-1 -right-1 bg-brand-500 text-slate-950 font-extrabold text-[11px] rounded-full h-5 w-5 flex items-center justify-center">0</span>
                            </button>

                            <!-- Dynamic Auth Status Container -->
                            <div id="user-nav-container" class="border-l border-slate-700 pl-3">
                                ${user ? `
                                    <div class="flex items-center gap-2">
                                        <div class="text-right hidden sm:block">
                                            <span class="block text-xs font-extrabold text-white leading-tight">${user.fullName || 'Member'}</span>
                                            <span class="block text-[10px] font-bold text-brand-400 capitalize">${(user.role || 'member').replace(/_/g, ' ')}</span>
                                        </div>
                                        <button id="btn-user-logout" title="Sign Out" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg text-xs font-bold transition flex items-center gap-1">
                                            <i class="fa-solid fa-right-from-bracket"></i>
                                        </button>
                                    </div>
                                ` : `
                                    <button id="btn-open-auth-modal" class="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5">
                                        <i class="fa-solid fa-right-to-bracket"></i> Sign In
                                    </button>
                                `}
                            </div>

                            <button id="btn-toggle-mobile-menu" class="md:hidden p-2 text-slate-300 hover:text-white focus:outline-none">
                                <i class="fa-solid fa-bars text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Mobile Menu Navigation Links -->
                <div id="mobile-menu" class="hidden md:hidden bg-slate-800 px-4 pt-2 pb-4 space-y-1 border-t border-slate-700 text-xs font-semibold">
                    <a href="/pages/shop.html" class="block px-3 py-2 rounded-md text-white hover:bg-slate-700">
                        <i class="fa-solid fa-store w-6"></i> Supply Catalog
                    </a>
                    
                    ${isStaffOrOfficer ? `
                        <a href="/pages/order.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-file-invoice w-6"></i> Check-Out & Release
                        </a>
                        <a href="/pages/return.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-rotate-left w-6"></i> Check-In / Return
                        </a>
                        <a href="/pages/admin.html" class="block px-3 py-2 rounded-md text-slate-300 hover:bg-slate-700">
                            <i class="fa-solid fa-list-check w-6"></i> Admin Console & Directory
                        </a>
                    ` : ''}
                </div>
            </header>
        `;

        // Inject navigation header along with loaded partial drawers/modals
        this.innerHTML = headerNavHtml + cartHtml + requisitionHtml + authHtml;
    }

    /**
     * Reads AppState.cart / localStorage and updates both the badge and the drawer contents
     */
    syncCartUI() {
        const cart = AppState.cart || [];
        const totalItemsCount = cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);

        // Update Nav Badge & Drawer Counter
        const cartBadge = this.querySelector('#cart-badge');
        const drawerCount = this.querySelector('#cart-drawer-count');

        if (cartBadge) cartBadge.textContent = totalItemsCount;
        if (drawerCount) drawerCount.textContent = totalItemsCount;

        // Render Items inside Drawer
        const container = this.querySelector('#cart-items-container');
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">Your pick basket is currently empty.</p>`;
            return;
        }

        container.innerHTML = cart.map((item, index) => {
            const rawPrice = parseFloat(item.price) || 0;
            const sizeTag = item.selectedSize && item.selectedSize !== 'OS' ? ` • Size: ${item.selectedSize}` : '';
            const qty = item.quantity || 1;

            return `
                <div class="py-3 flex items-center justify-between gap-3 border-b border-slate-100 text-xs">
                    <div class="flex-1">
                        <div class="font-mono text-[11px] font-bold text-slate-900">${item.locationCode || 'N/A'}</div>
                        <div class="text-xs font-semibold text-slate-800 line-clamp-1">${item.title}</div>
                        <div class="text-[11px] text-slate-500 font-medium">${sizeTag}</div>
                        <div class="text-[11px] font-semibold text-slate-500 mt-1">
                            <span class="line-through text-slate-400">$${(rawPrice * qty).toFixed(2)}</span>
                            <span class="text-brand-600 font-extrabold ml-1">$0.00</span>
                        </div>
                    </div>

                    <!-- Quantity Controls -->
                    <div class="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                        <button data-action="component-adjust-qty" data-cart-index="${index}" data-delta="-1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition">-</button>
                        <span class="px-2 text-xs font-extrabold text-slate-800">${qty}</span>
                        <button data-action="component-adjust-qty" data-cart-index="${index}" data-delta="1" class="px-2 py-1 text-slate-600 hover:bg-slate-200 font-bold transition">+</button>
                    </div>

                    <!-- Delete Button -->
                    <button data-action="component-remove-cart-item" data-cart-index="${index}" class="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition" title="Remove item">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    setupEventListeners() {
        // Mobile Navigation Toggle
        this.querySelector('#btn-toggle-mobile-menu')?.addEventListener('click', () => {
            this.querySelector('#mobile-menu')?.classList.toggle('hidden');
        });

        // Drawer Containers
        const cartDrawer = this.querySelector('#cart-drawer');
        const reqDrawer = this.querySelector('#requisition-drawer');
        const authModal = this.querySelector('#auth-modal');

        // Cart Drawer Toggle & Close Controls
        this.querySelector('#btn-cart-toggle')?.addEventListener('click', () => {
            this.syncCartUI();
            cartDrawer?.classList.remove('hidden');
        });

        this.querySelector('#btn-close-cart-drawer')?.addEventListener('click', () => {
            cartDrawer?.classList.add('hidden');
        });

        // Click Outside Backdrop -> Close Cart Drawer
        cartDrawer?.addEventListener('click', (e) => {
            if (e.target === cartDrawer) {
                cartDrawer.classList.add('hidden');
            }
        });

        // Requisition Drawer Toggle & Close Controls
        this.querySelector('#btn-toggle-requisition-drawer')?.addEventListener('click', () => {
            reqDrawer?.classList.remove('hidden');
        });

        this.querySelector('#btn-close-requisition-drawer')?.addEventListener('click', () => {
            reqDrawer?.classList.add('hidden');
        });

        // Click Outside Backdrop -> Close Requisition Drawer
        reqDrawer?.addEventListener('click', (e) => {
            if (e.target === reqDrawer) {
                reqDrawer.classList.add('hidden');
            }
        });

        // Redirect to Order page
        this.querySelector('#btn-proceed-picklist')?.addEventListener('click', () => {
            cartDrawer?.classList.add('hidden');
            window.location.href = '/pages/order.html';
        });

        // Event Delegation inside Cart Drawer for Quantity Changes & Deletions
        this.querySelector('#cart-items-container')?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('[data-action="component-remove-cart-item"]');
            const qtyBtn = e.target.closest('[data-action="component-adjust-qty"]');

            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.cartIndex, 10);
                if (AppState.cart && index >= 0) {
                    AppState.cart.splice(index, 1);
                    saveCart();
                    window.dispatchEvent(new CustomEvent('cart-updated'));
                }
            } else if (qtyBtn) {
                const index = parseInt(qtyBtn.dataset.cartIndex, 10);
                const delta = parseInt(qtyBtn.dataset.delta, 10);
                if (AppState.cart && index >= 0) {
                    const newQty = (AppState.cart[index].quantity || 1) + delta;
                    if (newQty <= 0) {
                        AppState.cart.splice(index, 1);
                    } else {
                        AppState.cart[index].quantity = newQty;
                    }
                    saveCart();
                    window.dispatchEvent(new CustomEvent('cart-updated'));
                }
            }
        });

        // Auth Modal Controls
        this.querySelector('#btn-open-auth-modal')?.addEventListener('click', () => {
            authModal?.classList.remove('hidden');
        });

        this.querySelector('#btn-close-auth-modal')?.addEventListener('click', () => {
            authModal?.classList.add('hidden');
        });

        // Click Outside Backdrop -> Close Auth Modal
        authModal?.addEventListener('click', (e) => {
            if (e.target === authModal) {
                authModal.classList.add('hidden');
            }
        });

        this.querySelector('#btn-user-logout')?.addEventListener('click', () => {
            if (window.handleUserLogout) window.handleUserLogout();
        });

        this.querySelector('#login-form')?.addEventListener('submit', (e) => {
            if (window.handleUserLogin) window.handleUserLogin(e);
        });

        this.querySelector('#register-form')?.addEventListener('submit', (e) => {
            if (window.handleUserRegister) window.handleUserRegister(e);
        });

        const loginForm = this.querySelector('#login-form');
        const regForm = this.querySelector('#register-form');
        const titleEl = this.querySelector('#auth-modal-title');

        this.querySelector('#btn-goto-register')?.addEventListener('click', () => {
            loginForm?.classList.add('hidden');
            regForm?.classList.remove('hidden');
            if (titleEl) titleEl.textContent = 'Create an Account';
        });

        this.querySelector('#btn-goto-login-from-reg')?.addEventListener('click', () => {
            regForm?.classList.add('hidden');
            loginForm?.classList.remove('hidden');
            if (titleEl) titleEl.textContent = 'Sign In to EquipShare';
        });
    }
}

class AppFooter extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <footer class="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 no-print mt-auto">
                <div class="max-w-7xl mx-auto px-4 text-center space-y-2">
                    <p>&copy; ${new Date().getFullYear()} EquipShare - Squadron Supply & Logistics Management System.</p>
                </div>
            </footer>
        `;
    }
}

customElements.define('app-header', AppHeader);
customElements.define('app-footer', AppFooter);