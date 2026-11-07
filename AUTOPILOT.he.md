# הפעלת האוטופילוט (פעם אחת) — אחרי זה המערכת עובדת בלי Claude ובלי המחשב שלך

מה קורה אוטומטית 5 פעמים ביום (08:30, 11:30, 14:30, 17:30, 20:30 שעון ישראל, חורף):
1. המערכת בוחרת נושא: 2 מתוך 5 הם **חדשות AI** (נקראות מ-RSS של TechCrunch / The Verge / OpenAI / Google / MIT / VentureBeat), 3 הם הסברים על דברים יומיומיים (`topics.txt`, 40 נושאים; תוסיף שורות כשרוצה).
2. מודל שפה חינמי (Groq או Gemini, לפי המפתח שתשים) כותב סטוריבורד; מנוע הרינדור בודק שהוא תקין, ואם לא — מנסה שוב.
3. רינדור תלת־ממדי + קול + מוזיקה → mp4.
4. הסרטון עולה כ-Release לריפו הציבורי, ו-Buffer מפרסם אותו לאינסטגרם ולטיקטוק (מסומן כ-AI).
5. `state.json` מתעדכן כדי לא לחזור על נושאים. אם המודל נכשל — המערכת נופלת חזרה על הבנק המוכן; אם גם הוא נגמר, הריצה נכשלת ותקבל מייל מ-GitHub.

## צעדים (מהמחשב; מהטלפון — "Request Desktop Website")
1. **מפתח Buffer:** Buffer ← Settings ← API (או developers.buffer.com) ← Create/Generate key. העתק.
2. **הכנס אותו לריפו:** github.com/m2gsg7rf22-cmd/explainer-factory ← Settings ← Secrets and variables ← Actions ← **New repository secret** ← שם: `BUFFER_API_KEY`, ערך: המפתח.
2ב. **מפתח מודל שפה חינמי (בלי כרטיס אשראי):** console.groq.com ← API Keys ← Create (או aistudio.google.com ← Get API key). שמור כ-secret בשם `GROQ_API_KEY` (או `GEMINI_API_KEY`) באותו מקום. נבדק: GitHub Models לא עובד בריצות של הריפו הזה (מחזיר "OK" ריק), לכן עברנו ל-Groq/Gemini.
3. **הרשאות:** Settings ← Actions ← General ← Workflow permissions ← **Read and write permissions** ← Save.
4. **ריצת ניסיון:** לשונית **Actions** ← daily-video ← **Run workflow**. בלי המשתנה `LIVE_POSTING` הסרטון נשמר ב-Buffer כ-**טיוטה** ולא מתפרסם. הריצה לוקחת ~15 דקות. פתח את הלוג: חפש `[buffer] DRAFT` ← הצלחה. אם יש שגיאה — שלח לי את הלוג של שלב "Buffer schema check" ושל "Render one video".
5. **הפעלה אמיתית:** Settings ← Secrets and variables ← Actions ← לשונית **Variables** ← New variable ← `LIVE_POSTING` = `1`.
6. סיימת. מכאן זה רץ לבד (GitHub מריץ לפי cron; הרצות יכולות להתעכב כמה דקות).

## מה לבדוק מדי פעם
* **Actions:** ריצה אדומה = מייל אליך. פתח את הלוג, ברוב המקרים זה מגבלת קצב של GitHub Models (ינסה שוב בריצה הבאה) או שינוי בממשק של Buffer.
* **מודל שפה:** חינמי עם מגבלות יומיות. בלי מפתח המערכת משתמשת בבנק (6 סרטונים) ואז נכשלת.
* **60 יום:** GitHub מכבה ריצות מתוזמנות בריפו בלי פעילות 60 יום. ה-commit של `state.json` בכל ריצה נחשב פעילות.
* **ידני אחרי שהפרסום הראשון הצליח:** מחק את התיקייה `media/` (3 סרטונים ראשונים שכבר מתוזמנים ב-Buffer) כדי לא לנפח את הריפו.

## מה נבדק בפועל ב-GitHub Actions (ריצות אמיתיות) ומה לא
נבדק: הרינדור המלא בענן (~3 דקות לסרטון), קול Kokoro, קריאת חדשות מ-RSS (נמצאה כתבה אמיתית), נפילה לבנק, שה-API של Buffer נגיש מהרץ (מחזיר 401 בלי מפתח).
לא נבדק: כתיבת סטוריבורד ע"י מודל (חסר מפתח Groq/Gemini) ופרסום ב-Buffer (חסר ה-secret). ריצת הניסיון בצעד 4 נועדה בדיוק לזה.
