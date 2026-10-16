import React, { useEffect, useRef, useState } from 'react';
import { X, Flashlight, FlashlightOff, Camera } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';

export default function QrScanner({ onPayloadScanned, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    let isCancelled = false;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }

        // Attach stream to ZXing reader
        const controls = await codeReader.decodeFromVideoElement(
          videoRef.current,
          (result, err) => {
            if (result && !isCancelled) {
              // Trigger crisp success tactile feedback
              if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
                navigator.vibrate(40);
              }
              onPayloadScanned(result.getText());
            }
          }
        );

        controlsRef.current = controls;
        videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera access error:', err);
        setErrorMsg('कैमरा शुरू करने में समस्या आई। कृपया अनुमति जांचें।');
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, [onPayloadScanned]);

  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;
    const track = videoRef.current.srcObject.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch constraint error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between items-center p-4">
      
      {/* Top Scanner Bar */}
      <div className="w-full max-w-md flex items-center justify-between pt-2 px-2 z-20">
        <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs tracking-wider">
          <Camera className="w-4 h-4 animate-pulse" />
          <span>CYBER RETICLE ACTIVE</span>
        </div>

        <div className="flex items-center space-x-2">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2.5 rounded-2xl border transition-all ${
                torchOn
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                  : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
              }`}
              title="Torch Toggle"
              aria-label="Toggle Flashlight"
            >
              {torchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5 text-slate-300" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors"
            aria-label="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Video Viewport */}
      <div className="relative w-full max-w-sm aspect-square my-auto flex items-center justify-center overflow-hidden rounded-3xl border border-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.2)] bg-slate-950">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Cyber Viewfinder Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none p-8 flex items-center justify-center">
          <div className="relative w-full h-full">
            
            {/* 4 Corner Framing Brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-xl shadow-[0_0_10px_rgba(34,211,238,0.8)]" />

            {/* Scanning Laser Beam */}
            <div className="laser-line" />
          </div>
        </div>

        {errorMsg && (
          <div className="absolute inset-x-4 bottom-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300 text-center font-medium">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Bottom Guidance */}
      <div className="w-full max-w-md pb-6 text-center z-20">
        <p className="text-xs text-slate-400 font-mono">
          QR कोड को फ्रेम के बीच में रखें · शून्य सर्वर अपलोड
        </p>
      </div>
    </div>
  );
}
