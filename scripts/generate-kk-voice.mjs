/**
 * Казахская озвучка через FreedomSpeech (https://freedomspeech.kz/docs/) —
 * голоса носителей, без акцента:
 *   - 10 сцен квеста «Землетрясение» (ситуация → событие → вопрос),
 *   - реплика диспетчера лифта,
 *   - короткие реплики учителя в «Пожаре» (voices/kk/*.mp3).
 *
 * Ключ — FREEDOMSPEECH_API_KEY в .env.local (файл в .gitignore) или в
 * окружении. Запуск:
 *
 *   node scripts/generate-kk-voice.mjs                 # всё, что ещё не записано
 *   node scripts/generate-kk-voice.mjs --force         # переписать всё
 *   node scripts/generate-kk-voice.mjs --only=apartment,teacher_stop
 *   node scripts/generate-kk-voice.mjs --audition=guldana_audiobook_kz,gaukhar_kz
 *       # одна сцена разными голосами → папка во временном каталоге
 *   node scripts/generate-kk-voice.mjs --narrator=<id> --dispatcher=<id>
 *
 * Формат результата — как у русских дорожек: обрезка тишины по краям,
 * громкость −18 LUFS, MP3 96 кбит/с, 44.1 кГц, моно.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://freedomspeech.kz/v1/audio/speech";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

/** Голос сцен и учителя — женский, как Elena в русской версии. */
const NARRATOR = args.narrator || "guldana_audiobook_kz";
/** Диспетчер лифта — другой персонаж, мужской голос. */
const DISPATCHER = args.dispatcher || "kairat_kz";

function readKey() {
  if (process.env.FREEDOMSPEECH_API_KEY)
    return process.env.FREEDOMSPEECH_API_KEY;
  const env = join(root, ".env.local");
  if (existsSync(env)) {
    for (const line of readFileSync(env, "utf8").split("\n")) {
      const m = line.match(/^\s*FREEDOMSPEECH_API_KEY\s*=\s*"?([^"\s]+)"?/);
      if (m) return m[1];
    }
  }
  return null;
}

const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const quest = readJson("src/content/earthquake/quest.json");
const kk = readJson("src/messages/kk.json");

/** Все реплики: id, файл, голос, текст (<pause> — пауза FreedomSpeech). */
function allLines() {
  const lines = quest.rooms
    .filter((room) => room.voice)
    .map((room) => {
      const t = kk.quest.room[room.id];
      return {
        id: room.id,
        out: `public${room.voice}.kk.mp3`,
        voice: NARRATOR,
        text: `${t.situation} <pause> ${t.event} <pause> ${t.question}`,
      };
    });

  const dispatcher = quest.rooms
    .flatMap((room) => Object.values(room.outcomes ?? {}))
    .find((o) => o.voice?.endsWith("/dispatcher"));
  if (dispatcher) {
    lines.push({
      id: "dispatcher",
      out: `public${dispatcher.voice}.kk.mp3`,
      voice: DISPATCHER,
      text: "Диспетчер тыңдап тұр. Шақыртуды қабылдадым. Сабыр сақтаңыз, көмек жолда.",
    });
  }

  const teacher = [
    ["sabyr_saqtandar", "Сабыр сақтаңдар!"],
    ["asykpandar", "Асықпаңдар!"],
    ["mugalimnin_artynan", "Мұғалімнің артынан жүріңдер!"],
    ["teacher_redirect", "Бәрі қосалқы шығуға! Сабырмен жүріңдер!"],
    ["teacher_stop", "Тоқтаңдар! Ол жаққа болмайды!"],
  ];
  for (const [id, text] of teacher) {
    lines.push({
      id,
      out: `public/audio/voices/kk/${id}.mp3`,
      voice: NARRATOR,
      text,
    });
  }
  return lines;
}

async function synthesize(key, text, voice) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ input: text, voice, language: "kk" }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text().catch(() => "");
    if (res.status === 401)
      throw new Error("ключ не принят (401) — проверьте FREEDOMSPEECH_API_KEY");
    if (res.status === 404) throw new Error(`голос не найден: ${voice}`);
    if (res.status < 500 || attempt === 4)
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw new Error("unreachable");
}

/** WAV → обрезка тишины → −18 LUFS → MP3, как у русских дорожек. */
function toMp3(wav, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "kk-voice-"));
  const src = join(dir, "in.wav");
  writeFileSync(src, wav);
  const trim =
    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05," +
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse," +
    "loudnorm=I=-18:TP=-1.5:LRA=11";
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-i",
    src,
    "-af",
    trim,
    "-ar",
    "44100",
    "-ac",
    "1",
    "-b:a",
    "96k",
    outPath,
  ]);
  rmSync(dir, { recursive: true, force: true });
  const dur = execFileSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    outPath,
  ])
    .toString()
    .trim();
  return Number(dur);
}

const key = readKey();
if (!key) {
  console.error(
    "Нет ключа FreedomSpeech. Добавьте в .env.local строку\n" +
      "  FREEDOMSPEECH_API_KEY=ваш_ключ\n" +
      "Ключ выдают через форму на https://freedomspeech.kz",
  );
  process.exit(1);
}

if (args.audition) {
  // Одна сцена разными голосами — выбрать диктора на слух.
  const [first] = allLines();
  const dir = mkdtempSync(join(tmpdir(), "kk-audition-"));
  for (const voice of String(args.audition).split(",")) {
    const wav = await synthesize(key, first.text, voice);
    const dur = toMp3(wav, join(dir, `${voice}.mp3`));
    console.log(`✓ ${voice}: ${dur.toFixed(1)} c`);
  }
  console.log(`\nОбразцы: ${dir}`);
  process.exit(0);
}

const only = args.only ? new Set(String(args.only).split(",")) : null;
let failed = 0;
for (const line of allLines()) {
  if (only && !only.has(line.id)) continue;
  const out = join(root, line.out);
  if (existsSync(out) && !args.force && !only) {
    console.log(`· ${line.id}: уже есть, пропуск (--force чтобы переписать)`);
    continue;
  }
  try {
    const wav = await synthesize(key, line.text, line.voice);
    const dur = toMp3(wav, out);
    console.log(
      `✓ ${line.id} (${line.voice}): ${dur.toFixed(1)} c → ${line.out}`,
    );
  } catch (e) {
    failed += 1;
    console.error(`✗ ${line.id}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
