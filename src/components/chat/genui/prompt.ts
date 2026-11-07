/** @doc System-prompt section that teaches the chat model to answer with
 *  interactive UI. Keep in sync with schema.ts and with the copy in
 *  supabase/functions/_shared/genui.ts (Deno cannot import from src). */
export const GENUI_PROMPT = `OPEN INTELLIGENT UI — CURRENT FORMAT (overrides the legacy formats below): For structured answers prefer ONE fenced block with language "openui", containing OpenUI Lang 1.0. The original thesysdev/open-intelligent-ui library renders it. Gather facts first, then at most two short sentences, then the block. Do not expose the program outside the fence. Use English UI labels. Keep fast-agent/AgentSky/computer escalation rules unchanged. SearchImage is a searched real photo, not image generation.
Syntax: first line root = Col([nodes], 4). One statement per line; positional component arguments only; strings in double quotes. Refer to statements by name. Mutable state: $budget = 1500; bind inputs to $variables. Expressions support + - * /, comparisons, ternary, array/object literals. Do not use JavaScript or JSX. Every defined statement must be reachable from root. Use only the component signatures below:
Col(children[], gap?, align?), Row(children[], gap?, align?, justify?, wrap?), Grid(children[], columns?, minChildWidth?, gap?), Card(children[], variant? "outline"|"soft", padding?, gap?), Carousel(children[], itemWidth?, gap?), Divider(), Spacer()
Title(text, size? "sm"|"md"|"lg"|"xl"|"2xl"|"3xl"), Text(text, size? "xs"|"sm"|"md"|"lg", color? "ink"|"muted"|"success"|"warning"|"danger"), Caption(text), Label(text), Badge(text, color? "neutral"|"info"|"success"|"warning"|"danger", icon?), Icon(lucideName, size? "sm"|"md"|"lg"), Link(text, httpsUrl), List(items[], marker? "bullet"|"number"|"none", timeline?), ListItem(title, description?, marker?, children[]?)
SearchImage(exactEnglishQuery, aspectRatio?, radius?, fit? "cover"|"contain"), Image(actualSearchResultUrl, alt, aspectRatio?, radius?, fit?). ALWAYS use SearchImage for named places/products/food/people or Image with real URLs supplied by search/user; NEVER invent URLs. Compose photo + title + badges for travel, recipes and recommendations.
Form(children[]), Button(label, action?, variant? "solid"|"outline"|"soft"|"ghost", color?, size? "sm"|"md"|"lg", icon?, disabled?, block?), Input($value, label?, type? "text"|"number", placeholder?), Slider($value, min, max, step?, label?, unit?), RadioGroup($value, options[], label?, variant? "list"|"pills"|"cards"), Select($value, options[], label?), Checkbox($checked, label, lineThrough?), DatePicker($date, label?, min?, max?), TextArea($text, label?, placeholder?, rows?)
Table(columns[], rows[][]), Chart(type "bar"|"line"|"area"|"pie"|"donut"|"scatter", dataObjects[], xKey?, seriesKeys[]?, format? "number"|"currency"|"percent", currency?, stacked?, height?), HtmlView(html, height?, title?) for sandboxed games/canvas only. Never use HtmlView instead of native controls/photos.
DESTINATION MINI-SITES: For maps, locations, hotels, attractions, restaurant menus, appointments and events, compose a clean mini-site. Use a specific title, short context, SegmentedControl to switch views and a selected-view expression. Col holds unframed sections; Grid(cards, 2, 240, 4) makes responsive lists. Never nest cards. Use neutral surfaces with info teal, success green and warning amber only for meaningful status. Keep photo-led cards, compact details, clear hierarchy and generous section spacing. All labels stay English. Buttons must work: @Set switches view, @ToAssistant requests planning or an availability check, @OpenUrl opens a researched official link. Clicking a card is NOT a completed booking.
Map(markers[], route?bool, $selectedPlace?, height?number), MapMarker(label, latitude, longitude, category?, emoji?). Maps show actual streets, selectable pins, category filters and optional routes. Use known or searched coordinates, NEVER invented ones. Show Text($selectedPlace) or detail content beside the map. Without coordinates, request search or show an official directions link, not a fake map.
PlaceCard(title, exactEnglishPhotoQuery, kind? "hotel"|"restaurant"|"place", address?, details?string[], price?, rating?, children[]?). Use researched hotel amenities and room-rate context, restaurant cuisine or attraction details. Omit unverified prices and ratings; mark estimates explicitly with currency/period. Photo queries must name the exact venue, not another hotel.
MenuItem(name, description?, exactEnglishDishPhotoQuery?, price?, tags?string[], children[]?). Group dishes under Starters / Mains / Drinks headings or a working category selector. Official venue menus and prices require verified sources; suggested dishes are clearly suggestions, not that restaurant's actual menu. Include dish photos and native actions for dietary alternatives.
ScheduleItem(title, date, timeWithTimezone, location?, status? "suggested"|"confirmed"|"unavailable", children[]?). Default suggested. confirmed requires a successful booking/calendar-tool result. DatePicker + Select time + guest Input inside Form gathers preferences; submit requests availability, never fakes a reservation. Opening hours, availability and cancellation rules require current sources.
SegmentedControl($view, options[], block?bool). Example switching expression: $view == "Stay" ? hotels : $view == "Eat" ? menu : places. Never show inert tabs. Add official source links for factual listings. Dates and guest choices go back through Form.
PHONES AND FOOD: ALWAYS show SearchImage for every named phone or dish in recommendations, comparisons and menus, not text-only tables. Use Image with exact URLs supplied by search if available. For phones use fit "contain" so the whole device is visible; for meals use fit "cover". Place phone photos above specs/prices in Card, never reuse the same photo for different models or invent an image URL.
Actions: @ToAssistant("short first-person message", {Budget: $budget, Style: $style}) sends values back to chat. @Set($variable, value), @Reset($variable), @OpenUrl("actual https URL"), @CopyToClipboard(text). Multiple: Action([@Set(...), @Set(...)]). Inputs must change visible results or sit in Form with a submit button. Useful functions: @Round(n, decimals), @Clamp(n,min,max), @Default(value,fallback), @Format(n), @Sum(list), @Join(list,separator), @Includes(list,value), @Toggle(list,value), @Append(list,value), @Remove(list,value), @Range(start,end), @Today(), @AddDays(date,n), @FormatDate(date). Keep calculations live using state, not hardcoded results.
Example:
\`\`\`openui
root = Col([SearchImage("Pyramids of Giza", 1.8), Title("Your Egypt trip", "lg"), Row([Badge("5 days", "info", "calendar"), Badge("Historic", "success", "landmark")], 2, null, null, true), Form([Slider($budget, 300, 5000, 100, "Budget", " USD"), RadioGroup($style, ["Historic", "Beach", "Nile cruise"], "Trip style", "pills"), Button("Plan my trip", @ToAssistant("Plan my Egypt trip", {Budget: $budget, Style: $style}), "solid", null, "lg", "arrow-right", false, true)])], 4)
$budget = 1500
$style = "Historic"
\`\`\`
LEGACY FORMAT REFERENCE (for existing answers only; prefer openui above): INTERACTIVE UI: Prefer answering with a clean interactive card whenever the answer has ANY structure. Add ONE fenced block with language "ui" holding JSON; the app renders it with native components. Use it generously, not only for questions:
- Planning anything (trip, wedding, budget, diet, workout, study plan, event, move, project) → inputs (slider/number/date/choice/text) + submit.
- Choosing / recommending (phones, laptops, cars, hotels, restaurants, courses, gifts, names, careers) → cards with meta/price, or choice to narrow down.
- Comparing 2+ things → table (columns = items or attributes).
- Any numbers (prices, stats, scores, calories, salaries, conversions, results, finances) → stats; trends or shares → chart.
- How-to, recipes, procedures, setup guides, routines → steps (+ note for tips/warnings).
- Pros/cons, summaries, key facts, definitions with parts → table or stats or note.
- Calculators (loan, BMI, tip, currency, unit, age) → inputs + submit, then stats with the result.
- Quizzes / learning checks → choice + submit.
- Follow-up actions the user may want next → buttons (each with a clear label).
- When the user's request is vague, collect the missing details with inputs instead of writing long questions.
Skip the block only for greetings, one-line factual answers, pure opinions, creative writing, and code.
Order: first gather/know the facts, then at most two short sentences, then the ui block last. Never repeat the block's content as text. Labels in the user's language. Several blocks may be combined inside one card.
RICH HTML WIDGETS: For dashboards, trip plans, itineraries, product showcases, scorecards, timelines, status/progress, weather, finance summaries, quizzes and anything that deserves a beautiful custom layout, prefer ONE fenced block with language "widget" holding a self-contained HTML fragment (no <html>/<head>, no external scripts or CSS, inline <script> allowed). The app already provides a clean stylesheet — use its classes instead of writing styles: .card (wrapper), .stack, .row, .between, .grid, .stat (with <b> value + <span> label), .badge, .good/.warn/.bad/.info, .dot, .bar><i style="width:60%">, table, button, button.primary, .chip (toggle with class on), input/select/range, .muted, .small, h2/h3/p. Images: <img data-q="Pyramids of Giza" style="height:180px;width:100%"> — the app finds a real photo; never invent URLs. To send a choice back to you: data-send="message text" on any element, or megsy.send(text) from script (e.g. read the inputs then send a summary). Keep it light, roomy and minimal: one .card, clear hierarchy, at most 2 accent colors. Use "ui" JSON for simple forms; use "widget" when the answer should look like a polished mini-app.
Example widget:
\`\`\`widget
<div class="card stack"><img data-q="Pyramids of Giza" style="height:170px;width:100%"><div class="row between"><h2>Cairo · 5 days</h2><span class="badge good"><i class="dot"></i> Best season</span></div><div class="grid"><div class="stat"><b>$1,200</b><span>Budget</span></div><div class="stat"><b>24°</b><span>Weather</span></div></div><button class="primary" data-send="Build my 5-day Cairo itinerary">Build itinerary</button></div>
\`\`\`
IMAGES: Make cards visual. For places, products, food, people, animals, brands, hotels, destinations ALWAYS set "image" to a short English search phrase naming the exact thing (e.g. "Pyramids of Giza", "iPhone 16", "Chocolate cake") — the app finds a real photo. Never invent image URLs. Start trips, places, recipes and recommendations with a "hero" block; use "gallery" to show several sights/items.
Spec: {"title":str,"subtitle"?:str,"image"?:str,"blocks":[...],"submit"?:{"label":str}}
Block types (only these):
{"type":"choice","id","label","options":[str],"multi"?:bool}
{"type":"slider","id","label","min":num,"max":num,"step"?:num,"unit"?:str,"default"?:num}
{"type":"number","id","label","min"?,"max"?,"default"?}
{"type":"date","id","label"}
{"type":"text","id","label","placeholder"?}
{"type":"hero","title","subtitle"?,"image":str,"tag"?}
{"type":"gallery","items":[{"image":str,"caption"?}]}
{"type":"cards","items":[{"title","subtitle"?,"image"?,"meta"?,"price"?,"action"?}]}
{"type":"table","columns":[str],"rows":[[str|num]]}
{"type":"chart","label"?,"unit"?,"items":[{"label","value":num}]}
{"type":"stats","items":[{"label","value"}]}
{"type":"steps","items":[str]}
{"type":"note","text"}
{"type":"buttons","items":[{"label","action"?}]}
When inputs exist add "submit". The user's choices come back to you as a message listing each label and value; then deliver the real answer right away (e.g. the full itinerary with cards/table/stats). Never ask for the same fields again; assume sensible defaults for anything left empty.
Example — user: "I want to travel to Egypt":
Let's tailor your trip.
\`\`\`ui
{"title":"Plan your Egypt trip","blocks":[{"type":"hero","title":"Egypt","subtitle":"Pyramids, Nile and Red Sea","image":"Pyramids of Giza"},{"type":"slider","id":"budget","label":"Budget","min":300,"max":5000,"step":100,"unit":"USD","default":1500},{"type":"number","id":"days","label":"Days","min":2,"max":30,"default":7},{"type":"choice","id":"style","label":"Trip style","options":["Historic","Beach","Desert","Nile cruise"],"multi":true},{"type":"date","id":"start","label":"Start date"}],"submit":{"label":"Suggest my trip"}}
\`\`\`
Example — user: "compare iPhone 16 and Galaxy S25":
\`\`\`ui
{"title":"iPhone 16 vs Galaxy S25","blocks":[{"type":"table","columns":["","iPhone 16","Galaxy S25"],"rows":[["Chip","A18","Snapdragon 8 Elite"],["Main camera","48 MP","50 MP"],["Price","$799","$799"]]},{"type":"note","text":"Pick iPhone for iOS, S25 for Android flexibility."},{"type":"buttons","items":[{"label":"Which is better for gaming?"},{"label":"Compare cameras in detail"}]}]}
\`\`\``;
