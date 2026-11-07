# Sky Nexus Hub — سياق المشروع والتسليم

**ملاحظة زمنية:** هذا السياق يسجل ما راجعناه في 2026-10-15. اعتبر الملفات وحالة Git وإعدادات النشر هي المصدر الحالي، وأعد التحقق قبل التعديل أو النشر.

## المشروع

- المستودع: `https://github.com/elgiza2/sky-nexus-hub`
- الفرع الذي فُحص: `main`، والـremote المسمى `origin` يشير للمستودع نفسه.
- التطبيق React/Vite/SSR مع Supabase Edge Functions.
- هذه المهارة حُزمت خارج المستودع في `/home/ubuntu/skills/sky-nexus-hub-maintainer/`؛ إذا احتاج المستخدم إلى نسخة محفوظة داخل المستودع، أضفها له بعد فحص التغييرات القائمة بدل افتراض ذلك.

## القرار المعماري المطلوب

المستخدم يريد من **Fast Agent** أن يفكر في الرسالة ويقرر بنفسه الرد أو التصعيد؛ لا تريد الواجهة اختيار المسار بناءً على كلمات مثل «صورة/فيديو/بحث». حافظ على هذا الفصل:

1. **Fast Chat / Fast Agent** هو نقطة البداية للرسائل النصية العادية.
2. نموذج `chat-fast` يستطيع الرد مباشرة أو إصدار sentinel داخلي للتصعيد. لا تعرض sentinel في نص المحادثة.
3. التصعيد من `chat-fast` يذهب إلى مسار الدردشة الكامل (`chat-alibaba` / الأدوات الكاملة)، **وليس** إلى جلسة AgentSky تلقائيًا.
4. المستخدم يظل صاحب القرار عند اختيار وضع متخصص أو وكيل/نموذج صراحةً. لا تُعد توجيه اختيار صريح بصمت.
5. Fast Chat نصّي حاليًا؛ لا تدّع أن النموذج السريع فحص الصور المرفقة. طلب صورة/فيديو مكتوب كنص يمر أولًا بقرار النموذج في الوضع العادي، أما المرفقات/الأوضاع المختارة صراحةً فلها حدود المسار الخاص.

## الملفات المحورية

- `src/pages/chat/ChatPage.tsx`: تجهيز الإرسال والمسارات الصريحة؛ لا تضف كشف نية أمامي يعترض الدردشة العادية قبل Fast Chat.
- `src/lib/chat/shouldUseFastChat.ts`: أهلية الرسائل النصية للمسار السريع.
- `src/lib/chat/fastChat.ts`: عميل SSE وتحليل reasoning/sentinel.
- `src/lib/streamChat.ts`: محاولة Fast Chat ثم مواصلة المسار الكامل عند إشارة التصعيد.
- `supabase/functions/chat-fast/index.ts`: تنفيذ ومطالبات النموذج السريع وقرار التصعيد.
- `src/pages/chat/services/runChatStreamTurn.ts`: استهلاك البث وعرض التفكير/الأدوات.
- `src/pages/chat/services/runAgentSkyTurn.ts`: تشغيل جلسة AgentSky/OpenClaw والـSSE ومراحل الجلسة.
- `src/lib/agentsky/client.ts`: واجهة `/api/agent/*`.
- `src/pages/chat/services/runComputerTurn.ts`: تشغيل مهمة Browser Use Cloud عبر خدمة Computer Agent الحالية.
- `src/lib/agentsky/fallbackPolicy.ts`: سياسة آمنة لاختيار fallback.
- `supabase/functions/_shared/cloudAgents.ts`: Browser Use Cloud API من جهة الخادم، تدوير المفاتيح وبعض بدائل النموذج الموجودة.
- `docs/agent-routing-and-models.md`: دليل للمستخدم عن الوكلاء/النماذج/الأدوات ومسارات التنفيذ.
- `plan.md` و`TODO.md`: سجل الخطة ونتائج التنفيذ والقيود.

## ما نُفذ في هذه الجولة السابقة

