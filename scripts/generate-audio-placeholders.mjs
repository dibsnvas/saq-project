/**
 * Генерирует placeholder-звуки для location-based audio системы.
 * Всё синтезируется кодом (шум/синусы) — никаких скачанных файлов и
 * проблем с лицензиями. Итог кладётся в public/audio/** как 16-bit WAV.
 *
 * Запуск: node scripts/generate-audio-placeholders.mjs
 * Замена на финальные ассеты — см. docs/audio-map.md.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "audio");
const SR = 22050;

// ------------------------------------------------------------ утилиты

/** Детерминированный PRNG (mulberry32) — одинаковые файлы на каждом запуске. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * SR));
}

/** Однополюсный lowpass. alpha ∈ (0,1]: меньше — глуше. */
function lowpass(samples, alpha) {
  let y = 0;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i] - y);
    samples[i] = y;
  }
  return samples;
}

/** Кроссфейд хвоста в начало — бесшовный луп для шумовых фактур. */
function makeLoopable(samples, fadeSeconds = 0.12) {
  const n = Math.min(Math.round(fadeSeconds * SR), samples.length >> 2);
  const out = new Float32Array(samples.length - n);
  for (let i = 0; i < out.length; i++) out[i] = samples[i];
  for (let i = 0; i < n; i++) {
    const w = i / n;
    out[i] = samples[samples.length - n + i] * (1 - w) + samples[i] * w;
  }
  return out;
}

/** Короткий шумовой всплеск (шаг, шорох, кашель) в buf по позиции. */
function noiseBurst(buf, rand, atSec, durSec, amp, lpAlpha = 0.25) {
  const start = Math.round(atSec * SR);
  const len = Math.round(durSec * SR);
  const burst = new Float32Array(len);
  for (let i = 0; i < len; i++) burst[i] = (rand() * 2 - 1) * amp;
  lowpass(burst, lpAlpha);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const env = Math.exp((-4.5 * i) / len);
    buf[start + i] += burst[i] * env;
  }
}

/** Синусовый тон с экспоненциальной атакой/затуханием. */
function tone(buf, atSec, durSec, freq, amp, { attack = 0.01, harmonics = [] } = {}) {
  const start = Math.round(atSec * SR);
  const len = Math.round(durSec * SR);
  const attackN = Math.max(1, Math.round(attack * SR));
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const env =
      (i < attackN ? i / attackN : 1) * Math.exp((-3 * i) / len);
    let v = Math.sin(2 * Math.PI * freq * t);
    for (const [mult, hAmp] of harmonics) {
      v += hAmp * Math.sin(2 * Math.PI * freq * mult * t);
    }
    buf[start + i] += v * amp * env;
  }
}

function normalizeTo(samples, peak) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  if (max === 0) return samples;
  const k = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= k;
  return samples;
}

function writeWav(relPath, samples) {
  const filePath = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples.length * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, data);
  console.log(`✓ ${relPath} (${(data.length / 1024).toFixed(0)} KB)`);
}

// ------------------------------------------------------------ фактуры

/** Тихий класс: мягкий шумовой фон + редкие шорохи бумаги/стульев. */
function classroomAmbience() {
  const rand = rng(101);
  const buf = buffer(6);
  for (let i = 0; i < buf.length; i++) {
    const lfo = 0.75 + 0.25 * Math.sin((2 * Math.PI * i) / (SR * 3));
    buf[i] = (rand() * 2 - 1) * 0.22 * lfo;
  }
  lowpass(buf, 0.06);
  for (let k = 0; k < 7; k++) {
    noiseBurst(buf, rand, 0.4 + rand() * 5, 0.12 + rand() * 0.1, 0.12, 0.5);
  }
  return normalizeTo(makeLoopable(buf), 0.5);
}

/** Коридорная толпа: средний шум + мягкие шаги + «бормотание». */
function corridorCrowd() {
  const rand = rng(202);
  const buf = buffer(6);
  for (let i = 0; i < buf.length; i++) {
    const murmur = 0.6 + 0.4 * Math.sin((2 * Math.PI * 3.7 * i) / SR + Math.sin(i / 9000));
    buf[i] = (rand() * 2 - 1) * 0.2 * murmur;
  }
  lowpass(buf, 0.12);
  for (let k = 0; k < 16; k++) {
    noiseBurst(buf, rand, rand() * 5.6, 0.06 + rand() * 0.05, 0.2, 0.3);
  }
  return normalizeTo(makeLoopable(buf), 0.55);
}

/** Низкое напряжение зоны дыма: тихий тёплый дрон, без хоррора. */
function smokeTension() {
  const buf = buffer(8);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * t * 0.125);
    buf[i] =
      (0.6 * Math.sin(2 * Math.PI * 55 * t) +
        0.35 * Math.sin(2 * Math.PI * 82.5 * t)) *
      lfo *
      0.3;
  }
  return normalizeTo(buf, 0.42);
}

