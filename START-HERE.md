# מתחילים כאן — הפעלת השרת

המטרה הראשונה: להפעיל את השרת במחשב ולבדוק דרך Swagger. רק אחר כך לחבר את React ולהעלות לענן. אינך צריך לשלוח בצ׳אט סיסמאות או מפתחות.

## 1. חילוץ ופתיחה

1. חלץ את ה־ZIP. תתקבל תיקייה בשם `escape-room-server`.
2. פתח אותה ב־VS Code באמצעות File → Open Folder.
3. פתח Terminal → New Terminal. ודא שהטרמינל נמצא בתיקייה שבה `package.json`.
4. בדוק `node --version`. הפרויקט מכוון ל־Node.js 24. אם יש לך Node 22, התקן Node 24 לפני ההפעלה.
5. הרץ `npm.cmd ci`. ההתקנה משתמשת בגרסאות שב־package-lock.json.
6. הרץ `Copy-Item .env.example .env`.

ב־PowerShell אנחנו משתמשים ב־`npm.cmd` כדי להימנע מחסימת npm.ps1. ב־macOS/Linux אפשר להשתמש ב־`npm` וב־`cp .env.example .env`.

## 2. בחירת מסד הנתונים

אפשרות א — Supabase: מסד בענן, כשהשרת עצמו יכול להישאר מקומי.

1. פתח https://supabase.com/dashboard וצור חשבון או התחבר.
2. צור פרויקט חדש במסלול Free. בחר שם, אזור וסיסמת מסד חזקה ושמור אותה אצלך.
3. בחר Connect ובדוק את אפשרויות החיבור למסד. לצורך שרת Node קבוע אפשר להשתמש ב־Session pooler, ובפרט כשהרשת תומכת IPv4 בלבד. העתק את הכתובת שהמערכת מציגה; אל תנחש את שם המארח או האזור.
4. החלף את מציין הסיסמה בסיסמה שלך. אם יש בסיסמה תווים מיוחדים, יש לקודד אותם לכתובת URL.
5. הוסף לפרמטרי הכתובת `schema=escape_room&connection_limit=3&sslmode=require`. אם אין `?` בכתובת, הוסף אותו לפני הפרמטר הראשון; אם יש, השתמש ב־`&`.
6. שים את הכתובת ב־`DATABASE_URL`. אפשר לשים את אותה כתובת Session pooler גם ב־`DIRECT_URL`. אין להשתמש ב־Transaction pooler עבור מיגרציות. חיבור ישיר זמין גם הוא, אם הרשת תומכת בו.
7. ב־Data API אל תוסיף את `escape_room` לרשימת Exposed schemas. אין לקליינט צורך בגישה ישירה לטבלאות. ה־Migration גם מפעיל RLS ללא מדיניות לקוראי API.

אפשרות ב — PostgreSQL מקומי:

אם כבר מותקן אצלך PostgreSQL עם pgAdmin, צור משתמש Login בשם `escape_room_app`, ללא Superuser, ומסד בשם `escape_room` בבעלותו. השתמש בכתובת המבנה הבא בשני משתני החיבור, עם הערכים שלך:

```text
postgresql://escape_room_app:YOUR_PASSWORD@localhost:5432/escape_room?schema=escape_room
```

אין צורך ב־Supabase Database במקרה הזה. להעלאת תמונות באמצעות השרת עדיין נדרש Supabase Storage. אפשר לבדוק את המשחק מקומית עם התמונה שב־assets גם לפני שהגדרת Storage.

## 3. אחסון תמונות ב־Supabase

1. בפרויקט Supabase פתח Storage וצור Bucket בשם `room-images`.
2. הגדר אותו כ־Public: תמונות החדר עצמן מיועדות לצפייה. אין ליצור מדיניות שמאפשרת לאורחים להעלות או למחוק קבצים.
3. השרת שומר תמונות כ־WebP; אם מגדירים סוגי קבצים מותרים ב־Bucket, יש להתיר `image/webp`. מגבלת הגודל של ה־Bucket צריכה לאפשר את תמונת הפלט.
4. העתק את Project URL ל־`SUPABASE_URL` ואת מפתח השרת `service_role` ל־`SUPABASE_SERVICE_ROLE_KEY`. שמות המסכים המדויקים עשויים להשתנות; חפש את הגדרות API Keys של הפרויקט. נדרשת הרשאת שרת, לא anon/public key.
5. השאר `SUPABASE_STORAGE_BUCKET=room-images`.

