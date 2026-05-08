#!/usr/bin/env python3
import os
import math
from PIL import Image, ImageDraw, ImageFont

SRC_PATH = "attached_assets/ChatGPT_Image_8_mai_2026,_15_15_31_1778250254128.png"
src = Image.open(SRC_PATH).convert("RGBA")
W, H = src.size  # 1983, 793
print(f"Source: {W}x{H}")

# Scale output for manageable GIF size
SCALE = 0.50
GW, GH = int(W * SCALE), int(H * SCALE)
src_s = src.resize((GW, GH), Image.LANCZOS)
print(f"Output: {GW}x{GH}")

# ── Easing functions ───────────────────────────────────────────────────────
def ease_out(t, n=3):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** n

def ease_out_back(t):
    t = max(0.0, min(1.0, t))
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * ((t - 1) ** 3) + c1 * ((t - 1) ** 2)

def phase(t, start, end, ease_fn=ease_out):
    return ease_fn(max(0.0, min(1.0, (t - start) / max(0.001, end - start))))

# ── Layout in OUTPUT pixels ────────────────────────────────────────────────
P1_END = int(GW * 0.214)   # Right edge of phone 1
P2_END = int(GW * 0.425)   # Right edge of phone 2

# Logo area (BKApay logo top-right)
LOGO_X1 = int(GW * 0.417)
LOGO_Y1 = int(GH * 0.00)
LOGO_X2 = int(GW * 0.545)
LOGO_Y2 = int(GH * 0.22)

# Headline text area
TEXT_X1 = int(GW * 0.417)
TEXT_Y1 = int(GH * 0.06)
TEXT_X2 = int(GW * 0.935)
TEXT_Y2 = int(GH * 0.44)

# Feature icons (Sécurisé, Rapide, API, Support)
FEAT_X1 = int(GW * 0.417)
FEAT_Y1 = int(GH * 0.44)
FEAT_X2 = int(GW * 0.993)
FEAT_Y2 = int(GH * 0.635)

# Operators label "OPÉRATEURS MOBILES MONEY"
OPS_LBL_X1 = int(GW * 0.417)
OPS_LBL_Y1 = int(GH * 0.635)
OPS_LBL_X2 = int(GW * 0.993)
OPS_LBL_Y2 = int(GH * 0.715)

# Operators grid (2 rows × 7 cols = 14 logos)
OPS_X1 = int(GW * 0.417)
OPS_Y1 = int(GH * 0.715)
OPS_X2 = int(GW * 0.993)
OPS_Y2 = int(GH * 0.930)
OPS_COLS = 7
OPS_ROWS = 2
OPS_W = (OPS_X2 - OPS_X1) // OPS_COLS
OPS_H = (OPS_Y2 - OPS_Y1) // OPS_ROWS

# Footer
FOOT_Y1 = int(GH * 0.930)

# Dark background colour
BG = (4, 8, 26)

# ── Build modified source with replaced headline text ─────────────────────
modified = src_s.copy()
dm = ImageDraw.Draw(modified)

# Sample background color just above headline (to match the gradient)
sample_y = max(0, TEXT_Y1 - 4)
bg_samples = [src_s.getpixel((x, sample_y))[:3]
              for x in range(TEXT_X1 + 20, TEXT_X2 - 20, 25)]
bg_r = sum(s[0] for s in bg_samples) // len(bg_samples)
bg_g = sum(s[1] for s in bg_samples) // len(bg_samples)
bg_b = sum(s[2] for s in bg_samples) // len(bg_samples)
text_bg = (bg_r, bg_g, bg_b)

# Paint over the original headline
dm.rectangle([TEXT_X1, TEXT_Y1, TEXT_X2, TEXT_Y2], fill=text_bg)

# Also sample a slightly lower row for a gradient effect
sample_y2 = min(GH - 1, TEXT_Y2 + 4)
bg_samples2 = [src_s.getpixel((x, sample_y2))[:3]
               for x in range(TEXT_X1 + 20, TEXT_X2 - 20, 25)]
bg_r2 = sum(s[0] for s in bg_samples2) // len(bg_samples2)
bg_g2 = sum(s[1] for s in bg_samples2) // len(bg_samples2)
bg_b2 = sum(s[2] for s in bg_samples2) // len(bg_samples2)

# Draw a subtle vertical gradient over the text area
text_h = TEXT_Y2 - TEXT_Y1
for row in range(text_h):
    frac = row / max(1, text_h - 1)
    r = int(bg_r + (bg_r2 - bg_r) * frac)
    g = int(bg_g + (bg_g2 - bg_g) * frac)
    b = int(bg_b + (bg_b2 - bg_b) * frac)
    dm.line([(TEXT_X1, TEXT_Y1 + row), (TEXT_X2, TEXT_Y1 + row)], fill=(r, g, b))

# ── Font setup ────────────────────────────────────────────────────────────
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
try:
    font_xl = ImageFont.truetype(FONT_BOLD, int(GH * 0.092))
    font_lg = ImageFont.truetype(FONT_BOLD, int(GH * 0.075))
except Exception as e:
    print(f"Font error: {e}, using default")
    font_xl = ImageFont.load_default()
    font_lg = font_xl

WHITE = (255, 255, 255, 255)
BLUE  = (30, 200, 255, 255)

# Draw new headline text
lines = [
    [("CONNECTEZ DES PAIEMENTS", WHITE)],
    [("DANS PLUSIEURS PAYS", WHITE)],
    [("AVEC ", WHITE), ("BKAPAY", BLUE)],
]

