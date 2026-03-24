import { useCallback } from 'react';
import { useEmotionStore } from '../store/emotionStore';
import { useSocket } from './useSocket';

// Simple typing speed tracker
let lastKeyTime = Date.now();
let keyCount = 0;
let errorCount = 0;

export function useEmotion() {
  const { emotion, recordTypingSignal } = useEmotionStore();
  const { sendEmotionSignal } = useSocket();

  const recordKeystroke = useCallback((isError = false) => {
    const now = Date.now();
    const pauseMs = now - lastKeyTime;

    keyCount++;
    if (isError) errorCount++;

    const elapsed = (now - lastKeyTime) / 1000 / 60; // minutes
    if (elapsed > 0) {
      const wpm = Math.round(keyCount / 5 / elapsed); // standard WPM (chars/5 per minute)
      recordTypingSignal(wpm, errorCount);

      // Send signal every 10 keystrokes
      if (keyCount % 10 === 0) {
        sendEmotionSignal(wpm, errorCount, pauseMs);
      }
    }

    if (keyCount > 100) {
      // Reset counters periodically
      keyCount = 0;
      errorCount = 0;
      lastKeyTime = now;
      return;
    }

    lastKeyTime = now;
  }, [recordTypingSignal, sendEmotionSignal]);

  return { emotion, recordKeystroke };
}
