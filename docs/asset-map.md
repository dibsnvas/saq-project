# Карта ассетов

Источник истины: `saq_assets_ready/` (не править). Рабочие файлы: `public/assets/`.
Синхронизация: `python scripts/sync-assets.py`.
Аудит альфы: `npm run audit:assets`.

Ключи Phaser — в `src/game/assets.ts` (AssetRegistry).

## Переименования / маппинг

| Исходник (пак) | public/assets | Ключ | Использование |
| --- | --- | --- | --- |
| `npc/npc_students_group_standing&talking.png` | `npc/npc_group_assembly.png` | `npc-group-assembly` | Группа ~15 человек у точки сбора |
| `npc/npc_students_group_walk.png` | `npc/npc_group_evacuating.png` | `npc-group-evacuating` | Группа 6–7 человек, поток эвакуации |
| `npc/npc_students_group.png` | `npc/processed/npc_pair_walking.png` (+ копия в `npc/`) | `npc-pair-walking` | Пара на лестнице; фон очищен скриптом |
| `backgrounds/*.png` | `backgrounds/*.jpg` (1280×720, q90) | `bg-*` | Фоны classroom/corridor/stairs/outdoor |
| **hand-authored** (не из ready) | `backgrounds/central_hall_empty.png` (1280×720) | `bg-central-hall` | Decision room; **sync:assets не перезаписывает** |
| **hand-authored** (не из ready) | `backgrounds/vestibule_empty.png` (1280×720) | `bg-vestibule` | Тамбур перед двором; **sync:assets не перезаписывает** |
| `player/player_*.png` | высота 400px (мелкие кадры front из ready пропускаются) | `player-*` | Игрок |
| **корень** `player_idle_front.png` | `player/player_idle_front.png` (as-is, 384×650) | `player-idle-front` | **Единственный** production source для front idle; не брать из `saq_assets_ready` |
| ~~`player_walk_*_{3,4}.png`~~ | удалены из `public` | — | Белый/серый мат; walk-анимация только кадры 1 и 2 |
| `effects/smoke_*`, haze, alert | без изменений | `fx-*` | Дым / тревога |
| `objects/*` | без изменений | `obj-*` | Рюкзак, знаки, … |
| **Downloads** `IMG_4720.MP4` (h264, 9.5 c) | `public/videos/fire-school-intro.mp4` | — (DOM `<video>`) | Интро (kk и фолбэк): урок → сигнал тревоги |
| та же картинка + русская дорожка | `public/videos/fire-school-intro.ru.mp4` | — (DOM `<video>`) | Интро для локали `ru`; выбор файла — `src/game/introVideo.ts` |
| **Downloads** `photo_5395732582240032946_y.jpg` | `public/assets/backgrounds/classroom_students_poster.jpg` | — (DOM `<img>`) | Poster видео, fallback и переходный кадр видео→игра |

## Белые фоны

Если у PNG полупрозрачный серо-белый мат (как у `npc_students_group.png`),
скрипт кладёт очищенную версию в `public/assets/npc/processed/`.
Исходник в `saq_assets_ready` не трогается.

`npm run audit:assets` падает, если у npc/player/objects углы непрозрачно почти белые.

## Не использовано (осознанно)

- `*_sheet_source.png`
- лишние alert_frame / spark / warning_icon / haze variants
- часть objects (двери уже нарисованы в фонах)
- `references/ui_reference.png`

## Фоны квеста «Землетрясение»

`public/assets/quest/*.jpg` — 1280×720, сгенерированы моделью `soul_location`
(Higgsfield) в стиле существующих фонов: apartment, elevator, mall, street,
car, night, aftershock, help, evacuation. Комната «Школа/офис» использует
`assets/backgrounds/classroom_start.jpg` из основного пака.

Замена фона: положить файл с тем же именем — путь указан в
`src/content/earthquake/quest.json` (`background`), координаты точек выбора
(`hotspot`) там же, в процентах кадра.

### Кадры хронологии

- `public/assets/quest/outcome/<комната>-<вариант>.jpg` — что произошло после
  выбора (20 кадров: по одному на каждый вариант каждой комнаты);
- `public/assets/quest/bridge/to-<комната>.jpg` — переход в следующее место
  (9 кадров);
- `public/audio/quest/dispatcher.<locale>.wav` — реплика диспетчера лифта.

Сгенерировано `nano_banana_2` (кадры, по референсу фона комнаты) и `seed_audio`
(реплика). Пути прописаны в `quest.json`: `outcomes[<вариант>].image`,
`bridge.image`, `outcomes[...].voice` (без `.<locale>.wav` — локаль
подставляется в рантайме).

### Видеоклипы хронологии

`public/assets/quest/video/*.mp4` — 29 клипов по 5 секунд, 720p, H.264+AAC,
пережаты с `-movflags +faststart`. По три на комнату: `<комната>-intro.mp4`,
`<комната>-<верный вариант>.mp4`, `<комната>-exit.mp4`.

Сгенерированы `seedance_2_5` (Higgsfield) от первого лица. Вступления
собираются с `end_image` = фон комнаты, клипы действия — с `start_image` фона
и `end_image` кадра последствия, выходы — со `start_image` кадра последствия.
Поэтому клип всегда стыкуется с картинкой, которую видит игрок.

**Подключены клипы пяти комнат:** «Квартира» (intro + cover) и четыре клипа
действия — `elevator-all_floors`, `school-under_desk`, `mall-column_cover`,
`street-open_space`. Они пересняты 2026-09-03 под текущий светлый арт моделью
`seedance_2_0_mini` (5 c, 720p, `start_image` = фон комнаты, `end_image` = кадр
последствия) и приведены к общему формату: 1280×720, 24 fps, H.264+AAC,
`-movflags +faststart`.

Прежние версии этих четырёх клипов лежат в `video-legacy/` (вне `public`, не
раздаются). Они сняты в старой «суровой» обстановке и с текущими фонами не
стыкуются.

**Остальные пять комнат** — `car`, `night`, `aftershock`, `help`, `evacuation` —
по-прежнему без видео: их файлы `*-intro.mp4`, `*-exit.mp4` и клипы действия в
`public/assets/quest/video/` относятся к старому арту и в `quest.json` не
подключены. Чтобы включить любую из них, надо сначала переснять клип по той же
схеме, а затем дописать поле `video` в нужный вариант `outcomes`.

### Современный стиль локаций

Все фоны и кадры последствий пересняты в светлом современном виде под
аудиторию 12+: новостройка, школа с интерактивной доской и цветными стульями,
торговый центр со стеклянными витринами, детская комната с ночником.
Фоны — `soul_location`, кадры последствий — `nano_banana_2` по референсу
соответствующего фона. Комната «Школа или офис» больше не использует
`assets/backgrounds/classroom_start.jpg` — у неё свой файл
`assets/quest/school.jpg`, игровой ассет пожара не тронут.
