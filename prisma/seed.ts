import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { registerSchema } from "../src/schemas/index.js";
const db = new PrismaClient();
const ids = {
  room: "10000000-0000-4000-8000-000000000001",
  letter: "20000000-0000-4000-8000-000000000001",
  diary: "20000000-0000-4000-8000-000000000002",
  photo: "20000000-0000-4000-8000-000000000003",
  lock: "20000000-0000-4000-8000-000000000004",
  drawer: "20000000-0000-4000-8000-000000000005",
  shelf: "20000000-0000-4000-8000-000000000006",
  safe: "20000000-0000-4000-8000-000000000007",
};
try {
  if (process.env.DEMO_PLAYER_EMAIL && process.env.DEMO_PLAYER_PASSWORD) {
    const p = registerSchema.parse({
      name: "שחקן לדוגמה",
      email: process.env.DEMO_PLAYER_EMAIL,
      password: process.env.DEMO_PLAYER_PASSWORD,
    });
    await db.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        name: p.name,
        email: p.email,
        passwordHash: await bcrypt.hash(p.password, 12),
      },
    });
  }
  if (!(await db.room.findUnique({ where: { id: ids.room } }))) {
    const imageUrl =
      process.env.DEMO_IMAGE_URL ||
      "http://localhost:5173/images/detective-office.png";
    if (process.env.NODE_ENV === "production" && !process.env.DEMO_IMAGE_URL)
      throw new Error(
        "Set DEMO_IMAGE_URL to the uploaded image URL before seeding production.",
      );
    await db.$transaction(async (tx) => {
      await tx.room.create({
        data: {
          id: ids.room,
          title: "התיק שלא נשלח",
          description:
            "החוקר נעלם. מצא את הרמזים במשרד, שחזר את צעדיו ופתח את הכספת.",
          category: "חקירה",
          difficulty: "medium",
          imageUrl,
        },
      });
      const info = [
        {
          id: ids.letter,
          label: "המעטפה",
          xpercent: 33,
          ypercent: 64,
          content:
            "קוד הארון הוא שעת הפגישה עם דוד בארבע ספרות. ביומן השארתי את כל הפרטים.",
        },
        {
          id: ids.diary,
          label: "היומן",
          xpercent: 20,
          ypercent: 67,
          content:
            "16:10 — יצאתי לתחנה. ההליכה ארכה 20 דקות. כשהגעתי, הרכבת עמדה לצאת בעוד 15 דקות. הפגישה עם דוד נקבעה לעשר דקות לפני יציאת הרכבת.",
        },
        {
          id: ids.photo,
          label: "התמונה",
          xpercent: 11,
          ypercent: 57,
          content:
            "בתמונה מופיע בניין מספר 24. מתחת לתמונה כתוב: המשרד הראשון שלי. כאן הכול התחיל.",
        },
      ];
      for (const h of info)
        await tx.hotspot.create({
          data: { ...h, roomId: ids.room, type: "INFO" },
        });
      const puzzles = [
        {
          id: ids.lock,
          label: "מנעול הארון",
          xpercent: 77,
          ypercent: 44,
          question: "מהו קוד הארון? ארבע ספרות.",
          answer: "1635",
          hint: "חשב את שעת ההגעה, הוסף 15 דקות והפחת 10 דקות.",
          solvedContent:
            "הארון נפתח. פתק: התיק החשוב שמור תחת מספר הבית שבו הכול התחיל.",
        },
        {
          id: ids.drawer,
          label: "מגירת התיקים",
          xpercent: 74,
          ypercent: 33,
          question: "מהו מספר התיק?",
          answer: "24",
          prerequisiteId: ids.lock,
          lockedMessage: "המגירה חסומה כל עוד הארון נעול.",
          hint: "בדוק את התמונה ואת הכיתוב שמתחתיה.",
          solvedContent:
            "שמרתי את המסמך בין הספרים.\nנייר בודד מסוכן פחות מתיק שלם.\nידעתי שתחפש במקום הנכון.",
        },
        {
          id: ids.shelf,
          label: "הספרייה",
          xpercent: 30,
          ypercent: 26,
          question: "באיזה מדף לחפש? הזן מספר בספירה מלמעלה.",
          answer: "2",
          prerequisiteId: ids.drawer,
          lockedMessage: "יש כאן ספרים רבים. צריך למצוא תחילה כיוון לחיפוש.",
          hint: "קרא את האות הראשונה בכל שורה במסר שבתיק.",
          solvedContent:
            "קוד הכספת: מספר הבית בשתי ספרות, ואחריו שעת הפגישה בארבע ספרות ללא נקודתיים.",
        },
        {
          id: ids.safe,
          label: "הכספת",
          xpercent: 91,
          ypercent: 53,
          question: "מהו הקוד בן שש הספרות?",
          answer: "241635",
          prerequisiteId: ids.shelf,
          lockedMessage: "עדיין חסר לך הרמז להרכבת הקוד.",
          hint: "השתמש במספר הבית ולאחריו בקוד שפתח את הארון.",
          solvedContent:
            "התיק נמצא! המסמכים מוכיחים שהשריפה בארכיון לא הייתה תאונה. השלמת את המשימה.",
          isFinal: true,
        },
      ];
      for (const h of puzzles)
        await tx.hotspot.create({
          data: {
            ...h,
            roomId: ids.room,
            type: "PUZZLE",
            answerType: "number",
            content: "",
          },
        });
    });
    console.log(
      "Demo room created. Hotspot positions are editable; adjust them to your image.",
    );
  } else
    console.log(
      "Demo room already exists; no content or progress was overwritten.",
    );

  const extraRooms = [
    {
      id: "10000000-0000-4000-8000-000000000002",
      title: "המסר שבמעטפה",
      category: "היגיון",
      difficulty: "easy" as const,
      content: "במכתב נכתב: התחל ב־12, הכפל ב־3, והוסף את מספר ימי השבוע.",
      answer: "43",
      hint: "12 כפול 3 הם 36; הוסף 7.",
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      title: "סוד הארכיון",
      category: "צפנים",
      difficulty: "hard" as const,
      content:
        "ברשימת התיקים נרשמו המספרים 3, 6, 12, 24. מתחת כתוב: המספר הבא הוא קוד המנעול.",
      answer: "48",
      hint: "כל מספר כפול מהמספר שלפניו.",
    },
  ];
  for (const r of extraRooms) {
    if (await db.room.findUnique({ where: { id: r.id } })) continue;
    await db.room.create({
      data: {
        id: r.id,
        title: r.title,
        description: "חדר תרגול קצר לבדיקת המערכת. קרא את המכתב ופתח את הכספת.",
        category: r.category,
        difficulty: r.difficulty,
        imageUrl:
          process.env.DEMO_IMAGE_URL ||
          "http://localhost:5173/images/detective-office.png",
        hotspots: {
          create: [
            {
              type: "INFO",
              label: "המכתב",
              xpercent: 33,
              ypercent: 64,
              content: r.content,
            },
            {
              type: "PUZZLE",
              label: "הכספת",
              xpercent: 91,
              ypercent: 53,
              content: "כספת עם מנעול מספרי",
              question: "מהו הקוד?",
              answerType: "number",
              answer: r.answer,
              hint: r.hint,
              solvedContent: "הכספת נפתחה. השלמת את חדר התרגול!",
              isFinal: true,
            },
          ],
        },
      },
    });
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : "Seed failed");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
