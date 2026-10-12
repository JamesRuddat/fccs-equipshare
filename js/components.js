// /js/components.js - Single Entry Point for Web Components & Drawers
import { AppAlertModal } from '/js/components/AppAlertModal.js';
import { AppHeader } from '/js/components/AppHeader.js';
import { AppFooter } from '/js/components/AppFooter.js';

import { setupCartDrawer } from '/js/modules/cartDrawer.js';
import { setupRequisitionDrawer } from '/js/modules/requisitionDrawer.js';

// Initialize global drawer reactive event handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupCartDrawer();
    setupRequisitionDrawer();
});

export {
    AppAlertModal,
    AppHeader,
    AppFooter
};