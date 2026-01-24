takePictureBtn.addEventListener('click', async () => {
    try {
        cameraModal.classList.add('active');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraVideo.srcObject = stream;
        cameraVideo.play(); // siguraduhin nag-play
    } catch (err) {
        alert('Cannot access camera. Check permissions or use HTTPS.');
        console.error(err);
    }
});

snapBtn.addEventListener('click', () => {
    if (!cameraVideo.srcObject) return alert('Camera not started.');
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
