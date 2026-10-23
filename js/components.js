// /js/components.js - Single Entry Point for Web Components, Drawers & Global Session Initialization
import { AppAlertModal } from '/js/components/AppAlertModal.js';
import { AppHeader } from '/js/components/AppHeader.js';
import { AppFooter } from '/js/components/AppFooter.js';

import { AppState } from '/js/state.js';
import { initAuth } from '/js/auth.js';

import { setupCartDrawer } from '/js/modules/cartDrawer.js';
import { setupRequisitionDrawer } from '/js/modules/requisitionDrawer.js';

// Initialize global drawers & global authentication persistence on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize global drawer handlers
    setupCartDrawer();
    setupRequisitionDrawer();

    // 2. Global Auth Observer: Resolves session persistence across ALL pages
    initAuth((user) => {
        AppState.currentUser = user;
        
        // Emits 'user-state-changed' so <app-header> and page scripts update their UI automatically
        window.dispatchEvent(new CustomEvent('user-state-changed'));
    });
});

export {
    AppAlertModal,
    AppHeader,
    AppFooter
};