/** Боковой коридор: разрежённый тихий саспенс-пад. */
function sideSuspense() {
  const buf = buffer(8);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const lfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * t * 0.125 + 1.2);
    buf[i] =
      (0.5 * Math.sin(2 * Math.PI * 110 * t) +
        0.25 * Math.sin(2 * Math.PI * 165 * t)) *
      lfo *
      0.22;
  }
  return normalizeTo(buf, 0.34);
}

/** Двор: ветер (шум с порывами) + редкие птичьи трели. */
function outdoorAmbience() {
  const rand = rng(303);
  const buf = buffer(8);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    const gust =
      0.5 + 0.3 * Math.sin(2 * Math.PI * t * 0.125) + 0.2 * Math.sin(2 * Math.PI * t * 0.31);
    buf[i] = (rand() * 2 - 1) * 0.3 * gust;
  }
  lowpass(buf, 0.05);
  // Птицы: короткие свипы-«трели»
  for (let k = 0; k < 5; k++) {
    const at = 0.6 + rand() * 6.6;
    const base = 2200 + rand() * 900;
    const start = Math.round(at * SR);
    const len = Math.round(0.14 * SR);
    for (let i = 0; i < len && start + i < buf.length; i++) {
      const t = i / SR;
      const chirp = Math.sin(2 * Math.PI * (base + 700 * Math.sin(t * 55)) * t);
      buf[start + i] += chirp * 0.08 * Math.exp((-6 * i) / len);
    }
  }
  return normalizeTo(makeLoopable(buf), 0.5);
}

/** Тихий гул вентиляции. */
function ventHum() {
  const buf = buffer(2);
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] =
      0.6 * Math.sin(2 * Math.PI * 120 * t) + 0.25 * Math.sin(2 * Math.PI * 240 * t);
  }
  return normalizeTo(buf, 0.2);
}

/** Школьная тревога: двухтоновый сигнал с паузой, умеренная резкость. */
function alarmLoop() {
  const buf = buffer(4);
  const beeps = [
    [0.0, 740],
    [0.45, 588],
    [0.9, 740],
    [1.35, 588],
    [1.8, 740],
    [2.25, 588],
    [2.7, 740],
    [3.15, 588],
    // 3.6–4.0 — пауза, чтобы сигнал «дышал» и меньше утомлял
  ];
  for (const [at, freq] of beeps) {
    tone(buf, at, 0.42, freq, 0.3, { attack: 0.02, harmonics: [[3, 0.12]] });
  }
  return normalizeTo(buf, 0.6);
}

/** Шаги игрока: 4 шага на 2 секунды. */
function footstepsWalk() {
  const rand = rng(404);
  const buf = buffer(2);
  for (let k = 0; k < 4; k++) {
    noiseBurst(buf, rand, k * 0.5 + 0.05, 0.09, 0.45, k % 2 ? 0.2 : 0.26);
  }
  return normalizeTo(buf, 0.5);
}

/** Шаги на лестнице: шаг + эхо-повтор. */
function footstepsStairs() {
  const rand = rng(505);
  const buf = buffer(2);
  for (let k = 0; k < 4; k++) {
    const at = k * 0.5 + 0.05;
    noiseBurst(buf, rand, at, 0.09, 0.42, 0.22);
    noiseBurst(buf, rand, at + 0.09, 0.12, 0.16, 0.14); // эхо
  }
  return normalizeTo(buf, 0.5);
}

/** Много мягких шагов — движение группы. */
function crowdShuffle() {
  const rand = rng(606);
  const buf = buffer(4);
  for (let k = 0; k < 26; k++) {
    noiseBurst(buf, rand, rand() * 3.7, 0.05 + rand() * 0.05, 0.18, 0.25);
  }
  lowpass(buf, 0.3);
  return normalizeTo(makeLoopable(buf), 0.42);
}

/** Открывание двери: щелчок + «воздушный» свип. */
function doorOpen() {
  const rand = rng(707);
  const buf = buffer(0.9);
  noiseBurst(buf, rand, 0.02, 0.05, 0.5, 0.6); // щелчок ручки
  const start = Math.round(0.12 * SR);
  const len = Math.round(0.6 * SR);
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const w = i / len;
    buf[start + i] += (rand() * 2 - 1) * 0.3 * Math.sin(Math.PI * w);
  }
  lowpass(buf, 0.15);
  return normalizeTo(buf, 0.5);
}

/** UI-клик. */
function uiClick() {
  const buf = buffer(0.12);
  tone(buf, 0, 0.1, 880, 0.5, { attack: 0.002 });
  return normalizeTo(buf, 0.5);
}

