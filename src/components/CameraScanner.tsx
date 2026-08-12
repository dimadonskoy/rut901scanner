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

  // Initialize Code Reader and enumerate cameras
  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    codeReader
      .listVideoInputDevices()
      .then((devices) => {
        setVideoDevices(devices);
        if (devices.length > 0) {
          // Default to back/environment camera if present
          const backCamera = devices.find((device) =>
            /back|environment|rear|main/i.test(device.label)
          );
          setSelectedDeviceId(backCamera ? backCamera.deviceId : devices[0].deviceId);
        }
      })
      .catch((err) => {
        console.error('Camera enumeration error:', err);
        setError('Unable to access camera hardware. Please check permissions.');
      });

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
    <div className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0 relative">
      {/* Video Viewport Header */}
      <div className="flex items-center justify-between p-4 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-blue-400 animate-pulse" />
          <h2 className="font-semibold text-sm text-slate-200">Point Camera at Teltonika RUT901 Label</h2>
        </div>

        <div className="flex items-center gap-2">
          {videoDevices.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleTorch}
            className={`p-2 rounded-lg transition-colors ${
              torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Toggle Flashlight"
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
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
          <div className="w-64 h-44 sm:w-80 sm:h-52 border-2 border-blue-500/80 rounded-2xl relative shadow-[0_0_40px_rgba(59,130,246,0.3)] bg-blue-500/5 flex flex-col justify-between p-3">
            {/* Target Corners */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

            {/* Scanning Laser Line Animation */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_12px_#60a5fa] animate-bounce my-auto" />
            
            <div className="text-center">
              <span className="text-[11px] font-medium tracking-wide bg-slate-950/80 px-2.5 py-1 rounded-full text-blue-300 border border-blue-500/30">
                ALIGN PASS / BARCODE HERE
              </span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="absolute inset-x-4 top-4 p-3 bg-red-950/90 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2 shadow-lg backdrop-blur">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/90 text-center border-t border-slate-800">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-slate-500" />
          Scans 1D Barcodes & Password Text automatically
        </p>
      </div>
    </div>
  );
};