המפתח הזה נשאר רק ב־`.env` של השרת או במשתני Render. הוא אינו שייך ל־React ואסור לשים אותו במשתנה ששמו מתחיל ב־`VITE_`.

## 4. השלמת הגדרות מקומיות

- `PORT=3000`.
- `NODE_ENV=development`.
- `CORS_ORIGINS=http://localhost:5173` — אם Vite פועל בפורט אחר, שנה בהתאם. ללא לוכסן בסוף. לכמה כתובות, הפרד בפסיקים.
- `TRUST_PROXY=0` במחשב המקומי.
- `JWT_SECRET` — מחרוזת אקראית ארוכה. אפשר ליצור מקומית באמצעות:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

העתק את התוצאה ל־`.env`. אל תעלה אותו ל־GitHub.

ליצירת מנהל מלא גם `ADMIN_NAME`,‏ `ADMIN_EMAIL` ו־`ADMIN_PASSWORD`. סיסמה באורך 10 תווים לפחות, עד 72 בתים ב־UTF-8. השתמש בסיסמה משלך, לא בסיסמה מדוגמה בתיעוד.

## 5. יצירת הטבלאות והמנהל

הרץ, פקודה אחת בכל פעם:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run admin:create
```

הפקודה האחרונה יוצרת מנהל חדש בלבד. היא אינה הופכת חשבון קיים למנהל ואינה דורסת סיסמה. אם האימייל כבר נרשם כשחקן, בחר אימייל אחר למנהל.

לאחר ההצלחה מחק את ערך `ADMIN_PASSWORD` מהקובץ. יצירת חשבון מנהל אינה מתבצעת אוטומטית בפריסה.

## 6. נתוני הדגמה ותמונה

כל הנתונים מומצאים. ה־Seed יוצר שלושה חדרים: „התיק שלא נשלח” ושני חדרי תרגול קצרים עבור חיפוש וסינון. חדרי התרגול משתמשים באותו רקע; אפשר להחליף תמונה דרך הניהול. חזרה על הפקודה לא תדרוס חדרים קיימים.

לבדיקה מקומית:

1. העתק `assets/detective-office.png` לתוך `public/images/` בפרויקט React שלך.
2. הרץ את React בפורט 5173. כתובת התמונה תהיה `http://localhost:5173/images/detective-office.png`.
3. השאר את `DEMO_IMAGE_URL` ריק והריץ `npm.cmd run db:seed`.
4. אם אתה רוצה גם שחקן לדוגמה, מלא לפני ההרצה `DEMO_PLAYER_EMAIL` ו־`DEMO_PLAYER_PASSWORD`. לחלופין, הירשם דרך Swagger. אין סיסמאות מוכנות וקבועות.

לשימוש בענן:

1. הרץ `npm.cmd run dev`, היכנס ל־Swagger והתחבר כמנהל.
2. העלה את התמונה דרך `POST /api/admin/uploads`.
3. העתק את `imageUrl` שהתקבל אל `DEMO_IMAGE_URL` ואז הרץ את ה־Seed. בסביבת production חובה להגדיר אותו.
4. אם כבר יצרת את החדרים מקומית באותו מסד, ה־Seed לא יעדכן אותם: שנה את `imageUrl` של כל חדר דרך PATCH.

המספר 24 מוצג בטקסט של נקודת התמונה, ולא מסתמכים על כך שהמספר קריא ברקע. מיקומי הנקודות הותאמו לתמונה המצורפת; אפשר לדייק אותם בעורך שלך.

## 7. הפעלה ובדיקה ב־Swagger

```powershell
npm.cmd run dev
```

