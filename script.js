const gallery = document.getElementById("gallery");
const message = document.getElementById("message");
const orderButton = document.getElementById("orderButton");

const PHOTOS_DIR = "photos/";
const RAW_DIR = "https://raw.githubusercontent.com/srbee/dailypics/main/photos/";
const MAX_SCAN = 500;
const EXIF_BYTES = 65536;
let newestFirst = true;
let currentPhotos = [];
let loadGeneration = 0;

// Read only the beginning of the JPEG. EXIF metadata is normally stored near
// the start of a JPEG, so we avoid downloading the whole photograph.
async function extractExifDate(name) {
  const url = `${RAW_DIR}${encodeURIComponent(name)}`;
  try {
    let response = await fetch(url, {
      headers: { Range: `bytes=0-${EXIF_BYTES - 1}` },
      cache: "no-store"
    });
    if (!response.ok) return null;

    // If the server honours Range, this is only a small partial response.
    // If it does not, do not download the whole image here; give up quickly.
    if (response.status !== 206) return null;

    const buffer = await response.arrayBuffer();
    return parseJpegExif(new DataView(buffer));
  } catch (error) {
    console.warn("Could not read EXIF:", name, error);
    return null;
  }
}

function parseJpegExif(view) {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint8(offset + 1);
    offset += 2;

    if (marker === 0xDA || marker === 0xD9) break;
    if (marker >= 0xD0 && marker <= 0xD7) continue;
    if (offset + 2 > view.byteLength) break;

    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;

    if (marker === 0xE1 && segmentLength >= 8) {
      const exifStart = offset + 2;
      if (readAscii(view, exifStart, 6) === "Exif\0\0") {
        return parseExif(view, exifStart + 6, offset + segmentLength);
      }
    }
    offset += segmentLength;
  }
  return null;
}

function readAscii(view, offset, length) {
  let result = "";
  for (let i = 0; i < length && offset + i < view.byteLength; i++) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}

function parseExif(view, tiffStart, tiffEnd) {
  if (tiffStart + 8 > tiffEnd) return null;

  const byteOrder = readAscii(view, tiffStart, 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") return null;

  const get16 = p => view.getUint16(p, littleEndian);
  const get32 = p => view.getUint32(p, littleEndian);
  if (get16(tiffStart + 2) !== 42) return null;

  const firstIFD = tiffStart + get32(tiffStart + 4);
  if (firstIFD < tiffStart || firstIFD + 2 > tiffEnd) return null;

  let exifIFD = null;
  let fallback = null;
  const count = get16(firstIFD);

  for (let i = 0; i < count; i++) {
    const entry = firstIFD + 2 + i * 12;
    if (entry + 12 > tiffEnd) break;
    const tag = get16(entry);
    if (tag === 0x8769) {
      exifIFD = tiffStart + get32(entry + 8);
    } else if (tag === 0x0132) {
      fallback = readIFDAscii(entry, view, tiffStart, tiffEnd, get16, get32);
    }
  }

  if (exifIFD !== null && exifIFD + 2 <= tiffEnd) {
    const exifCount = get16(exifIFD);
    for (let i = 0; i < exifCount; i++) {
      const entry = exifIFD + 2 + i * 12;
      if (entry + 12 > tiffEnd) break;
      const tag = get16(entry);
      if (tag === 0x9003 || tag === 0x9004) {
        const date = parseExifDate(readIFDAscii(entry, view, tiffStart, tiffEnd, get16, get32));
        if (date) return date;
      }
    }
  }
  return parseExifDate(fallback);
}

function readIFDAscii(entry, view, tiffStart, tiffEnd, get16, get32) {
  const type = get16(entry + 2);
  const count = get32(entry + 4);
  if (type !== 2 || count < 1) return null;

  const dataOffset = count <= 4 ? entry + 8 : tiffStart + get32(entry + 8);
  if (dataOffset < tiffStart || dataOffset + count > tiffEnd) return null;
  return readAscii(view, dataOffset, count).replace(/\0.*$/, "").trim();
}

function parseExifDate(text) {
  if (!text) return null;
  const match = text.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6])
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
  if (!response.ok) throw new Error(`Could not read photos directory (${response.status})`);

  const entries = await response.json();
  if (!Array.isArray(entries)) return [];

  const files = entries
    .filter(entry => entry.type === "file" && isJpg(entry.name))
    .slice(0, MAX_SCAN);

  // Limit concurrent EXIF requests so a phone does not open hundreds at once.
  const results = [];
  const workers = Math.min(6, files.length);
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const index = next++;
      const entry = files[index];
      results[index] = {
        name: entry.name,
        date: await extractExifDate(entry.name)
      };
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

function render(photos) {
  gallery.replaceChildren();

  const sorted = [...photos].sort((a, b) => {
    const timeA = a.date ? a.date.getTime() : -Infinity;
    const timeB = b.date ? b.date.getTime() : -Infinity;
    if (timeA !== timeB) return newestFirst ? timeB - timeA : timeA - timeB;
    return newestFirst ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
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
  const generation = ++loadGeneration;
  try {
    message.textContent = "Reading photo dates…";
    const photos = await getPhotoList();
    if (generation !== loadGeneration) return;
    currentPhotos = photos;
    render(currentPhotos);
  } catch (error) {
    if (generation !== loadGeneration) return;
    console.error(error);
    gallery.replaceChildren();
    message.classList.remove("hidden");
    message.textContent = "Photos could not be loaded. Please try again later.";
  }
}

// Reverse the already-loaded gallery instantly. Never reload photos here.
orderButton.addEventListener("click", () => {
  newestFirst = !newestFirst;
  render(currentPhotos);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

loadGallery();
