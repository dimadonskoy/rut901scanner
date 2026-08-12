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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between py-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400">
            <Router className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Teltonika RUT901 <span className="text-xs bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-500/30">Password Scanner</span>
            </h1>
            <p className="text-xs text-slate-400">Camera label scanner to phone barcode</p>
          </div>
        </div>
        <Wifi className="w-5 h-5 text-emerald-400 animate-pulse" />
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center space-y-4">
        {!scannedPassword ? (
          <>
            {/* Live Camera Scanner Viewport */}
            <CameraScanner onScanResult={handleScanResult} />

            {/* Quick Manual Fallback Drawer */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
              {!showManualForm ? (
                <button
                  onClick={() => setShowManualForm(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium"
                >
                  <Keyboard className="w-4 h-4 text-blue-400" />
                  Or type/edit password manually
                </button>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Enter password manually..."
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md"
                    >
                      Generate Barcode
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-400"
                  >
                    Cancel
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
      <footer className="w-full max-w-lg mx-auto text-center py-4 border-t border-slate-900 mt-6">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-blue-400" />
          Teltonika RUT901 Default Password Scanner App
        </p>
      </footer>
    </div>
  );
}

export default App;
