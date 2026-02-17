// ============================================
// SUPABASE CONFIG - Connected to Cloud Database
// ============================================
const SUPABASE_URL = "https://zvbwhxwktappxhzmytni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YndoeHdrdGFwcHhoem15dG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQxNzcsImV4cCI6MjA4NDg0MDE3N30.V-XDHkifpzmrAk_H7GT9g47ZXcmcPiwIJUEOKg502B0";

// ============================================
// AUTHENTICATION
// ============================================
const AUTH_CREDENTIALS = {
    username: "admin",
    password: "admin123"
};

// Check if user is already logged in
function checkAuth() {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const username = localStorage.getItem("username");

    if (isLoggedIn === "true" && username) {
        showApp(username);
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById("loginContainer").style.display = "flex";
    document.getElementById("app").style.display = "none";
}

function showApp(username) {
    document.getElementById("loginContainer").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("userName").textContent = username;
    loadImages();
}

// Handle login form submission
document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
        if (rememberMe) {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("username", username);
        } else {
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("username", username);
        }

        showToast("Login Successful!", "Welcome back, " + username + "!", "success");
        setTimeout(() => showApp(username), 500);
    } else {
        showToast("Login Failed", "Invalid username or password", "error");

        // Shake animation on error
        const loginCard = document.querySelector(".login-card");
        loginCard.style.animation = "none";
        setTimeout(() => {
            loginCard.style.animation = "shake 0.5s ease-in-out";
        }, 10);
    }
});

function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("username");

    showToast("Logged Out", "You have been logged out successfully", "info");
    setTimeout(() => {
        showLogin();
        // Reset form
        document.getElementById("loginForm").reset();
    }, 500);
}

// ============================================
// STATE
// ============================================
let allImages = [];
let selectedImages = new Set();
let editingId = null;
let deletingId = null;
let cameraStream = null;
let isAdminView = false;
let currentViewImage = null;

// ============================================
// SUPABASE HELPERS - WITH FIXED PAGINATION
// ============================================
const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation,count=exact"
};

/**
 * FIXED: Fetch ALL records from Supabase with pagination
 * Supabase has a default limit of 1000 records per request
 * This function fetches in batches until all records are retrieved
 */
async function supabaseGet(table, query = "") {
    let allData = [];
    let offset = 0;
    const limit = 1000; // Supabase max per request
    let hasMore = true;
    let totalFromHeader = null;

    console.log(`📄 Starting to fetch ALL images from ${table}...`);

    while (hasMore) {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${query}&limit=${limit}&offset=${offset}`;

        try {
            const res = await fetch(url, {
                headers: {
                    ...headers,
                    "Prefer": "return=representation,count=exact"
                }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errorText}`);
            }

            // Get total count from Content-Range header
            const contentRange = res.headers.get('Content-Range');
            if (contentRange && !totalFromHeader) {
                const match = contentRange.match(/\/(\d+)$/);
                if (match) {
                    totalFromHeader = parseInt(match[1]);
                    console.log(`📊 Supabase reports ${totalFromHeader} total records`);

                    // Update loading progress
                    updateLoadingProgress(0, totalFromHeader);
                }
            }

            const data = await res.json();

            if (data.length > 0) {
                allData = allData.concat(data);
                console.log(`📦 Batch ${Math.floor(offset/limit) + 1}: Fetched ${data.length} records. Total so far: ${allData.length}`);

                // Update loading progress
                if (totalFromHeader) {
                    updateLoadingProgress(allData.length, totalFromHeader);
                }

                // Check if we got less than limit, meaning no more data
                if (data.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                // No more data
                hasMore = false;
            }
        } catch (error) {
            console.error(`❌ Error fetching batch at offset ${offset}:`, error);
            showToast("Database Error", "Failed to fetch images: " + error.message, "error");
            hasMore = false;
        }
    }

    console.log(`✅ COMPLETE! Total records fetched: ${allData.length}`);
    console.log(`📊 Verification: Array length = ${allData.length}`);

    return allData;
}

