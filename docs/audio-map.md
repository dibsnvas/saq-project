# Audio map — location-based audio system

Звуковая система устроена в три слоя (звуки НЕ подключаются напрямую в SchoolScene):

| Модуль | Ответственность |
| --- | --- |
| `src/game/audio/AudioManager.ts` | Единственный AudioContext, категории громкости, кроссфейды лупов, one-shot'ы, mute (localStorage `saq.soundEnabled`), duck на паузе |
| `src/game/audio/AmbientAudioSystem.ts` | Машина звуковых состояний, планировщик редких реплик, финальные последовательности успех/таймаут |
| `src/game/audio/RoomAudioConfig.ts` | Только данные: состояния → слои/громкости/one-shot'ы, реестр путей `AUDIO_FILES` |

## Состояния

`lesson → alarm_start → classroom_evacuation → corridor → central_hall → smoke_danger → side_corridor → stairs → vestibule → outdoor → success | timeout` (+ служебное `paused` — duck без смены слоёв).

Маршрут комнат и звуковые состояния:

- «Corridor near classroom» → `corridor` (лёгкая толпа, без tension);
- «Central hall» (distant/light) → `central_hall` (плотнее толпа + голос учителя);
- «Central hall» medium/blocked или danger-зона → `smoke_danger`;
- «Side corridor» → `side_corridor` (после осознания дыма);
- «Stairs» → `stairs`; «Vestibule» → `vestibule` (тревога↓, двор↑);
- `lesson` в игровом рантайме не используется — «урок до тревоги» целиком живёт в видео-интро.
- Видео-интро озвучено, поэтому у него своя версия на локаль: `ru` берёт
  `fire-school-intro.ru.mp4` (голос учителя + шум класса + сирена с 4.6 c),
  остальные — исходную запись. Выбор файла — `src/game/introVideo.ts`.

## Файлы

Все текущие файлы — **процедурные placeholder'ы** (16-bit WAV), сгенерированные
`node scripts/generate-audio-placeholders.mjs`. Ничего не скачивалось — лицензионно чисто.

Замена на финальный звук: положите файл (mp3/ogg/wav — формат определяется по
содержимому, расширение не важно) и обновите путь в `AUDIO_FILES`
(`src/game/audio/RoomAudioConfig.ts`). Больше нигде пути не хранятся.

| Файл | Где звучит | Placeholder сейчас | Чем заменить |
| --- | --- | --- | --- |
| `ambience/classroom_ambience.wav` | lesson, alarm_start, classroom_evacuation | мягкий шум + шорохи бумаги | реальный classroom ambience (шелест, стулья, приглушённый голос учителя) |
| `ambience/corridor_crowd.wav` | corridor, smoke_danger, stairs | шум с «бормотанием» и шагами | школьный коридор: шаги толпы, тревожные тихие голоса |
| `ambience/smoke_tension.wav` | smoke_danger | тихий низкий дрон 55/82 Гц | low tension ambience (НЕ хоррор-дрон) |
| `ambience/side_suspense.wav` | side_corridor | разрежённый тихий пад | subtle suspense ambience |
| `ambience/outdoor_ambience.wav` | vestibule, outdoor, success | ветер + синтетические птицы | двор школы: ветер, птицы, дальние голоса |
| `ambience/vent_hum.wav` | smoke_danger | гул 120 Гц | subtle ventilation hum |
| `ambience/crowd_shuffle.wav` | alarm_start, classroom_evacuation, stairs, outdoor (one-shot) | наложенные мягкие шаги | движение стульев/группы учеников |
| `alarms/alarm_loop.wav` | все «внутренние» состояния | двухтоновый сигнал с паузой | школьная пожарная сирена (умеренная, не раздражающая); для stairs желателен вариант с эхом, для outdoor — приглушённый «из здания» |
| `footsteps/footsteps_walk.wav` | шаги игрока (movement-слой) | 4 шага/2 c, фильтрованный шум | шаги по линолеуму |
| `footsteps/stairs_footsteps.wav` | шаги игрока на лестнице | шаги + эхо-повтор | шаги по бетонной лестнице с реверберацией |
| `ui/door_open.wav` | переходы между комнатами | щелчок + свип | открывание школьной двери |
| `ui/ui_click.wav` | выбор первого решения | короткий блип | мягкий UI-клик |
| `ui/crowd_bump.wav` | вход в плотную группу (лестница) | глухой мягкий толчок | short collision/slowdown (без «болевого» удара) |
| `ui/low_completion.wav` | timeout | два спокойных тона вниз | нейтральный завершающий сигнал (не победный) |
| `voices/cough_soft.wav` | smoke_danger | мягкий шумовой «кашель» | distant cough (деликатный) |
| `voices/teacher_muffled.wav` | fallback для всех реплик | приглушённая слоговая модуляция | см. локализованные реплики ниже |
| `music/success_chime.wav` | успешное завершение | тёплое арпеджио C-E-G | короткий success chime (не аркадный) |
| `music/success_music.wav` | после chime, ~4.5 c | спокойные пады C→F | calm uplifting completion, 3–5 c, НЕ фанфары |

