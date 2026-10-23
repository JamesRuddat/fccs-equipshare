// /js/firebase-db.js - Clean Data Access Layer with Dual-List Inventory & Issue Tracking
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
    addDoc, getDocs, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendPasswordResetEmail, onAuthStateChanged, signOut
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
const issuesRef = collection(db, "issues");

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
   LIST 1: SUPPLY / INVENTORY MANAGEMENT (`supply` collection)
   ========================================================================== */

/**
 * CREATE: Adds a new inventory item to the supply closet.
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
        status: initialStatus,
        hideFromCatalog: !!itemData.hideFromCatalog,
        vanguardUrl: itemData.vanguardUrl || "",
        image: itemData.image || "",
        createdAt: serverTimestamp()
    };

    return await addDoc(supplyRef, payload);
}

/**
 * READ ALL SUPPLY: Fetches all inventory items from closet stock.
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
 * UPDATE: Updates specific metadata or stock maps on an inventory item.
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

        if (!cleanPayload.status) {
            const totalQty = getTotalQuantity(stockMap);
            cleanPayload.status = totalQty > 0 ? "IN" : "OUT";
        }
    }

    if (updatedData.categories !== undefined) cleanPayload.categories = parseArray(updatedData.categories);

    await updateDoc(itemRef, cleanPayload);
}

/**
 * DELETE: Hard-deletes an inventory item document.
 */
export async function deleteSupplyItem(itemId) {
    await deleteDoc(doc(db, "supply", itemId));
}

/* ==========================================================================
   LIST 2: ISSUED EQUIPMENT LEDGER (`issues` collection)
   ========================================================================== */

/**
 * DIRECT ISSUE:
 * 1. Decrements 1 unit of target size in supply closet (`supply` collection).
 * 2. Status stays "IN" unless remaining stock across all sizes hits 0.
 * 3. Creates a separate checkout record in the `issues` collection.
 */
export async function issueSupplyItemToMember(itemId, memberData, selectedSize = "OS") {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Supply item does not exist.");

    const itemData = itemDoc.data();
    const stockMap = { ...(itemData.stock || { "OS": 1 }) };
    const targetSize = (selectedSize || "OS").toUpperCase().trim();

    const currentQty = parseInt(stockMap[targetSize] || 0, 10);
    if (currentQty <= 0) {
        throw new Error(`Size "${targetSize}" is currently out of stock for "${itemData.title}".`);
    }

    // 1. Deduct 1 unit from specified size
    stockMap[targetSize] = currentQty - 1;
    const totalRemaining = getTotalQuantity(stockMap);

    // 2. Status remains "IN" as long as total remaining stock > 0
    let updatedStatus = "IN";
    if (itemData.status === "VANGUARD") {
        updatedStatus = "VANGUARD";
    } else if (totalRemaining === 0) {
        updatedStatus = "OUT";
    }

    await updateDoc(itemRef, {
        stock: stockMap,
        status: updatedStatus,
        lastIssuedToUid: memberData?.uid || null,
        lastIssuedToEmail: memberData?.email ? memberData.email.toLowerCase().trim() : null,
        lastIssuedToName: memberData?.fullName || memberData?.displayName || "Unassigned Member",
        lastIssuedDate: serverTimestamp()
    });

    // 3. Log explicit checkout entry in the 'issues' collection
    try {
        await addDoc(issuesRef, {
            supplyItemId: itemId,
            locationCode: itemData.locationCode || "",
            title: itemData.title || "Untitled Item",
            size: targetSize,
            price: itemData.price || 0,
            issuedToUid: memberData?.uid || null,
            issuedToEmail: memberData?.email ? memberData.email.toLowerCase().trim() : null,
            issuedToName: memberData?.fullName || memberData?.displayName || "Unassigned / General Unit",
            status: "ISSUED",
            issuedAt: serverTimestamp()
        });
    } catch (err) {
        console.warn("Could not log issue record (Check Firestore Rules for 'issues'):", err);
    }
}

/**
 * READ ALL ISSUED PROPERTY: Fetches active checkout records from the `issues` collection.
 */
