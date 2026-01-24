// =======================
// SUPABASE CONFIGURATION
// =======================
const SUPABASE_URL = 'https://zvbwhxwktappxhzmytni.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2YndoeHdrdGFwcHhoem15dG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNjQxNzcsImV4cCI6MjA4NDg0MDE3N30.V-XDHkifpzmrAk_H7GT9g47ZXcmcPiwIJUEOKg502B0';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =======================
// DOM ELEMENTS
// =======================
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const takePictureBtn = document.getElementById('takePictureBtn');
const imagesGrid = document.getElementById('imagesGrid');
const totalImagesEl = document.getElementById('totalImages');
const foundImagesEl = document.getElementById('foundImages');
const selectedImagesEl = document.getElementById('selectedImages');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');
const dropZone = document.getElementById('dropZone');

// Modal Elements
const imageModal = document.getElementById('imageModal');
const modalClose = document.getElementById('modalClose');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');

// Camera Elements
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const snapBtn = document.getElementById('snapBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');

// Edit Elements
const editModal = document.getElementById('editModal');
const editName = document.getElementById('editName');
const editDate = document.getElementById('editDate');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Delete Elements
const deleteModal = document.getElementById('deleteModal');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

// Toast
const toast = document.getElementById('toast');

// =======================
// STATE
// =======================
let selectedImages = new Set();
let currentStream = null;
let currentFacingMode = 'user';
let editingImage = null;
let deletingImageId = null;
let allImages = [];
let totalImageCount = 0;

// =======================
// UTILITIES
// =======================
function showToast(message, type = 'default') {
    toast.textContent = message;
    toast.className = 'toast show';
    if (type === 'error') toast.classList.add('error');
    if (type === 'success') toast.classList.add('success');
    setTimeout(() => toast.classList.remove('show', 'error', 'success'), 3000);
}

function updateStats(found) {
    totalImagesEl.textContent = totalImageCount;
    foundImagesEl.textContent = found;
    selectedImagesEl.textContent = selectedImages.size;
}

// =======================
// DATABASE OPERATIONS
// =======================
async function loadImages() {
    try {
        // Get accurate total count first (no 1000 limit)
        const { count, error: countError } = await supabaseClient
            .from('images')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        
        totalImageCount = count || 0;

        // Fetch images for display (limited to 1000 for performance)
        const { data, error } = await supabaseClient
            .from('images')
            .select('*')
            .order('created_at', { ascending: false })
            .range(0, 999);

        if (error) throw error;
        
        allImages = data || [];
        renderImages(allImages, searchInput.value);
    } catch (error) {
        showToast('Error loading images: ' + error.message, 'error');
    }
}

async function uploadImage(file, customName) {
    try {
        let imageUrl;
        let fileName;

        if (typeof file === 'string') {
            // Base64 data from camera
            const response = await fetch(file);
            const blob = await response.blob();
            fileName = customName || `camera_${Date.now()}`;
            const filePath = `${Date.now()}_${fileName}.png`;

            const { error: uploadError } = await supabaseClient.storage
                .from('images')
                .upload(filePath, blob);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('images')
                .getPublicUrl(filePath);

            imageUrl = urlData.publicUrl;
        } else {
            // File from upload
            fileName = customName || file.name.replace(/\.[^/.]+$/, '');
            const filePath = `${Date.now()}_${file.name}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage
                .from('images')
                .getPublicUrl(filePath);

            imageUrl = urlData.publicUrl;
        }

        // Check for duplicate names
        const existingNames = new Set(allImages.map(img => img.name));
        let finalName = fileName;
        let counter = 1;
        while (existingNames.has(finalName)) {
            finalName = `${fileName}_${counter++}`;
        }

        const { error: insertError } = await supabaseClient
            .from('images')
            .insert({
                name: finalName,
                date: new Date().toISOString().split('T')[0],
                image_url: imageUrl
            });

        if (insertError) throw insertError;

        showToast(`Image uploaded: ${finalName}`, 'success');
        await loadImages();
        return true;
    } catch (error) {
        showToast('Error uploading image: ' + error.message, 'error');
        return false;
    }
}

async function updateImage(id, name, date) {
    try {
        const { error } = await supabaseClient
            .from('images')
            .update({ name, date })
            .eq('id', id);

        if (error) throw error;

        showToast('Image updated', 'success');
        await loadImages();
        return true;
    } catch (error) {
        showToast('Error updating image: ' + error.message, 'error');
        return false;
    }
}

async function deleteImage(id) {
    try {
        const { error } = await supabaseClient
            .from('images')
            .delete()
            .eq('id', id);

        if (error) throw error;

        selectedImages.delete(id);
        showToast('Image deleted', 'success');
        await loadImages();
        return true;
    } catch (error) {
        showToast('Error deleting image: ' + error.message, 'error');
        return false;
    }
}

// =======================
// RENDER IMAGES
// =======================
function renderImages(images, filter = '') {
    const filtered = images.filter(img =>
        img.name.toLowerCase().includes(filter.toLowerCase()) ||
        img.date.includes(filter)
    );

    updateStats(filtered.length);

    if (filtered.length === 0) {
        imagesGrid.innerHTML = '';
        noResults.classList.add('show');
        return;
    }

    noResults.classList.remove('show');

    imagesGrid.innerHTML = filtered.map(img => `
        <div class="image-card ${selectedImages.has(img.id) ? 'selected' : ''}" data-id="${img.id}">
            <div class="selected-check">✓</div>
            <img src="${img.image_url}" alt="${img.name}" loading="lazy">
            <div class="image-overlay">
                <div class="image-info">
                    <h4>${img.name}</h4>
                    <p>${img.date}</p>
                </div>
                <div class="image-actions">
                    <button class="btn-view" onclick="viewImage('${img.id}')">👁 View</button>
                    <button class="btn-edit" onclick="openEdit('${img.id}')">✏️</button>
                    <button class="btn-delete" onclick="openDelete('${img.id}')">🗑</button>
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers for selection
    document.querySelectorAll('.image-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const id = card.dataset.id;
            toggleSelection(id);
        });
    });
}

