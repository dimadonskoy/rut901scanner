import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minimize2, Copy, Check, QrCode, Barcode as BarcodeIcon, ShieldCheck, Sparkles } from 'lucide-react';

interface BarcodeDisplayProps {
  scannedPassword: string;
  onClear: () => void;
  deviceSn?: string;
  deviceMac?: string;
}

export const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
  scannedPassword,
  onClear,
  deviceSn,
  deviceMac
}) => {
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'barcode' | 'qr'>('barcode');
  const [editedPassword, setEditedPassword] = useState(scannedPassword);

  const handleCopy = () => {
    navigator.clipboard.writeText(editedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-100">Password Captured</h2>
            <p className="text-[11px] text-slate-400">Ready to present or scan</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-xs font-medium px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 border border-slate-700/60 transition-all cursor-pointer min-h-[44px] flex items-center"
        >
          Scan Another
        </button>
      </div>

      {/* Editable Password Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-1">
          <label className="text-xs text-slate-400 font-medium">Captured Password</label>
          <span className="text-[10px] text-slate-500 font-mono">Tap input to edit</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2.5 shadow-inner focus-within:border-blue-500/80 transition-colors">
          <input
            type="text"
            value={editedPassword}
            onChange={(e) => setEditedPassword(e.target.value)}
            className="bg-transparent flex-1 text-emerald-400 font-mono font-bold text-lg sm:text-xl tracking-wider focus:outline-none px-2"
          />
          <button
            onClick={handleCopy}
            className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50 active:scale-95'
            }`}
            title="Copy Password"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        {(deviceSn || deviceMac) && (
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 px-1 font-mono">
            {deviceSn && <span>SN: <strong className="text-slate-200">{deviceSn}</strong></span>}
            {deviceMac && <span>MAC: <strong className="text-slate-200">{deviceMac}</strong></span>}
          </div>
        )}
      </div>

      {/* View Switcher */}
      <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80">
        <button
          onClick={() => setActiveTab('barcode')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'barcode'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarcodeIcon className="w-4 h-4" />
          1D Barcode (Code 128)
        </button>
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all min-h-[44px] cursor-pointer ${
            activeTab === 'qr'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4" />
          2D QR Code
        </button>
      </div>

      {/* Barcode Output Display Box (High Contrast White Card) */}
      <div className="relative bg-white rounded-2xl p-6 flex flex-col items-center justify-center min-h-[220px] border-2 border-slate-600 shadow-xl group overflow-hidden">
        <button
          onClick={() => setIsFullScreen(true)}
          className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-slate-100 rounded-xl backdrop-blur shadow opacity-80 group-hover:opacity-100 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer min-h-[44px] min-w-[44px] justify-center"
          title="Fullscreen Presentation Mode"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Enlarge</span>
        </button>

        {activeTab === 'barcode' ? (
          <div className="w-full overflow-x-auto flex justify-center py-2">
            <Barcode
              value={editedPassword || 'RUT901'}
              format="CODE128"
              width={2.2}
              height={90}
              displayValue={true}
              font="monospace"
              fontOptions="bold"
              fontSize={18}
              margin={10}
              background="#ffffff"
              lineColor="#000000"
            />
          </div>
        ) : (
          <div className="py-2">
            <QRCodeSVG
              value={editedPassword || 'RUT901'}
              size={180}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H"
            />
          </div>
        )}
        <p className="text-[11px] text-slate-500 font-sans mt-3 flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Point target camera directly at this screen
        </p>
      </div>

      {/* FULLSCREEN / PHONE PRESENTATION MODAL */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 space-y-6 animate-in fade-in zoom-in-95">
          <div className="absolute top-6 right-6">
            <button
              onClick={() => setIsFullScreen(false)}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-full transition-all cursor-pointer min-w-[48px] min-h-[48px] flex items-center justify-center shadow-lg"
              aria-label="Close Fullscreen"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-xl font-bold text-slate-100">Scan Barcode</h3>
            <p className="text-base text-emerald-400 font-mono font-bold tracking-wider">{editedPassword}</p>
          </div>

          <div className="bg-white p-8 rounded-3xl border-8 border-slate-800 shadow-2xl flex flex-col items-center justify-center max-w-full">
            {activeTab === 'barcode' ? (
              <div className="overflow-x-auto max-w-full p-2">
                <Barcode
                  value={editedPassword || 'RUT901'}
                  format="CODE128"
                  width={3}
                  height={140}
                  displayValue={true}
                  font="monospace"
                  fontOptions="bold"
                  fontSize={24}
                  margin={15}
                  background="#ffffff"
                  lineColor="#000000"
                />
              </div>
            ) : (
              <div className="p-2">
                <QRCodeSVG
                  value={editedPassword || 'RUT901'}
                  size={280}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                />
              </div>
            )}
          </div>

          <p className="text-xs text-blue-300 font-mono tracking-widest uppercase animate-pulse bg-blue-950/60 px-4 py-1.5 rounded-full border border-blue-500/30">
            MAXIMUM SCANNER CONTRAST MODE
          </p>
        </div>
      )}
    </div>
  );
};
