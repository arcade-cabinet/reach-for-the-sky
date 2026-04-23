import '@testing-library/jest-dom/vitest';

const canvasContextStub = {
  canvas: null,
  clearRect: () => undefined,
  fillRect: () => undefined,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  measureText: (text: string) => ({ width: text.length * 8 }),
  putImageData: () => undefined,
  setTransform: () => undefined,
  drawImage: () => undefined,
  save: () => undefined,
  fillText: () => undefined,
  restore: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  closePath: () => undefined,
  stroke: () => undefined,
  translate: () => undefined,
  scale: () => undefined,
  rotate: () => undefined,
  arc: () => undefined,
  fill: () => undefined,
  rect: () => undefined,
  clip: () => undefined,
};

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => canvasContextStub,
});
