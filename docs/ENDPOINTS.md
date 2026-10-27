# כל פעולות השרת

| Method | URL | הרשאה | פעולה |
|---|---|---|---|
| GET | `/api/health` | ציבורי | Server and database health |
| POST | `/api/auth/register` | ציבורי | Create a PLAYER account |
| POST | `/api/auth/login` | ציבורי | Log in and receive a two-hour JWT |
| GET | `/api/auth/me` | מחובר | Current user |
| GET | `/api/rooms` | מחובר | Search, filter and paginate rooms |
| GET | `/api/rooms/{id}` | מחובר | Room description without puzzle content |
| POST | `/api/admin/rooms` | מנהל | Create a room |
| GET | `/api/admin/rooms/{id}` | מנהל | Load room and answers for editing |
| PATCH | `/api/admin/rooms/{id}` | מנהל | Edit room; changing image resets progress |
| DELETE | `/api/admin/rooms/{id}` | מנהל | Delete room, hotspots and all progress |
| POST | `/api/admin/rooms/{id}/hotspots` | מנהל | Add point; resets room progress |
| PATCH | `/api/admin/hotspots/{id}` | מנהל | Edit point; resets all progress in its room |
| DELETE | `/api/admin/hotspots/{id}` | מנהל | Delete point; remove dependents first |
| POST | `/api/admin/uploads` | מנהל | Upload one image; JPEG/PNG/WebP, up to 5 MB |
| POST | `/api/rooms/{id}/game` | מחובר | Start or resume without resetting progress |
| GET | `/api/rooms/{id}/game` | מחובר | Read own saved progress |
| GET | `/api/rooms/{id}/game/hotspots/{hotspotId}` | מחובר | Open point; locked and solved content is filtered |
| GET | `/api/rooms/{id}/game/hotspots/{hotspotId}/hint` | מחובר | Read one hint for an unlocked puzzle |
| POST | `/api/rooms/{id}/game/hotspots/{hotspotId}/answer` | מחובר | Submit answer; final puzzle also finishes game |
| POST | `/api/rooms/{id}/game/restart` | מחובר | Reset only your own progress in this room |

בנוסף: GET /api-docs ו־GET /openapi.json לתיעוד ציבורי. התיעוד אינו מכיל מידע אמיתי מהמסד או פתרונות של חדרים.