function updateLoadingProgress(current, total) {
    const progressEl = document.getElementById("loadingProgress");
    if (progressEl && total > 0) {
        const percentage = Math.round((current / total) * 100);
        progressEl.textContent = `Loading ${current.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} images (${percentage}%)`;
    }
}

async function supabaseInsert(table, data) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: "POST", 
            headers, 
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Insert failed: ${errorText}`);
        }
        
        return res.json();
    } catch (error) {
        console.error("Insert error:", error);
        throw error;
    }
}

async function supabaseUpdate(table, id, data) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
            method: "PATCH", 
            headers: { ...headers, "Prefer": "return=representation" },
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Update failed: ${errorText}`);
        }
        
        return res.json();
    } catch (error) {
        console.error("Update error:", error);
        throw error;
    }
}

async function supabaseDelete(table, id) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
            method: "DELETE", 
            headers
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Delete failed: ${errorText}`);
        }
    } catch (error) {
        console.error("Delete error:", error);
        throw error;
    }
}

async function supabaseUploadFile(bucket, path, blob, contentType) {
    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": "Bearer " + SUPABASE_ANON_KEY,
                "Content-Type": contentType
            },
            body: blob
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Upload failed: ${errorText}`);
        }
        
        return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    } catch (error) {
        console.error("Upload error:", error);
        throw error;
    }
}

// ============================================
// LOAD IMAGES - WITH FULL PAGINATION
// ============================================
async function loadImages() {
    try {
        showLoading(true);

        // Clear cache first
        allImages = [];
        selectedImages.clear();

        console.log(`🚀 Starting image load process...`);

        // Fetch ALL images from database with pagination
        allImages = await supabaseGet("images", "order=created_at.desc");

        // Force array if not already
        if (!Array.isArray(allImages)) {
            console.warn("⚠️ Response is not an array, converting...");
            allImages = [];
        }

        // Log for debugging - to verify exact count
        console.log(`✅ FINAL RESULT: Total images loaded from database: ${allImages.length}`);
        if (allImages.length > 0) {
            console.log(`🔍 First image:`, allImages[0]);
            console.log(`🔍 Last image:`, allImages[allImages.length - 1]);
        }

        // Force counter update
        renderAll();
        showLoading(false);

        // Show toast with count
        if (allImages.length > 0) {
            showToast("Gallery Loaded", `Successfully loaded ${allImages.length.toLocaleString('en-US')} image(s) from database`, "success");
        } else {
            showToast("Gallery Empty", "No images found in database. Upload some images to get started!", "info");
        }
    } catch (e) {
        console.error("❌ Load error:", e);
        showToast("Load Failed", "Failed to load images: " + e.message, "error");
        showLoading(false);
        // Set to empty array if load fails
        allImages = [];
        renderAll();
    }
}

function showLoading(show) {
    const container = document.getElementById("loadingContainer");
    const grid = document.getElementById("imageGrid");
    const dropzone = document.getElementById("dropzone");

    if (show) {
        container.style.display = "block";
        grid.style.display = "none";
        dropzone.style.display = "none";
    } else {
        container.style.display = "none";
        // Clear progress text
        const progressEl = document.getElementById("loadingProgress");
        if (progressEl) {
            progressEl.textContent = "";
        }
        if (!isAdminView) {
            grid.style.display = "grid";
            dropzone.style.display = "block";
        }
    }
}

