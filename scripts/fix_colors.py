"""Bulk replace hardcoded hex colors with CSS variables.

Palette Bleu de Prusse + Or (2026-04-20) :
  - Principale   : Bleu de Prusse #0F2E4C  → var(--althy-prussian)
  - Hover/accent : Bleu signature #1A4975  → var(--althy-signature)
  - Premium      : Or Althy      #C9A961  → var(--althy-gold)
  - Glacier      : #F4F6F9                 → var(--althy-glacier)
  - Ardoise      : #475569                 → var(--althy-text-2)
  - Muted        : #64748B                 → var(--althy-text-3)

L'ancien orange (#E8602C) est migré vers le bleu de Prusse. L'alias
var(--althy-orange) pointe vers prussian durant la phase de transition.
"""
import os

REPLACEMENTS = {
    # ── Texte ───────────────────────────────────────────────────────────────
    '"#0F172A"': '"var(--althy-text)"',
    '"#3D3830"': '"var(--althy-text)"',
    '"#1A1612"': '"var(--althy-text)"',
    '"#4A4440"': '"var(--althy-text)"',
    '"#475569"': '"var(--althy-text-2)"',
    '"#5C5650"': '"var(--althy-text-2)"',
    '"#64748B"': '"var(--althy-text-3)"',
    '"#7A7469"': '"var(--althy-text-3)"',
    '"#8A7A6A"': '"var(--althy-text-3)"',
    '"#9CA3AF"': '"var(--althy-text-3)"',
    '"#9ca3af"': '"var(--althy-text-3)"',

    # ── Surfaces ────────────────────────────────────────────────────────────
    '"#FAFAF8"': '"var(--althy-bg)"',
    '"#FFFFFF"': '"var(--althy-surface)"',
    '"#F5F2ED"': '"var(--althy-surface-2)"',
    '"#F5F3EF"': '"var(--althy-surface-2)"',
    '"#F5F2EE"': '"var(--althy-surface-2)"',
    '"#F4F6F9"': '"var(--althy-glacier)"',

    # ── Bordures ────────────────────────────────────────────────────────────
    '"#E8E4DC"': '"var(--althy-border)"',
    '"#EAE3D9"': '"var(--althy-border)"',

    # ── Bleu de Prusse (couleur principale) ─────────────────────────────────
    '"#0F2E4C"': '"var(--althy-prussian)"',
    '"#1A4975"': '"var(--althy-signature)"',
    # legacy orange → prussian (migration automatique)
    '"#E8602C"': '"var(--althy-prussian)"',
    '"#C84E1E"': '"var(--althy-signature)"',

    # Teintes bg claires héritées de l'orange → prussian-bg
    '"#FAE4D6"': '"var(--althy-prussian-bg)"',
    '"#FEF2EB"': '"var(--althy-prussian-bg)"',
    '"#FEF0EA"': '"var(--althy-prussian-bg)"',
    '"#FDF6F2"': '"var(--althy-prussian-bg)"',

    # ── Or Althy (premium) ──────────────────────────────────────────────────
    '"#C9A961"': '"var(--althy-gold)"',
    '"#B5975A"': '"var(--althy-gold-hover)"',
    '"#FEF9E7"': '"var(--althy-gold-bg)"',

    # ── Sémantique ──────────────────────────────────────────────────────────
    '"#16A34A"': '"var(--althy-green)"',
    '"#16a34a"': '"var(--althy-green)"',
    '"#22C55E"': '"var(--althy-green)"',
    '"#15803D"': '"var(--althy-green)"',
    '"#4CAF50"': '"var(--althy-green)"',
    '"#2E5E22"': '"var(--althy-green)"',
    '"#2E7D32"': '"var(--althy-green)"',
    '"#E8F8F0"': '"var(--althy-green-bg)"',
    '"#EBF2EA"': '"var(--althy-green-bg)"',
    '"#EBF4E8"': '"var(--althy-green-bg)"',
    '"#E74C3C"': '"var(--althy-red)"',
    '"#EF4444"': '"var(--althy-red)"',
    '"#C0392B"': '"var(--althy-red)"',
    '"#DC3545"': '"var(--althy-red)"',
    '"#DC2626"': '"var(--althy-red)"',
    '"#dc2626"': '"var(--althy-red)"',
    '"#E53E3E"': '"var(--althy-red)"',
    '"#FDECEA"': '"var(--althy-red-bg)"',
    '"#2563EB"': '"var(--althy-blue)"',
    '"#3B82F6"': '"var(--althy-blue)"',
    '"#EEF3FE"': '"var(--althy-blue-bg)"',
    '"#7C3AED"': '"var(--althy-purple)"',
    '"#25D366"': '"var(--whatsapp-green)"',
    '"#F59E0B"': '"var(--althy-warning)"',
}

RGBA_REPLACEMENTS = {
    # Migration legacy orange (232,96,44) → prussian (15,46,76)
    'rgba(232,96,44,': 'rgba(15,46,76,',
    'rgba(232, 96, 44,': 'rgba(15,46,76,',
}

BORDER_PATS = [
    ('1px solid #E8E4DC', '1px solid var(--althy-border)'),
    ('1px solid #EAE3D9', '1px solid var(--althy-border)'),
    ('1px solid #0F2E4C', '1px solid var(--althy-prussian)'),
]

# Les fichiers Mapbox/Leaflet exigent du hex brut → ne pas toucher
SKIP_IN_PATH = ['map\\', 'map/', 'LandingHeroMap', 'OpenerMap', 'VilleMap']
# Les gradients (sphere, logo) et constantes PRUSSIAN_HEX utilisent du hex brut
GRAD_KW = ['gradient(', 'stopColor', 'const PRUSSIAN', 'PRUSSIAN_HEX']

base = os.path.join('C:\\', 'Users', 'Killan', 'immohub', 'frontend', 'src')
tf = 0
tr = 0

for root, dirs, files in os.walk(base):
    for fname in files:
        if not fname.endswith(('.tsx', '.ts')):
            continue
        fp = os.path.join(root, fname)
        if any(s in fp for s in SKIP_IN_PATH):
            continue
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
        orig = content
        count = 0
        for old, new in BORDER_PATS:
            n = content.count(old)
            if n:
                content = content.replace(old, new)
                count += n
        for old, new in RGBA_REPLACEMENTS.items():
            n = content.count(old)
            if n:
                content = content.replace(old, new)
                count += n
        for old, new in REPLACEMENTS.items():
            lines = content.split('\n')
            nl = []
            for line in lines:
                if old in line:
                    if any(kw in line for kw in GRAD_KW):
                        nl.append(line)
                        continue
                    n = line.count(old)
                    line = line.replace(old, new)
                    count += n
                nl.append(line)
            content = '\n'.join(nl)
        if content != orig:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            tf += 1
            tr += count
            rel = fp[len(base)+1:].replace('\\', '/')
            print(f"  {rel}: {count}")

print(f"\nTotal: {tf} files, {tr} replacements")
