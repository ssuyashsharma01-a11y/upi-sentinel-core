import React, { useRef, useState, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Image as ImageIcon, XCircle, RefreshCw } from 'lucide-react';

export default function QrScanner({ onPayloadScanned, onClose }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const controlsRef = useRef(null);

  const startCamera = async () => {
    setErrorMsg('');
    setIsScanning(true);
    const codeReader = new BrowserMultiFormatReader();

    try {
      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const text = result.getText();
            if (controlsRef.current) {
              controlsRef.current.stop();
            }
            onPayloadScanned(text);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setErrorMsg('Camera permission denied or camera not accessible.');
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const codeReader = new BrowserMultiFormatReader();
    const imgUrl = URL.createObjectURL(file);

    try {
      const result = await codeReader.decodeFromImageUrl(imgUrl);
      URL.revokeObjectURL(imgUrl);
      if (result) {
        onPayloadScanned(result.getText());
      } else {
        setErrorMsg('No readable QR code found in uploaded image.');
      }
    } catch (err) {
      URL.revokeObjectURL(imgUrl);
      setErrorMsg('Could not decode QR code from image.');
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Camera className="w-4 h-4 text-blue-600" />
            <span>Scan UPI QR Code</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewfinder */}
        <div className="relative aspect-square w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <div className="absolute inset-8 border-2 border-blue-500/80 rounded-xl pointer-events-none animate-pulse" />
        </div>

        {errorMsg && (
          <div className="text-[11px] text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Alternative: Upload Screenshot */}
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Select Image</span>
          </button>
          <button
            type="button"
            onClick={startCamera}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}