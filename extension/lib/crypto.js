// Password encryption for backups and agency sync (Web Crypto: PBKDF2-SHA256 → AES-GCM). Only someone with the
// password can read the result; the helper server never sees the password or the data.
const ITER = 250000;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function keyFrom(password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), enc.encode(JSON.stringify(obj)));
  return { app: 'indian-visa-helper', encrypted: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function decryptJson(box, password) {
  try {
    const key = await keyFrom(password, unb64(box.salt), box.iter || ITER);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data))));
  } catch {
    throw new Error('wrong-password');
  }
}

// A sync space id from the agency password: slow to guess (PBKDF2), and different from the encryption key.
export async function syncSpaceId(password) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('ivh-sync-space-id-v1'), iterations: ITER }, base, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

// PIN for the panel lock: stored only as a salted hash.
export async function hashPin(pin, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: 100000 }, base, 256);
  return { salt, hash: b64(bits) };
}
