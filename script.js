// =======================
// INDEXEDDB SETUP
// =======================
let db;
const request = indexedDB.open('GalleryDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;
    const store = db.createObjectStore('images', { keyPath: 'id' });
    store.createIndex('id', 'id', { unique: true });
    store.createIndex('date', 'date', { unique: false });
};

request.onsuccess = function(event) {
    db = event.target.result;
    loadImages();
};

request.onerror = function(event) {
    alert('IndexedDB error: ' + event.target.errorCode);
};

// =======================
// TRACK SELECTED IMAGES
// =======================
let selectedImages = new Set();

// DOM ELEMENTS
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const takePictureBtn = document.getElementById('takePictureBtn');
const imagesGrid = document.getElementById('imagesGrid');
const totalImagesEl = document.getElementById('totalImages');
const foundImagesEl = document.getElementById('foundImages');
const selectedImagesEl = document.getElementById('selectedImages');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');

// MODAL ELEMENTS
const imageModal = document.getElementById('imageModal');
const modalClose = document.getElementById('modalClose');
const modalImage = document.getElementById('modalImage');

// CAMERA ELEMENTS
const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const snapBtn = document.getElementById('snapBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const cameraCanvas = document.getElementById('cameraCanvas');

let currentStream = null;
let currentFacingMode = 'user'; // 'user' = front camera, 'environment' = back camera

// =======================
// UTILITIES
// =======================
function updateSelectedCount() {
    selectedImagesEl.textContent = selectedImages.size;
}

// =======================
// INDEXEDDB OPERATIONS
// =======================
function addImage(imageObj) {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.add(imageObj);
    transaction.oncomplete = () => loadImages(searchInput.value);
}

function deleteImage(id) {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.delete(id);
    transaction.oncomplete = () => {
        selectedImages.delete(id);
        updateSelectedCount();
        loadImages(searchInput.value);
    };
}

function updateImage(imageObj) {
    const transaction = db.transaction(['images'], 'readwrite');
    const store = transaction.objectStore('images');
    store.put(imageObj);
    transaction.oncomplete = () => loadImages(searchInput.value);
}

function getAllImages(callback) {
    const transaction = db.transaction(['images'], 'readonly');
    const store = transaction.objectStore('images');
    const request = store.getAll();
    request.onsuccess = () => callback(request.result);
}

// =======================
// RENDER IMAGES
// =======================
function renderImages(imagesArray, filter = '') {
    imagesGrid.innerHTML = '';
    const filtered = imagesArray.filter(img =>
        img.id.toLowerCase().includes(filter.toLowerCase()) || img.date.includes(filter)
    );

    foundImagesEl.textContent = filtered.length;
    totalImagesEl.textContent = imagesArray.length;

    if (filtered.length === 0) {
        noResults.style.display = 'block';
        selectedImages.clear();
        updateSelectedCount();
        return;
    } else {
        noResults.style.display = 'none';
    }

    filtered.forEach(img => {
        const card = document.createElement('div');
        card.classList.add('image-card');

        const container = document.createElement('div');
        container.classList.add('image-container');

        const imageEl = document.createElement('img');
        imageEl.src = img.image;
        imageEl.alt = img.id;

        container.appendChild(imageEl);

        const info = document.createElement('div');
        info.classList.add('image-info');

        const idEl = document.createElement('div');
        idEl.classList.add('image-id');
        idEl.textContent = img.id;

        const dateEl = document.createElement('div');
        dateEl.classList.add('image-date');
        dateEl.textContent = img.date;

        info.appendChild(idEl);
        info.appendChild(dateEl);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.style.padding = '5px 10px';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '8px';
        deleteBtn.style.background = '#f56565';
        deleteBtn.style.color = 'white';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm('Delete this image?')) deleteImage(img.id);
        });

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.style.marginTop = '5px';
        editBtn.style.padding = '5px 10px';
        editBtn.style.border = 'none';
        editBtn.style.borderRadius = '8px';
        editBtn.style.background = '#4299e1';
        editBtn.style.color = 'white';
        editBtn.style.cursor = 'pointer';
        editBtn.addEventListener('click', e => {
            e.stopPropagation();
            const newID = prompt('Enter new name/ID:', img.id);
            const newDate = prompt('Enter new date (YYYY-MM-DD):', img.date);
            if (newID && newDate) {
                img.id = newID;
                img.date = newDate;
                updateImage(img);
            }
        });

        info.appendChild(deleteBtn);
        info.appendChild(editBtn);

        card.appendChild(container);
        card.appendChild(info);

        // Click to select + modal
        card.addEventListener('click', () => {
            if (selectedImages.has(img.id)) {
                selectedImages.delete(img.id);
                card.style.border = 'none';
            } else {
                selectedImages.add(img.id);
                card.style.border = '3px solid #667eea';
            }
            updateSelectedCount();

            modalImage.src = img.image;
            imageModal.classList.add('active');
        });

        imagesGrid.appendChild(card);
    });
}

