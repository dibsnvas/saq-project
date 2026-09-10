"""
Вырезает сплошной зелёный фон у сгенерированного спрайта персонажа.

Спрайты ТРЦ генерируются на #00FF00 (см. docs/asset-map.md), а прозрачность
делается здесь — локально, без платных сервисов удаления фона:
альфа по «зелёности» пикселя, подавление зелёного ореола по краям,
обрезка по содержимому и уменьшение до нужной высоты.

    python3 scripts/chroma-key.py raw.png out.png [max_height=560]

Спрайт обрезается вплотную к фигуре, поэтому в раскладке figureFill ≈ 0.95–0.97
(у школьных спрайтов с полями было 0.78–0.9).
"""
import sys

import numpy as np
from PIL import Image


def key(src: str, dst: str, max_h: int = 560) -> None:
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # насколько пиксель «зеленее» остальных каналов: >70 — фон, <25 — персонаж
    greenness = g - np.maximum(r, b)
    alpha = np.clip(1.0 - (greenness - 25.0) / 45.0, 0.0, 1.0)
    # despill: у краёв срезаем лишний зелёный до уровня соседних каналов
    g_clean = np.where(greenness > 0, np.minimum(g, np.maximum(r, b)), g)
    out = np.dstack([r, g_clean, b, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out)

    a = np.asarray(img)[..., 3]
    ys, xs = np.where(a > 24)
    img = img.crop((
        max(int(xs.min()) - 4, 0),
        max(int(ys.min()) - 4, 0),
        min(int(xs.max()) + 5, img.width),
        min(int(ys.max()) + 5, img.height),
    ))
    if img.height > max_h:
        img = img.resize((round(img.width * max_h / img.height), max_h), Image.LANCZOS)
    img.save(dst, optimize=True)

    a = np.asarray(img)[..., 3]
    corners = [int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1])]
    print(f"{dst}: {img.width}x{img.height}, альфа в углах {corners}")


if __name__ == "__main__":
    key(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 560)