export async function getAllIssuedEquipment() {
    try {
        const q = query(issuesRef, where("status", "==", "ISSUED"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.warn("Error fetching issued equipment list:", err);
        return [];
    }
}

/**
 * READ MEMBER ISSUED EQUIPMENT: Fetches active items issued to a specific member.
 */
export async function getIssuedItemsForMember(userUid, userEmail = '') {
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    const issuedItems = [];

    try {
        const qUid = query(issuesRef, where("issuedToUid", "==", userUid), where("status", "==", "ISSUED"));
        const snapUid = await getDocs(qUid);
        snapUid.docs.forEach(d => issuedItems.push({ id: d.id, ...d.data() }));

        if (issuedItems.length === 0 && cleanEmail) {
            const qEmail = query(issuesRef, where("issuedToEmail", "==", cleanEmail), where("status", "==", "ISSUED"));
            const snapEmail = await getDocs(qEmail);
            snapEmail.docs.forEach(d => issuedItems.push({ id: d.id, ...d.data() }));
        }
    } catch (err) {
        console.warn("Error querying 'issues' collection for member:", err);
    }

    return issuedItems;
}

/**
 * CHECK-IN ITEM: 
 * Returns gear from a member back to available closet stock.
 * 1. Increments target size stock in `supply`.
 * 2. Marks the `issues` ledger document as "RETURNED".
 */
export async function checkinSupplyItem(issueRecordId, itemId, returnedSize = "OS") {
    // 1. Close out issue record in `issues`
    if (issueRecordId) {
        try {
            const issueDocRef = doc(db, "issues", issueRecordId);
            await updateDoc(issueDocRef, {
                status: "RETURNED",
                returnedAt: serverTimestamp()
            });
        } catch (err) {
            console.warn("Could not update issue ledger entry:", err);
        }
    }

    // 2. Restore 1 unit to target size in `supply`
    if (itemId) {
        const itemRef = doc(db, "supply", itemId);
        const itemDoc = await getDoc(itemRef);

        if (itemDoc.exists()) {
            const itemData = itemDoc.data();
            const stockMap = { ...(itemData.stock || { "OS": 0 }) };
            const targetSize = (returnedSize || "OS").toUpperCase().trim();

            const currentQty = parseInt(stockMap[targetSize] || 0, 10);
            stockMap[targetSize] = currentQty + 1;

            await updateDoc(itemRef, {
                stock: stockMap,
                status: itemData.status === "VANGUARD" ? "VANGUARD" : "IN"
            });
        }
    }
}

/* ==========================================================================
   ORDER REQUEST WORKFLOW (Pending Requests before Handout)
   ========================================================================== */

/**
 * MEMBER REQUESTS ITEM: Reserves stock and creates pending request state on item.
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
        throw new Error(`Size "${targetSize}" is out of stock for "${itemData.title}".`);
    }

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
 * CONFIRM PENDING REQUEST: Handout pending request and log to `issues` ledger.
 */
export async function issueSupplyItem(itemId) {
    const itemRef = doc(db, "supply", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) throw new Error("Item does not exist.");

    const itemData = itemDoc.data();
    const totalRemaining = getTotalQuantity(itemData.stock || {});

    // Clear pending request status on main item
    await updateDoc(itemRef, {
        status: totalRemaining > 0 ? "IN" : "OUT",
        lastIssuedToUid: itemData.requestedByUid || null,
        lastIssuedToEmail: itemData.requestedByEmail || null,
        lastIssuedToName: itemData.requestedByName || "Member",
        lastIssuedDate: serverTimestamp(),
        requestedByUid: null,
        requestedByEmail: null,
        requestedByName: null,
        requestedPhone: null,
        requestedSize: null,
        requestedAt: null
    });

    // Log to `issues` ledger
    try {
        await addDoc(issuesRef, {
            supplyItemId: itemId,
            locationCode: itemData.locationCode || "",
            title: itemData.title || "Untitled Item",
            size: itemData.requestedSize || "OS",
            issuedToUid: itemData.requestedByUid || null,
            issuedToEmail: itemData.requestedByEmail || null,
            issuedToName: itemData.requestedByName || "Member",
            status: "ISSUED",
            issuedAt: serverTimestamp()
        });
    } catch (err) {
        console.warn("Could not log to 'issues' collection:", err);
    }
}

/**
 * SET VANGUARD STATUS
 */
export async function setAsVanguardItem(itemId, vanguardUrl) {
    const itemRef = doc(db, "supply", itemId);
    await updateDoc(itemRef, {
        status: "VANGUARD",
        stock: { "OS": 0 },
        vanguardUrl: vanguardUrl || "https://www.vanguardmil.com"
    });
}

/* ==========================================================================
   USER ACCOUNT & ROLE MANAGEMENT
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

export async function resetUserPassword(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error("Please enter a valid email address.");
    await sendPasswordResetEmail(auth, cleanEmail);
}

export async function correctUserEmail(identifier, password, newEmail) {
    const cleanIdentifier = (identifier || '').trim();
    const cleanNewEmail = (newEmail || '').trim().toLowerCase();
    const cleanPhone = cleanIdentifier.replace(/\D/g, '');

    if (!cleanIdentifier || !password || !cleanNewEmail) {
        throw new Error("All fields are required.");
    }

    const snapshot = await getDocs(usersRef);
    const matchingDoc = snapshot.docs.find(d => {
        const data = d.data();
        const nameMatch = data.fullName && data.fullName.toLowerCase() === cleanIdentifier.toLowerCase();
        const userCleanPhone = (data.phone || '').replace(/\D/g, '');
        const phoneMatch = cleanPhone.length >= 7 && userCleanPhone === cleanPhone;
        return nameMatch || phoneMatch;
    });

    if (!matchingDoc) {
        throw new Error("No account found matching that name or phone number.");
    }

    const userData = matchingDoc.data();
    const oldEmail = userData.email;

    let userCredential;
    try {
        userCredential = await signInWithEmailAndPassword(auth, oldEmail, password);
    } catch (err) {
        throw new Error("Incorrect password for this account.");
    }

    const newCredential = await createUserWithEmailAndPassword(auth, cleanNewEmail, password);
    const newUid = newCredential.user.uid;

    await setDoc(doc(db, "users", newUid), {
        ...userData,
        uid: newUid,
        email: cleanNewEmail,
        updatedAt: serverTimestamp()
    });

    await deleteDoc(doc(db, "users", matchingDoc.id));

    return cleanNewEmail;
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