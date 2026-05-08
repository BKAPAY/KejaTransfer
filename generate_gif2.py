#!/usr/bin/env python3
"""
BKApay – animation GIF professionnelle
Téléphone 1 entre depuis la gauche → Téléphone 2 entre depuis la gauche
→ Logo + texte s'écrit mot par mot → Features → Opérateurs un par un
"""
import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "attached_assets/ChatGPT_Image_8_mai_2026,_15_15_31_1778250254128.png"
src = Image.open(SRC).convert("RGBA")
W, H = src.size
print(f"Source: {W}×{H}")

# ── Résolution de sortie ───────────────────────────────────────────────────
SCALE = 0.52
GW, GH = int(W * SCALE), int(H * SCALE)
src_s = src.resize((GW, GH), Image.LANCZOS)
print(f"Sortie:  {GW}×{GH}")

# ── Frontières des zones (en pixels de sortie) ────────────────────────────
P1_END = int(GW * 0.214)          # bord droit téléphone 1
P2_END = int(GW * 0.426)          # bord droit téléphone 2
RP_X   = P2_END                   # panneau droit commence ici
RP_W   = GW - RP_X

# Extraction des "blocs" de l'image source
phone1 = src_s.crop((0,      0, P1_END, GH))   # bloc tel 1
phone2 = src_s.crop((P1_END, 0, P2_END, GH))   # bloc tel 2
right  = src_s.crop((RP_X,   0, GW,     GH))   # tout le panneau droit

BG = (4, 8, 26)     # bleu nuit (couleur de fond)

# ── Coordonnées DANS le panneau droit (relatives à RP_X) ─────────────────
# Logo BKApay
LGX1 = int(RP_W * 0.015); LGY1 = int(GH * 0.005)
LGX2 = int(RP_W * 0.290); LGY2 = int(GH * 0.225)

# Zone titre
TXA = int(RP_W * 0.010); TYA = int(GH * 0.065)
TXB = int(RP_W * 0.990); TYB = int(GH * 0.445)

# Features (4 icônes)
FX1 = int(RP_W * 0.010); FY1 = int(GH * 0.445)
FX2 = int(RP_W * 0.990); FY2 = int(GH * 0.640)
N_FEAT = 4
FEAT_W = (FX2 - FX1) // N_FEAT

# Label opérateurs
OLX1 = int(RP_W * 0.010); OLY1 = int(GH * 0.640)
OLX2 = int(RP_W * 0.990); OLY2 = int(GH * 0.725)

# Grille opérateurs (2 lignes × 7 colonnes)
OGX1 = int(RP_W * 0.010); OGY1 = int(GH * 0.725)
OGX2 = int(RP_W * 0.990); OGY2 = int(GH * 0.932)
OCOLS, OROWS = 7, 2
OC_W = (OGX2 - OGX1) // OCOLS
OC_H = (OGY2 - OGY1) // OROWS

# Footer
FTY1 = int(GH * 0.932)

# ── Construction du panneau droit modifié (texte remplacé) ────────────────
rp_mod = right.copy()
d0 = ImageDraw.Draw(rp_mod)

# Couleur de fond de la zone titre (on sample au-dessus)
sample_y = max(0, TYA - 3)
bg_samp  = [right.getpixel((x, sample_y))[:3]
            for x in range(TXA + 10, TXB - 10, 20)]
bg_r  = sum(s[0] for s in bg_samp) // len(bg_samp)
bg_g  = sum(s[1] for s in bg_samp) // len(bg_samp)
bg_b  = sum(s[2] for s in bg_samp) // len(bg_samp)
TITLE_BG = (bg_r, bg_g, bg_b)

# Peindre par-dessus l'ancien titre
d0.rectangle([TXA, TYA, TXB, TYB], fill=TITLE_BG)

# Police
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
# Taille adaptée à la zone (≈ 43 % de la hauteur pour 3 lignes)
FONT_SZ = int(GH * 0.068)
try:
    fnt = ImageFont.truetype(FONT_PATH, FONT_SZ)
except:
    fnt = ImageFont.load_default()

WHITE = (255, 255, 255, 255)
CYAN  = (0, 195, 255, 255)

# Lignes du nouveau titre
TITLE_WORDS = [
    ("COLLECTER LES PAIEMENTS", WHITE),
    ("DANS PLUSIEURS PAYS", WHITE),
    ("AVEC ", WHITE, "BKAPAY", CYAN),
]

