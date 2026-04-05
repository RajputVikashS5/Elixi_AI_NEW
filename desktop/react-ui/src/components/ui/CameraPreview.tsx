import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, X } from 'lucide-react';
import { api } from '../../services/api';

export const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<'idle' | 'ready' | 'blocked' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const width = 224; // sm:w-56
    const height = 170;
    return {
      x: Math.max(12, window.innerWidth - width - 20),
      y: Math.max(12, window.innerHeight - height - 110),
    };
  });

  useEffect(() => {
    let mounted = true;
    let frameTimeout: number | null = null;

    /**
     * Release camera from backend AI engine.
     * Uses the unified API service.
     */
    const releaseBackendCamera = async (): Promise<boolean> => {
      try {
        console.log('[CameraPreview] Releasing backend camera...');
        const response = await api.post('/ai/camera/disable');
        console.log('[CameraPreview] Backend camera released:', response.data);
        return true;
      } catch (error) {
        console.warn('[CameraPreview] Failed to release backend camera:', error);
        // Continue anyway; camera might not be in use
        return false;
      }
    };

    const startPreview = async () => {
      if (!enabled) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error');
        setErrorDetail('Camera API is not available in this renderer context.');
        return;
      }

      try {
        setErrorDetail('');

        // Prefer renderer preview ownership when this widget is visible.
        await releaseBackendCamera();
        await new Promise((resolve) => window.setTimeout(resolve, 180));

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 180 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          setStatus('error');
          setErrorDetail('Video element is not available.');
          return;
        }

        video.srcObject = stream;

        try {
          await video.play();
        } catch {
          // Some environments delay play() until metadata/canplay; handled below.
        }

        const markReady = () => {
          if (!mounted) return;
          setStatus('ready');
          setErrorDetail('');
          if (frameTimeout !== null) {
            window.clearTimeout(frameTimeout);
            frameTimeout = null;
          }
        };

        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
          markReady();
        } else {
          video.onplaying = markReady;
          video.onloadeddata = markReady;

          frameTimeout = window.setTimeout(() => {
            if (!mounted) return;
            if (!video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
              setStatus('error');
              setErrorDetail('No video frames received. Camera may be busy or blocked by another process.');
            }
          }, 3000);
        }
      } catch (error) {
        const name = (error as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('blocked');
          setErrorDetail('Permission denied. Allow camera access for ELIXI.');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          // Busy camera can happen if backend analysis owns the webcam.
          if (!recoveryAttemptedRef.current) {
            recoveryAttemptedRef.current = true;
            setStatus('idle');
            setErrorDetail('Camera busy. Releasing backend camera...');

            const released = await releaseBackendCamera();
            if (released) {
              await new Promise((resolve) => window.setTimeout(resolve, 350));
              if (mounted) {
                await startPreview();
              }
              return;
            }
          }

          setStatus('error');
          setErrorDetail('Camera is in use by another app/process.');
        } else {
          setStatus('error');
          setErrorDetail((error as Error)?.message || 'Unable to start camera preview.');
        }
      }
    };

    const stopPreview = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.onplaying = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.srcObject = null;
      }
      if (frameTimeout !== null) {
        window.clearTimeout(frameTimeout);
        frameTimeout = null;
      }
    };

    if (enabled) {
      recoveryAttemptedRef.current = false;
      setStatus('idle');
      void startPreview();
    } else {
      stopPreview();
      setStatus('idle');
    }

    return () => {
      mounted = false;
      stopPreview();
    };
  }, [enabled]);

  const statusText =
    status === 'blocked'
      ? 'Camera permission blocked'
      : status === 'error'
        ? 'Camera unavailable'
        : status === 'idle'
          ? 'Starting camera...'
          : 'Live camera';

  const handleDragStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      const nextX = Math.min(Math.max(12, moveEvent.clientX - offsetX), maxX);
      const nextY = Math.min(Math.max(12, moveEvent.clientY - offsetY), maxY);
      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-30 no-drag"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative w-48 sm:w-56 rounded-xl overflow-hidden border border-elixi-border bg-elixi-surface/90 shadow-2xl backdrop-blur-sm">
        <div
          className="flex items-center justify-between px-2 py-1.5 border-b border-elixi-border bg-black/20 cursor-move"
          onMouseDown={handleDragStart}
          title="Drag to move"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-elixi-muted">
            {enabled ? <Camera size={12} /> : <CameraOff size={12} />}
            <span>{statusText}</span>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((prev) => !prev)}
            className="text-elixi-muted hover:text-elixi-text transition-colors"
            title={enabled ? 'Hide camera preview' : 'Show camera preview'}
          >
            {enabled ? <X size={12} /> : <Camera size={12} />}
          </button>
        </div>

        <div className="relative aspect-video bg-black/60">
          {enabled && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover scale-x-[-1] ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            />
          )}

          {(!enabled || status !== 'ready') && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center text-xs text-elixi-muted px-2 text-center">
              {status === 'blocked'
                ? 'Allow camera access in browser/electron settings.'
                : status === 'error'
                  ? (errorDetail || 'Camera unavailable.')
                  : 'Camera preview is off.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
