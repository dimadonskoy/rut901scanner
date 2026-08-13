import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';
import { recognize } from 'tesseract.js';
import { Camera, RefreshCw, Zap, AlertCircle, Scan, Eye, Copy } from 'lucide-react';
import { extractPasswordField } from '../lib/extractPassword';

interface CameraScannerProps {
  onScanResult: (password: string, fullText?: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanResult }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewfinderRef = useRef<HTMLDivElement | null>(null);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [lastRawText, setLastRawText] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  // Initialize Code Reader and request camera permissions explicitly
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    async function initCamera() {
      // Check for Secure Context (HTTPS or localhost) - iOS Safari strict requirement
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setError('Camera requires HTTPS on iOS. Please access via localhost or a secure HTTPS connection.');
        return;
      }

      try {
        // Request permissions first to trigger browser security prompt
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        // Stop initial temporary stream after obtaining permissions
        stream.getTracks().forEach((track) => track.stop());

        // Now enumerate devices (labels will be populated once permitted)
        const devices = await codeReader.listVideoInputDevices();
        setVideoDevices(devices);

        if (devices.length > 0) {
          // Default to environment/back camera (iOS rear camera)
          const backCamera = devices.find((device) =>
            /back|environment|rear|main|0/i.test(device.label)
          );
          setSelectedDeviceId(backCamera ? backCamera.deviceId : devices[0].deviceId);
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission was denied. Please allow camera access in iOS Settings > Safari / Browser Settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera detected on this device.');
        } else {
          setError('Unable to access camera. Ensure you are using HTTPS or localhost.');
        }
      }
    }

    initCamera();

    return () => {
      codeReader.reset();
    };
  }, []);

  // Extract the PASSWORD field value from decoded barcode/QR text.
  const parseAndReport = React.useCallback((rawText: string) => {
    if (!rawText || rawText.trim().length === 0) return;

    const extracted = extractPasswordField(rawText);
    if (extracted) {
      onScanResult(extracted, rawText);
    } else {
      setLastRawText(rawText);
    }
  }, [onScanResult]);

  // Map the on-screen viewfinder box to source-video pixel coordinates,
  // accounting for the video element's object-cover scaling/cropping.
  const getViewfinderCropRect = (video: HTMLVideoElement) => {
    const box = viewfinderRef.current;
    if (!box) return null;

    const vRect = video.getBoundingClientRect();
    const bRect = box.getBoundingClientRect();
    if (vRect.width === 0 || vRect.height === 0) return null;

    const scale = Math.max(vRect.width / video.videoWidth, vRect.height / video.videoHeight);
    const offsetX = (video.videoWidth * scale - vRect.width) / 2;
    const offsetY = (video.videoHeight * scale - vRect.height) / 2;

    // Pad the crop ~12% so slightly misaligned labels still fit.
    const padX = bRect.width * 0.12;
    const padY = bRect.height * 0.12;

    const sx = (bRect.left - vRect.left - padX + offsetX) / scale;
    const sy = (bRect.top - vRect.top - padY + offsetY) / scale;
    const sw = (bRect.width + padX * 2) / scale;
    const sh = (bRect.height + padY * 2) / scale;

    return {
      sx: Math.max(0, sx),
      sy: Math.max(0, sy),
      sw: Math.min(sw, video.videoWidth - Math.max(0, sx)),
      sh: Math.min(sh, video.videoHeight - Math.max(0, sy)),
    };
  };

  // Grayscale the frame, invert it when the background is dark (labels print
  // white-on-black, but Tesseract expects dark-on-light), and stretch contrast.
  const preprocessForOcr = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const px = imageData.data;

    let sum = 0;
    const gray = new Uint8ClampedArray(px.length / 4);
    for (let i = 0; i < gray.length; i++) {
      const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      gray[i] = g;
      sum += g;
    }

    const invert = sum / gray.length < 128;

    let min = 255;
    let max = 0;
    for (let i = 0; i < gray.length; i++) {
      if (invert) gray[i] = 255 - gray[i];
      if (gray[i] < min) min = gray[i];
      if (gray[i] > max) max = gray[i];
    }

    const range = Math.max(1, max - min);
    for (let i = 0; i < gray.length; i++) {
      const v = ((gray[i] - min) / range) * 255;
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Capture the viewfinder region of the video frame and run OCR to read the
  // printed PASSWORD field.
  const captureAndRecognizePassword = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      setOcrError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }

    setCapturing(true);
    setOcrError(null);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const crop = getViewfinderCropRect(video);
      const sx = crop ? crop.sx : 0;
      const sy = crop ? crop.sy : 0;
      const sw = crop ? crop.sw : video.videoWidth;
      const sh = crop ? crop.sh : video.videoHeight;

      // Upscale small crops so label glyphs are large enough for Tesseract.
      const upscale = Math.min(3, Math.max(1, 1400 / sw));
      canvas.width = Math.round(sw * upscale);
      canvas.height = Math.round(sh * upscale);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      preprocessForOcr(ctx, canvas.width, canvas.height);

      const { data } = await recognize(canvas, 'eng');
      const password = extractPasswordField(data.text);

      if (password) {
        onScanResult(password, data.text);
      } else {
        setOcrError('PASSWORD field not detected — align label and try again.');
        setLastRawText(data.text);
      }
    } catch (err) {
      console.error('OCR capture error:', err);
      setOcrError('Could not read label text. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  // Start continuous video decoding
  useEffect(() => {
    if (!selectedDeviceId || !codeReaderRef.current || !videoRef.current) return;

    setError(null);

    codeReaderRef.current.decodeFromVideoDevice(
      selectedDeviceId,
      videoRef.current,
      (result: Result | null, err) => {
        if (result) {
          const text = result.getText();
          parseAndReport(text);
        }
        if (err && !(err.name === 'NotFoundException')) {
          // Non-critical frame decode error
        }
      }
    );

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, [selectedDeviceId, parseAndReport]);

  const switchCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const newTorchState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newTorchState }]
        });
        setTorchOn(newTorchState);
      } catch (err) {
        console.warn('Flashlight not supported on this device/browser:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-0 relative backdrop-blur-md">
      {/* Video Viewport Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-slate-950/80 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Scan className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="font-semibold text-xs sm:text-sm text-slate-200">Scan RUT901 Label</h2>
            <p className="text-[10px] text-slate-400">Position 1D barcode inside box</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {videoDevices.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              title="Switch Camera"
              aria-label="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={captureAndRecognizePassword}
            disabled={capturing}
            className={`px-3 py-2.5 rounded-xl transition-all min-h-[44px] flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
              capturing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-lg shadow-blue-900/30'
            }`}
            title="Capture PASSWORD field"
            aria-label="Capture PASSWORD field"
          >
            <Camera className={`w-4 h-4 ${capturing ? 'animate-spin' : ''}`} />
            {capturing ? 'Reading...' : 'Capture PASSWORD'}
          </button>
          <button
            onClick={toggleTorch}
            className={`p-2.5 rounded-xl transition-all min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer ${
              torchOn
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.5)] font-bold'
                : 'bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-300'
            }`}
            title="Toggle Flashlight"
            aria-label="Toggle Flashlight"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Stream Container */}
      <div className="relative aspect-square sm:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder Target Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div ref={viewfinderRef} className="w-64 h-44 sm:w-80 sm:h-52 border-2 border-blue-500/70 rounded-2xl relative shadow-[0_0_50px_rgba(59,130,246,0.25)] bg-blue-500/5 flex flex-col justify-between p-3 overflow-hidden">
            {/* Target Corners */}
            <div className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-4 border-l-4 border-blue-400 rounded-tl-xl shadow-sm" />
            <div className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-4 border-r-4 border-blue-400 rounded-tr-xl shadow-sm" />
            <div className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-4 border-l-4 border-blue-400 rounded-bl-xl shadow-sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-4 border-r-4 border-blue-400 rounded-br-xl shadow-sm" />

            {/* Scanning Laser Line Animation */}
            <div className="animate-laser w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#60a5fa]" />

            <div className="text-center mt-auto">
              <span className="text-[10px] font-semibold tracking-wider uppercase bg-slate-950/85 px-3 py-1 rounded-full text-blue-300 border border-blue-500/30 backdrop-blur-sm">
                ALIGN PASS / BARCODE HERE
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="absolute inset-x-4 top-4 p-3 bg-red-950/90 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* OCR Error Alert */}
        {ocrError && (
          <div className="absolute inset-x-4 bottom-4 p-3 bg-red-950/90 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{ocrError}</span>
          </div>
        )}
      </div>

      {/* Raw Scanned Text Panel — shown when text was read but no PASSWORD field matched */}
      {lastRawText && (
        <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 py-3 space-y-2">
          <button
            onClick={() => setShowRawText((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Text was scanned but no PASSWORD field found — view it
            </span>
            <span className="text-slate-500">{showRawText ? 'Hide' : 'Show'}</span>
          </button>

          {showRawText && (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500">
                Tap a word below to use it as the password:
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                {lastRawText.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => (
                  <div key={i} className="flex flex-wrap gap-1.5">
                    {line.trim().split(/\s+/).map((word, j) => (
                      <button
                        key={j}
                        onClick={() => onScanResult(word, lastRawText)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-blue-600 active:bg-blue-700 text-slate-200 hover:text-white font-mono text-xs transition-colors cursor-pointer"
                        title="Use as password"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(lastRawText)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2 py-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy all text
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/90 text-center border-t border-slate-800/80">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-slate-500" />
          Scans 1D Barcodes & Password text automatically
        </p>
      </div>
    </div>
  );
};