def draw_title_lines(draw, words, alpha_per_word=None):
    """Dessine les lignes du titre. alpha_per_word: liste de floats 0‒1 par mot."""
    ty = TYA + int(GH * 0.010)
    line_h = FONT_SZ + int(GH * 0.010)
    word_idx = 0
    for line_def in words:
        tx = TXA + 6
        if len(line_def) == 2:
            text, color = line_def
            a = 255
            if alpha_per_word is not None and word_idx < len(alpha_per_word):
                a = int(255 * alpha_per_word[word_idx])
            draw.text((tx, ty), text, font=fnt,
                      fill=(*color[:3], a))
            word_idx += 1
        else:
            t1, c1, t2, c2 = line_def
            # deux mots sur la même ligne
            a1 = 255
            if alpha_per_word is not None and word_idx < len(alpha_per_word):
                a1 = int(255 * alpha_per_word[word_idx])
            draw.text((tx, ty), t1, font=fnt, fill=(*c1[:3], a1))
            bb1 = draw.textbbox((tx, ty), t1, font=fnt)
            word_idx += 1
            a2 = 255
            if alpha_per_word is not None and word_idx < len(alpha_per_word):
                a2 = int(255 * alpha_per_word[word_idx])
            draw.text((bb1[2], ty), t2, font=fnt, fill=(*c2[:3], a2))
            word_idx += 1
        ty += line_h

# Dessiner le titre final sur rp_mod (version complète)
draw_title_lines(d0, TITLE_WORDS)
rp_mod = rp_mod.convert("RGBA")

# ── Easing ────────────────────────────────────────────────────────────────
def ease_out(t, n=3):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** n

def ease_out_back(t):
    t = max(0.0, min(1.0, t))
    return 1 + 2.70158 * (t - 1)**3 + 1.70158 * (t - 1)**2

def ph(t, s, e, fn=ease_out):
    return fn(max(0.0, min(1.0, (t - s) / max(1e-6, e - s))))

# ── Coller une image en gérant les coordonnées hors-cadre ─────────────────
def paste_clipped(canvas, img, dest_x, dest_y):
    sw, sh = img.size
    cw, ch = canvas.size
    sx0 = max(0, -dest_x);  sy0 = max(0, -dest_y)
    sx1 = min(sw, cw - dest_x); sy1 = min(sh, ch - dest_y)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    crop = img.crop((sx0, sy0, sx1, sy1))
    dx = max(0, dest_x);    dy = max(0, dest_y)
    if img.mode == "RGBA":
        canvas.paste(crop, (dx, dy), crop)
    else:
        canvas.paste(crop, (dx, dy))

# ── Overlay semi-transparent ───────────────────────────────────────────────
def overlay(img, x1, y1, x2, y2, color, alpha):
    if alpha <= 0:
        return
    w, h = x2 - x1, y2 - y1
    if w <= 0 or h <= 0:
        return
    ov = Image.new("RGBA", (w, h), (*color, int(alpha)))
    img.paste(ov, (x1, y1), ov)

# ── Génération des frames ─────────────────────────────────────────────────
N = 80            # nombre de frames
DURATION = 55     # ms par frame  (~18 fps)
N_WORDS = 4       # nombre de "mots/groupes" dans le titre (3 lignes + BKAPAY)

frames    = []
durations = []

