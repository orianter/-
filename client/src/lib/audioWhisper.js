const WHISPER_SAMPLE_RATE = 16000;
const MAX_WHISPER_SEC = 60;
const MAX_BASE64_CHARS = 2_800_000;

function resampleMono(channelData, fromRate, toRate, maxInputSamples) {
  const inputLen = Math.min(channelData.length, maxInputSamples);
  const outputLen = Math.floor((inputLen * toRate) / fromRate);
  const output = new Float32Array(Math.max(1, outputLen));
  const ratio = fromRate / toRate;
  for (let i = 0; i < outputLen; i += 1) {
    const srcIdx = Math.min(Math.floor(i * ratio), inputLen - 1);
    output[i] = channelData[srcIdx];
  }
  return output;
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function encodeWav(pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(new Uint8Array(pcmBuffer));
  return buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function extractAudioForWhisper(file, durationSec) {
  const maxSec = Math.min(Number(durationSec) || MAX_WHISPER_SEC, MAX_WHISPER_SEC);
  try {
    const buffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    const audioBuffer = await Promise.race([
      ctx.decodeAudioData(buffer.slice(0)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
    ]);
    await ctx.close();

    if (!audioBuffer.numberOfChannels) {
      return { available: false, reason: 'no-audio' };
    }

    const channel = audioBuffer.getChannelData(0);
    const maxInputSamples = Math.floor(audioBuffer.sampleRate * maxSec);
    const resampled = resampleMono(channel, audioBuffer.sampleRate, WHISPER_SAMPLE_RATE, maxInputSamples);
    const pcm = floatTo16BitPCM(resampled);
    const wav = encodeWav(pcm, WHISPER_SAMPLE_RATE);
    const base64 = arrayBufferToBase64(wav);

    if (base64.length > MAX_BASE64_CHARS) {
      return { available: false, reason: 'too-large' };
    }

    return {
      available: true,
      base64,
      mimeType: 'audio/wav',
      durationSec: Math.round((resampled.length / WHISPER_SAMPLE_RATE) * 10) / 10,
      sizeKb: Math.round(wav.byteLength / 1024),
    };
  } catch {
    return { available: false, reason: 'decode-failed' };
  }
}
