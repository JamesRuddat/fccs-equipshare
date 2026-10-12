// /js/components/AppAlertModal.js - Global Custom Alert Component
class AppAlertModal extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <div id="global-alert-backdrop" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden no-print transition-opacity">
                <div id="global-alert-card" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 text-center transform scale-95 transition-transform">
                    
                    <!-- Icon Indicator -->
                    <div id="global-alert-icon-container" class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <i id="global-alert-icon" class="fa-solid fa-triangle-exclamation"></i>
                    </div>

                    <!-- Title & Message -->
                    <div class="space-y-1">
                        <h3 id="global-alert-title" class="text-lg font-extrabold text-slate-900 dark:text-white">
                            Notification
                        </h3>
                        <p id="global-alert-message" class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            Alert message content.
                        </p>
                    </div>

                    <!-- Confirm / Close Button -->
                    <button id="global-alert-btn-close" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-sm">
                        OK
                    </button>
                </div>
            </div>
        `;

        const backdrop = this.querySelector('#global-alert-backdrop');
        const closeBtn = this.querySelector('#global-alert-btn-close');

        // Dismiss on button click
        closeBtn?.addEventListener('click', () => this.hide());

        // Dismiss on click outside modal card
        backdrop?.addEventListener('click', (e) => {
            if (e.target === backdrop) this.hide();
        });
    }

    show(title, message, type = 'warning') {
        const backdrop = this.querySelector('#global-alert-backdrop');
        const titleEl = this.querySelector('#global-alert-title');
        const msgEl = this.querySelector('#global-alert-message');
        const iconContainer = this.querySelector('#global-alert-icon-container');
        const iconEl = this.querySelector('#global-alert-icon');

        if (!backdrop || !titleEl || !msgEl) return;

        titleEl.textContent = title || "Notice";
        msgEl.textContent = message || "";

        // Icon styling variations based on alert type
        if (type === 'error') {
            iconContainer.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl bg-red-500/10 text-red-500 border border-red-500/20";
            iconEl.className = "fa-solid fa-circle-xmark";
        } else if (type === 'success') {
            iconContainer.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
            iconEl.className = "fa-solid fa-circle-check";
        } else if (type === 'info') {
            iconContainer.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl bg-blue-500/10 text-blue-500 border border-blue-500/20";
            iconEl.className = "fa-solid fa-circle-info";
        } else { // default warning
            iconContainer.className = "w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl bg-amber-500/10 text-amber-500 border border-amber-500/20";
            iconEl.className = "fa-solid fa-triangle-exclamation";
        }

        backdrop.classList.remove('hidden');
    }

    hide() {
        const backdrop = this.querySelector('#global-alert-backdrop');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

customElements.define('app-alert-modal', AppAlertModal);

// Universal Window Helper Function
window.showAlert = function(title, message, type = 'warning') {
    let alertModal = document.querySelector('app-alert-modal');
    
    // Auto-inject element if missing from HTML page DOM
    if (!alertModal) {
        alertModal = document.createElement('app-alert-modal');
        document.body.appendChild(alertModal);
    }
    
    alertModal.show(title, message, type);
};

export { AppAlertModal };