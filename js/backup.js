// Copias de seguridad: cifrado AES-GCM de 256 bits con una clave derivada de tu contraseña (PBKDF2).
// La contraseña nunca se guarda: sin ella, nadie puede leer la copia, tampoco tú.
const enc = new TextEncoder(), ITER = 600000;
const blobB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const b64Bytes = s => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
async function derive(pass, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** JSON por trozos: evita crear una sola cadena enorme cuando hay muchas fotos. */
export function plainBlob(data) {
  const { stores, ...head } = data, parts = [JSON.stringify(head).slice(0, -1), ',"stores":{'];
  Object.entries(stores).forEach(([s, rows], i) => {
    parts.push(`${i ? ',' : ''}${JSON.stringify(s)}:[`);
    rows.forEach((r, j) => parts.push((j ? ',' : '') + JSON.stringify(r)));
    parts.push(']');
  });
  parts.push('}}');
  return new Blob(parts, { type: 'application/json' });
}
export async function encryptedBlob(data, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(pass, salt, ITER);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await plainBlob(data).arrayBuffer());
  const body = await blobB64(new Blob([cipher]));
  const head = JSON.stringify({ app: 'alba', encrypted: 1, exported: data.exported, photosIncluded: data.photosIncluded, kdf: 'PBKDF2-SHA256', iter: ITER, salt: await blobB64(new Blob([salt])), iv: await blobB64(new Blob([iv])) });
  return new Blob([head.slice(0, -1), ',"data":"', body, '"}'], { type: 'application/json' });
}
export async function decryptBackup(o, pass) {
  const key = await derive(pass, b64Bytes(o.salt), o.iter);
  let plain;
  try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64Bytes(o.iv) }, key, b64Bytes(o.data)); }
  catch { throw new Error('Contraseña incorrecta o archivo dañado.'); }
  return JSON.parse(new TextDecoder().decode(plain));
}