// =======================
// LOAD IMAGES
// =======================
function loadImages(filter = '') {
    getAllImages(imagesArray => renderImages(imagesArray, filter));
}

// =======================
// UPLOAD HANDLER
// =======================
uploadBtn.addEventListener('click', () => {
    const files = fileInput.files;
    if (!files.length) return;

    getAllImages(existingImages => {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                let fileName = file.name.replace(/\.[^/.]+$/, "");
                let finalID = fileName;
                let counter = 1;
                while (existingImages.some(img => img.id === finalID)) {
                    finalID = `${fileName}_${counter++}`;
                }

                const newImage = {
                    id: finalID,
                    date: new Date().toISOString().split('T')[0],
                    image: e.target.result
                };
                addImage(newImage);
            };
            reader.readAsDataURL(file);
        });
    });

    fileInput.value = '';
});

// =======================
// SEARCH HANDLER
// =======================
searchInput.addEventListener('input', e => loadImages(e.target.value));

// =======================
// MODAL HANDLER
// =======================
modalClose.addEventListener('click', () => imageModal.classList.remove('active'));

// =======================
// CAMERA FUNCTIONS
// =======================

// Stop current camera stream
function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

// Start camera with specified facing mode
async function startCamera(facingMode) {
    // Stop any existing stream first
    stopCamera();

    const constraints = {
        video: {
            facingMode: facingMode, // 'user' for front, 'environment' for back
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        cameraVideo.srcObject = stream;
        currentFacingMode = facingMode;
        
        // Update button text to show current camera
        updateSwitchButtonText();
        
        console.log('Camera started:', facingMode === 'user' ? 'Front Camera' : 'Back Camera');
    } catch (err) {
        console.error('Camera error:', err);
        
        // If the requested camera fails, try the other one
        if (facingMode === 'environment') {
            console.log('Back camera failed, trying front camera...');
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });
                currentStream = fallbackStream;
                cameraVideo.srcObject = fallbackStream;
                currentFacingMode = 'user';
                updateSwitchButtonText();
            } catch (fallbackErr) {
                alert('Cannot access any camera: ' + fallbackErr.message);
            }
        } else {
            alert('Cannot access camera: ' + err.message);
        }
    }
}

// Update switch button text
function updateSwitchButtonText() {
    if (switchCameraBtn) {
        const nextCamera = currentFacingMode === 'user' ? 'Back' : 'Front';
        switchCameraBtn.textContent = `Switch to ${nextCamera} Camera`;
    }
}

// Open camera modal - starts with front camera
takePictureBtn.addEventListener('click', async () => {
    cameraModal.style.display = 'flex';
    currentFacingMode = 'user'; // Start with front camera
    await startCamera(currentFacingMode);
});

// Switch between front and back camera
switchCameraBtn.addEventListener('click', async () => {
    // Toggle facing mode
    const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    console.log('Switching camera to:', newFacingMode === 'user' ? 'Front' : 'Back');
    await startCamera(newFacingMode);
});

// Capture image
snapBtn.addEventListener('click', () => {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);

    const imageData = cameraCanvas.toDataURL('image/png');
    const timestamp = new Date().getTime();
    addImage({
        id: `camera_${timestamp}`,
        date: new Date().toISOString().split('T')[0],
        image: imageData
    });

    stopCamera();
    cameraVideo.srcObject = null;
    cameraModal.style.display = 'none';
});

// Close camera
closeCameraBtn.addEventListener('click', () => {
    stopCamera();
    cameraVideo.srcObject = null;
    cameraModal.style.display = 'none';
});

// =======================
// INITIAL LOAD
// =======================
updateSelectedCount();