1. פתח http://localhost:3000/api/health — צפוי `{"status":"ok"}`.
2. פתח http://localhost:3000/api-docs.
3. פתח `POST /api/auth/login`, לחץ Try it out, הזן את אימייל וסיסמת המנהל שיצרת ולחץ Execute.
4. העתק את `token` מהתשובה. לחץ Authorize בראש הדף והדבק את ה־Token בלבד, בלי לכתוב `Bearer` לפניו.
5. נסה `GET /api/auth/me` ואת `GET /api/rooms`.
6. העתק מזהה חדר והפעל `POST /api/rooms/{id}/game`.
7. שמור את ערך `revision` המוחזר. הוא נדרש בשליחת תשובה ובאיפוס.
8. פתח נקודה דרך `GET .../hotspots/{hotspotId}` ושלח פתרון דרך `POST .../answer`.
9. כדי לבדוק הרשאות, הירשם כשחקן, החלף Token ב־Authorize ונסה פעולת ניהול: תקבל 403. הסרת Token תגרום ל־401.

את כל פרטי החדר והתשובות ניתן לראות כמנהל בלבד ב־`GET /api/admin/rooms/{id}`. זה גם מאפשר לוודא שפעולת הוספה נשמרה במסד. אפשר לבדוק את הטבלאות גם ב־pgAdmin או בממשק מסד הנתונים.

## 8. העלאה ל־GitHub

1. פתח חשבון ב־https://github.com אם אין לך.
2. צור Repository חדש בשם `escape-room-server`. אפשר לבחור Private.
3. באתר המאגר השתמש ב־Add file → Upload files, או בקישור upload files במאגר ריק.
4. גרור את תוכן תיקיית השרת, כך ש־`package.json` ו־`render.yaml` יהיו בשורש המאגר, ולא בתוך תיקייה נוספת.
5. העלה `src`,‏ `prisma`,‏ `docs`,‏ `tests`,‏ קובצי ההגדרות והמדריכים. התמונה ב־assets אופציונלית לפריסה.
6. אל תעלה `node_modules`,‏ `dist`,‏ `.env` אמיתי או קבצים עם סיסמאות. העלה `.env.example` ו־`.gitignore`. שים לב: בהעלאה ידנית בדפדפן אין להסתמך על .gitignore שיסנן עבורך את הקבצים.
7. שמור את ההעלאה באמצעות Commit changes ובדוק שקיימים `package.json`,‏ `package-lock.json`,‏ `src/server.ts` ו־`prisma/migrations`.

## 9. העלאה ל־Render

הפרויקט לא נפרס אוטומטית. ההגדרות מוכנות, אך צריך חשבון שלך וחיבור למאגר.

1. פתח https://dashboard.render.com והתחבר ל־GitHub.
2. בחר New → Web Service ובחר את המאגר.
3. Runtime: Node. אם העלית את התוכן לשורש, השאר Root Directory ריק.
4. Build Command:

```text
npm ci --include=dev && npm run db:generate && npm run build
```

5. Start Command:

```text
npm run db:migrate && npm start
```

6. בחר Instance Type: Free, לאחר עיון במגבלות המוצגות בחשבון.
7. ב־Environment הגדר:

| משתנה | ערך |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `TRUST_PROXY` | `1` |
| `DATABASE_URL` | כתובת מסד הענן שלך עם הסכמה `escape_room` |
| `DIRECT_URL` | כתובת המתאימה למיגרציות; Session pooler או direct |
| `JWT_SECRET` | סוד אקראי ארוך, שיצרת בעצמך |
| `CORS_ORIGINS` | כתובת React, או `http://localhost:5173` כשהקליינט מקומי |
| `SUPABASE_URL` | כתובת פרויקט Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | מפתח שרת פרטי |
| `SUPABASE_STORAGE_BUCKET` | `room-images` |

אין צורך להגדיר PORT; השרת קורא את הפורט ש־Render מספק. הגדר Health Check Path ל־`/api/health` אם השדה מוצג.

8. צור את השירות והמתן לסיום הפריסה. מיגרציות רצות בתחילת ההפעלה; אין כאן צורך בפקודת Pre-deploy בתשלום.
9. בדוק בכתובת שקיבלת את `/api/health` ואת `/api-docs`.
10. אם טרם נוצר מנהל במסד הענן, הרץ `admin:create` מהמחשב שלך כשה־`.env` מחובר לאותו מסד. אין צורך ב־Shell של Render.

