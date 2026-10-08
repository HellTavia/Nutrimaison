// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* SCANNER DE CODES-BARRES                                             */
/*  1. Détecteur natif d'Android (BarcodeDetector) quand il existe :   */
/*     rapide et précis.                                               */
/*  2. Sinon ZXing, image par image, sur la zone centrale.             */
/*  Caméra arrière en haute résolution + mise au point continue :     */
/*  c'est ce qui manquait (la caméra par défaut est souvent en        */
/*  640×480 sans autofocus, illisible pour un code EAN).              */
/* ================================================================== */
import {
  DecodeHintType, BarcodeFormat, MultiFormatReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource,
} from "@zxing/library";

const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

let zxingReader = null;
function getZxing() {
  if (!zxingReader) {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    zxingReader = new MultiFormatReader();
    zxingReader.setHints(hints);
  }
  return zxingReader;
}

let nativeDetector; // undefined = pas encore testé, null = indisponible
async function getNative() {
  if (nativeDetector !== undefined) return nativeDetector;
  nativeDetector = null;
  try {
    if ("BarcodeDetector" in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.length) nativeDetector = new window.BarcodeDetector({ formats });
    }
  } catch (e) { nativeDetector = null; }
  return nativeDetector;
}

/** Code-barres alimentaire plausible (8, 12 ou 13 chiffres). */
function validCode(code) {
  return typeof code === "string" && /^\d{8}$|^\d{12,14}$/.test(code.trim());
}

/** Essaie de décoder le contenu d'un canvas (natif puis ZXing). */
async function decodeCanvas(canvas) {
  const native = await getNative();
  if (native) {
    try {
      const res = await native.detect(canvas);
      const hit = res.find((r) => validCode(r.rawValue));
      if (hit) return hit.rawValue.trim();
    } catch (e) {}
  }
  try {
    const w = canvas.width, h = canvas.height;
    const data = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const lum = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h)));
    const r = getZxing().decodeWithState(bitmap);
    const t = r && r.getText();
    if (validCode(t)) return t.trim();
  } catch (e) { /* rien trouvé sur cette image */ }
  return null;
}

/**
 * Lance la caméra dans <video> et appelle onCode(code) au premier code lu.
 * Renvoie { stop(), setTorch(bool), hasTorch }.
 */
export async function startLiveScan(video, onCode) {
  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      advanced: [{ focusMode: "continuous" }],
    },
  };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // certains appareils refusent les contraintes avancées : on réessaie en simple
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
  }
  const track = stream.getVideoTracks()[0];
  try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (e) {}
  const caps = (track.getCapabilities && track.getCapabilities()) || {};

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play().catch(() => {});

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stopped = false;
  let frame = 0;

  const loop = async () => {
    if (stopped) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw && vh) {
      frame++;
      // une image sur deux : zone centrale (plus rapide), l'autre : image entière
      const crop = frame % 2 === 0;
      const sw = crop ? Math.round(vw * 0.8) : vw;
      const sh = crop ? Math.round(vh * 0.5) : vh;
      const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
      const scale = Math.min(1, 1280 / sw);
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const code = await decodeCanvas(canvas);
      if (code && !stopped) {
        stop();
        try { navigator.vibrate && navigator.vibrate(120); } catch (e) {}
        onCode(code);
        return;
      }
    }
    setTimeout(loop, 120);
  };
  setTimeout(loop, 300);

  function stop() {
    stopped = true;
    try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
    try { video.srcObject = null; } catch (e) {}
  }
  async function setTorch(on) {
    try { await track.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (e) { return false; }
  }
  return { stop, setTorch, hasTorch: !!caps.torch };
}

/** Décode un code-barres sur une photo (prise avec l'appareil photo natif : meilleure mise au point). */
export async function decodeImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i); i.onerror = reject; i.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    // plusieurs tailles : les photos de 12 Mpx sont trop grandes pour ZXing, trop petites ratent les traits fins
    for (const target of [1600, 1000, 2400, 700]) {
      const scale = Math.min(1, target / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const code = await decodeCanvas(canvas);
      if (code) return code;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Ouvre la caméra arrière dans <video> (pour prendre une photo de repas dans l'app). */
export async function openCamera(video) {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 }, advanced: [{ focusMode: "continuous" }] },
    });
  } catch (e) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
  }
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play().catch(() => {});
  return {
    stop() { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {} try { video.srcObject = null; } catch (e) {} },
    /** Capture l'image courante en fichier JPEG (max 1600 px, suffisant pour l'IA et léger à envoyer). */
    async snap() {
      const vw = video.videoWidth, vh = video.videoHeight;
      const scale = Math.min(1, 1600 / Math.max(vw, vh));
      const c = document.createElement("canvas");
      c.width = Math.round(vw * scale); c.height = Math.round(vh * scale);
      c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
      return new File([blob], "repas.jpg", { type: "image/jpeg" });
    },
  };
}