// ============================================
// RENDER - 100% ACCURATE COUNTERS
// ============================================
function renderAll() {
    // Get search query
    const searchInput = document.getElementById("searchInput");
    const query = searchInput ? searchInput.value.toLowerCase() : "";

    // Filter images based on search
    const filtered = allImages.filter(img =>
        img.name.toLowerCase().includes(query) || (img.date && img.date.includes(query))
    );

    // Get actual counts - 100% accurate from the array
    const totalCount = allImages.length;
    const foundCount = filtered.length;
    const selectedCount = selectedImages.size;

    // Update display with proper number formatting
    const totalCountEl = document.getElementById("totalCount");
    const foundCountEl = document.getElementById("foundCount");
    const selectedCountEl = document.getElementById("selectedCount");

    if (totalCountEl) totalCountEl.textContent = totalCount.toLocaleString('en-US');
    if (foundCountEl) foundCountEl.textContent = foundCount.toLocaleString('en-US');
    if (selectedCountEl) selectedCountEl.textContent = selectedCount.toLocaleString('en-US');

    // Debug log to verify accuracy
    console.log(`📊 COUNTER UPDATE:`);
    console.log(`   - Total Images in Memory: ${totalCount}`);
    console.log(`   - Filtered/Found: ${foundCount}`);
    console.log(`   - Selected: ${selectedCount}`);

    // Update bulk delete count
    const bulkDeleteCount = document.getElementById("bulkDeleteCount");
    if (bulkDeleteCount) {
        bulkDeleteCount.textContent = selectedCount.toLocaleString('en-US');
    }

    // Show/hide bulk actions
    const bulkActions = document.getElementById("bulkActions");
    if (bulkActions) {
        if (selectedCount > 0) {
            bulkActions.style.display = "flex";
        } else {
            bulkActions.style.display = "none";
        }
    }

    // Render the grid and admin table
    renderGrid(filtered);
    renderAdminTable(filtered);
}

