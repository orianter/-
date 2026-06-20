# Reel Analyzer

ניתוח AI בסיסי לסרטוני **TikTok** ו-**Instagram Reels** — מופעל דרך Supabase Edge Functions.

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

copy client\.env.example client\.env
# הוסף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY
```

ב-Supabase צריך להוסיף Secret בשם `OPENAI_API_KEY`, ואז לפרוס את הפונקציה:

```bash
supabase functions deploy analyze
```

## הרצה

```bash
npm run dev
```

פתח: **http://localhost:5173**

## מבנה

```
client/     React — ממשק בעברית
supabase/   Edge Function שקוראת ל-OpenAI
server/     שרת ישן לעיבוד וידאו מלא (לא בשימוש ב-client החדש)
```

## עלות OpenAI

תלוי במודל ובאורך התשובה. כרגע הניתוח לא שולח את קובץ הווידאו עצמו ל-OpenAI.

## תשלום (Cardcom)

מוכן בקוד (`server/cardcom.js`) — נחבר כשתרצה למכור.
