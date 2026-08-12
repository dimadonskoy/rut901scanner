import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';
import { Camera, RefreshCw, Zap, AlertCircle, Scan } from 'lucide-react';

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

  // Extract Teltonika Password from scanned content (1D Barcode, QR code, or Label text)
  const parseAndReport = React.useCallback((rawText: string) => {
    if (!rawText || rawText.trim().length === 0) return;

    // Teltonika Label Parsing Patterns
    // Example RUT901 labels often have:
    // WPA Key / Password: 8-12 alphanumeric characters
    // Or string format PASS: <password>
    let extracted = rawText.trim();

    const passMatch = rawText.match(/(?:PASS|PASSWORD|WPA|KEY|PW)[\s:]*([A-Za-z0-9!@#$%^&*]{8,20})/i);
    if (passMatch && passMatch[1]) {
      extracted = passMatch[1];
    } else {
      // If it's a raw barcode value printed under PASS label
      const cleanMatch = rawText.match(/\b([A-Za-z0-9]{8,16})\b/);
      if (cleanMatch) {
        extracted = cleanMatch[1];
      }
    }

    onScanResult(extracted, rawText);
  }, [onScanResult]);

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

        {/* Viewfinder Target Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="w-64 h-44 sm:w-80 sm:h-52 border-2 border-blue-500/70 rounded-2xl relative shadow-[0_0_50px_rgba(59,130,246,0.25)] bg-blue-500/5 flex flex-col justify-between p-3 overflow-hidden">
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
      </div>

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