אפשר גם להשתמש ב־New → Blueprint ולבחור את המאגר. `render.yaml` מגדיר את אותו שירות ומבקש את הסודות בהקמה. בדיקת מבנה ה־YAML בוצעה; לא בוצעה פריסה בחשבון שלך.

שמות הכפתורים מבוססים על התיעוד הזמין בעת ההכנה, ולא על כניסה לחשבון שלך. אם הממשק שונה, עצור באותו מסך והיעזר בשמות ההגדרות לעיל.

## 10. עלויות ומגבלות

נבדק מול התיעוד ב־27.10.2026: Render מציע Web Service חינמי שנרדם לאחר חוסר פעילות, ולכן הבקשה הראשונה עשויה להתעכב. מסלול Supabase Free מוגבל בנפח ובתעבורה ויכול להשהות פרויקט לא פעיל. אין הבטחה שהמסלולים יישארו ללא שינוי. בדוק את המסלול לפני יצירה, ואל בחר שדרוג בתשלום לצורך הפרויקט.

לא משתמשים בדיסק המקומי של Render לאחסון תמונות, משום שהקבצים אינם נשמרים שם באופן קבוע. אם שירות ענן אינו נגיש דרך נטפרי או שהמסלול אינו מתאים, אפשר להמשיך להריץ Node ו־PostgreSQL מקומית; שירות העלאת התמונות דורש גישה ל־Supabase. NetFree עשוי לדרוש בדיקה של דומיין השירות או התמונות — לא נבדקה נגישות מהרשת שלך.

מקורות: [Render Free](https://render.com/docs/free), [Supabase Pricing](https://supabase.com/pricing), [Prisma + Supabase](https://supabase.com/docs/guides/database/prisma), [Render Environment](https://render.com/docs/configure-environment-variables), [Supabase Data API Security](https://supabase.com/docs/guides/api/securing-your-api).

## 11. פתרון תקלות

| תקלה | מה לבדוק |
|---|---|
| Missing script / package.json not found | אתה בתיקיית escape-room-server, לא בתיקיית האב |
| npm.ps1 חסום | השתמש ב־npm.cmd |
| Node engine mismatch | התקן Node 24 ופתח טרמינל חדש |
| Prisma client missing | הרץ db:generate אחרי npm ci |
| DATABASE_URL / P1001 | כתובת, סיסמה, קידוד תווים, חיבור רשת ו־Session pooler |
| Permission denied / RLS | התחבר במשתמש שהוא בעל הטבלאות והסכמה; לא במפתח anon |
| JWT_SECRET invalid | החלף את מציין המקום בסוד אקראי של 32 תווים לפחות |
| 401 | התחבר מחדש והכנס Token תקף ב־Authorize |
| 403 | בדוק תפקיד מנהל; או CORS_ORIGINS אם הקוד הוא CORS_REJECTED |
| 409 ROOM_NOT_READY | נדרשת חידת סיום אחת וחידות תקינות |
| 409 ROOM_CHANGED | מנהל ערך את החדר; טען מחדש והתחל משחק מעודכן |
| 409 HAS_DEPENDENTS | הסר קישורי תלות לפני מחיקת חידה |
| 413 בהעלאה | הקובץ גדול מ־5MB |
| 400 INVALID_IMAGE | צריך JPEG/PNG/WebP תקין ולא מונפש, עד 25 מיליון פיקסלים |
| 502 UPLOAD_FAILED | שם Bucket, מפתח שרת, הרשאות ומגבלות אחסון |
| 503 STORAGE_NOT_CONFIGURED | מלא משתני Supabase בשרת |
| תמונה לא נטענת | בדוק כתובת מלאה, Bucket ציבורי, Vite פעיל לתמונה מקומית או חסימת רשת |
| Swagger לא נפתח | בדוק שהשרת פעיל ושקיימת docs/openapi.json |
| Build Failed ב־Render | ודא שה־lockfile הועלה ושלא דילגת על devDependencies בבנייה |
| התחברות קיימת חדלה לעבוד לאחר פריסה | JWT_SECRET השתנה או ה־Token פג |
