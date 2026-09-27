#!/usr/bin/env python3
"""生成 Daily Recall 的位图图标与 favicon。

用途: 由几何定义生成 PWA 图标（192/512）、apple-touch-icon 与 favicon.ico，
      图案与 public/icon.svg 保持一致（同心圆环 = 一层层向回追溯的记忆）。
      浏览器标签页、手机主屏、PWA 安装都需要位图，只有 SVG 是不够的。
用法: python3 scripts/make-icons.py
入参: 无
出参: public/icon-192.png、public/icon-512.png、public/apple-touch-icon.png、
      src/app/favicon.ico（App Router 会自动把它当作站点图标）
依赖: Pillow（pip install Pillow）
关键词: 图标, icon, favicon, PWA, apple-touch-icon, 位图, 生成, Pillow, 手机主屏, 应用图标
更新: 2026-09-28
"""

from pathlib import Path

from PIL import Image, ImageDraw

BG = (51, 102, 242, 255)
WHITE = (255, 255, 255, 255)
# 用实色而不是半透明白：PIL 画半透明描边是替换像素、不做 alpha 混合，
# 不同渲染器下会出现色差。这两个值就是白叠在蓝底上混合出来的颜色。
RING_OUTER = (100, 139, 245, 255)
RING_INNER = (163, 186, 249, 255)
ROOT = Path(__file__).resolve().parent.parent


def render(size: int, *, simple: bool = False, corners: bool = False) -> Image.Image:
    """画一个图标。

    simple  —— 小尺寸下简化图案（16px 画三圈会糊成一团）
    corners —— 是否带圆角。apple-touch-icon 必须满幅不透明，由系统自己加圆角。
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 512

    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=int(112 * scale) if corners else 0,
        fill=BG,
    )

    center = size / 2

    def ring(radius: float, color: tuple[int, int, int, int], width: float) -> None:
        r = radius * scale
        draw.ellipse(
            [center - r, center - r, center + r, center + r],
            outline=color,
            width=max(1, int(width * scale)),
        )

    if simple:
        ring(170, RING_OUTER, 40)
        core = 62 * scale
    else:
        ring(152, RING_OUTER, 26)
        ring(100, RING_INNER, 26)
        core = 48 * scale

    draw.ellipse(
        [center - core, center - core, center + core, center + core],
        fill=WHITE,
    )
    return img


def main() -> None:
    public = ROOT / "public"
    public.mkdir(exist_ok=True)

    for size in (192, 512):
        out = public / f"icon-{size}.png"
        render(size).save(out)
        print(f"[icons] {out.relative_to(ROOT)}")

    apple = public / "apple-touch-icon.png"
    render(180).save(apple)
    print(f"[icons] {apple.relative_to(ROOT)}")

    # favicon.ico 存多尺寸，浏览器按需取用
    app_dir = ROOT / "src" / "app"
    app_dir.mkdir(parents=True, exist_ok=True)
    favicon = app_dir / "favicon.ico"
    render(256, simple=True).save(favicon, sizes=[(16, 16), (32, 32), (48, 48)])
    print(f"[icons] {favicon.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
