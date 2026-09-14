// Public pages use small, pre-cut mural images. The editor preview uses the
// current saved region, so changing a connection cannot show an older crop.
let revision = 0;
let elements;

function setup() {
  if (elements) return elements;
  const dialog = document.querySelector('#art-dialog');
  const wrap = dialog?.querySelector('.art-image-wrap');
  const original = dialog?.querySelector('#art-image');
  const originalError = dialog?.querySelector('#art-image-error');
  const originalLink = dialog?.querySelector('#full-art');
  if (!dialog || !wrap || !original || !originalError || !originalLink) return null;

  dialog.classList.add('has-artwork-pair');
  wrap.classList.add('artwork-pair');
  const figure = (label, className) => {
    const node = document.createElement('figure');
    node.className = `artwork-pair-figure ${className}`;
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    node.append(caption);
    return node;
  };
  const child = figure('아이의 원화', 'artwork-pair-child');
  const childStage = document.createElement('div');
  childStage.className = 'artwork-pair-stage';
  childStage.append(original, originalError);
  child.append(childStage, originalLink);

  const mural = figure('YOYOJIN의 벽화', 'artwork-pair-mural');
  const muralStage = document.createElement('div');
  muralStage.className = 'artwork-pair-stage';
  const crop = document.createElement('div');
  crop.className = 'artwork-pair-crop';
  crop.hidden = true;
  const image = document.createElement('img');
  image.id = 'art-mural-image';
  image.decoding = 'async';
  crop.append(image);
  const message = document.createElement('p');
  message.className = 'artwork-pair-message';
  message.setAttribute('role', 'status');
  muralStage.append(crop, message);
  const link = document.createElement('a');
  link.id = 'full-mural';
  link.className = 'text-button';
  link.textContent = '벽화 그림 크게 보기 ↗';
  link.target = '_blank';
  link.rel = 'noopener';
  link.hidden = true;
  mural.append(muralStage, link);
  wrap.replaceChildren(child, mural);
  elements = { dialog, crop, image, message, link, mural };
  // Escape and native dialog closing must also invalidate pending image loads.
  dialog.addEventListener('close', resetArtworkPair);
  return elements;
}

function regionOf(value) {
  if (!value || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(value[key]))) return null;
  const { x, y, width, height } = value;
  if (x < 0 || y < 0 || x >= 1 || y >= 1 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
  return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) };
}

function localImageURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return url.origin === location.origin && ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

/** Show the selected child's worksheet beside the exact linked mural region. */
export function showArtworkPair(item, { wall, preview = false } = {}) {
  const ui = setup();
  if (!ui) return;
  resetArtworkPair();
  const token = revision;
  const region = regionOf(item?.wallRegion);
  if (!region) {
    ui.message.textContent = preview ? '벽화 영역이 아직 지정되지 않았어요. 그림 연결 화면에서 영역을 지정해 주세요.' : '이 원화에 연결된 벽화 영역을 준비하고 있어요.';
    return;
  }

  const publicCrop = !preview && localImageURL(item.muralImage);
  const source = publicCrop || localImageURL(wall?.image);
  const dimensionsKnown = Number.isFinite(wall?.width) && wall.width > 0 && Number.isFinite(wall?.height) && wall.height > 0;
  if (!source || (!publicCrop && !dimensionsKnown)) {
    ui.message.textContent = '연결된 벽화 그림을 불러올 자료가 없어요.';
    return;
  }

  // This aspect ratio shows the entire selected rectangle without stretching.
  // It is capped only in display size, never by cropping additional content.
  const ratio = dimensionsKnown ? region.width * wall.width / (region.height * wall.height) : 1;
  ui.crop.style.setProperty('--crop-ratio', String(ratio));
  ui.crop.style.setProperty('--crop-fit-width', `${ratio * 100}cqh`);
  ui.image.alt = `참여 작품 ${item.id}과 연결된 YOYOJIN의 벽화 그림`;
  ui.image.classList.toggle('artwork-pair-whole-wall', !publicCrop);
  ui.mural.classList.toggle('artwork-pair-pending', preview && item.mapping?.confirmed !== true);
  ui.message.textContent = '벽화 그림을 불러오는 중이에요…';
  ui.mural.setAttribute('aria-busy', 'true');
  if (publicCrop) {
    ui.image.style.cssText = '';
    ui.link.href = publicCrop;
  } else {
    // One reusable image node points to the same wall URL as the wall map.
    // No canvas, repeated full-wall downloads, or inferred point-sized crops.
    ui.image.style.width = `${100 / region.width}%`;
    ui.image.style.height = `${100 / region.height}%`;
    ui.image.style.left = `${-100 * region.x / region.width}%`;
    ui.image.style.top = `${-100 * region.y / region.height}%`;
  }
  const loaded = () => {
    if (token !== revision || ui.image.src !== source) return;
    if (!dimensionsKnown && ui.image.naturalWidth && ui.image.naturalHeight) {
      const actualRatio = ui.image.naturalWidth / ui.image.naturalHeight;
      ui.crop.style.setProperty('--crop-ratio', String(actualRatio));
      ui.crop.style.setProperty('--crop-fit-width', `${actualRatio * 100}cqh`);
    }
    ui.crop.hidden = false;
    ui.message.hidden = true;
    ui.link.hidden = !publicCrop;
    ui.mural.removeAttribute('aria-busy');
  };
  ui.image.onload = loaded;
  ui.image.onerror = () => {
    if (token !== revision) return;
    ui.crop.hidden = true;
    ui.message.hidden = false;
    ui.message.textContent = '벽화 그림을 불러오지 못했어요. 창을 닫고 다시 열어 주세요.';
    ui.mural.removeAttribute('aria-busy');
  };
  if (ui.image.src !== source || (ui.image.complete && ui.image.naturalWidth === 0)) ui.image.src = source;
  if (ui.image.complete && ui.image.naturalWidth > 0) loaded();
}

/** Clear the previous selection and prevent late loads from showing it again. */
export function resetArtworkPair() {
  revision += 1;
  if (!elements) return;
  const { crop, image, message, link, mural } = elements;
  image.onload = null;
  image.onerror = null;
  crop.hidden = true;
  message.hidden = false;
  message.textContent = '';
  link.hidden = true;
  link.removeAttribute('href');
  mural.removeAttribute('aria-busy');
  mural.classList.remove('artwork-pair-pending');
}
