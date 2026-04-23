function requireWebCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Web Crypto getRandomValues is required for browser random bytes.');
  }
  return cryptoApi;
}

export function randomFillSync<T extends ArrayBufferView>(buffer: T): T {
  const bytes = new Uint8Array(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength);
  requireWebCrypto().getRandomValues(bytes);
  return buffer;
}

export function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  randomFillSync(bytes);
  return bytes;
}

export default { randomFillSync, randomBytes };