- إزالة استبعاد الكلمات المفتاحية للوسائط من أهلية Fast Chat، وإزالة توجيه الواجهة الأمامية التلقائي الذي كان يسبق قرار Fast Agent.
- إصلاح اعتراض عام في `ChatPage.tsx` كان يحوّل الرسائل العادية إلى `runComputerTurn` قبل Fast Chat.
- جعل التفكير والرّد حدثين منفصلين، وإعادة تفعيل حالة التفكير عند وصول reasoning، وتقوية محلل SSE لقبول `data:` مع/من دون مسافة ومعالجة الإطار الأخير حتى دون newline نهائي، مع flush لـUTF-8 decoder.
- إزالة تحويل النصوص إلى مسار البحث العميق من الواجهة حتى يقرر Fast Agent التصعيد؛ الأوضاع الصريحة محفوظة.
- إضافة fallback عند فشل AgentSky: مهلة خمول للبث ومحاولات reconnect محدودة، ثم تجربة Browser Use Cloud الداخلي عند أخطاء مؤقتة/شبكية (`408`, `425`, `429`, `5xx` أو تعطل شبكة/stream). يمر fallback عبر Computer Agent server/API ومفاتيح الخادم، وليس فتح `https://cloud.browser-use.com/signin` أو تسجيل دخول يدوي.
- منع تكرار المهمة إذا كان هناك نص مرئي أو خطوة/أداة منفذة؛ وعدم fallback لتجاوز رفض الصلاحيات/الخطة أو فشل مسار الوسائط. يعاد استخدام فقاعة الرسائل نفسها في المحاولة الاحتياطية؛ ينظف loading/thinking بعد تسليمها.
- أُضيفت اختبارات لسلوك fallback، مع تحديث اختبارات AgentSky/fast-chat، ودليل المعمارية.

## سياسة السلامة وحدود التغطية

- لا تعِد مهمة AgentSky بعد أي أثر مرئي أو تنفيذ فعل/أداة؛ إعادة المهمة قد تكرر آثارًا خارجية.
- لا تستخدم Browser Use للتحايل على 401/403 أو رفض اشتراك/خطة أو سياسات وسائط.
- fallback يعتمد على إعداد/مفتاح Browser Use صالح في مخزن الخادم (`browser_use_keys` أو مصادر الخادم الاحتياطية/secret). لا تطلب من المستخدم إرسال المفتاح في المحادثة ولا تكشف قيمه.
- إذا فشل Browser Use نفسه، أظهر الفشل بوضوح؛ لا تدوّر في loop غير محدود. لا يوجد في هذا التغيير ضمان لمزوّد ثالث بعد Browser Use.
- AgentSky وFast Chat مساران مختلفان. لا تخلط fallback من AgentSky مع sentinel الخاص بـFast Chat.

## التحقق السابق

- `npx vitest run src/lib/agentsky/fallbackPolicy.test.ts src/pages/chat/services/runAgentSkyTurn.test.ts src/lib/chat/shouldUseFastChat.test.ts src/lib/chat/fastChat.test.ts src/lib/agentsky/mediaPolicy.test.ts`: **23 اختبارًا ناجحًا**.
- `npm run build`: نجح بعد تنفيذ تغييرات fallback الأساسية.
- ESLint وPrettier نجحا على الملفات المساعدة التي فُحصت، و`git diff --check` كان نظيفًا.
- `npm run lint` الشامل للمستودع سبق أن أعطى عددًا كبيرًا من أخطاء/ملاحظات قديمة في ملفات غير مرتبطة؛ لا تعالجها بإعادة تنسيق جماعية أثناء مهمة محدودة.

## حالة Git/Vercel المسجلة عند إنشاء handoff

- Git branch: `main`، remote: `origin`، ولا تُضمّن build artifacts أو أسرارًا في commit.
- لم يكن هناك `.vercel/project.json` ولا Vercel CLI مثبت في بيئة Sandbox عند الفحص.
- تكامل Vercel MCP أفاد بأنه يتطلب تسجيل دخول قبل عرض أدواته؛ لذلك **النشر لم يكتمل** في تلك اللحظة. أكمل دخول Vercel عبر التدفق المخصص، ثم تحقّق من المشروع/فريق النشر والفرع/البيئة المطلوبة قبل deploy. إذا ظهر أن المشروع غير مربوط أو أن الإنتاج/preview ملتبس، أوقف النشر واسأل عن الاختيار الناقص.
- افحص حالة Git عند استئناف العمل؛ قد يكون الـcommit/push قد تم بعد إنشاء هذا المرجع.
