import React, { useEffect, useRef, useState } from 'react';
import { X, Flashlight, FlashlightOff, Camera } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';

export default function QrScanner({ onPayloadScanned, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const controlsRef = useRef(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    let isCancelled = false;

    async function initCamera() {
      try {
        // Use ideal so laptop front webcam & mobile back camera both work seamlessly
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.muted = true;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }

        // Attach stream to ZXing reader
        const controls = await codeReader.decodeFromVideoElement(
          videoRef.current,
          (result, _err) => {
            if (result && !isCancelled) {
              if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
                navigator.vibrate(40);
              }
              onPayloadScanned(result.getText());
            }
          }
        );

        if (isCancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (err) {
        console.error('Camera stream access failed:', err);
        setErrorMsg('Camera access failed. Check browser permissions.');
      }
    }

    initCamera();

    return () => {
      isCancelled = true;
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [onPayloadScanned]);

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.25)] bg-slate-950 flex items-center justify-center">
        
        {/* Live Hardware Video Stream */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* HUD Scanner Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
          <div className="relative w-full h-full border-2 border-dashed border-cyan-400/60 rounded-xl flex items-center justify-center">
            <div className="absolute top-2 left-2 text-[10px] font-mono tracking-widest text-cyan-400 bg-black/60 px-2 py-0.5 rounded uppercase">
              Cyber Reticle Active
            </div>
            {/* Animated Laser Scanning Line */}
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-bounce" />
          </div>
        </div>

        {/* Top Controls */}
        <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800 transition"
              aria-label="Toggle Torch"
            >
              {torchOn ? <FlashlightOff className="w-5 h-5 text-amber-400" /> : <Flashlight className="w-5 h-5 text-slate-300" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800 transition"
            aria-label="Close Scanner"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {errorMsg && (
          <div className="absolute bottom-4 left-4 right-4 bg-rose-500/90 text-white text-xs py-2 px-3 rounded-lg text-center font-medium backdrop-blur-sm">
            {errorMsg}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs font-mono text-slate-400 tracking-wider">
        QR कोड को फ्रेम के बीच में रखें • शून्य सर्वर अपलोड
      </p>
    </div>
  );
}