for fi in range(N):
    t = fi / (N - 1)

    # Canevas de base (fond noir nuit)
    frame = Image.new("RGBA", (GW, GH), (*BG, 255))

    # ─── Panneau droit : toujours visible (révélé par zones) ─────────────
    frame.paste(rp_mod, (RP_X, 0), rp_mod)

    draw = ImageDraw.Draw(frame)

    # ─── Masquer le logo (t 0.30→0.48) ───────────────────────────────────
    lg_t = ph(t, 0.30, 0.48)
    overlay(frame, RP_X + LGX1, LGY1, RP_X + LGX2, LGY2, BG, 255 * (1 - lg_t))

    # ─── Masquer zone titre, révéler mot par mot (t 0.42→0.70) ──────────
    # On masque toute la zone titre d'abord
    title_prog = ph(t, 0.42, 0.70)   # 0→1 sur toute la phase
    # Chaque mot a son propre alpha
    alphas = []
    for wi in range(N_WORDS):
        word_start = wi / N_WORDS
        word_end   = (wi + 1) / N_WORDS
        a = ph(title_prog, word_start, word_end)
        alphas.append(a)
    # On redessine le titre avec alphas dynamiques par-dessus un masque noir
    overlay(frame, RP_X + TXA, TYA, RP_X + TXB, TYB, BG, 255)  # masque total
    tmp_title = Image.new("RGBA", (TXB - TXA, TYB - TYA), (0, 0, 0, 0))
    d_tmp = ImageDraw.Draw(tmp_title)
    # décaler les coords dans le patch
    def draw_in_patch(draw, words, alphas):
        ty = int(GH * 0.010)
        line_h = FONT_SZ + int(GH * 0.010)
        wi = 0
        for line_def in words:
            tx = 6
            if len(line_def) == 2:
                text, color = line_def
                a = int(255 * alphas[wi]) if wi < len(alphas) else 255
                draw.text((tx, ty), text, font=fnt, fill=(*color[:3], a))
                wi += 1
            else:
                t1, c1, t2, c2 = line_def
                a1 = int(255 * alphas[wi]) if wi < len(alphas) else 255
                draw.text((tx, ty), t1, font=fnt, fill=(*c1[:3], a1))
                bb1 = draw.textbbox((tx, ty), t1, font=fnt)
                wi += 1
                a2 = int(255 * alphas[wi]) if wi < len(alphas) else 255
                draw.text((bb1[2], ty), t2, font=fnt, fill=(*c2[:3], a2))
                wi += 1
            ty += line_h
    draw_in_patch(d_tmp, TITLE_WORDS, alphas)
    frame.paste(tmp_title, (RP_X + TXA, TYA), tmp_title)

    # ─── Masquer features (t 0.65→0.78) ──────────────────────────────────
    for fi2 in range(N_FEAT):
        feat_s = 0.65 + fi2 * 0.035
        feat_e = feat_s + 0.055
        ft = ph(t, feat_s, feat_e)
        x1 = RP_X + FX1 + fi2 * FEAT_W
        overlay(frame, x1, FY1, x1 + FEAT_W, FY2, BG, 255 * (1 - ft))

    # ─── Masquer label opérateurs (t 0.75→0.83) ──────────────────────────
    lbl_t = ph(t, 0.75, 0.83)
    overlay(frame, RP_X + OLX1, OLY1, RP_X + OLX2, OLY2, BG, 255 * (1 - lbl_t))

    # ─── Opérateurs un par un (t 0.82→0.97) ──────────────────────────────
    N_OPS = OCOLS * OROWS
    for oi in range(N_OPS):
        op_s = 0.82 + oi * (0.15 / N_OPS)
        op_e = op_s + (0.15 / N_OPS) + 0.02
        ot = ph(t, op_s, op_e)
        if ot < 1.0:
            row = oi // OCOLS
            col = oi % OCOLS
            rx1 = RP_X + OGX1 + col * OC_W
            ry1 = OGY1 + row * OC_H
            overlay(frame, rx1, ry1, rx1 + OC_W, ry1 + OC_H, BG, 255 * (1 - ot))

    # ─── Footer (t 0.94→1.00) ────────────────────────────────────────────
    ft_t = ph(t, 0.94, 1.00)
    overlay(frame, 0, FTY1, GW, GH, BG, 255 * (1 - ft_t))

    # ═══ TÉLÉPHONES : entrée depuis la gauche hors-cadre ═════════════════

    # Téléphone 1 : x de -P1_END → 0  (t 0.00→0.28)
    p1_t  = ph(t, 0.00, 0.28, ease_out_back)
    p1_x  = int(-P1_END + P1_END * p1_t)    # commence hors-écran à gauche
    paste_clipped(frame, phone1, p1_x, 0)

    # Téléphone 2 : x de (P1_END - P2W) → P1_END  (t 0.16→0.42)
    P2_W  = P2_END - P1_END
    p2_t  = ph(t, 0.16, 0.42, ease_out_back)
    p2_x  = int(P1_END - P2_W + P2_W * p2_t)
    paste_clipped(frame, phone2, p2_x, 0)

    frames.append(frame.convert("RGB"))
    durations.append(DURATION)

# Pauses aux moments-clés
pause_frames = {
    int(N * 0.29): 280,   # après arrivée tel 1
    int(N * 0.43): 200,   # après arrivée tel 2
    N - 1:         3800,  # fin
}
for fi2, dur in pause_frames.items():
    if 0 <= fi2 < len(durations):
        durations[fi2] = dur

# ── Sauvegarde ────────────────────────────────────────────────────────────
out = "bkapay_pro.gif"
print("Sauvegarde du GIF…")
frames[0].save(
    out,
    save_all=True,
    append_images=frames[1:],
    loop=0,
    duration=durations,
    optimize=False,
)
kb = os.path.getsize(out) // 1024
print(f"✓  {out}  |  {GW}×{GH}  |  {N} frames  |  {kb} KB")
