import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, X } from 'lucide-react';
import { api } from '../../services/api';
import { useEmotionStore, EmotionState } from '../../store/emotionStore';

type CameraEmotionStatusResponse = {
  status?: {
    enabled?: boolean;
    active?: boolean;
    ready?: boolean;
    message?: string;
  } | string;
  emotion_signal?: {
    state?: string;
    confidence?: number;
    summary?: string;
    enabled?: boolean;
    raw_metrics?: {
      facial_expression?: string;
      expression_confidence?: number;
      face_engagement?: number;
      eye_strain?: number;
      blink_rate?: number;
      eye_openness?: number;
      looking_at_screen?: boolean;
    };
    facial_cues?: {
      smile?: number;
      frown?: number;
      raised_brows?: number;
      squint?: number;
      eye_wideness?: number;
    };
  };
};

function normalizeEmotionState(value: string | undefined): EmotionState {
  if (value === 'focused' || value === 'stressed' || value === 'fatigued' || value === 'frustrated' || value === 'motivated') {
    return value;
  }
  return 'neutral';
}

export const CameraPreview: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const updateEmotion = useEmotionStore((s) => s.updateEmotion);
  const [enabled, setEnabled] = useState(true);
  const [emotionRecognizerEnabled, setEmotionRecognizerEnabled] = useState(true);
  const [status, setStatus] = useState<'idle' | 'ready' | 'blocked' | 'error'>('idle');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [cameraEmotion, setCameraEmotion] = useState<{ 
    state: string; 
    confidence: number; 
    summary?: string;
    facial_expression?: string;
    expression_confidence?: number;
    facial_cues?: Record<string, number>;
    raw_metrics?: Record<string, any>;
  } | null>(null);
  const [cameraEmotionError, setCameraEmotionError] = useState<string>('');
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
          setStatus('error');
          if (emotionRecognizerEnabled) {
            setErrorDetail('Camera is currently owned by live emotion recognizer.');
          } else {
            setErrorDetail('Camera is in use by another app/process.');
          }
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
  }, [enabled, emotionRecognizerEnabled]);

  useEffect(() => {
    let mounted = true;
    let pollInterval: number | null = null;

    const syncRecognizer = async () => {
      try {
        if (emotionRecognizerEnabled) {
          await api.post('/ai/camera/enable');
        } else {
          await api.post('/ai/camera/disable');
        }
      } catch {
        // Keep UI resilient even if AI engine is temporarily unavailable.
      }
    };

    const pollStatus = async () => {
      if (!mounted || !enabled) {
        return;
      }

      try {
        const response = await api.get<CameraEmotionStatusResponse>('/ai/camera/status');
        const signal = response.data?.emotion_signal;
        if (signal?.state) {
          const confidence = typeof signal.confidence === 'number' ? signal.confidence : 0;
          setCameraEmotion({
            state: signal.state,
            confidence,
            summary: signal.summary,
            facial_expression: signal.raw_metrics?.facial_expression,
            expression_confidence: signal.raw_metrics?.expression_confidence,
            facial_cues: signal.facial_cues,
            raw_metrics: signal.raw_metrics,
          });
          setCameraEmotionError('');

          if (confidence > 0) {
            updateEmotion(normalizeEmotionState(signal.state), confidence, {
              sources: ['webcam'],
              summaries: signal.summary ? [signal.summary] : undefined,
            });
          }
        } else {
          setCameraEmotion(null);
        }
      } catch {
        setCameraEmotion(null);
        setCameraEmotionError('Emotion recognizer unavailable');
      }
    };

    void syncRecognizer();
    void pollStatus();
    pollInterval = window.setInterval(() => {
      void pollStatus();
    }, 2000);

    return () => {
      mounted = false;
      if (pollInterval !== null) {
        window.clearInterval(pollInterval);
      }
    };
  }, [enabled, emotionRecognizerEnabled, updateEmotion]);

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEmotionRecognizerEnabled((prev) => !prev)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${emotionRecognizerEnabled ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/10 text-elixi-muted hover:text-elixi-text'}`}
              title={emotionRecognizerEnabled ? 'Disable live emotion recognizer' : 'Enable live emotion recognizer'}
            >
              {emotionRecognizerEnabled ? 'Emotion On' : 'Emotion Off'}
            </button>
            <button
              type="button"
              onClick={() => setEnabled((prev) => !prev)}
              className="text-elixi-muted hover:text-elixi-text transition-colors"
              title={enabled ? 'Hide camera preview' : 'Show camera preview'}
            >
              {enabled ? <X size={12} /> : <Camera size={12} />}
            </button>
          </div>
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

          {enabled && emotionRecognizerEnabled && (
            <div className="absolute left-2 bottom-2 right-2 rounded-md bg-black/65 border border-cyan-400/40 px-2 py-1.5 text-[10px] text-white space-y-1">
              {cameraEmotion ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-cyan-300">
                      {cameraEmotion.state.toUpperCase()}
                    </span>
                    <span className="text-cyan-400 tabular-nums">
                      {Math.round(cameraEmotion.confidence * 100)}%
                    </span>
                  </div>
                  {cameraEmotion.summary && (
                    <div className="text-[9px] text-cyan-100/80 truncate">
                      {cameraEmotion.summary}
                    </div>
                  )}
                  {cameraEmotion.facial_cues && (
                    <div className="grid grid-cols-2 gap-1 text-[8px] pt-0.5 border-t border-cyan-400/20">
                      {cameraEmotion.facial_cues.smile !== undefined && cameraEmotion.facial_cues.smile > 0.2 && (
                        <div className="text-yellow-300">😊 Smile: {Math.round(cameraEmotion.facial_cues.smile * 100)}%</div>
                      )}
                      {cameraEmotion.facial_cues.frown !== undefined && cameraEmotion.facial_cues.frown > 0.2 && (
                        <div className="text-orange-300">🤨 Frown: {Math.round(cameraEmotion.facial_cues.frown * 100)}%</div>
                      )}
                      {cameraEmotion.facial_cues.raised_brows !== undefined && cameraEmotion.facial_cues.raised_brows > 0.2 && (
                        <div className="text-purple-300">👁️ Raised Brows: {Math.round(cameraEmotion.facial_cues.raised_brows * 100)}%</div>
                      )}
                      {cameraEmotion.facial_cues.squint !== undefined && cameraEmotion.facial_cues.squint > 0.2 && (
                        <div className="text-blue-300">🎯 Focus: {Math.round(cameraEmotion.facial_cues.squint * 100)}%</div>
                      )}
                    </div>
                  )}
                  {cameraEmotion.raw_metrics && (
                    <div className="text-[8px] text-slate-300/70 space-y-0.5 pt-0.5 border-t border-cyan-400/20">
                      <div>Engagement: {Math.round((cameraEmotion.raw_metrics.face_engagement || 0) * 100)}%</div>
                      <div>Eye Strain: {Math.round((cameraEmotion.raw_metrics.eye_strain || 0) * 100)}%</div>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-slate-200">
                  {cameraEmotionError || 'Analyzing expressions...'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
