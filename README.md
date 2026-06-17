# Reel Analyzer

ניתוח מקצועי לסרטוני **TikTok** ו-**Instagram Reels** (עד דקה) — מופעל על ידי AI.

## מה האפליקציה נותנת

- **ציון כללי** + פסק דין קצר
- **6 ציונים לפי קטגוריה**: Hook, קצב, מסר, ויזואל, אודיו, התאמה לפלטפורמה
- **3 תיקונים דחופים** — מה לעשות קודם
- **ציר זמן** — רגעים קריטיים בסרטון
- **למה לא עבד / מה לשנות / איך לשפר**
- **Hook ותסריט משופר**
- **העתקת דוח** בלחיצה

## התקנה

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..

copy server\.env.example server\.env
# הוסף OPENAI_API_KEY=sk-...
```

## הרצה

```bash
npm run dev
```

פתח: **http://localhost:5173**

## מבנה

```
client/     React — ממשק בעברית
server/     Express + ffmpeg + OpenAI
  analyze.js   עיבוד וידאו וניתוח
  cardcom.js   תשלום (לעתיד)
```

## עלות OpenAI

~$0.05–0.15 לסרטון של דקה.

## תשלום (Cardcom)

מוכן בקוד (`server/cardcom.js`) — נחבר כשתרצה למכור.
