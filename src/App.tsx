import React, { useState } from 'react';
import { CameraScanner } from './components/CameraScanner';
import { BarcodeDisplay } from './components/BarcodeDisplay';
import { Wifi, Router, Sparkles, Key, Keyboard } from 'lucide-react';

export function App() {
  const [scannedPassword, setScannedPassword] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  const handleScanResult = (password: string) => {
    if (password && password.trim()) {
      setScannedPassword(password.trim());
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      setScannedPassword(manualInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans select-none">
      {/* Ambient background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <header className="relative w-full max-w-lg mx-auto flex items-center justify-between py-3 px-1 border-b border-slate-800/80 mb-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/15 border border-blue-500/30 rounded-xl text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <Router className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Teltonika RUT901 <span className="text-[10px] sm:text-xs bg-blue-500/15 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-500/30 font-medium">Scanner</span>
            </h1>
            <p className="text-xs text-slate-400">Router label scanner to phone barcode</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-300">Ready</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative w-full max-w-lg mx-auto flex-1 flex flex-col justify-center space-y-4">
        {!scannedPassword ? (
          <>
            {/* Live Camera Scanner Viewport */}
            <CameraScanner onScanResult={handleScanResult} />

            {/* Quick Manual Fallback Drawer */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 text-center shadow-lg backdrop-blur-sm">
              {!showManualForm ? (
                <button
                  onClick={() => setShowManualForm(true)}
                  className="w-full py-2 text-xs text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 font-medium group active:scale-[0.99] cursor-pointer min-h-[44px]"
                >
                  <div className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-blue-600/20 group-hover:text-blue-400 text-slate-400 transition-colors">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  Type or edit router password manually
                </button>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="relative flex-1">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Enter password manually..."
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-emerald-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 min-h-[44px]"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-blue-900/30 cursor-pointer min-h-[44px]"
                    >
                      Generate Barcode
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1 px-3"
                  >
                    Cancel manual entry
                  </button>
                </form>
              )}
            </div>
          </>
        ) : (
          /* Scanned Result & Barcode Display Mode */
          <BarcodeDisplay
            scannedPassword={scannedPassword}
            onClear={() => {
              setScannedPassword(null);
              setManualInput('');
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="relative w-full max-w-lg mx-auto text-center py-4 border-t border-slate-900 mt-6">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          Teltonika RUT901 Default Password Scanner Utility
        </p>
      </footer>
    </div>
  );
}

export default App;
