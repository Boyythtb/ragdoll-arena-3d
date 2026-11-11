import os
from PIL import Image, ImageDraw, ImageFont

def create_og_image():
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), '#fdf2f8')
    d = ImageDraw.Draw(im)

    # Nền kẻ sọc Parquet
    for y in range(0, H, 24):
        d.line([(0, y), (W, y)], fill='#fce7f3', width=1)

    # Võ đài chính giữa
    d.rounded_rectangle([250, 140, 950, 540], radius=42, fill='#fbcfe8')
    d.rounded_rectangle([240, 130, 940, 530], radius=42, fill='#1e1b4b')
    d.rounded_rectangle([255, 145, 925, 515], radius=32, fill='#34d399')

    # Dây đài
    d.rectangle([255, 200, 925, 208], fill='#f472b6')
    d.rectangle([255, 450, 925, 458], fill='#f472b6')

    # Đô vật P1 (Xanh Sky Blue)
    d.ellipse([380, 260, 480, 360], fill='#0284c7', outline='#ffffff', width=6)
    d.ellipse([405, 240, 455, 290], fill='#fde047') # Đầu
    d.ellipse([460, 290, 520, 350], fill='#f43f5e', outline='#ffffff', width=4) # Găng đấm

    # Đô vật P2 (Đỏ Rose bị đấm văng ra)
    d.ellipse([700, 250, 800, 350], fill='#f43f5e', outline='#ffffff', width=6)
    d.ellipse([735, 220, 785, 270], fill='#fde047')

    # Tia sao va chạm
    d.ellipse([540, 280, 620, 360], fill='#fde047')

    try:
        font_big = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 68)
        font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 24)
        font_badge = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 15)
    except:
        font_big = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    d.rounded_rectangle([490, 24, 710, 62], radius=19, fill='#ffffff', outline='#f43f5e', width=2)
    d.text((600, 43), "✨ TBOY STUDIO PRESENTS ✨", font=font_badge, fill='#f43f5e', anchor="mm")

    d.text((600, 115), "RAGDOLL ARENA 3D", font=font_big, fill='#1e1b4b', anchor="mm")
    d.text((600, 112), "RAGDOLL ARENA 3D", font=font_big, fill='#fb7185', anchor="mm")

    d.rounded_rectangle([360, 560, 840, 608], radius=24, fill='#ffffff', outline='#fb7185', width=2)
    d.text((600, 584), "🤼 ĐẤU VẬT KHỚP UỐN DẺO REALTIME ĐỈNH CAO", font=font_sub, fill='#1e1b4b', anchor="mm")

    im.save('d:/Code web/ragdoll-arena/public/og-image.png', 'PNG')

    # App icon 512
    S = 512
    icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    idraw = ImageDraw.Draw(icon)
    idraw.rounded_rectangle([0, 0, S, S], radius=110, fill='#1e1b4b')
    idraw.rounded_rectangle([18, 18, S-18, S-18], radius=96, fill='#34d399')

    # Nhân vật chibi
    idraw.ellipse([140, 180, 360, 400], fill='#0284c7', outline='#ffffff', width=8)
    idraw.ellipse([190, 110, 310, 230], fill='#fde047', outline='#ffffff', width=6)
    # Băng đô
    idraw.rectangle([190, 140, 310, 170], fill='#f43f5e')
    # Găng đấm to
    idraw.ellipse([300, 240, 420, 360], fill='#f43f5e', outline='#ffffff', width=8)

    icon.save('d:/Code web/ragdoll-arena/public/icon-512.png', 'PNG')
    icon.resize((192, 192), Image.Resampling.LANCZOS).save('d:/Code web/ragdoll-arena/public/icon-192.png', 'PNG')
    icon.resize((180, 180), Image.Resampling.LANCZOS).save('d:/Code web/ragdoll-arena/public/apple-touch-icon.png', 'PNG')
    icon.resize((32, 32), Image.Resampling.LANCZOS).save('d:/Code web/ragdoll-arena/public/favicon-32x32.png', 'PNG')
    icon.resize((16, 16), Image.Resampling.LANCZOS).save('d:/Code web/ragdoll-arena/public/favicon-16x16.png', 'PNG')
    print("Created Ragdoll assets!")

if __name__ == '__main__':
    create_og_image()