/** Мягкое столкновение с толпой — глухой толчок без «боли». */
function crowdBump() {
  const rand = rng(808);
  const buf = buffer(0.4);
  tone(buf, 0, 0.3, 110, 0.6, { attack: 0.004 });
  noiseBurst(buf, rand, 0.01, 0.08, 0.2, 0.2);
  return normalizeTo(buf, 0.5);
}

/** Тихий кашель вдалеке: два мягких шумовых толчка. */
function coughSoft() {
  const rand = rng(909);
  const buf = buffer(0.55);
  noiseBurst(buf, rand, 0.02, 0.12, 0.4, 0.18);
  noiseBurst(buf, rand, 0.24, 0.1, 0.3, 0.18);
  return normalizeTo(buf, 0.42);
}

/**
 * Приглушённый «голос учителя» вдалеке: слоговая амплитудная модуляция
 * низкого тона + сильный lowpass. Заменяется реальными записями RU/KK.
 */
function teacherMuffled() {
  const rand = rng(111);
  const buf = buffer(1.6);
  const syllables = [0.05, 0.35, 0.7, 1.05];
  for (const at of syllables) {
    const start = Math.round(at * SR);
    const len = Math.round(0.24 * SR);
    const f = 165 + rand() * 40;
    for (let i = 0; i < len && start + i < buf.length; i++) {
      const t = i / SR;
      const env = Math.sin((Math.PI * i) / len);
      buf[start + i] +=
        (Math.sin(2 * Math.PI * f * t) +
          0.4 * Math.sin(2 * Math.PI * f * 2.7 * t) +
          0.2 * (rand() * 2 - 1)) *
        env *
        0.3;
    }
  }
  lowpass(buf, 0.08);
  return normalizeTo(buf, 0.5);
}

/** Успех: короткое тёплое арпеджио, не аркадные фанфары. */
function successChime() {
  const buf = buffer(1.3);
  tone(buf, 0.0, 0.8, 523.25, 0.3, { attack: 0.01, harmonics: [[2, 0.15]] });
  tone(buf, 0.16, 0.8, 659.25, 0.28, { attack: 0.01, harmonics: [[2, 0.15]] });
  tone(buf, 0.32, 0.9, 783.99, 0.3, { attack: 0.01, harmonics: [[2, 0.15]] });
  return normalizeTo(buf, 0.55);
}

/** Спокойная завершающая музыка: мягкие пады C → F, ~4.5 c. */
function successMusic() {
  const buf = buffer(4.5);
  const pad = (at, dur, freqs, amp) => {
    for (const f of freqs) {
      tone(buf, at, dur, f, amp, { attack: 0.5, harmonics: [[2, 0.08]] });
    }
  };
  pad(0.0, 2.4, [261.63, 329.63, 392.0], 0.16); // C-мажор
  pad(2.1, 2.3, [349.23, 440.0, 523.25], 0.15); // F-мажор
  tone(buf, 0.6, 1.0, 783.99, 0.1, { attack: 0.05 });
  tone(buf, 2.7, 1.4, 880.0, 0.1, { attack: 0.05 });
  return normalizeTo(buf, 0.5);
}

/** Нейтральный сигнал завершения по таймауту: два спокойных тона вниз. */
function lowCompletion() {
  const buf = buffer(1.5);
  tone(buf, 0.0, 0.7, 392.0, 0.3, { attack: 0.03 });
  tone(buf, 0.55, 0.9, 329.63, 0.3, { attack: 0.03 });
  return normalizeTo(buf, 0.45);
}

// ------------------------------------------------------------ манифест

const FILES = {
  "ambience/classroom_ambience.wav": classroomAmbience,
  "ambience/corridor_crowd.wav": corridorCrowd,
  "ambience/smoke_tension.wav": smokeTension,
  "ambience/side_suspense.wav": sideSuspense,
  "ambience/outdoor_ambience.wav": outdoorAmbience,
  "ambience/vent_hum.wav": ventHum,
  "ambience/crowd_shuffle.wav": crowdShuffle,
  "alarms/alarm_loop.wav": alarmLoop,
  "footsteps/footsteps_walk.wav": footstepsWalk,
  "footsteps/stairs_footsteps.wav": footstepsStairs,
  "ui/door_open.wav": doorOpen,
  "ui/ui_click.wav": uiClick,
  "ui/crowd_bump.wav": crowdBump,
  "ui/low_completion.wav": lowCompletion,
  "voices/cough_soft.wav": coughSoft,
  "voices/teacher_muffled.wav": teacherMuffled,
  "music/success_chime.wav": successChime,
  "music/success_music.wav": successMusic,
};

for (const [rel, make] of Object.entries(FILES)) {
  writeWav(rel, make());
}

// Каталоги под будущие локализованные реплики (см. docs/audio-map.md).
for (const dir of ["voices/kk", "voices/ru"]) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, ".gitkeep"), "");
}

console.log("\nГотово. Замена placeholder-звуков — docs/audio-map.md");
