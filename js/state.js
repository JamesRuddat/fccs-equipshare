// /js/state.js

export const AppState = {
    supply: [],
    membersList: [],
    cart: JSON.parse(localStorage.getItem('equipshare_cart') || '[]'),
    currentUser: null
};

export function saveCart() {
    localStorage.setItem('equipshare_cart', JSON.stringify(AppState.cart || []));
    
    // Notify all web components and scripts that the cart was updated
    window.dispatchEvent(new CustomEvent('cart-updated'));
}

export function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none no-print';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-slate-700 transition-all transform translate-y-2';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-brand-500 mr-2"></i>${message}`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}
