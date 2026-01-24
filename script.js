/***********************
 * GLOBAL VARIABLES
 ***********************/
let images = [];
let db;
const DB_NAME = 'galleryDB';
const DB_STORE = 'images';

const imagesGrid = document.getElementById('imagesGrid');
const totalImagesEl = document.getElementById('totalImages');
const foundImagesEl = document.getElementById('foundImages');
const selectedImagesEl = document.getElementById('selectedImages');
const noResultsEl = document.getElementById('noResults');

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const takePictureBtn = document.getElementById('takePictureBtn');
const searchInput = document.getElementById('searchInput');
const dragDropArea = document.getElementById('dragDropArea');

const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalClose = document.getElementById('modalClose');

const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const snapBtn = document.getElementById('snapBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const cameraCanvas = document.getElementById('cameraCanvas');

let selectedImages = new Set();

/***********************
 * INDEXEDDB SETUP
 ***********************/
function initDB() {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        loadImagesFromDB();
    };

    request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
    };
}

/***********************
 * DB FUNCTIONS
 ***********************/
function saveImageToDB(img) {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.put(img);
}

function deleteImageFromDB(id) {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.delete(id);
}

function loadImagesFromDB() {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
        images = request.result;
        renderImages();
    };
}

/***********************
 * UTILITY FUNCTIONS
 ***********************/
function updateStats() {
    totalImagesEl.textContent = images.length;
    foundImagesEl.textContent = filterImages(searchInput.value).length;
    selectedImagesEl.textContent = selectedImages.size;
}

function filterImages(query) {
    if (!query) return images;
    return images.filter(img =>
        img.id.toLowerCase().includes(query.toLowerCase()) ||
        img.date.includes(query)
    );
}

function createImageCard(img) {
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

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newName = prompt('Rename image:', img.id);
        if (newName) {
            img.id = newName;
            saveImageToDB(img);
            renderImages();
        }
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this image?')) {
            images = images.filter(i => i.id !== img.id);
            selectedImages.delete(img.id);
            deleteImageFromDB(img.id);
            renderImages();
        }
    });

    info.appendChild(editBtn);
    info.appendChild(deleteBtn);

    // Click card = select
    card.addEventListener('click', () => {
        if (selectedImages.has(img.id)) {
            selectedImages.delete(img.id);
            card.style.border = '';
        } else {
            selectedImages.add(img.id);
            card.style.border = '3px solid #667eea';
        }
        updateStats();
    });

    // Click image = modal
    container.addEventListener('click', (e) => {
        e.stopPropagation();
        modalImage.src = img.image;
        imageModal.classList.add('active');
    });

    card.appendChild(container);
    card.appendChild(info);
    return card;
}

function renderImages() {
    imagesGrid.innerHTML = '';
    const filtered = filterImages(searchInput.value);
    if (!filtered.length) {
        noResultsEl.style.display = 'block';
    } else {
        noResultsEl.style.display = 'none';
        filtered.forEach(img => imagesGrid.appendChild(createImageCard(img)));
    }
    updateStats();
}

/***********************
 * UPLOAD HANDLER
 ***********************/
function handleFilesUpload(files) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            let fileName = file.name.replace(/\.[^/.]+$/, "");
            let finalID = fileName;
            let counter = 1;
            while (images.some(img => img.id === finalID)) {
                finalID = `${fileName}_${counter++}`;
            }

            const newImg = {
                id: finalID,
                date: new Date().toISOString().split('T')[0],
                image: e.target.result
            };
            images.push(newImg);
            saveImageToDB(newImg);
            renderImages();
        };
        reader.readAsDataURL(file);
    });
}

uploadBtn.addEventListener('click', () => {
    if (!fileInput.files.length) return;
    handleFilesUpload(fileInput.files);
    fileInput.value = '';
});

fileInput.addEventListener('change', () => {
    if (!fileInput.files.length) return;
    handleFilesUpload(fileInput.files);
    fileInput.value = '';
});

/***********************
 * SEARCH
 ***********************/
searchInput.addEventListener('input', () => renderImages());

/***********************
 * MODAL
 ***********************/
modalClose.addEventListener('click', () => imageModal.classList.remove('active'));

/***********************
 * DRAG & DROP + THUMBNAILS
 ***********************/
dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('dragover');

    // Show thumbnails while dragging
    const files = e.dataTransfer.items;
    dragDropArea.querySelectorAll('.preview-thumb').forEach(p => p.remove());

    Array.from(files).forEach(item => {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            const reader = new FileReader();
            reader.onload = e => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('preview-thumb');
                img.style.width = '50px';
                img.style.height = '50px';
                img.style.objectFit = 'cover';
                img.style.margin = '2px';
                dragDropArea.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });
});

dragDropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('dragover');
    dragDropArea.querySelectorAll('.preview-thumb').forEach(p => p.remove());
});

dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('dragover');
    dragDropArea.querySelectorAll('.preview-thumb').forEach(p => p.remove());
    if (e.dataTransfer.files.length) {
        handleFilesUpload(e.dataTransfer.files);
    }
});

/***********************
 * CAMERA
 ***********************/
takePictureBtn.addEventListener('click', async () => {
    cameraModal.classList.add('active');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraVideo.srcObject = stream;
});

snapBtn.addEventListener('click', () => {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    const dataUrl = cameraCanvas.toDataURL('image/png');

    const finalID = `IMG_${Date.now()}`;
    const newImg = {
        id: finalID,
        date: new Date().toISOString().split('T')[0],
        image: dataUrl
    };
    images.push(newImg);
    saveImageToDB(newImg);
    renderImages();
});

closeCameraBtn.addEventListener('click', () => {
    cameraModal.classList.remove('active');
    const stream = cameraVideo.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
});

/***********************
 * INITIAL LOAD
 ***********************/
initDB();
