// ---------- ТИПЫ ----------
interface Pin {
  x: number;
  y: number;
}

interface Config {
  maxLines: number;
  threadAlpha: number;
  canvasSize: number;
  numPins: number;
  pinRadius: number;
}

// ---------- КОНФИГУРАЦИЯ ----------
const CONFIG: Config = {
  maxLines: 3000,
  threadAlpha: 12,
  canvasSize: 600,
  numPins: 250,
  pinRadius: 290, // canvasSize/2 - 10
};

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ----------
let pins: Pin[] = [];
let sourceData: Uint8ClampedArray | null = null;
let currentPin: number = 0;
let linesCount: number = 0;
let isWeaving: boolean = true;

const canvas = document.getElementById('art-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
const img = document.getElementById('source-image') as HTMLImageElement;

// ---------- ГЕНЕРАЦИЯ ГВОЗДЕЙ ПО ОКРУЖНОСТИ ----------
function generatePins(): void {
  const cx = CONFIG.canvasSize / 2;
  const cy = CONFIG.canvasSize / 2;
  const radius = CONFIG.pinRadius;
  
  for (let i = 0; i < CONFIG.numPins; i++) {
    const angle = (i * 2 * Math.PI) / CONFIG.numPins;
    pins.push({
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    });
  }
}

// ---------- ЗАГРУЗКА И ОБРАБОТКА ИЗОБРАЖЕНИЯ ----------
function loadImageData(): boolean {
  if (!img.complete || !img.naturalWidth) {
    console.error('Image not loaded');
    return false;
  }

  // Кроп изображения в квадрат
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - size) / 2;
  const sy = (img.naturalHeight - size) / 2;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = CONFIG.canvasSize;
  tempCanvas.height = CONFIG.canvasSize;
  const tCtx = tempCanvas.getContext('2d')!;
  tCtx.drawImage(img, sx, sy, size, size, 0, 0, CONFIG.canvasSize, CONFIG.canvasSize);
  
  sourceData = tCtx.getImageData(0, 0, CONFIG.canvasSize, CONFIG.canvasSize).data;
  return true;
}

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
function init(): void {
  // Очищаем канвас белым фоном
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CONFIG.canvasSize, CONFIG.canvasSize);

  if (!loadImageData()) return;
  
  generatePins();
  requestAnimationFrame(weave);
}

// ---------- ПОИСК ЛУЧШЕЙ ЛИНИИ ----------
function findBestLine(fromIdx: number): { index: number } {
  if (!sourceData) return { index: -1 };
  
  let bestIdx = -1;
  let maxDark = -1;
  const minDist = Math.floor(pins.length * 0.05);
  
  for (let i = 0; i < pins.length; i++) {
    if (i === fromIdx) continue;
    
    // Проверка минимального расстояния между гвоздями
    let dist = Math.abs(i - fromIdx);
    if (dist > pins.length / 2) dist = pins.length - dist;
    if (dist < minDist) continue;
    
    const dark = getLineDarkness(pins[fromIdx]!, pins[i]!);
    if (dark > maxDark) {
      maxDark = dark;
      bestIdx = i;
    }
  }
  
  if (maxDark < 10) return { index: -1 };
  return { index: bestIdx };
}

// ---------- РАСЧЁТ ТЕМНОТЫ ЛИНИИ ----------
function getLineDarkness(p1: Pin, p2: Pin): number {
  if (!sourceData) return 0;
  
  let sum = 0;
  let x = p1.x;
  let y = p1.y;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (steps < 10) return 0;
  
  const xInc = dx / steps;
  const yInc = dy / steps;
  
  for (let i = 0; i < steps; i += 2) {
    const lx = Math.round(x);
    const ly = Math.round(y);
    
    if (lx >= 0 && lx < CONFIG.canvasSize && ly >= 0 && ly < CONFIG.canvasSize) {
      const idx = (ly * CONFIG.canvasSize + lx) * 4;
      const brightness = (sourceData[idx]! + sourceData[idx + 1]! + sourceData[idx + 2]!) / 3;
      sum += 255 - brightness;
    }
    x += xInc * 2;
    y += yInc * 2;
  }
  
  return sum;
}

// ---------- ВЫЧИТАНИЕ ЛИНИИ (ЗАТЕМНЕНИЕ ОБЛАСТИ) ----------
function subtractLine(p1: Pin, p2: Pin): void {
  if (!sourceData) return;
  
  let x = p1.x;
  let y = p1.y;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const xInc = dx / steps;
  const yInc = dy / steps;
  
  for (let i = 0; i < steps; i++) {
    const lx = Math.round(x);
    const ly = Math.round(y);
    
    if (lx >= 0 && lx < CONFIG.canvasSize && ly >= 0 && ly < CONFIG.canvasSize) {
      const idx = (ly * CONFIG.canvasSize + lx) * 4;
      sourceData[idx]     = Math.min(255, sourceData[idx]!     + CONFIG.threadAlpha * 1.5);
      sourceData[idx + 1] = Math.min(255, sourceData[idx + 1]! + CONFIG.threadAlpha * 1.5);
      sourceData[idx + 2] = Math.min(255, sourceData[idx + 2]! + CONFIG.threadAlpha * 1.5);
    }
    x += xInc;
    y += yInc;
  }
}

// ---------- ОСНОВНОЙ ЦИКЛ ТКАЧЕСТВА ----------
function weave(): void {
  if (!isWeaving) return;
  
  const BATCH = 8;
  
  for (let k = 0; k < BATCH; k++) {
    if (linesCount >= CONFIG.maxLines) {
      isWeaving = false;
      return;
    }
    
    const target = findBestLine(currentPin);
    if (target.index === -1) {
      isWeaving = false;
      return;
    }
    
    // Рисуем линию
    ctx.strokeStyle = `rgba(0,0,0,${CONFIG.threadAlpha / 255})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(pins[currentPin]!.x,   pins[currentPin]!.y);
    ctx.lineTo(pins[target.index]!.x, pins[target.index]!.y);
    ctx.stroke();
    
    // Вычитаем из изображения
    subtractLine(pins[currentPin]!, pins[target.index]!);
    
    currentPin = target.index;
    linesCount++;
  }
  
  requestAnimationFrame(weave);
}

// ---------- ЗАПУСК ----------
if (img.complete) {
  init();
} else {
  img.onload = init;
}
