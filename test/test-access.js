// GitHub Pages receives encrypted artwork data; the unlock key stays in this page.
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const gate = document.createElement('section');
gate.id = 'test-access-gate';
gate.setAttribute('aria-labelledby', 'test-access-title');
gate.innerHTML = `
  <div class="test-access-card">
    <p class="test-access-brand">YOYOJIN · 울산시립미술관</p>
    <span class="test-access-tag">작가용 AR 테스트</span>
    <h1 id="test-access-title">함께 살아가는<br>세상<span aria-hidden="true">●</span></h1>
    <p class="test-access-description">벽화를 비추고, 아이들의 그림과 이야기를 만나 보세요.</p>
    <form id="test-access-form">
      <label for="test-access-password">테스트 접속 암호</label>
      <div class="test-access-input-wrap">
        <input id="test-access-password" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" required disabled aria-describedby="test-access-status">
        <button type="button" id="test-access-toggle" aria-label="암호 보기" aria-pressed="false">보기</button>
      </div>
      <button type="submit" id="test-access-submit" disabled>테스트 열기 <span aria-hidden="true">↗</span></button>
    </form>
    <p id="test-access-status" role="status" aria-live="polite">테스트를 준비하고 있어요…</p>
    <button type="button" id="test-access-retry" hidden>새로고침</button>
    <p class="test-access-note">접속 후 카메라 시작 버튼을 눌러 주세요.<br>카메라 영상은 기기에서만 처리합니다.</p>
  </div>`;
document.body.classList.add('test-locked');
document.body.prepend(gate);

const form = gate.querySelector('#test-access-form');
const passwordInput = gate.querySelector('#test-access-password');
const submitButton = gate.querySelector('#test-access-submit');
const toggleButton = gate.querySelector('#test-access-toggle');
const status = gate.querySelector('#test-access-status');
const retryButton = gate.querySelector('#test-access-retry');
const assetPromises = new Map();
const objectURLs = new Set();
let config;
let unlockKey;
let busy = false;
let pageLeaving = false;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('test-access-error', error);
}

function base64Bytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function encryptedURL(path) {
  if (typeof path !== 'string' || !/^locked\/[A-Za-z0-9._-]+\.bin$/.test(path)) {
    throw new Error('Invalid encrypted asset path');
  }
  return new URL(path, new URL('./', import.meta.url));
}

async function decryptFile(path, logicalPath, key) {
  const response = await fetch(encryptedURL(path), { credentials: 'omit' });
  if (!response.ok) throw new Error(`Encrypted file unavailable (${response.status})`);
  const encrypted = new Uint8Array(await response.arrayBuffer());
  if (encrypted.byteLength < 29) throw new Error('Invalid encrypted file');
  return crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: encrypted.subarray(0, 12),
    additionalData: encoder.encode(logicalPath),
    tagLength: 128,
  }, key, encrypted.subarray(12));
}

async function deriveKey(password) {
  const bytes = encoder.encode(password);
  const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
  bytes.fill(0);
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    salt: base64Bytes(config.salt),
    iterations: config.iterations,
    hash: 'SHA-256',
  }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

function clearAssets() {
  objectURLs.forEach(url => URL.revokeObjectURL(url));
  objectURLs.clear();
  assetPromises.clear();
}

function showBanner(snapshotLabel, logout) {
  const banner = document.createElement('aside');
  banner.id = 'test-access-banner';
  banner.setAttribute('aria-label', '테스트 자료 버전');
  const text = document.createElement('span');
  const label = document.createElement('strong');
  label.textContent = 'AR 테스트';
  text.append(label, document.createTextNode(` · ${snapshotLabel}`));
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = '잠그기';
  exit.addEventListener('click', logout);
  banner.append(text, exit);
  const header = document.querySelector('body > .topbar');
  if (header) header.after(banner);
  else gate.after(banner);
}

