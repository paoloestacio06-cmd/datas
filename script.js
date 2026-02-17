// ============================================
// SUPABASE CONFIG - Connected to Lovable Cloud
// ============================================
const SUPABASE_URL = "https://zvbwhxwktappxhzmytni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YndoeHdrdGFwcHhoem15dG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQxNzcsImV4cCI6MjA4NDg0MDE3N30.V-XDHkifpzmrAk_H7GT9g47ZXcmcPiwIJUEOKg502B0";

// ============================================
// STATE
// ============================================
let allImages = [];
let selectedImages = new Set();
let editingId = null;
let deletingId = null;
let cameraStream = null;
let isAdminView = false;

// ============================================
// SUPABASE HELPERS
// ============================================
const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
};

async function supabaseGet(table, query = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function supabaseInsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST", headers, body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function supabaseUpdate(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH", headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

async function supabaseDelete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "DELETE", headers
    });
    if (!res.ok) throw new Error(await res.text());
}

async function supabaseUploadFile(bucket, path, blob, contentType) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": contentType
        },
        body: blob
    });
    if (!res.ok) throw new Error(await res.text());
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ============================================
// LOAD IMAGES
// ============================================
async function loadImages() {
    try {
        allImages = await supabaseGet("images", "order=created_at.desc");
        renderAll();
    } catch (e) {
        console.error("Load error:", e);
        alert("Failed to load images. Check console.");
    }
}

// ============================================
// RENDER
// ============================================
function renderAll() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allImages.filter(img =>
        img.name.toLowerCase().includes(query) || (img.date && img.date.includes(query))
    );

    document.getElementById("totalCount").textContent = allImages.length;
    document.getElementById("foundCount").textContent = filtered.length;
    document.getElementById("selectedCount").textContent = selectedImages.size;

    renderGrid(filtered);
    renderAdminTable(filtered);
}

function renderGrid(images) {
    const grid = document.getElementById("imageGrid");
    if (!images.length) {
        grid.innerHTML = '<div class="empty-state"><div class="emoji">📷</div><p>No images found</p></div>';
        return;
    }

    grid.innerHTML = images.map(img => `
        <div class="image-card ${selectedImages.has(img.id) ? 'selected' : ''}" onclick="toggleSelect('${img.id}')">
            <div class="check">✓</div>
            <img src="${img.image_url}" alt="${img.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>No Image</text></svg>'">
            <div class="overlay">
                <h4>${escapeHtml(img.name)}</h4>
                <p>${img.date || 'No date'}</p>
                <div class="actions">
                    <button class="btn-view" onclick="event.stopPropagation(); viewImage('${img.id}')">👁 View</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); openEdit('${img.id}')">✏️</button>
                    <button class="btn-delete" onclick="event.stopPropagation(); openDelete('${img.id}')">🗑</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderAdminTable(images) {
    const tbody = document.getElementById("adminTableBody");
    if (!images.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:#888;">No images</td></tr>';
        return;
    }

    tbody.innerHTML = images.map(img => `
        <tr>
            <td><img src="${img.image_url}" alt="${img.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23f0f0f0%22 width=%2240%22 height=%2240%22/></svg>'"></td>
            <td><input class="input" value="${escapeHtml(img.name)}" id="admin-name-${img.id}"></td>
            <td><input class="input" type="date" value="${img.date || ''}" id="admin-date-${img.id}"></td>
            <td>
                <div class="admin-actions">
                    <button class="btn btn-primary btn-sm" onclick="adminSave('${img.id}')">💾 Save</button>
                    <button class="btn btn-danger btn-sm" onclick="openDelete('${img.id}')">🗑</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// ACTIONS
// ============================================
function toggleSelect(id) {
    if (selectedImages.has(id)) selectedImages.delete(id);
    else selectedImages.add(id);
    renderAll();
}

function viewImage(id) {
    const img = allImages.find(i => i.id === id);
    if (!img) return;
    document.getElementById("viewImage").src = img.image_url;
    document.getElementById("viewName").textContent = img.name;
    document.getElementById("viewDate").textContent = img.date || "No date";
    openModal("viewModal");
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
    if (!name) return alert("Name is required");

    try {
        await supabaseUpdate("images", editingId, { name, date });
        closeModal("editModal");
        await loadImages();
    } catch (e) {
        alert("Failed to save: " + e.message);
    }
}

async function adminSave(id) {
    const name = document.getElementById(`admin-name-${id}`).value.trim();
    const date = document.getElementById(`admin-date-${id}`).value;
    if (!name) return alert("Name is required");

    try {
        await supabaseUpdate("images", id, { name, date });
        await loadImages();
        alert("Saved!");
    } catch (e) {
        alert("Failed to save: " + e.message);
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
        await loadImages();
    } catch (e) {
        alert("Failed to delete: " + e.message);
    }
}

// ============================================
// FILE UPLOAD
// ============================================
async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

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
        } catch (e) {
            console.error("Upload error:", e);
            alert("Upload failed for " + file.name);
        }
    }

    event.target.value = "";
    await loadImages();
}

// ============================================
// CAMERA
// ============================================
async function openCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        document.getElementById("cameraVideo").srcObject = cameraStream;
        openModal("cameraModal");
    } catch (e) {
        alert("Camera access denied or not available.");
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
            await loadImages();
        } catch (e) {
            alert("Capture failed: " + e.message);
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
    document.getElementById("adminBtn").textContent = isAdminView ? "← Gallery" : "🗄️ Admin";
    renderAll();
}

// ============================================
// MODAL HELPERS
// ============================================
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// ============================================
// FILTER
// ============================================
function filterImages() { renderAll(); }

// ============================================
// DRAG & DROP
// ============================================
const dz = document.getElementById("dropzone");
dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("dragging"); });
dz.addEventListener("dragleave", () => dz.classList.remove("dragging"));
dz.addEventListener("drop", e => {
    e.preventDefault();
    dz.classList.remove("dragging");
    if (e.dataTransfer.files.length) {
        document.getElementById("fileInput").files = e.dataTransfer.files;
        handleFileUpload({ target: { files: e.dataTransfer.files, value: "" } });
    }
});

// ============================================
// UTILS
// ============================================
function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text;
    return d.innerHTML;
}

// ============================================
// INIT
// ============================================
loadImages();