function renderGrid(images) {
    const grid = document.getElementById("imageGrid");
    if (!images.length) {
        grid.innerHTML = '<div class="empty-state"><div class="emoji">📷</div><p>No images found</p><small>Try uploading some images or adjust your search</small></div>';
        return;
    }

    grid.innerHTML = images.map(img => `
        <div class="image-card ${selectedImages.has(img.id) ? 'selected' : ''}" onclick="toggleSelect('${img.id}')" data-testid="image-card-${img.id}">
            <div class="check">✓</div>
            <img src="${img.image_url}" alt="${escapeHtml(img.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="overlay">
                <h4>${escapeHtml(img.name)}</h4>
                <p>📅 ${img.date || 'No date'}</p>
                <div class="actions">
                    <button class="btn-view" onclick="event.stopPropagation(); viewImage('${img.id}')" data-testid="view-button-${img.id}">👁 View</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); openEdit('${img.id}')" data-testid="edit-button-${img.id}">✏️</button>
                    <button class="btn-delete" onclick="event.stopPropagation(); openDelete('${img.id}')" data-testid="delete-button-${img.id}">🗑</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAdminTable(images) {
    const tbody = document.getElementById("adminTableBody");
    if (!images.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#888;">No images found</td></tr>';
        return;
    }

    tbody.innerHTML = images.map(img => `
        <tr data-testid="admin-row-${img.id}">
            <td><img src="${img.image_url}" alt="${escapeHtml(img.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E'"></td>
            <td><input class="input" value="${escapeHtml(img.name)}" id="admin-name-${img.id}" data-testid="admin-name-${img.id}"></td>
            <td><input class="input" type="date" value="${img.date || ''}" id="admin-date-${img.id}" data-testid="admin-date-${img.id}"></td>
            <td>
                <div class="admin-actions">
                    <button class="btn btn-primary btn-sm" onclick="adminSave('${img.id}')" data-testid="admin-save-${img.id}">💾 Save</button>
                    <button class="btn btn-danger btn-sm" onclick="openDelete('${img.id}')" data-testid="admin-delete-${img.id}">🗑</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// ACTIONS
// ============================================
function toggleSelect(id) {
    if (selectedImages.has(id)) {
        selectedImages.delete(id);
    } else {
        selectedImages.add(id);
    }
    renderAll();
}

function clearSelection() {
    selectedImages.clear();
    renderAll();
    showToast("Selection Cleared", "All images have been deselected", "info");
}

function viewImage(id) {
    const img = allImages.find(i => i.id === id);
    if (!img) return;

    currentViewImage = img;
    document.getElementById("viewImage").src = img.image_url;
    document.getElementById("viewName").textContent = img.name;
    document.getElementById("viewDate").textContent = img.date || "No date";
    openModal("viewModal");
}

function downloadImage() {
    if (!currentViewImage) return;

    const link = document.createElement('a');
    link.href = currentViewImage.image_url;
    link.download = currentViewImage.name + '.jpg';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Download Started", "Your image is being downloaded", "success");
}

function openEdit(id) {
    const img = allImages.find(i => i.id === id);
    if (!img) return;
    editingId = id;
    document.getElementById("editName").value = img.name;
    document.getElementById("editDate").value = img.date || "";
    openModal("editModal");
}

async function saveEdit() {
    const name = document.getElementById("editName").value.trim();
    const date = document.getElementById("editDate").value;
    if (!name) {
        showToast("Validation Error", "Name is required", "error");
        return;
    }

    try {
        await supabaseUpdate("images", editingId, { name, date });
        closeModal("editModal");
        showToast("Saved!", "Image details updated successfully", "success");
        await loadImages();
    } catch (e) {
        showToast("Save Failed", "Failed to save: " + e.message, "error");
    }
}

async function adminSave(id) {
    const name = document.getElementById(`admin-name-${id}`).value.trim();
    const date = document.getElementById(`admin-date-${id}`).value;
    if (!name) {
        showToast("Validation Error", "Name is required", "error");
        return;
    }

    try {
        await supabaseUpdate("images", id, { name, date });
        showToast("Saved!", "Image details updated successfully", "success");
        await loadImages();
    } catch (e) {
        showToast("Save Failed", "Failed to save: " + e.message, "error");
    }
}

function openDelete(id) {
    deletingId = id;
    openModal("deleteModal");
}

async function confirmDelete() {
    try {
        await supabaseDelete("images", deletingId);
        selectedImages.delete(deletingId);
        closeModal("deleteModal");
        showToast("Deleted!", "Image has been deleted successfully", "success");

        // Reload to get accurate count
        await loadImages();
        console.log(`🗑️ Delete complete. New total: ${allImages.length} images`);
    } catch (e) {
        showToast("Delete Failed", "Failed to delete: " + e.message, "error");
    }
}

async function bulkDelete() {
    if (selectedImages.size === 0) return;

    const count = selectedImages.size;
    const confirmed = confirm(`Are you sure you want to delete ${count} selected image(s)? This action cannot be undone.`);

    if (!confirmed) return;

    try {
        showLoading(true);
        const deletePromises = Array.from(selectedImages).map(id =>
            supabaseDelete("images", id)
        );
        await Promise.all(deletePromises);

        selectedImages.clear();
        showToast("Bulk Delete Complete!", `Successfully deleted ${count} image(s)`, "success");

        // Reload to get accurate count
        await loadImages();
        console.log(`🗑️ Bulk delete complete. New total: ${allImages.length} images`);
    } catch (e) {
        showToast("Bulk Delete Failed", "Some images could not be deleted: " + e.message, "error");
        await loadImages();
    }
}

// ============================================
// FILE UPLOAD
// ============================================
async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    showLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        try {
            const filePath = `${Date.now()}_${file.name}`;
            const publicUrl = await supabaseUploadFile("images", filePath, file, file.type);
            const name = file.name.replace(/\.[^/.]+$/, "");

            await supabaseInsert("images", {
                name,
                date: new Date().toISOString().split("T")[0],
                image_url: publicUrl
            });
            successCount++;
        } catch (e) {
            console.error("Upload error:", e);
            failCount++;
        }
    }

    event.target.value = "";

    // Force complete reload from database
    console.log(`📤 Upload complete. Reloading all images...`);
    await loadImages();

    const newTotal = allImages.length;
    console.log(`📤 Upload complete. New total: ${newTotal} images`);

    if (successCount > 0) {
        showToast("Upload Complete!", `Uploaded ${successCount} image(s). Total: ${newTotal.toLocaleString('en-US')}`, "success");
    }
    if (failCount > 0) {
        showToast("Upload Partial", `${failCount} image(s) failed to upload`, "error");
    }
}