## Локализованные реплики

Система сначала ищет файл текущей локали, при отсутствии тихо играет
`voices/teacher_muffled.wav`. Достаточно положить файлы — код менять не нужно.

**Русские реплики записаны**: `text2speech_v2`, движок `elevenlabs`, женский
пресет **Elena** (`ca83ca7f-c186-493d-bd69-0d765fa861b2`). Обрезаны по тишине и
нормализованы до −18 LUFS. Первая версия делалась на `seed_audio` и была
забракована по качеству русского произношения — при пересъёмке держаться
ElevenLabs. **Казахских файлов пока нет** — локаль `kk` по-прежнему падает на
`teacher_muffled.wav`.

| Путь (файл) | Реплика |
| --- | --- |
| `voices/kk/sabyr_saqtandar.mp3` (нет) | «Сабыр сақтаңдар!» |
| `voices/kk/asykpandar.mp3` (нет) | «Асықпаңдар!» |
| `voices/kk/mugalimnin_artynan.mp3` (нет) | «Мұғалімнің артынан жүріңдер!» |
| `voices/kk/teacher_redirect.mp3` (нет) | Реплика перенаправления у зоны дыма |
| `voices/ru/sohranyaite_spokoistvie.mp3` (есть) | «Сохраняйте спокойствие!» |
| `voices/ru/ne_toropites.mp3` (есть) | «Не торопитесь!» |
| `voices/ru/idite_za_uchitelem.mp3` (есть) | «Идите за учителем!» |
| `voices/ru/teacher_redirect.mp3` (есть) | Реплика перенаправления у зоны дыма |

Реплики играются редко (случайный интервал 10–26 c), не постоянно.

## Громкость

Итоговая громкость = master × duck(пауза) × категория × слой × movement-фактор (для шагов).
Уровни слоёв заданы в `RoomAudioConfig.ts` в рамках ориентиров ТЗ:
alarm 0.10–0.44 (по удалённости), ambience 0.10–0.35, footsteps 0.28–0.44,
voice 0.30–0.50, success music 0.40–0.42, пауза — duck до 0.06.

## Гарантии поведения

- Звук стартует только после явного клика («Сценарийді бастау» / выбор решения / toggle); если браузер не дал `AudioContext.resume()` — показывается неблокирующий тост, игра полностью проходима без звука.
- Дублей нет по построению: лупы в `AudioManager` ключуются по URL и применяются diff'ом (`applyLoops`), контекст — синглтон через `globalThis`.
- Пауза — duck, а не stop: resume не создаёт второй экземпляр лупа.
- Restart: `AmbientAudioSystem.reset()` обрывает one-shot'ы (включая музыку успеха) и сбрасывает флаг «музыка уже играла».
- Mute (`🔊/🔇` в HUD) сохраняется в localStorage, действует на всё игровое аудио и на звук видео-интро; телеметрия пишет только `sound_enabled` / `sound_disabled`.
