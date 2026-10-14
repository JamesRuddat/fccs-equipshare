// /js/firebase-db.js - Clean Data Access Layer with Workflow & Size Support
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
    addDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBVW7YEih-nk_jNOiblY8tZOQRHU28bEX0",
    authDomain: "squadron-innovatory.firebaseapp.com",
    projectId: "squadron-innovatory",
    storageBucket: "squadron-innovatory.firebasestorage.app",
    messagingSenderId: "937800647620",
    appId: "1:937800647620:web:e4a192d2905d4a0ab15a91",
    measurementId: "G-YRW7ZCNXRY"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const supplyRef = collection(db, "supply");
const usersRef = collection(db, "users");

// Helper to convert array/string input to a clean string array
const parseArray = (input) => {
    if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
    if (typeof input === 'string' && input.trim()) {
        return input.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
};

/**
 * Helper to normalize stock object input.
 * Accepts either a stock object { "S": 5, "M": 10 } or numeric total for one-size items.
 * Output: { [sizeLabel]: quantityNumber }
 */
const parseStock = (stockInput, defaultQuantity = 1) => {
    if (stockInput && typeof stockInput === 'object' && !Array.isArray(stockInput)) {
        const cleanStock = {};
        Object.keys(stockInput).forEach(size => {
            const qty = parseInt(stockInput[size], 10);
            if (!isNaN(qty) && qty >= 0) {
                cleanStock[size.trim().toUpperCase()] = qty;
            }
        });
        return Object.keys(cleanStock).length > 0 ? cleanStock : { "OS": defaultQuantity };
    }

    const qty = parseInt(stockInput, 10);
    return { "OS": !isNaN(qty) && qty >= 0 ? qty : defaultQuantity };
};

/**
 * Calculates total available stock count across all sizes for an item.
 */
export const getTotalQuantity = (stockMap) => {
    if (!stockMap || typeof stockMap !== 'object') return 0;
    return Object.values(stockMap).reduce((sum, q) => sum + (parseInt(q, 10) || 0), 0);
};

/* ==========================================================================
   SUPPLY / INVENTORY CRUD & WORKFLOW
   ========================================================================== */

/**
 * CREATE: Adds a clean supply item document with stock per size.
 */
export async function createSupplyItem(itemData) {
    const stockMap = parseStock(itemData.stock, itemData.quantity || 1);
    const totalQty = getTotalQuantity(stockMap);

    let initialStatus = itemData.status || (totalQty > 0 ? "IN" : "OUT");

    const payload = {
        locationCode: (itemData.locationCode || "").toUpperCase().trim(),
        location: itemData.location || "Closet Slot",
        title: itemData.title || "Untitled Item",
        price: parseFloat(itemData.price) || 0,
        categories: parseArray(itemData.categories),
        sizes: Object.keys(stockMap),
        stock: stockMap,
        isOneSize: Object.keys(stockMap).length === 1 && Object.keys(stockMap)[0] === "OS",
        status: initialStatus, // Options: "IN", "REQUESTED", "ISSUED", "VANGUARD", "OUT"
        hideFromCatalog: !!itemData.hideFromCatalog, // Stores true for squadron-owned/hidden items
        vanguardUrl: itemData.vanguardUrl || "",
        image: itemData.image || "",
        createdAt: serverTimestamp()
    };

    return await addDoc(supplyRef, payload);
}

/**
 * READ ALL: Fetches all supply items.
 */
export async function getSupplyItems() {
    const snapshot = await getDocs(supplyRef);
    return snapshot.docs.map(d => {
        const data = d.data();
        const stockMap = data.stock || { "OS": 1 };
        return {
            id: d.id,
            ...data,
            stock: stockMap,
            totalQuantity: getTotalQuantity(stockMap)
        };
    });
}

/**
 * UPDATE: Updates specific fields or stock map on a supply item document.
 */
export async function updateSupplyItem(itemId, updatedData) {
    const itemRef = doc(db, "supply", itemId);
    const cleanPayload = {};

    if (updatedData.locationCode !== undefined) cleanPayload.locationCode = updatedData.locationCode.toUpperCase().trim();
    if (updatedData.location !== undefined) cleanPayload.location = updatedData.location;
    if (updatedData.title !== undefined) cleanPayload.title = updatedData.title;
    if (updatedData.price !== undefined) cleanPayload.price = parseFloat(updatedData.price) || 0;
    if (updatedData.vanguardUrl !== undefined) cleanPayload.vanguardUrl = updatedData.vanguardUrl;
    if (updatedData.image !== undefined) cleanPayload.image = updatedData.image;
    if (updatedData.status !== undefined) cleanPayload.status = updatedData.status;
    if (updatedData.hideFromCatalog !== undefined) cleanPayload.hideFromCatalog = !!updatedData.hideFromCatalog;

    if (updatedData.stock !== undefined) {
        const stockMap = parseStock(updatedData.stock);
        cleanPayload.stock = stockMap;
        cleanPayload.sizes = Object.keys(stockMap);
        cleanPayload.isOneSize = Object.keys(stockMap).length === 1 && Object.keys(stockMap)[0] === "OS";

        // Preserve VANGUARD or active workflow status if already set
        if (!cleanPayload.status) {
            const totalQty = getTotalQuantity(stockMap);
            cleanPayload.status = totalQty > 0 ? "IN" : "OUT";
        }
    }

    if (updatedData.categories !== undefined) cleanPayload.categories = parseArray(updatedData.categories);

    await updateDoc(itemRef, cleanPayload);
}

/**
 * DIRECT ISSUE: Supply Officer directly assigns an available item to a member.
 */
export async function issueSupplyItemToMember(itemId, memberData, selectedSize = "OS") {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Item does not exist.");

    const itemData = itemDoc.data();
    const stockMap = { ...(itemData.stock || { "OS": 1 }) };
    const targetSize = (selectedSize || "OS").toUpperCase().trim();

    const currentQty = parseInt(stockMap[targetSize] || 0, 10);
    if (currentQty <= 0) {
        throw new Error(`Size "${targetSize}" is out of supply for "${itemData.title}".`);
    }

    // Deduct stock for the issued item
    stockMap[targetSize] = currentQty - 1;

    // Check if remaining stock across all sizes is 0
    const totalRemaining = getTotalQuantity(stockMap);
    const newStatus = totalRemaining > 0 ? "IN" : "OUT";

    await updateDoc(itemRef, {
        stock: stockMap,
        status: itemData.status === "VANGUARD" ? "VANGUARD" : newStatus,
        lastIssuedToUid: memberData.uid || null,
        lastIssuedToEmail: memberData.email ? memberData.email.toLowerCase().trim() : null,
        lastIssuedToName: memberData.fullName || memberData.displayName || "Member",
        lastIssuedDate: serverTimestamp()
    });
}

/**
 * MEMBER REQUESTS ITEM: Sets status to "REQUESTED" (Order placed on order.html, pending pickup)
 */
export async function requestSupplyItem(itemId, memberData, selectedSize = "OS") {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Item does not exist.");

    const itemData = itemDoc.data();
    const stockMap = { ...(itemData.stock || { "OS": 1 }) };
    const targetSize = (selectedSize || "OS").toUpperCase().trim();

    const currentQty = parseInt(stockMap[targetSize] || 0, 10);
    if (currentQty <= 0) {
        throw new Error(`Size "${targetSize}" is out of supply for "${itemData.title}".`);
    }

    // Reserve stock quantity for this request
    stockMap[targetSize] = currentQty - 1;

    await updateDoc(itemRef, {
        stock: stockMap,
        status: "REQUESTED",
        requestedByUid: memberData.uid || null,
        requestedByEmail: memberData.email ? memberData.email.toLowerCase().trim() : null,
        requestedByName: memberData.fullName || memberData.displayName || "Member",
        requestedPhone: memberData.phone || "",
        requestedSize: targetSize,
        requestedAt: serverTimestamp()
    });
}

/**
 * OFFICER ISSUES ITEM: Supply Officer confirms physical handover and marks status as "ISSUED"
 */
export async function issueSupplyItem(itemId) {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Item does not exist.");

    const itemData = itemDoc.data();

    await updateDoc(itemRef, {
        status: "ISSUED",
        lastIssuedToUid: itemData.requestedByUid || itemData.lastIssuedToUid || null,
        lastIssuedToEmail: itemData.requestedByEmail || itemData.lastIssuedToEmail || null,
        lastIssuedToName: itemData.requestedByName || itemData.lastIssuedToName || "Member",
        lastIssuedDate: serverTimestamp(),
        // Clear pending request metadata
        requestedByUid: null,
        requestedByEmail: null,
        requestedByName: null,
        requestedPhone: null
    });
}

/**
 * CHECKIN ITEM: Resets an issued or requested item back to available closet stock.
 */
export async function checkinSupplyItem(itemId, returnedSize = "OS") {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Item does not exist.");

    const itemData = itemDoc.data();
    const stockMap = { ...(itemData.stock || { "OS": 0 }) };
    const targetSize = (returnedSize || "OS").toUpperCase().trim();

    const currentQty = parseInt(stockMap[targetSize] || 0, 10);
    stockMap[targetSize] = currentQty + 1;

    await updateDoc(itemRef, {
        stock: stockMap,
        status: "IN",
        requestedByUid: null,
        requestedByEmail: null,
        requestedByName: null
    });
}

/**
 * SET VANGUARD STATUS: Flag catalog items that are not physically stocked in unit supply
 */
export async function setAsVanguardItem(itemId, vanguardUrl) {
    const itemRef = doc(db, "supply", itemId);
    await updateDoc(itemRef, {
        status: "VANGUARD",
        stock: { "OS": 0 },
        vanguardUrl: vanguardUrl || "https://www.vanguardmil.com"
    });
}

/**
 * DELETE: Hard-deletes a supply document.
 */
export async function deleteSupplyItem(itemId) {
    await deleteDoc(doc(db, "supply", itemId));
}

/* ==========================================================================
   USER MANAGEMENT & ACCOUNT LINKING
   ========================================================================== */

export async function registerUserAccount(email, password, fullName, phone) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    let existingDocId = null;
    let existingRole = "member";

    const qEmail = query(usersRef, where("email", "==", cleanEmail));
    const snapEmail = await getDocs(qEmail);

    if (!snapEmail.empty) {
        existingDocId = snapEmail.docs[0].id;
        existingRole = snapEmail.docs[0].data().role || "member";
    } else if (cleanPhone) {
        const qPhone = query(usersRef, where("phone", "==", cleanPhone));
        const snapPhone = await getDocs(qPhone);
        if (!snapPhone.empty) {
            existingDocId = snapPhone.docs[0].id;
            existingRole = snapPhone.docs[0].data().role || "member";
        }
    }

    await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName || (snapEmail.docs[0]?.data().fullName) || "Member",
        email: cleanEmail,
        phone: cleanPhone,
        role: existingRole,
        createdAt: serverTimestamp()
    });

    if (existingDocId && existingDocId !== user.uid) {
        await deleteDoc(doc(db, "users", existingDocId));
    }

    return user;
}

export function loginUserAccount(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function logoutUserAccount() {
    return signOut(auth);
}

export function listenToAuthState(callback) {
    return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        return userDoc.exists() ? userDoc.data() : null;
    } catch (err) {
        return null;
    }
}

export async function getAllUsers() {
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserRoleInDB(targetUid, newRole) {
    await updateDoc(doc(db, "users", targetUid), { role: newRole });
}