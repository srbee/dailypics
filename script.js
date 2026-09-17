const gallery = document.getElementById("gallery");
const message = document.getElementById("message");
const orderButton = document.getElementById("orderButton");

const PHOTOS_DIR = "photos/";
let newestFirst = true;
let currentPhotos = [];

// Read the capture time directly from the mobile filename.
// Example: IMG_20260917_143025.jpg -> 14:30 17-09-26
function extractDateFromFilename(filename) {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year), Number(month) - 1, Number(day),
    Number(hour), Number(minute), Number(second)
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return "Time unavailable";
  const pad = value => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${String(date.getFullYear()).slice(-2)}`;
}

function isJpg(filename) {
  return /\.jpe?g$/i.test(filename);
}

function createCard(photo) {
  const card = document.createElement("article");
  card.className = "photo-card";

  const time = document.createElement("div");
  time.className = "photo-time";
  time.textContent = formatDate(photo.date);

  const frame = document.createElement("div");
  frame.className = "photo-frame";

  const image = document.createElement("img");
  image.src = `${PHOTOS_DIR}${encodeURIComponent(photo.name)}`;
  image.alt = `Daily Pic taken ${formatDate(photo.date)}`;
  image.loading = "lazy";
  image.decoding = "async";

  frame.appendChild(image);
  card.append(time, frame);
  return card;
}

async function getPhotoList() {
  const response = await fetch(
    "https://api.github.com/repos/srbee/dailypics/contents/photos",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Could not read photos directory (${response.status})`);
  }

  const entries = await response.json();
  if (!Array.isArray(entries)) return [];

  return entries
    .filter(entry => entry.type === "file" && isJpg(entry.name))
    .map(entry => ({
      name: entry.name,
      date: extractDateFromFilename(entry.name)
    }));
}

function render(photos) {
  gallery.replaceChildren();

  const sorted = [...photos].sort((a, b) => {
    const timeA = a.date ? a.date.getTime() : -Infinity;
    const timeB = b.date ? b.date.getTime() : -Infinity;

    if (timeA !== timeB) {
      return newestFirst ? timeB - timeA : timeA - timeB;
    }

    return newestFirst
      ? b.name.localeCompare(a.name)
      : a.name.localeCompare(b.name);
  });

  sorted.forEach(photo => gallery.appendChild(createCard(photo)));

  message.classList.toggle("hidden", sorted.length > 0);
  if (!sorted.length) {
    message.textContent = "No JPG photos found in the photos folder yet.";
  }

  orderButton.textContent = newestFirst
    ? "⇅ Reverse order"
    : "⇅ Newest first";
}

async function loadGallery() {
  try {
    message.textContent = "Loading photos…";
    currentPhotos = await getPhotoList();
    render(currentPhotos);
  } catch (error) {
    console.error(error);
    gallery.replaceChildren();
    message.classList.remove("hidden");
    message.textContent = "Photos could not be loaded. Please try again later.";
  }
}

// Reverse instantly — no re-reading of files and no EXIF processing.
orderButton.addEventListener("click", () => {
  newestFirst = !newestFirst;
  render(currentPhotos);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

loadGallery();
