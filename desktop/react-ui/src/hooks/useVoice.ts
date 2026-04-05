import { useCallback, useEffect, useRef } from 'react';
import { useVoiceStore } from '../store/voiceStore';
import { useChatStore } from '../store/chatStore';
import { useSocket } from './useSocket';
import { voiceService } from '../services/voiceService';

const TARGET_SAMPLE_RATE = 16000;

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate <= TARGET_SAMPLE_RATE) {
    return input;
  }

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);

  let outputIndex = 0;
  let inputIndex = 0;
  while (outputIndex < newLength) {
    const nextInputIndex = Math.round((outputIndex + 1) * ratio);
    let accumulator = 0;
    let count = 0;

    for (let i = inputIndex; i < nextInputIndex && i < input.length; i += 1) {
      accumulator += input[i];
      count += 1;
    }

    output[outputIndex] = count > 0 ? accumulator / count : 0;
    outputIndex += 1;
    inputIndex = nextInputIndex;
  }

  return output;
}

function float32ToInt16(samples: Float32Array): Int16Array {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

export function useVoice() {
  const voice = useVoiceStore();
  const { sessionId } = useChatStore();
  const {
    startVoiceSession: emitVoiceStart,
    stopVoiceSession: emitVoiceStop,
    sendVoiceAudio,
  } = useSocket({ enableRealtimeHandlers: false });

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedGainRef = useRef<GainNode | null>(null);
  const lastFrameSentAtRef = useRef<number | null>(null);
  const lastVolumeUpdateRef = useRef<number>(0);
  const lastAudioSendAtRef = useRef<number>(0);

  const teardownAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (mutedGainRef.current) {
      mutedGainRef.current.disconnect();
      mutedGainRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) {
      void context.close();
    }

    // Clean up refs - don't call voice.setVolume here to avoid re-render loops
    lastFrameSentAtRef.current = null;
    lastVolumeUpdateRef.current = 0;
    lastAudioSendAtRef.current = 0;
  }, []); // No dependencies

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const status = await voiceService.getStatus();
        if (!mounted) return;
        voice.setStatus(status.status);
        voice.setWakeWordActive(status.wakeWordActive);
      } catch {
        // Keep local defaults if backend voice status is unavailable.
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, []); // Remove voice dependency to prevent re-runs on store updates

  const startListening = useCallback(async () => {
    if (streamRef.current) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextImpl) {
        throw new Error('AudioContext is not available in this renderer.');
      }

      const audioContext = new AudioContextImpl();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const mutedGain = audioContext.createGain();
      mutedGain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        const inputChannel = event.inputBuffer.getChannelData(0);
        const copied = new Float32Array(inputChannel.length);
        copied.set(inputChannel);

        const rms = calculateRms(copied);
        const now = Date.now();

        // Volume update throttled to prevent re-render storms.
        if (now - lastVolumeUpdateRef.current > 500) {
          voice.setVolume(Math.min(1, rms * 3.5));
          lastVolumeUpdateRef.current = now;
        }

        const downsampled = downsampleTo16k(copied, audioContext.sampleRate);
        const pcm16 = float32ToInt16(downsampled);
        const bytes = new Uint8Array(pcm16.buffer);
        const cadenceMs = lastFrameSentAtRef.current ? now - lastFrameSentAtRef.current : 0;

        // Keep frame cadence bounded so backend STT queue doesn't get flooded.
        if (bytes.byteLength > 0 && now - lastAudioSendAtRef.current >= 120) {
          voice.setDebugMetrics({
            sampleRate: TARGET_SAMPLE_RATE,
            frameBytes: bytes.byteLength,
            cadenceMs: Number(cadenceMs.toFixed(1)),
          });
          sendVoiceAudio(uint8ToBase64(bytes), 'pcm_s16le', TARGET_SAMPLE_RATE);
          lastFrameSentAtRef.current = now;
          lastAudioSendAtRef.current = now;
        }
      };

      source.connect(processor);
      processor.connect(mutedGain);
      mutedGain.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      mutedGainRef.current = mutedGain;
      voice.setDebugMetrics({
        sampleRate: TARGET_SAMPLE_RATE,
        frameBytes: 0,
        cadenceMs: 0,
      });

      voice.setStatus('listening');
      void voiceService.startSession(sessionId).catch(() => {
        // Status remains best-effort from UI standpoint.
      });
      emitVoiceStart(sessionId);
    } catch {
      teardownAudioCapture();
      voice.setStatus('idle');
    }
  }, [sessionId, emitVoiceStart, sendVoiceAudio, teardownAudioCapture]); // Removed voice to prevent re-creates on every store change

  const stopListening = useCallback(() => {
    teardownAudioCapture();
    voice.setVolume(0); // Reset volume when stopping
    voice.reset();
    void voiceService.stopSession().catch(() => {
      // Ignore stop failures in UI.
    });
    emitVoiceStop();
  }, [emitVoiceStop, teardownAudioCapture]); // Removed voice to prevent re-creates on every store change

  useEffect(() => {
    return () => {
      teardownAudioCapture();
    };
  }, [teardownAudioCapture]);

  return {
    ...voice,
    startListening,
    stopListening,
  };
}