ty = TEXT_Y1 + int(GH * 0.012)
for line in lines:
    x = TEXT_X1 + int(GW * 0.006)
    max_h = 0
    for text, color in line:
        dm.text((x, ty), text, font=font_xl, fill=color)
        bbox = dm.textbbox((x, ty), text, font=font_xl)
        x = bbox[2]
        max_h = max(max_h, bbox[3] - bbox[1])
    ty += max_h + int(GH * 0.008)

print("Text replaced. Generating frames...")

# ── Generate frames ────────────────────────────────────────────────────────
N_FRAMES = 75
frames = []
durations = []

for fi in range(N_FRAMES):
    t = fi / (N_FRAMES - 1)

    frame = modified.copy()
    d = ImageDraw.Draw(frame)

    # ═══ Phone 1: wipe-reveal left→right (t 0.00→0.22) ═══════════════════
    p1_t = phase(t, 0.00, 0.22)
    p1_shown = int(P1_END * p1_t)
    if p1_shown < P1_END:
        d.rectangle([p1_shown, 0, P1_END, GH], fill=BG)

    # ═══ Phone 2: wipe-reveal left→right (t 0.16→0.36) ═══════════════════
    p2_t = phase(t, 0.16, 0.36)
    p2_shown = P1_END + int((P2_END - P1_END) * p2_t)
    if p2_shown < P2_END:
        d.rectangle([p2_shown, 0, P2_END, GH], fill=BG)

    # ═══ BKApay logo: fade in (t 0.33→0.50) ══════════════════════════════
    logo_t = phase(t, 0.33, 0.50)
    logo_alpha = int(255 * (1 - logo_t))
    if logo_alpha > 0:
        ov = Image.new("RGBA", (LOGO_X2 - LOGO_X1, LOGO_Y2 - LOGO_Y1),
                       BG + (logo_alpha,))
        frame.paste(ov, (LOGO_X1, LOGO_Y1), ov)

    # ═══ Headline text: fade in (t 0.38→0.55) ═════════════════════════════
    txt_t = phase(t, 0.38, 0.55)
    txt_alpha = int(255 * (1 - txt_t))
    if txt_alpha > 0:
        ov = Image.new("RGBA", (TEXT_X2 - TEXT_X1, TEXT_Y2 - TEXT_Y1),
                       BG + (txt_alpha,))
        frame.paste(ov, (TEXT_X1, TEXT_Y1), ov)

    # ═══ Feature icons: slide up + fade (t 0.52→0.65) ═════════════════════
    feat_t = phase(t, 0.52, 0.65)
    feat_alpha = int(255 * (1 - feat_t))
    if feat_alpha > 0:
        ov = Image.new("RGBA", (FEAT_X2 - FEAT_X1, FEAT_Y2 - FEAT_Y1),
                       BG + (feat_alpha,))
        frame.paste(ov, (FEAT_X1, FEAT_Y1), ov)

    # ═══ Operators label: fade in (t 0.63→0.72) ═══════════════════════════
    lbl_t = phase(t, 0.63, 0.72)
    lbl_alpha = int(255 * (1 - lbl_t))
    if lbl_alpha > 0:
        ov = Image.new("RGBA", (OPS_LBL_X2 - OPS_LBL_X1,
                                OPS_LBL_Y2 - OPS_LBL_Y1),
                       BG + (lbl_alpha,))
        frame.paste(ov, (OPS_LBL_X1, OPS_LBL_Y1), ov)

    # ═══ Operators: pop in one by one (t 0.70→0.95) ════════════════════════
    N_OPS = OPS_COLS * OPS_ROWS  # 14
    ops_raw = max(0.0, min(1.0, (t - 0.70) / 0.25))
    n_visible = int(N_OPS * ops_raw)

    for oi in range(N_OPS):
        if oi >= n_visible:
            row = oi // OPS_COLS
            col = oi % OPS_COLS
            rx1 = OPS_X1 + col * OPS_W
            ry1 = OPS_Y1 + row * OPS_H
            d.rectangle([rx1, ry1, rx1 + OPS_W - 1, ry1 + OPS_H - 1], fill=BG)

    # ═══ Footer: fade in (t 0.93→1.00) ════════════════════════════════════
    foot_t = phase(t, 0.93, 1.00)
    foot_alpha = int(255 * (1 - foot_t))
    if foot_alpha > 0:
        ov = Image.new("RGBA", (GW, GH - FOOT_Y1), BG + (foot_alpha,))
        frame.paste(ov, (0, FOOT_Y1), ov)

    frames.append(frame.convert("RGB"))
    durations.append(55)

# Pause momentarily after phone 1 done (~frame 17) and phone 2 done (~frame 27)
if len(frames) > 17:
    durations[17] = 220
if len(frames) > 28:
    durations[28] = 180

# Hold final frame
durations[-1] = 3500

# ── Save GIF ───────────────────────────────────────────────────────────────
out_path = "bkapay_animation.gif"
print("Saving GIF...")
frames[0].save(
    out_path,
    save_all=True,
    append_images=frames[1:],
    loop=0,
    duration=durations,
    optimize=False,
)
kb = os.path.getsize(out_path) // 1024
print(f"Saved: {out_path}  |  {GW}×{GH}  |  {N_FRAMES} frames  |  {kb} KB")