toggleButton.addEventListener('click', () => {
  const visible = passwordInput.type === 'password';
  passwordInput.type = visible ? 'text' : 'password';
  toggleButton.textContent = visible ? '숨기기' : '보기';
  toggleButton.setAttribute('aria-label', visible ? '암호 숨기기' : '암호 보기');
  toggleButton.setAttribute('aria-pressed', String(visible));
});
retryButton.addEventListener('click', () => location.reload());

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !config || !passwordInput.value) return;
  busy = true;
  submitButton.disabled = true;
  passwordInput.disabled = true;
  toggleButton.disabled = true;
  form.setAttribute('aria-busy', 'true');
  passwordInput.removeAttribute('aria-invalid');
  setStatus('암호를 확인하고 있어요…');
  let password = passwordInput.value;
  passwordInput.value = '';
  let payload;
  try {
    const key = await deriveKey(password);
    password = '';
    const plaintext = await decryptFile(config.catalog, 'data/catalog.json', key);
    payload = JSON.parse(decoder.decode(plaintext));
    new Uint8Array(plaintext).fill(0);
    if (!payload || !payload.catalog || !payload.assets || typeof payload.assets !== 'object') {
      throw new Error('Invalid catalog');
    }
    unlockKey = key;
  } catch (error) {
    password = '';
    unlockKey = undefined;
    setStatus(error.name === 'OperationError'
      ? '암호가 맞지 않거나 자료를 열 수 없어요. 암호를 다시 확인해 주세요.'
      : '테스트 자료를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', true);
    passwordInput.setAttribute('aria-invalid', 'true');
    busy = false;
    submitButton.disabled = false;
    passwordInput.disabled = false;
    toggleButton.disabled = false;
    form.removeAttribute('aria-busy');
    passwordInput.focus();
    return;
  }

  if (pageLeaving) return;
  const logout = () => {
    unlockKey = undefined;
    clearAssets();
    delete window.YoyojinTest;
    location.reload();
  };
  const assetURL = async logicalPath => {
    if (pageLeaving || !unlockKey) throw new Error('Test session is locked');
    if (!Object.prototype.hasOwnProperty.call(payload.assets, logicalPath)) throw new Error('Artwork is not included in this test');
    if (!assetPromises.has(logicalPath)) {
      const asset = payload.assets[logicalPath];
      const key = unlockKey;
      const pending = (async () => {
        if (!asset || !['image/webp', 'image/png', 'image/jpeg'].includes(asset.mime)) {
          throw new Error('Unsupported artwork type');
        }
        const plaintext = await decryptFile(asset.file, logicalPath, key);
        if (pageLeaving || unlockKey !== key) throw new Error('Test session has ended');
        const url = URL.createObjectURL(new Blob([plaintext], { type: asset.mime }));
        new Uint8Array(plaintext).fill(0);
        objectURLs.add(url);
        return url;
      })();
      assetPromises.set(logicalPath, pending);
      pending.catch(() => {
        if (assetPromises.get(logicalPath) === pending) assetPromises.delete(logicalPath);
      });
    }
    return assetPromises.get(logicalPath);
  };
  window.YoyojinTest = {
    catalog: payload.catalog,
    assetURL,
    snapshotLabel: config.snapshotLabel,
    logout,
  };
  setStatus('관람 화면을 준비하고 있어요…');
  showBanner(config.snapshotLabel, logout);
  gate.hidden = true;
  document.body.classList.remove('test-locked');
  try {
    await import('./app.js');
  } catch {
    document.body.classList.add('test-locked');
    gate.hidden = false;
    unlockKey = undefined;
    clearAssets();
    delete window.YoyojinTest;
    form.hidden = true;
    setStatus('관람 화면을 준비하지 못했어요. 새로고침 후 다시 접속해 주세요.', true);
    retryButton.hidden = false;
  }
});

window.addEventListener('pagehide', () => {
  pageLeaving = true;
  unlockKey = undefined;
  clearAssets();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});

try {
  if (!window.isSecureContext || !crypto.subtle) {
    throw new Error('secure-context-required');
  }
  const response = await fetch(new URL('./test-config.json', import.meta.url), { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error('config-unavailable');
  const candidate = await response.json();
  if (candidate.iterations !== 310000 || typeof candidate.salt !== 'string' || base64Bytes(candidate.salt).length < 16 || typeof candidate.snapshotLabel !== 'string') {
    throw new Error('invalid-config');
  }
  encryptedURL(candidate.catalog);
  config = candidate;
  passwordInput.disabled = false;
  submitButton.disabled = false;
  setStatus('안내받은 암호를 입력해 주세요.');
} catch (error) {
  setStatus(error.message === 'secure-context-required'
    ? 'Safari 또는 Chrome에서 https로 시작하는 테스트 주소를 열어 주세요.'
    : '테스트 준비 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.', true);
  retryButton.hidden = false;
}