// ============================================
// CAMERA
// ============================================
async function openCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });
        document.getElementById("cameraVideo").srcObject = cameraStream;
        openModal("cameraModal");
    } catch (e) {
        showToast("Camera Error", "Camera access denied or not available", "error");
    }
}

async function capturePhoto() {
    const video = document.getElementById("cameraVideo");
    const canvas = document.getElementById("cameraCanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        try {
            const fileName = `camera_${Date.now()}`;
            const filePath = `${Date.now()}_${fileName}.png`;
            const publicUrl = await supabaseUploadFile("images", filePath, blob, "image/png");

            await supabaseInsert("images", {
                name: fileName,
                date: new Date().toISOString().split("T")[0],
                image_url: publicUrl
            });

            closeCamera();
            showToast("Photo Captured!", "Your photo has been saved successfully", "success");

            // Reload to get accurate count
            await loadImages();
            console.log(`📸 Camera capture complete. New total: ${allImages.length} images`);
        } catch (e) {
            showToast("Capture Failed", "Failed to save photo: " + e.message, "error");
        }
    }, "image/png");
}

function closeCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    closeModal("cameraModal");
}

// ============================================
// ADMIN TOGGLE
// ============================================
function toggleAdmin() {
    isAdminView = !isAdminView;
    document.getElementById("adminPanel").style.display = isAdminView ? "block" : "none";
    document.getElementById("imageGrid").style.display = isAdminView ? "none" : "grid";
    document.getElementById("dropzone").style.display = isAdminView ? "none" : "block";
    document.getElementById("adminBtn").innerHTML = isAdminView ? "<span>🖼️ Gallery</span>" : "<span>🗄️ Admin</span>";
    renderAll();
}

// ============================================
// MODAL HELPERS
// ============================================
function openModal(id) {
    document.getElementById(id).classList.add("open");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("open");
}

// ============================================
// FILTER
// ============================================
function filterImages() {
    renderAll();
}

// ============================================
// MANUAL REFRESH
// ============================================
async function refreshGallery() {
    console.log("🔄 Manual refresh triggered...");
    showToast("Refreshing...", "Loading latest images from database", "info");
    await loadImages();
}

// ============================================
// DRAG & DROP
// ============================================
const dz = document.getElementById("dropzone");

if (dz) {
    dz.addEventListener("click", () => {
        document.getElementById("fileInput").click();
    });

    dz.addEventListener("dragover", e => {
        e.preventDefault();
        dz.classList.add("dragging");
    });

    dz.addEventListener("dragleave", () => {
        dz.classList.remove("dragging");
    });

    dz.addEventListener("drop", e => {
        e.preventDefault();
        dz.classList.remove("dragging");
        if (e.dataTransfer.files.length) {
            const fileInput = document.getElementById("fileInput");
            fileInput.files = e.dataTransfer.files;
            handleFileUpload({ target: fileInput });
        }
    });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
        success: "✅",
        error: "❌",
        info: "ℹ️"
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "slideInRight 0.3s ease-out reverse";
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// ============================================
// UTILS
// ============================================
function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener("keydown", (e) => {
    // Escape key to close modals
    if (e.key === "Escape") {
        const modals = ["viewModal", "editModal", "deleteModal", "cameraModal"];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && modal.classList.contains("open")) {
                closeModal(modalId);
            }
        });
    }

    // Ctrl/Cmd + A to select all (when not in input)
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        allImages.forEach(img => selectedImages.add(img.id));
        renderAll();
        showToast("All Selected", `Selected ${allImages.length} image(s)`, "info");
    }

    // Ctrl/Cmd + D to clear selection
    if ((e.ctrlKey || e.metaKey) && e.key === "d" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        clearSelection();
    }
});

// ============================================
// INIT - AUTO START ON PAGE LOAD
// ============================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MEDGISTIX SKU System Starting...");
    console.log("📊 Database URL:", SUPABASE_URL);
    console.log("✅ All systems ready!");
    checkAuth();
});
