// /js/auth.js
import { AppState, showToast } from '/js/state.js';
import {
    listenToAuthState,
    getUserProfile,
    loginUserAccount,
    registerUserAccount,
    logoutUserAccount,
    resetUserPassword,
    correctUserEmail
} from '/js/firebase-db.js';

export function initAuth(onUserChanged) {
    listenToAuthState(async (user) => {
        if (user) {
            try {
                AppState.currentUser = await getUserProfile(user.uid) || {
                    uid: user.uid,
                    fullName: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    role: 'member'
                };
            } catch (err) {
                console.warn("Could not fetch Firestore user profile:", err);
                AppState.currentUser = {
                    uid: user.uid,
                    fullName: user.email.split('@')[0],
                    email: user.email,
                    role: 'member'
                };
            }
        } else {
            AppState.currentUser = null;
        }

        renderUserNavPill();
        
        // Notify all web components (like <app-header>) that auth state has loaded/changed
        window.dispatchEvent(new CustomEvent('user-state-changed'));

        if (typeof onUserChanged === 'function') onUserChanged(AppState.currentUser);
    });
}

export function renderUserNavPill() {
    const container = document.getElementById('user-nav-container');
    if (!container) return;

    if (AppState.currentUser) {
        const roleName = (AppState.currentUser.role || 'member').replace(/_/g, ' ');
        container.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="text-right hidden sm:block">
                    <span class="block text-xs font-extrabold text-white leading-tight">${AppState.currentUser.fullName}</span>
                    <span class="block text-[10px] font-bold text-brand-400 capitalize">${roleName}</span>
                </div>
                <button onclick="handleUserLogout()" title="Sign Out" class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-lg text-xs font-bold transition flex items-center gap-1">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button onclick="openAuthModal()" class="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-right-to-bracket"></i> Sign In
            </button>
        `;
    }
}

// Global modal bindings
export function openAuthModal() {
    document.getElementById('auth-modal')?.classList.remove('hidden');
}

export function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('hidden');
}

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

window.toggleAuthMode = function (mode) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const title = document.getElementById('auth-modal-title');

    if (mode === 'register') {
        loginForm?.classList.add('hidden');
        regForm?.classList.remove('hidden');
        if (title) title.textContent = "Create New Account";
    } else {
        regForm?.classList.add('hidden');
        loginForm?.classList.remove('hidden');
        if (title) title.textContent = "Sign In to EquipShare";
    }
};

window.handleUserLogin = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');

    const email = emailEl?.value?.trim();
    const password = passwordEl?.value;

    if (!email || !password) {
        window.showAlert("Login Failed", "Please enter both email and password.", "error");
        return;
    }

    try {
        await loginUserAccount(email, password);
        if (passwordEl) passwordEl.value = '';

        if (typeof showToast === 'function') showToast("Signed in successfully!");
        closeAuthModal();

        // Removed undefined `userProfile` reference — listenToAuthState handles state update automatically
    } catch (err) {
        console.error("Authentication Error:", err);
        if (err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
            window.showAlert("Invalid login credentials", "Please check your email and password, or create an account if you haven't registered yet.", "error");
        } else {
            window.showAlert("Login failed", err.message, "error");
        }
    }
};

window.handleUserRegister = async function (e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    const name = document.getElementById('reg-name')?.value?.trim();
    const phone = document.getElementById('reg-phone')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;

    if (!email || !password || !name) {
        window.showAlert("Registration failed", "Please complete all required registration fields.", "error");
        return;
    }

    try {
        await registerUserAccount(email, password, name, phone);

        const passwordEl = document.getElementById('reg-password');
        if (passwordEl) passwordEl.value = '';

        if (typeof showToast === 'function') showToast("Account created and linked successfully!");
        closeAuthModal();
    } catch (err) {
        console.error("Registration Error:", err);
        window.showAlert("Registration failed", err.message, "error");
    }
};

window.handleUserLogout = async function () {
    try {
        await logoutUserAccount();
        AppState.currentUser = null;
        renderUserNavPill();
        window.dispatchEvent(new CustomEvent('user-state-changed'));
        if (typeof showToast === 'function') showToast("Signed out.");
    } catch (err) {
        console.error("Logout failed:", err);
        window.showAlert("Logout failed", err.message, "error");
    }
};

window.handlePasswordReset = async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email')?.value;

    try {
        await resetUserPassword(email);
        alert(`Password reset link sent to ${email}. Please check your inbox and spam folder.`);
        document.getElementById('btn-goto-login-from-reset')?.click();
    } catch (error) {
        alert(`Password Reset Failed: ${error.message}`);
    }
};

window.handleUpdateEmail = async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('update-user-identifier')?.value;
    const password = document.getElementById('update-email-password')?.value;
    const newEmail = document.getElementById('update-new-email')?.value;

    try {
        const updatedEmail = await correctUserEmail(identifier, password, newEmail);
        alert(`Success! Your account email has been corrected to ${updatedEmail}. You can now sign in.`);

        // Pre-fill corrected email into login input
        const loginEmailInput = document.getElementById('login-email');
        if (loginEmailInput) loginEmailInput.value = updatedEmail;

        document.getElementById('btn-goto-login-from-update')?.click();
    } catch (error) {
        alert(`Email Correction Failed: ${error.message}`);
    }
};