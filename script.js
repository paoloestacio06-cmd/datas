// =======================
// INDEXEDDB SETUP
// =======================
let db;
let dbReady = false;

const request = indexedDB.open('GalleryDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains('images')) {
        const store = db.createObjectStore('images', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
    }
};

request.onsuccess = function(event) {
    db = event.target.result;
    dbReady = true;
    loadImages();
};

request.onerror = function(event) {
    showToast('Database error: ' + event.target.errorCode);
};

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

// Toast
const toast = document.getElementById('toast');

// =======================
// STATE
// =======================
let selectedImages = new Set();
let currentStream = null;
let currentFacingMode = 'user';
let editingImage = null;
let allImages = [];

// =======================
// UTILITIES
// =======================
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateStats(total, found) {
    totalImagesEl.textContent = total;
    foundImagesEl.textContent = found;
    selectedImagesEl.textContent = selectedImages.size;
}

// =======================
// INDEXEDDB OPERATIONS
// =======================
function addImage(imageObj) {
    if (!dbReady) {
        showToast('Database not ready. Please wait...');
        return;
    }
    
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    const request = store.add(imageObj);
    
    request.onsuccess = () => {
        loadImages(searchInput.value);
        showToast('Image uploaded: ' + imageObj.id);
    };
    
    request.onerror = () => {
        showToast('Error saving image');
    };
}

function deleteImage(id) {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.delete(id);
    
    transaction.oncomplete = () => {
        selectedImages.delete(id);
        loadImages(searchInput.value);
        showToast('Image deleted');
    };
}

function updateImage(imageObj) {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.put(imageObj);
    
    transaction.oncomplete = () => {
        loadImages(searchInput.value);
        showToast('Image updated');
    };
}

function getAllImages(callback) {
    const transaction = db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const request = store.getAll();
    
    request.onsuccess = () => callback(request.result || []);
}

// =======================
// RENDER IMAGES
// =======================
function renderImages(images, filter = '') {
    const filtered = images.filter(img =>
        img.id.toLowerCase().includes(filter.toLowerCase()) || 
        img.date.includes(filter)
    );

    updateStats(images.length, filtered.length);
    
    if (filtered.length === 0) {
        imagesGrid.innerHTML = '';
        noResults.classList.add('show');
        return;
    }
    
    noResults.classList.remove('show');
    
    imagesGrid.innerHTML = filtered.map(img => `
        <div class="image-card ${selectedImages.has(img.id) ? 'selected' : ''}" data-id="${img.id}">
            <div class="selected-check">✓</div>
            <img src="${img.image}" alt="${img.id}">
            <div class="image-overlay">
                <div class="image-info">
                    <h4>${img.id}</h4>
                    <p>${img.date}</p>
                </div>
                <div class="image-actions">
                    <button class="btn-view" onclick="viewImage('${img.id}')">👁 View</button>
                    <button class="btn-edit" onclick="openEdit('${img.id}')">✏️</button>
                    <button class="btn-delete" onclick="confirmDelete('${img.id}')">🗑</button>
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

function loadImages(filter = '') {
    if (!dbReady) return;
    getAllImages(images => {
        allImages = images;
        renderImages(images, filter);
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
        modalImage.src = img.image;
        modalTitle.textContent = img.id;
        modalDate.textContent = img.date;
        imageModal.classList.add('active');
    }
}

function openEdit(id) {
    editingImage = allImages.find(i => i.id === id);
    if (editingImage) {
        editName.value = editingImage.id;
        editDate.value = editingImage.date;
        editModal.classList.add('active');
    }
}

function confirmDelete(id) {
    if (confirm('Delete this image?')) {
        deleteImage(id);
    }
}

// =======================
// UPLOAD HANDLER
// =======================
function handleFiles(files) {
    if (!files.length || !dbReady) {
        if (!dbReady) showToast('Please wait, database loading...');
        return;
    }

    const existingIds = new Set(allImages.map(img => img.id));

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            let fileName = file.name.replace(/\.[^/.]+$/, "");
            let finalId = fileName;
            let counter = 1;

            while (existingIds.has(finalId)) {
                finalId = `${fileName}_${counter++}`;
            }
            existingIds.add(finalId);

            addImage({
                id: finalId,
                date: new Date().toISOString().split('T')[0],
                image: e.target.result
            });
        };
        reader.readAsDataURL(file);
    });

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

saveEditBtn.addEventListener('click', () => {
    if (editingImage && editName.value && editDate.value) {
        updateImage({
            ...editingImage,
            id: editName.value,
            date: editDate.value
        });
        editModal.classList.remove('active');
        editingImage = null;
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
            showToast('Cannot access camera');
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

snapBtn.addEventListener('click', () => {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    
    const imageData = cameraCanvas.toDataURL('image/png');
    addImage({
        id: `camera_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        image: imageData
    });
    
    stopCamera();
    cameraModal.classList.remove('active');
});

closeCameraBtn.addEventListener('click', () => {
    stopCamera();
    cameraModal.classList.remove('active');
});
