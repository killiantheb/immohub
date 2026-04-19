"""Bulk replace hardcoded hex colors with CSS variables."""
import os

REPLACEMENTS = {
    '"#7A7469"': '"var(--althy-text-3)"',
    '"#3D3830"': '"var(--althy-text)"',
    '"#5C5650"': '"var(--althy-text-2)"',
    '"#1A1612"': '"var(--althy-text)"',
    '"#4A4440"': '"var(--althy-text)"',
    '"#8A7A6A"': '"var(--althy-text-3)"',
    '"#FAFAF8"': '"var(--althy-bg)"',
    '"#FFFFFF"': '"var(--althy-surface)"',
    '"#F5F2ED"': '"var(--althy-surface-2)"',
    '"#F5F3EF"': '"var(--althy-surface-2)"',
    '"#F5F2EE"': '"var(--althy-surface-2)"',
    '"#E8E4DC"': '"var(--althy-border)"',
    '"#EAE3D9"': '"var(--althy-border)"',
    '"#E8602C"': '"var(--althy-orange)"',
    '"#FAE4D6"': '"var(--althy-orange-light)"',
    '"#FEF2EB"': '"var(--althy-orange-light)"',
    '"#FEF0EA"': '"var(--althy-orange-light)"',
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
    '"#9CA3AF"': '"var(--althy-text-3)"',
    '"#9ca3af"': '"var(--althy-text-3)"',
    '"#64748B"': '"var(--althy-text-3)"',
}

BORDER_PATS = [
    ('1px solid #E8E4DC', '1px solid var(--althy-border)'),
    ('1px solid #EAE3D9', '1px solid var(--althy-border)'),
]

SKIP_IN_PATH = ['map\\', 'map/', 'LandingHeroMap', 'OpenerMap', 'VilleMap']
GRAD_KW = ['gradient(', 'stopColor', 'const ORANGE', "ORANGE_HEX"]

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
