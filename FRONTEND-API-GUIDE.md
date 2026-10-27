# חיבור React לשרת — ללא קוד React

## כתובות והתחברות

Base URL מקומי: `http://localhost:3000/api`. בענן: כתובת השירות בתוספת `/api`.

כל בקשה מלבד login, register ו־health דורשת:

```text
Authorization: Bearer TOKEN
```

לבקשות JSON הוסף `Content-Type: application/json`. בהעלאת תמונה השתמש ב־FormData עם שדה בשם `image`, ואל תגדיר Content-Type ידנית — הדפדפן מוסיף את הגבול של multipart.

בהתחברות מתקבל `{user, token, expiresIn}`. התוקף הוא שעתיים. אפשר להחזיק Token בזיכרון/Context; אם בוחרים sessionStorage כדי לשמר רענון, הוא נגיש ל־JavaScript ולכן חשוב לא להציג HTML לא מהימן. ב־401 יש לנקות את ההתחברות ולחזור למסך Login. ההתקדמות עצמה נשמרת במסד ואינה אובדת כש־Token פג.

## מיפוי מסכים

| מסך | פעולות |
|---|---|
| הרשמה | POST /auth/register |
| התחברות | POST /auth/login; GET /auth/me |
| קטלוג וניהול רשימת חדרים | GET /rooms |
| פרטי חדר | GET /rooms/:id |
| משחק | POST /rooms/:id/game; GET נקודה; POST תשובה; GET רמז |
| יצירת חדר | POST /admin/uploads ואז POST /admin/rooms |
| עריכת חדר | GET /admin/rooms/:id; PATCH /admin/rooms/:id; פעולות hotspots |
| סיום | התשובה הנכונה לחידת הסיום מחזירה game.status=COMPLETED |

מסך הבית יכול להציג תוכן מקומי; אין צורך בפעולת API מיוחדת.

## שינויים ביחס לנתונים הישנים שלך

- כתובת השרת החדשה היא `/api/rooms`, ולא השרת הזמני בפורט 1753.
- GET /rooms מחזיר אובייקט `{items,total,page,pageSize}`. הרשימה נמצאת ב־`items` ולא בשורש התשובה.
- המזהים הם UUID, לא `room-1` או `hotspot-1`. העבר תמיד מזהה שחזר מהשרת.
- נשמרו שמות `imageUrl`,‏ `xpercent`,‏ `ypercent`,‏ `label`,‏ `question` ו־`answerType`.
- `clue` הוחלף ב־`content` לתיאור וב־`hint` לעזרה לפי בקשה.
- `rewardDigit` ו־`order` אינם קיימים. אין איסוף ספרות; חידת הסיום היא נקודה עם `isFinal=true`.
- `answer` קיים בנתוני ניהול בלבד. אין לבדוק תשובות ב־React.
- מצב משחק מגיע מהשרת. אל תשלח רשימת חידות פתורות או מזהה משתמש כדי לשמור התקדמות.

## נתוני חדר

```json
{
  "title": "החדר שלי",
  "description": "מצא את המסר הסודי",
  "category": "חקירה",
  "difficulty": "medium",
  "imageUrl": "https://example.com/room.webp",
  "imageKey": "IMAGE_KEY_RETURNED_BY_UPLOAD"
}
```

השדות חובה מלבד imageKey. השתמש ב־imageUrl ו־imageKey שחזרו מהעלאה. הערכים האפשריים לקושי: easy, medium, hard. פרטי חדר לשחקן כוללים `isPlayable` ו־`puzzleCount`; כבה את כפתור המשחק אם isPlayable הוא false.

## נתוני נקודת מידע

```json
{"label":"מכתב","xpercent":30,"ypercent":60,"type":"INFO","content":"תוכן המכתב"}
```

נקודת מידע אינה מכילה תשובה, רמז, תלות או סימון סיום. אין צורך לסמן אותה כנקראה כדי להתקדם.

## נתוני חידה — למנהל בלבד

```json
{
  "label":"מנעול",
  "xpercent":75,
  "ypercent":45,
  "type":"PUZZLE",
  "content":"מנעול עם ארבע ספרות",
  "question":"מהו הקוד?",
  "answerType":"number",
  "answer":"1635",
  "hint":"בדוק את הזמנים ביומן",
  "solvedContent":"המנעול נפתח. הפתק מפנה אותך לתמונה.",
  "prerequisiteId":null,
  "lockedMessage":null,
  "isFinal":false
}
```

חובה: label, מיקום, type, content (יכול להיות ריק), question, answerType, answer ו־solvedContent. רמז ותלות אינם חובה. אם יש prerequisiteId, חייבת להיות lockedMessage.

`number` פירושו קוד של ספרות 0–9, לא חישובים או מספרים עשרוניים. גם הוא נשלח כמחרוזת, כדי לשמור קוד כגון `007`. השוואת טקסט מתעלמת מרווחים בקצוות ומהבדלי אותיות גדולות/קטנות, אך לא מתעלמת מסימני פיסוק או מרווחים פנימיים. לתשובה „מדף שני” לא מתקבל אוטומטית „המדף השני”.

לנקודה יש חידה אחת בלבד. אם צריכים שני שלבים באותו חפץ, יוצרים שתי נקודות סמוכות עם תלות ביניהן.

