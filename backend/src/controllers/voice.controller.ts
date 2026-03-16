import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { voiceService } from '../services/voice.service';

const startSchema = z.object({
  sessionId: z.string().uuid(),
});

const ttsSchema = z.object({
  text: z.string().min(1).max(4000),
});

const wakeSchema = z.object({
  active: z.boolean(),
});

const voiceSettingsSchema = z.object({
  rate: z.number().int().min(50).max(400).optional(),
  volume: z.number().min(0).max(1).optional(),
  voice_id: z.string().max(256).nullable().optional(),
});

export async function getVoiceStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const status = await voiceService.getStatus();
    return res.json(status);
  } catch (err) {
    next(err);
  }
}

export async function startVoiceSession(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid sessionId', details: parsed.error.issues });
    }

    const data = await voiceService.startSession(parsed.data.sessionId);
    return res.json({ success: true, session: data });
  } catch (err) {
    next(err);
  }
}

export async function stopVoiceSession(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await voiceService.stopSession();
    return res.json({ success: true, session: data });
  } catch (err) {
    next(err);
  }
}

export async function setWakeWordState(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = wakeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid wake-word payload', details: parsed.error.issues });
    }

    const data = await voiceService.setWakeWord(parsed.data.active);
    return res.json({ success: true, session: data });
  } catch (err) {
    next(err);
  }
}

export async function synthesizeSpeech(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = ttsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid tts payload', details: parsed.error.issues });
    }

    const data = await voiceService.synthesize(parsed.data.text);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getVoiceSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await voiceService.getVoiceSettings();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateVoiceSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = voiceSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid settings payload', details: parsed.error.issues });
    }
    const data = await voiceService.updateVoiceSettings(parsed.data);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listVoices(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await voiceService.listVoices();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getVoiceCapabilities(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await voiceService.getCapabilities();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