// =======================
// IMAGE ACTIONS
// =======================
function toggleSelection(id) {
    if (selectedImages.has(id)) {
        selectedImages.delete(id);
    } else {
        selectedImages.add(id);
    }
    renderImages(allImages, searchInput.value);
}

function viewImage(id) {
    const img = allImages.find(i => i.id === id);
    if (img) {
        modalImage.src = img.image_url;
        modalTitle.textContent = img.name;
        modalDate.textContent = img.date;
        imageModal.classList.add('active');
    }
}

function openEdit(id) {
    editingImage = allImages.find(i => i.id === id);
    if (editingImage) {
        editName.value = editingImage.name;
        editDate.value = editingImage.date;
        editModal.classList.add('active');
    }
}

function openDelete(id) {
    deletingImageId = id;
    deleteModal.classList.add('active');
}

// =======================
// UPLOAD HANDLER
// =======================
async function handleFiles(files) {
    if (!files.length) return;

    for (const file of files) {
        await uploadImage(file);
    }

    fileInput.value = '';
}

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// =======================
// DRAG & DROP
// =======================
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => fileInput.click());

// =======================
// SEARCH
// =======================
searchInput.addEventListener('input', (e) => {
    renderImages(allImages, e.target.value);
});

// =======================
// MODALS
// =======================
modalClose.addEventListener('click', () => imageModal.classList.remove('active'));
imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) imageModal.classList.remove('active');
});

cancelEditBtn.addEventListener('click', () => {
    editModal.classList.remove('active');
    editingImage = null;
});

saveEditBtn.addEventListener('click', async () => {
    if (editingImage && editName.value && editDate.value) {
        await updateImage(editingImage.id, editName.value, editDate.value);
        editModal.classList.remove('active');
        editingImage = null;
    }
});

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.remove('active');
    deletingImageId = null;
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (deletingImageId) {
        await deleteImage(deletingImageId);
        deleteModal.classList.remove('active');
        deletingImageId = null;
    }
});

// =======================
// CAMERA
// =======================
async function startCamera(facingMode) {
    stopCamera();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        currentStream = stream;
        cameraVideo.srcObject = stream;
        currentFacingMode = facingMode;
    } catch (err) {
        if (facingMode === 'environment') {
            startCamera('user');
        } else {
            showToast('Cannot access camera', 'error');
        }
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    cameraVideo.srcObject = null;
}

takePictureBtn.addEventListener('click', () => {
    cameraModal.classList.add('active');
    startCamera('user');
});

switchCameraBtn.addEventListener('click', () => {
    const newMode = currentFacingMode === 'user' ? 'environment' : 'user';
    startCamera(newMode);
});

snapBtn.addEventListener('click', async () => {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);

    const imageData = cameraCanvas.toDataURL('image/png');
    await uploadImage(imageData, `camera_${Date.now()}`);

    stopCamera();
    cameraModal.classList.remove('active');
});

closeCameraBtn.addEventListener('click', () => {
    stopCamera();
    cameraModal.classList.remove('active');
});

// =======================
// INITIALIZE
// =======================
document.addEventListener('DOMContentLoaded', () => {
    loadImages();
});
