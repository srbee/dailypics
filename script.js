const gallery = document.getElementById("gallery");
const message = document.getElementById("message");
const orderButton = document.getElementById("orderButton");

const PHOTOS_DIR = "photos/";
const MAX_SCAN = 500;
let newestFirst = true;

// The program reads the timestamp embedded in each filename.
// It supports common mobile-style names such as:
// IMG_20260917_143025.jpg
// 20260917_143025.jpg
// 2026-09-17_14-30-25.jpg
// IMG-20260917-WA0012.jpg (date only: time is unavailable)
function extractDateFromFilename(filename) {
  const name = filename.replace(/\.[^.]+$/, "");

  // YYYYMMDD_HHMMSS or YYYYMMDD-HHMMSS
  let match = name.match(/(20\d{2})(\d{2})(\d{2})[_-]([01]\d|2[0-3])([0-5]\d)([0-5]\d)/);
  if (match) {
    return new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), Number(match[6])
    );
  }

  // YYYY-MM-DD_HH-MM-SS or YYYY-MM-DD_HHMMSS
  match = name.match(/(20\d{2})[-_](\d{2})[-_](\d{2})[ T_-](\d{2})[-_:]?(\d{2})[-_:]?(\d{2})/);
  if (match) {
    return new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), Number(match[6])
    );
  }

  // YYYYMMDD only. Useful for filenames where the phone supplies date but no time.
  match = name.match(/(?:^|[^0-9])(20\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return null;
}

function formatDate(date) {
  if (!date) return "Time unavailable";

  const pad = value => String(value).padStart(2, "0");
  return `${pad(date.getHours())} ${pad(date.getMinutes())}  ${pad(date.getDate())} ${pad(date.getMonth() + 1)} ${String(date.getFullYear()).slice(-2)}`;
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
  // GitHub Pages cannot list a directory by itself. The GitHub API is used
  // only to discover the JPG filenames; the actual images are loaded from
  // this site's own photos/ directory.
  const apiUrl = "https://api.github.com/repos/srbee/dailypics/contents/photos";
  const response = await fetch(apiUrl, { cache: "no-store" });

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
    }))
    .slice(0, MAX_SCAN);
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
  if (!sorted.length) message.textContent = "No JPG photos found in the photos folder yet.";

  orderButton.textContent = newestFirst ? "⇅ Reverse order" : "⇅ Newest first";
  orderButton.setAttribute(
    "aria-label",
    newestFirst ? "Show oldest photo first" : "Show newest photo first"
  );
}

async function loadGallery() {
  try {
    message.textContent = "Looking for photos…";
    const photos = await getPhotoList();
    render(photos);
  } catch (error) {
    console.error(error);
    gallery.replaceChildren();
    message.classList.remove("hidden");
    message.textContent = "Photos could not be loaded. Please try again later.";
  }
}

orderButton.addEventListener("click", async () => {
  newestFirst = !newestFirst;
  await loadGallery();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

loadGallery();
