# خادم التعاون الحقيقي (Co-op Server)

خادم WebSocket مجاني على **Cloudflare Workers + Durable Objects**.
غرفة واحدة (DungeonRoom) لكل رمز فريق، تزامن:

- مواقع اللاعبين (~30-80ms بدلاً من 450ms+ في Firestore)
- **HP الزعيم المشترك** — الأربعة يستهلكون شريط حياة واحد
- عدّاد القتل المشترك

## النشر (مجاني)

```bash
cd server
npm install
npx wrangler login
npx wrangler deploy
```

بعد النشر ستحصل على رابط مثل:
`wss://sr-coop.<حسابك>.workers.dev`

ثم في اللعبة (أو عبر Console):

```js
localStorage.setItem('coop_server_url', 'wss://sr-coop.YOUR-SUBDOMAIN.workers.dev');
```

(أو عدّل الرابط الافتراضي في `src/services/roomSocket.ts`).

## اختبار محلي

```bash
cd server
npm install
npx wrangler dev
# ثم ضع localStorage.setItem('coop_server_url', 'ws://localhost:8787')
```

## لماذا مجاني؟

خطة Workers المجانية تدعم Durable Objects مع **WebSocket Hibernation**:
الغرفة النائمة (لا يوجد اتصالات نشطة) لا تُحاسب عليها إطلاقاً، والرسائل المجانية
(100k يومياً) تكفي بكثير لفريق يلعب أحياناً.

## البنية

```
Client (roomSocket.ts)  ⇄  WebSocket  ⇄  Worker (index.ts)
                                            └─ DungeonRoom DO (room.ts)
                                                 ├─ players: positions relay
                                                 ├─ boss: authoritative HP
                                                 └─ kills: shared counter
```
