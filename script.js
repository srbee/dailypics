const gallery = document.getElementById("gallery");
const message = document.getElementById("message");
const photoCount = document.getElementById("photoCount");

const photoFolder = "photos/";
let photoNumber = 1;
let loadedPhotos = 0;

// Create the next filename: 001.jpg, 002.jpg, 003.jpg ...
function getFileName(number) {
    return String(number).padStart(3, "0") + ".jpg";
}

// Try to load photos sequentially
function loadNextPhoto() {

    const fileName = getFileName(photoNumber);
    const imagePath = photoFolder + fileName;

    const img = new Image();

    img.onload = function () {

        const card = document.createElement("div");
        card.className = "photo-card";

        const displayImage = document.createElement("img");
        displayImage.src = imagePath;
        displayImage.alt = fileName;
        displayImage.loading = "lazy";

        // Open the photograph in a new tab when clicked
        displayImage.onclick = function () {
            window.open(imagePath, "_blank");
        };

        const caption = document.createElement("div");
        caption.className = "caption";
        caption.textContent = fileName;

        card.appendChild(displayImage);
        card.appendChild(caption);
        gallery.appendChild(card);

        loadedPhotos++;
        photoNumber++;

        loadNextPhoto();
    };

    img.onerror = function () {
        message.textContent = loadedPhotos === 0
            ? "No photographs found."
            : "";

        photoCount.textContent = loadedPhotos +
            (loadedPhotos === 1 ? " छायाचित्र " : " छायाचित्र ");
    };

    img.src = imagePath;
}

// Start loading the numbered photographs
loadNextPhoto();