## ניהול ועריכה

יצירה מחזירה 201. עדכון מחזיר 200 ומחיקה 204 ללא JSON.

PATCH מקבל רק את השדות שרוצים לשנות. לשליחת הסרה של רמז או תלות השתמש ב־null; אל תשלח מחרוזת ריקה. כדי להפוך PUZZLE ל־INFO נקה גם את כל שדות החידה, קישורי התלות והסימון isFinal. אם חידות אחרות תלויות בה, הסר את התלויות קודם.

כל שינוי/הוספה/מחיקה של נקודה מאפס את כל ההתקדמויות בחדר. תשובת השמירה כוללת progressReset ו־revision. יש להציג למנהל אזהרה מראש. שינוי imageUrl מאפס גם הוא. מחיקת חדר מחייבת אישור ברור בממשק שלך.

חדר מופיע מיד בקטלוג. כדי למנוע כניסה מוקדמת בזמן יצירת חדר, הגדר את חידת הסיום אחרונה. אין פעולת פרסום נפרדת.

## מהלך המשחק

1. בכניסה ל־`/play/:id`, קרא `POST /rooms/:id/game`. אותה פעולה גם ממשיכה משחק קיים בלי לאפס אותו.
2. התשובה כוללת `revision`,‏ `status`,‏ `solvedHotspotIds`,‏ `solvedCount`,‏ `totalPuzzles` ונקודות עם מיקום ומצב. התוכן לא מגיע ברשימה הזאת.
3. בלחיצה על נקודה קרא `GET /rooms/:id/game/hotspots/:hotspotId`.
4. לפי `state`: ב־LOCKED הצג lockedMessage; ב־SOLVED הצג content שנחשף; ב־AVAILABLE הצג content ושאלה אם זו PUZZLE.
5. כפתור רמז קורא ל־`GET .../hint`. שמור את התצוגה המקומית בזמן המשחק. הרמז זמין שוב אחרי כניסה מחדש; אין תיעוד נפרד במסד של חשיפת רמז.
6. שלח תשובה:

```json
{"answer":"1635","revision":1}
```

מספר הגרסה הוא דוגמה: השתמש בערך האמיתי שחזר מהמשחק. תשובה שגויה מחזירה 200 עם `{correct:false,message:...}`. תשובה נכונה מחזירה `{correct:true,alreadySolved:false,hotspot:...,game:...}`.

7. עדכן את התצוגה מנתוני game שהשרת החזיר. לא צריך בקשת שמירה נוספת. פתרון חוזר לא ייספר פעמיים.
8. כאשר game.status הוא COMPLETED, הצג את הודעת הסיום מתוך hotspot.content.
9. כדי להתחיל מחדש, לאחר אישור המשתמש שלח POST /rooms/:id/game/restart עם `{revision:...}`.

אין Endpoint נפרד בשם finish: שליחת תשובה לחידת הסיום עושה זאת. אין צורך בבקשות בכל שנייה או בשמירת התקדמות בזמן סגירת הדפדפן.

החלון המשותף יכול לשמור `selectedHotspot` מקומית; החלפת חדר, איפוס או שגיאת ROOM_CHANGED צריכים לנקות אותו. אחרי שינוי ב־React Query רענן את נתוני החדר/משחק לפי הצורך. הטקסטים הם טקסט רגיל — הצג אותם כטקסט, עם `white-space: pre-line` עבור שבירת שורות; אל תשתמש ב־dangerouslySetInnerHTML.

## חיפוש וסינון

דוגמה: `/rooms?search=תיק&category=חקירה&difficulty=medium&sort=newest&page=1&pageSize=20` (העבר פרמטרים באמצעות URLSearchParams).

מיון: newest, oldest, title, difficulty. חיפוש טקסט בכותרת ובתיאור. קטגוריה היא התאמה מדויקת. הסינון מתבצע לפני חלוקה לעמודים. מנהל בוחר קטגוריה בטופס; אין מערכת נפרדת לניהול קטגוריות.

## שגיאות

מבנה קבוע:

```json
{"error":{"code":"PUZZLE_LOCKED","message":"Solve the prerequisite puzzles first"}}
```

| מצב | טיפול בממשק |
|---|---|
| 400 VALIDATION_ERROR | הצג שגיאות טופס מתוך details |
| 401 | מעבר להתחברות |
| 403 FORBIDDEN | הצג שאין הרשאה |
| 404 | פריט לא נמצא |
| 409 PUZZLE_LOCKED | סגור שדה תשובה וטען מצב מעודכן |
| 409 ROOM_CHANGED / GAME_NOT_STARTED | טען מחדש והתחל/חדש את המשחק; העריכה עשויה לאפס התקדמות |
| 409 HAS_DEPENDENTS | הסר קודם תלות של חידות אחרות |
| 413 | תמונה גדולה מדי |
| 429 | בקש לנסות שוב מאוחר יותר |
| 500/502/503 | הצג שגיאה ואפשר ניסיון חוזר |

הודעות השרת באנגלית; אפשר להציג הודעה עברית לפי error.code. תוכן החדרים עצמם בעברית או בכל שפה שהמנהל בוחר.

המקור המלא לשדות, מגבלות, הרשאות ודוגמאות הוא `docs/openapi.json` ו־Swagger.
