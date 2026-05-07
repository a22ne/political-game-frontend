// 遊戲核心數值與狀態
const API_BASE = window.API_BASE_URL || "";
const apiFetch = (path, options) => fetch(`${API_BASE}${path}`, options);
const ASSET_BASE = window.ASSET_BASE_URL || "./";
const REMOTE_ASSET_BASE = window.REMOTE_ASSET_BASE_URL || API_BASE;
const KNOWN_IMAGE_FILES = new Set([
    "char_ceo.png",
    "char_civil_servant.png",
    "char_councilor.png",
    "char_elder.png",
    "char_general.png",
    "char_generic.png",
    "char_influencer.png",
    "char_journalist.png",
    "char_mayor.png",
    "char_professor.png",
    "char_student.png",
    "char_union.png",
    "city_map.png",
    "event_bribe.png",
    "event_education.png",
    "event_energy.png",
    "event_fakenews.png",
    "event_marriage.png",
    "event_military.png",
    "event_pollution.png",
    "event_ubi.png",
    "event_wage.png",
    "news_accident.png",
    "news_media.png",
    "news_scandal.png"
]);
const CHARACTER_IMAGE_BY_NAME = {
    "柯爾市長": "char_mayor.png",
    "莫長老": "char_elder.png",
    "艾達議員": "char_councilor.png",
    "威廉總裁": "char_ceo.png",
    "莉亞記者": "char_journalist.png",
    "龐頭目": "char_union.png",
    "雷將軍": "char_general.png",
    "費教授": "char_professor.png",
    "蘇網紅": "char_influencer.png",
    "學生運動者": "char_student.png",
    "基層公務員": "char_civil_servant.png",
    "中小企業主": "char_ceo.png"
};

function normalizeBaseUrl(base) {
    if (!base) return "";
    return base.endsWith("/") ? base : `${base}/`;
}

function normalizeImageName(fileName, fallback = "") {
    const raw = String(fileName || fallback || "").trim();
    if (!raw) return "";
    if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
    return raw
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "")
        .replace(/^static\/images\//i, "")
        .replace(/^images\//i, "");
}

function imageAliasFromText(text = "", fallback = "") {
    const value = String(text || "").toLowerCase();
    const pairs = [
        [/mayor|市長|柯爾/, "char_mayor.png"],
        [/elder|長老|莫長老/, "char_elder.png"],
        [/council|議員|艾達/, "char_councilor.png"],
        [/ceo|總裁|企業|威廉/, "char_ceo.png"],
        [/journal|reporter|記者|莉亞/, "char_journalist.png"],
        [/union|工會|頭目|龐頭目/, "char_union.png"],
        [/general|軍|將軍|雷將軍/, "char_general.png"],
        [/professor|教授|費教授/, "char_professor.png"],
        [/influencer|網紅|蘇網紅/, "char_influencer.png"],
        [/student|學生/, "char_student.png"],
        [/civil|公務/, "char_civil_servant.png"],
        [/wage|salary|工資|薪資|罷工/, "event_wage.png"],
        [/education|school|學生|教育|校園/, "event_education.png"],
        [/energy|能源/, "event_energy.png"],
        [/pollution|污染|環境/, "event_pollution.png"],
        [/fakenews|fake|media|網路|假消息|言論|新聞/, "event_fakenews.png"],
        [/bribe|賄|黑箱|貪腐/, "event_bribe.png"],
        [/scandal|醜聞/, "news_scandal.png"],
        [/military|國安|軍事|安全/, "event_military.png"],
        [/marriage|婚姻|平權|家庭/, "event_marriage.png"],
        [/ubi|基本收入|社會福利/, "event_ubi.png"],
        [/accident|事故|意外/, "news_accident.png"]
    ];
    const match = pairs.find(([pattern]) => pattern.test(value));
    return match ? match[1] : fallback;
}

function resolveImageFile(fileName = "", fallback = "char_generic.png", context = "") {
    const normalized = normalizeImageName(fileName);
    if (/^(?:https?:|data:|blob:)/i.test(normalized)) return normalized;
    if (KNOWN_IMAGE_FILES.has(normalized)) return normalized;

    const aliased = imageAliasFromText(`${normalized} ${context}`, "");
    if (aliased) return aliased;

    const fallbackName = normalizeImageName(fallback);
    if (KNOWN_IMAGE_FILES.has(fallbackName)) return fallbackName;
    return fallbackName || "";
}

function imagePath(fileName, fallback = "char_generic.png", base = ASSET_BASE) {
    const normalized = resolveImageFile(fileName, fallback);
    if (!normalized) return "";
    if (/^(?:https?:|data:|blob:)/i.test(normalized)) return normalized;
    return `${normalizeBaseUrl(base)}static/images/${normalized}`;
}

const assetPath = (path) => {
    const normalized = normalizeImageName(path);
    return normalized ? imagePath(normalized, "") : "";
};

function remoteImagePath(fileName) {
    if (!REMOTE_ASSET_BASE || /^(?:https?:|data:|blob:)/i.test(String(fileName || ""))) return "";
    const normalized = normalizeImageName(fileName);
    return normalized ? `${normalizeBaseUrl(REMOTE_ASSET_BASE)}static/images/${normalized}` : "";
}

function setImageSource(img, fileName, fallbackFile = "char_generic.png", fallbackDataUri = "") {
    if (!img) return;
    const original = normalizeImageName(fileName);
    const aliased = imageAliasFromText(`${original} ${img.alt || ""}`, "");
    const resolvedFile = resolveImageFile(fileName, fallbackFile, img.alt || "");
    const localSrc = original && !/^(?:https?:|data:|blob:)/i.test(original) && !aliased && !KNOWN_IMAGE_FILES.has(original)
        ? `${normalizeBaseUrl(ASSET_BASE)}static/images/${original}`
        : imagePath(resolvedFile, fallbackFile);
    const remoteSrc = remoteImagePath(fileName);
    const finalFallback = fallbackDataUri || imagePath(fallbackFile, fallbackFile);

    img.onerror = () => {
        if (remoteSrc && img.src !== remoteSrc) {
            img.src = remoteSrc;
            return;
        }
        img.onerror = null;
        if (finalFallback) {
            img.src = finalFallback;
        } else {
            img.style.display = "none";
        }
    };

    if (localSrc) {
        img.src = localSrc;
    } else if (finalFallback) {
        img.src = finalFallback;
    }
}

function isStudentPlayer() {
    const character = gameState.character || {};
    return [character.name, character.role, character.description]
        .filter(Boolean)
        .some((value) => String(value).includes("學生"));
}

function polishNarrativeText(text = "") {
    return String(text || "")
        .replace(/受協份子/g, "妥協派")
        .replace(
            /遊行最終和平落幕，但政府並未給出實質承諾，工資法案不了了之。/g,
            "遊行和平落幕，但政府只承諾持續研議；工資法案暫時擱置，沒有進入具體承諾階段。"
        )
        .replace(/工資法案不了了之/g, "工資法案暫時擱置，沒有進入具體承諾階段")
        .replace(/不了了之/g, "暫時擱置");
}

function adaptPersuasionConfig(config) {
    if (!config) return config;

    const adapted = {
        ...config,
        persuasion_high: { ...(config.persuasion_high || {}) },
        persuasion_low: { ...(config.persuasion_low || {}) }
    };

    if (isStudentPlayer() && adapted.target === "莫長老") {
        adapted.reason = "莫長老不是要「抵制一個學生」，而是擔心你的街頭倡議把社區帶進世代衝突。他正要求社區場地與長輩組織暫停支援這場行動。";
        adapted.persuasion_high.text = "透過師長與家長代表溝通，把訴求轉成正式程序";
        adapted.persuasion_low.text = "直接開直播點名批評長老守舊";
        adapted.persuasion_high.result_text = "你把衝突從「學生對抗長輩」改成「如何讓訴求進入正式程序」。莫長老仍保留立場，但同意先讓代表旁聽協調，反彈暫時降溫。";
        adapted.persuasion_low.result_text = "公開點名讓支持者覺得痛快，也讓保守社群更防衛。議題焦點從具體改革滑向世代對立，後續溝通成本升高。";
    }

    return adapted;
}

const gameState = {
    playerName: '',
    character: null,
    stats: {
        freedom: 50,
        order: 50,
        progress: 50,
        populism: 20
    },
    locations: [],
    events: [],
    currentEventIndex: 0,
    characters: [],
    npcApprovals: {
        "柯爾市長": 50,
        "莫長老": 50,
        "艾達議員": 50,
        "威廉總裁": 50,
        "莉亞記者": 50,
        "龐頭目": 50,
        "雷將軍": 50,
        "費教授": 50,
        "蘇網紅": 50
    },
    pendingDecision: null,
    memories: [],
    characterArcs: {},
    lastArcChanges: [],
    lastOutcome: null,
    nextHook: null,
    decisionLocked: false,
    persuasionLocked: false,
    appliedDecisionKeys: {},
    npcContinuity: {},
    choiceHistory: [],
    reflectionLog: [],
    behaviorScores: {
        assertiveness: 0,
        cooperation: 0,
        riskTolerance: 0,
        institutionTrust: 0,
        empathy: 0,
        pragmatism: 0,
        conflictAvoidance: 0
    }
};

function escapeHTML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function characterByName(name = "") {
    return gameState.characters.find((character) => character.name === name) || null;
}

function characterImageFile(name = "") {
    const character = characterByName(name);
    const namedFallback = CHARACTER_IMAGE_BY_NAME[name] || "char_generic.png";
    return resolveImageFile(character?.image_filename || namedFallback, namedFallback, `${name} ${character?.role || ""}`);
}

function renderAvatar(name, className = "dialogue-avatar") {
    const fileName = characterImageFile(name);
    return `<img class="${className}" src="${imagePath(fileName, 'char_generic.png')}" data-image-file="${escapeHTML(fileName)}" alt="${escapeHTML(name)}">`;
}

function eventImageFile(event = {}) {
    const context = `${event.title || ""} ${event.description || ""} ${event.image_filename || ""}`;
    return resolveImageFile(event.image_filename, imageAliasFromText(context, "event_fakenews.png"), context);
}

function hydrateDynamicImages(root = document) {
    root.querySelectorAll?.("img[data-image-file]").forEach((img) => {
        const fallback = img.dataset.fallbackImage || (String(img.dataset.imageFile || "").startsWith("event_") ? "event_fakenews.png" : "char_generic.png");
        setImageSource(img, img.dataset.imageFile, fallback);
    });
}

function clearMapHighlights() {
    els.worldMap?.querySelectorAll(".map-pin").forEach((pin) => {
        pin.classList.remove("speaker-active", "speaker-watch");
    });
}

function highlightMapCharacters(names = [], className = "speaker-active") {
    const set = new Set(names.filter(Boolean));
    els.worldMap?.querySelectorAll(".map-pin").forEach((pin) => {
        if (set.has(pin.dataset.characterName)) {
            pin.classList.add(className);
        }
    });
}

function roleProfile() {
    const character = gameState.character || {};
    const text = `${character.name || ""}${character.role || ""}${character.description || ""}`;

    if (text.includes("學生")) {
        return {
            desire: "讓受傷的人得到制度回應，同時避免運動被貼上失控標籤。",
            fear: "支持者覺得你太軟，長輩與校方又覺得你在煽動。",
            throughline: "你的主線不是贏一次抗議，而是把街頭壓力變成校方或市府必須回應的程序。",
            ally: "艾達議員",
            skeptic: "莫長老",
            inbox: [
                ["同學群組", "今晚要不要衝市府？大家都在等你一句話。"],
                ["導師私訊", "你可以抗議，但不要讓學生變成大人政治的燃料。"],
                ["地方新聞", "校園抗爭延燒，市府稱將密切關注公共秩序。"]
            ]
        };
    }

    if (text.includes("企業") || text.includes("商")) {
        return {
            desire: "保住員工與生意，也不想被大財團或街頭輿論綁架。",
            fear: "一邊罵你剝削，一邊逼你表態；任何選擇都可能傷到現金流。",
            throughline: "你的主線是在生存壓力下證明自己不是財團棋子，也不是只會安撫員工的老闆。",
            ally: "威廉總裁",
            skeptic: "龐頭目",
            inbox: [
                ["會計訊息", "如果罷工再拖三天，月底薪資週轉會很緊。"],
                ["員工代表", "大家不是要鬧事，只是想知道老闆站哪邊。"],
                ["商會通知", "今晚有閉門會議，請勿對媒體單獨發言。"]
            ]
        };
    }

    if (text.includes("公務") || text.includes("政府")) {
        return {
            desire: "讓制度撐住，不讓上級卸責，也不讓第一線成為代罪羔羊。",
            fear: "文件流程太慢，輿論太快；你可能同時得罪長官與民眾。",
            throughline: "你的主線是在官僚體系裡找出能簽字、能負責、能把話說清楚的人。",
            ally: "柯爾市長",
            skeptic: "莉亞記者",
            inbox: [
                ["主管提醒", "所有對外說法都要先送審，不要擅自回應記者。"],
                ["匿名同事", "資料其實早就整理好了，只是沒人敢簽。"],
                ["市民投訴", "你們再不處理，我們明天就去市府門口。"]
            ]
        };
    }

    return {
        desire: "在多方壓力中保住自己的立場，並讓議題不要被單一派系吞掉。",
        fear: "你越想居中協調，越可能被兩邊同時懷疑。",
        throughline: "你的主線是在不同陣營互不信任時，找出一條還能被討論的公共路徑。",
        ally: "莉亞記者",
        skeptic: "雷將軍",
        inbox: [
            ["朋友私訊", "你今天最好先想清楚，因為大家都在截圖。"],
            ["新聞推播", "公共議題升溫，多方要求關鍵人物表態。"],
            ["匿名提醒", "有人準備把你的舊發言整理成懶人包。"]
        ]
    };
}

function renderInbox(profile = roleProfile()) {
    return `
        <div class="inbox-stack">
            ${profile.inbox.map(([from, message]) => `
                <article class="inbox-item">
                    <strong>${escapeHTML(from)}</strong>
                    <span>${escapeHTML(message)}</span>
                </article>
            `).join("")}
        </div>`;
}

function renderWorldIntro() {
    const cards = [
        ["威權退場後", "蓬萊共和國重新有了選舉、議會與媒體，但人民對制度的信任還沒有長回來。"],
        ["街頭與議會", "街頭能讓痛苦被看見，議會能把訴求寫成規則；兩者彼此需要，也彼此懷疑。"],
        ["媒體與網路", "每個事件都會被剪輯、轉傳與重新命名。真相不是消失，而是常常被情緒蓋住。"],
        ["舊利益與新世代", "改革不是一句口號。它會改變誰付錢、誰失去權力、誰第一次被聽見。這一切，完全取決於我們用手上的鑰匙打開世界的哪一道門。"]
    ];

    return `
        <div class="intro-brief">
            <b>這不是一場找正確答案的遊戲。</b>
            <span>你會在制度不穩、資訊混亂、利益互相牽制的社會裡做選擇。每一步都可能讓某些人被看見，也讓另一些人承擔代價。</span>
        </div>
        <div class="intro-thread-list">
            ${cards.map(([title, body]) => `
                <span><b>${escapeHTML(title)}</b>${escapeHTML(body)}</span>
            `).join("")}
        </div>`;
}

function roleLeverage() {
    const character = gameState.character || {};
    const text = `${character.name || ""}${character.role || ""}${character.description || ""}`;
    if (text.includes("學生")) return "街頭動員、社群擴散、青年組織，以及把抽象不公變成具體故事的能力。";
    if (text.includes("企業") || text.includes("業主")) return "就業、人脈、資源與地方經濟話語權。你能讓政策成本變得可見。";
    if (text.includes("公務")) return "程序知識、內部資訊與執行經驗。你知道制度在哪裡會卡住。";
    return "你的關係網、公開形象與判斷力。你能把分散的人與事件連成一條線。";
}

function allNpcNames() {
    return [
        "柯爾市長",
        "莫長老",
        "艾達議員",
        "威廉總裁",
        "莉亞記者",
        "龐頭目",
        "雷將軍",
        "費教授",
        "蘇網紅"
    ].filter((name) => name !== gameState.character?.name);
}

function playerRelationshipSeed(name = "") {
    const profile = roleProfile();
    const character = gameState.character || {};
    const text = `${character.name || ""}${character.role || ""}${character.description || ""}`;

    if (name === profile.ally) {
        return {
            open: "他曾給你一個入口，但還不確定你能不能承擔後果。",
            repair: "你把承諾轉成行動，他願意把自己的籌碼押到你身上。",
            rupture: "你讓他承擔了代價卻沒有給出下一步，他會把門重新關上。"
        };
    }
    if (name === profile.skeptic) {
        return {
            open: "他不是單純反對你，而是覺得你可能把局勢推過界。",
            repair: "你證明自己不是只靠聲量，他開始承認你有處理複雜局勢的能力。",
            rupture: "你的選擇踩中他的底線，他會把你當成必須阻止的人。"
        };
    }
    if (text.includes("學生")) {
        const studentSeeds = {
            "柯爾市長": ["市府曾把學生陳情排到議程外，現在他必須判斷你是否真的代表群眾。", "你逼市府正面承認學生訴求，市長會把你納入正式協調。", "他認定你只會製造壓力，後續會用程序拖住你。"],
            "莉亞記者": ["她想報導你，但還不確定你能不能提供可查證的線索。", "你給她時間線與證據，她會讓議題被更多人理解。", "她覺得你把媒體當擴音器，報導會轉向檢視你的動機。"],
            "龐頭目": ["他欣賞你的動員力，但擔心學生最後會拋下基層。", "你讓街頭和基層利益接上，他會把組織力借給你。", "他覺得你只顧形象，會另組更激烈的行動。"]
        };
        if (studentSeeds[name]) {
            const [open, repair, rupture] = studentSeeds[name];
            return { open, repair, rupture };
        }
    }
    if (text.includes("企業") || text.includes("商")) {
        const businessSeeds = {
            "威廉總裁": ["他願意把你帶進商會，但前提是你不要破壞企業陣線。", "你證明中小企業有自己的現實，他會把你視為談判代表。", "他覺得你背離商界共同利益，會把你排除在資源圈外。"],
            "龐頭目": ["他把你看成資方，但也知道你不是大財團。", "你承認員工壓力並提出具體方案，他會讓街頭壓力先降下來。", "他認定你仍然站在資方一邊，會把你變成動員目標。"],
            "莉亞記者": ["她想知道你是被成本困住，還是只是拿成本當藉口。", "你願意公開帳目與困境，她會報導中小企業的夾縫。", "你閃避問題，她會把焦點轉向企業責任。"]
        };
        if (businessSeeds[name]) {
            const [open, repair, rupture] = businessSeeds[name];
            return { open, repair, rupture };
        }
    }
    if (text.includes("公務") || text.includes("政府")) {
        const civilSeeds = {
            "柯爾市長": ["他需要你守住流程，但你知道流程也可能被拿來卸責。", "你幫他把責任說清楚，他會讓你進入決策核心。", "你讓市府難堪，他會把責任往第一線推。"],
            "莉亞記者": ["她懷疑你只是官方說法的一部分，但也知道你可能掌握真資料。", "你提供可查證脈絡，她會把你從官僚形象中拆出來。", "你擋住資訊，她會把你寫成體制沉默的一部分。"],
            "雷將軍": ["他要求穩定，但你擔心安全話語會壓過公共說明。", "你讓安全與透明並行，他會承認你有治理能力。", "你挑戰他的邊界，他會要求更高層級接管。"]
        };
        if (civilSeeds[name]) {
            const [open, repair, rupture] = civilSeeds[name];
            return { open, repair, rupture };
        }
    }

    return {
        open: "你們之間還沒有真正攤牌，他正在觀察你會把局勢推向哪裡。",
        repair: "你的選擇讓他看見合作空間，這段關係開始有了回應。",
        rupture: "你的選擇讓他的成本升高，這段關係轉向防衛。"
    };
}

function renderPlayerRelationshipThreads(profile = roleProfile()) {
    const names = [...new Set([profile.ally, profile.skeptic, "柯爾市長", "莉亞記者"].filter(Boolean))]
        .filter((name) => name !== gameState.character?.name)
        .slice(0, 4);

    return `
        <div class="relationship-seeds">
            <b>未完成的關係</b>
            ${names.map((name) => {
                const seed = playerRelationshipSeed(name);
                return `<span>${escapeHTML(name)}：${escapeHTML(compactText(seed.open, 38))}</span>`;
            }).join("")}
        </div>`;
}

function renderRoleIntro(profile = roleProfile()) {
    return `
        <div class="role-brief expanded">
            <strong>【${escapeHTML(gameState.character.role)}】</strong>
            <p>${escapeHTML(gameState.character.description)}</p>
            <div><b>你的位置：</b>你不是旁觀者，而是被不同陣營拉扯的人。你的每一次表態都會被支持者、反對者與媒體重新解讀。</div>
            <div><b>你真正想改變：</b>${escapeHTML(profile.desire)}</div>
            <div><b>你最怕失去：</b>${escapeHTML(profile.fear)}</div>
            <div><b>你手上的籌碼：</b>${escapeHTML(roleLeverage())}</div>
            <div><b>你的主線：</b>${escapeHTML(profile.throughline)}</div>
            ${renderPlayerRelationshipThreads(profile)}
        </div>
    `;
}

function renderOpeningCast(profile = roleProfile()) {
    const names = [...new Set([profile.ally, profile.skeptic, "柯爾市長", "莉亞記者"].filter(Boolean))]
        .filter((name) => name !== gameState.character?.name)
        .slice(0, 4);

    return `
        <div class="opening-cast">
            ${names.map((name) => {
                const arc = ensureCharacterArc(name);
                return `
                    <article class="cast-card">
                        ${renderAvatar(name, "cast-avatar")}
                        <div>
                            <b>${escapeHTML(name)}</b>
                            <span>${escapeHTML(compactText(arc.goal, 42))}</span>
                            <small>未完成：${escapeHTML(compactText(arc.relation.open, 38))}</small>
                        </div>
                    </article>`;
            }).join("")}
        </div>
        <div class="pressure-note muted">這些人不是單純的支持或反對。他們都有自己的目標，會根據你的選擇改變態度。</div>
    `;
}

function chapterInfo() {
    const total = Math.max(gameState.events.length, 1);
    const turn = gameState.currentEventIndex + 1;
    const ratio = turn / total;

    if (ratio <= 0.25) {
        return {
            label: "第一幕：建立立場",
            pressure: "大家還在判斷你是哪一邊的人。",
            prompt: "這一回合最重要的不是勝利，而是你願意用什麼方式進場。"
        };
    }
    if (ratio <= 0.55) {
        return {
            label: "第二幕：議題升溫",
            pressure: "支持者開始要求更明確的承諾，反對者也在找你的破綻。",
            prompt: "你的選擇會開始留下記錄，後面的人會拿它來要求你一致。"
        };
    }
    if (ratio <= 0.8) {
        return {
            label: "第三幕：反彈與交換",
            pressure: "原本沉默的人開始組織反擊，盟友也會要求你付出代價。",
            prompt: "現在已經不是單純表態，而是要決定你願意犧牲哪一段關係。"
        };
    }
    return {
        label: "終幕：收束或決裂",
        pressure: "每個陣營都想把最後結果寫成自己的勝利。",
        prompt: "最後幾步會決定你留下的是制度成果、動員聲量，還是一串未完成的承諾。"
    };
}

function strongestEffect(effects = {}) {
    const entries = Object.entries(effects).filter(([, value]) => value !== 0);
    if (!entries.length) return ["balance", 0];
    return entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
}

function effectLabel(key) {
    return {
        freedom: "公共發聲",
        order: "秩序與安全",
        progress: "制度改革",
        populism: "情緒動員",
        balance: "局勢平衡"
    }[key] || key;
}

function effectDirection(value) {
    if (value > 0) return "上升";
    if (value < 0) return "下降";
    return "沒有明顯變化";
}

function behaviorScoreTemplate() {
    return {
        assertiveness: 0,
        cooperation: 0,
        riskTolerance: 0,
        institutionTrust: 0,
        empathy: 0,
        pragmatism: 0,
        conflictAvoidance: 0
    };
}

function resetBehaviorTracking() {
    gameState.choiceHistory = [];
    gameState.reflectionLog = [];
    gameState.npcContinuity = {};
    gameState.behaviorScores = behaviorScoreTemplate();
}

function eventArcWeight(event = {}, index = 0) {
    const text = `${event.title || ""} ${event.description || ""} ${event.image_filename || ""}`.toLowerCase();
    let weight = 40;

    if (/wage|education|marriage|ubi|工資|學生|教育|婚姻|基本收入|社會福利/.test(text)) {
        weight = 10;
    } else if (/fakenews|media|scandal|bribe|假新聞|媒體|醜聞|賄賂|黑箱/.test(text)) {
        weight = 35;
    } else if (/pollution|energy|military|污染|能源|軍事|國防|安全/.test(text)) {
        weight = 65;
    }

    if (event.target_role) weight -= 4;
    return weight + index / 100;
}

function smoothStoryEvents(events = []) {
    return events
        .map((event, index) => ({ event, index, weight: eventArcWeight(event, index) }))
        .sort((a, b) => a.weight - b.weight)
        .map(({ event }) => event);
}

function directorChapterBeat(index = 0, total = 1) {
    const ratio = (index + 1) / Math.max(total, 1);
    if (ratio <= 0.25) {
        return {
            label: "立場形成",
            trigger: "選前倒數開始，市府想維持平穩，民間卻覺得自己再不說話就會被忽略。",
            pressure: "每個角色都在判斷你是能合作的人，還是只會讓局勢升溫的人。"
        };
    }
    if (ratio <= 0.55) {
        return {
            label: "議題升溫",
            trigger: "前幾回合留下的承諾開始被拿出來檢查，支持者要求你更明確，反對者也開始結盟。",
            pressure: "你不能再只表態，必須說清楚誰要付成本、誰要被保護。"
        };
    }
    if (ratio <= 0.8) {
        return {
            label: "反彈成形",
            trigger: "原本觀望的人開始被迫站隊，媒體與社群把每個選擇剪成簡短標籤。",
            pressure: "你前面得罪或拉近的人，現在會用自己的方式回到場上。"
        };
    }
    return {
        label: "最後收束",
        trigger: "選前最後一週，所有陣營都想把結果寫成自己的勝利。",
        pressure: "這一刻考驗的不是一次選擇，而是你前面留下的信任、衝突與承諾。"
    };
}

function directorLensTitle(lensLabel = "信任危機") {
    return {
        "責任危機": "事故責任時間線",
        "生計壓力": "生活成本談判",
        "世代衝突": "街頭與社區的邊界",
        "資訊戰": "假消息與查證戰",
        "發展代價": "發展成本誰承擔",
        "安全焦慮": "安全授權與自由界線",
        "價值衝突": "婚姻平權與家庭價值",
        "信任危機": "制度信任破口"
    }[lensLabel] || "制度信任破口";
}

function playerRoleKey() {
    const character = gameState.character || {};
    const text = `${character.name || ""}${character.role || ""}${character.description || ""}`;
    if (text.includes("學生")) return "student";
    if (text.includes("企業") || text.includes("商")) return "business";
    if (text.includes("公務") || text.includes("政府")) return "civil";
    return "citizen";
}

function directorLensForPlayer(baseLens = {}, event = {}) {
    const role = playerRoleKey();
    const label = baseLens.label || "信任危機";
    if (role === "business") {
        const table = {
            "世代衝突": {
                cause: "年輕員工要求透明升遷與合理工時，老員工和地方商家擔心規則改太快，成本會直接壓到店裡。",
                stakes: "推太快，企業可能撐不住；拖太久，年輕員工會覺得又被敷衍。",
                actors: ["龐頭目", "威廉總裁", "莫長老", "莉亞記者"]
            },
            "生計壓力": {
                cause: "薪資、租金和訂單同時擠壓，中小企業與員工都覺得自己在替制度失靈付錢。",
                stakes: "只顧員工，店可能倒；只顧店，員工會把壓力帶上街頭。",
                actors: ["龐頭目", "威廉總裁", "柯爾市長", "莉亞記者"]
            },
            "責任危機": {
                cause: "事故或失誤發生後，市府、企業和現場管理者都被要求說明誰早就知道風險。",
                stakes: "查清楚會得罪人；不查清楚，企業與市府的信任會一起下滑。",
                actors: ["柯爾市長", "莉亞記者", "威廉總裁", "費教授"]
            }
        };
        if (table[label]) return { ...baseLens, ...table[label] };
    }

    if (role === "civil") {
        const table = {
            "世代衝突": {
                cause: "學生和年輕公民要求更快回應，長官與社區要求第一線先穩住場面。",
                stakes: "你太快推動會得罪長官；太慢回應會讓民眾覺得公務體系只會拖。",
                actors: ["柯爾市長", "艾達議員", "莫長老", "莉亞記者"]
            },
            "責任危機": {
                cause: "事故發生後，第一線資料、上級指示和公開說法彼此對不上。",
                stakes: "說太少會變成遮掩；說太多可能被上級切割。",
                actors: ["柯爾市長", "莉亞記者", "雷將軍", "費教授"]
            },
            "生計壓力": {
                cause: "民眾要求補助與調薪，上級卻要求你用有限預算交出結果。",
                stakes: "承諾太多會爆預算；承諾太少會讓民怨回到第一線窗口。",
                actors: ["柯爾市長", "龐頭目", "艾達議員", "費教授"]
            }
        };
        if (table[label]) return { ...baseLens, ...table[label] };
    }

    if (role === "student" && label === "生計壓力") {
        return {
            ...baseLens,
            cause: "工讀、學費與租屋壓力讓學生抗爭不只是價值表態，而是生活已經撐不下去。",
            stakes: "只喊理想會被說不懂現實；只談現實又可能失去改革方向。",
            actors: ["艾達議員", "龐頭目", "莉亞記者", "莫長老"]
        };
    }

    return baseLens;
}

function directorPlayerPosition(event = {}) {
    const role = playerRoleKey();
    const lens = issueLens(event);
    const lines = {
        student: {
            "世代衝突": "你是被推到台前的學生倡議者。這回合的核心不是打倒長輩，而是讓訴求進入可回應的程序。",
            "生計壓力": "你要把學生的生活壓力說清楚，避免運動只被看成情緒表演。",
            default: "你靠動員和敘事讓問題被看見，但也必須承擔失控後果。"
        },
        business: {
            "世代衝突": "你是中小企業主。這回合的核心不是反對年輕人，而是說清楚改變成本誰先扛。",
            "生計壓力": "你同時面對員工、訂單和現金流。你必須讓大家知道，生存壓力不是拒絕改革的藉口。",
            default: "你不是財團，也不是旁觀者。每一次表態都會影響員工、商會與街頭對你的判斷。"
        },
        civil: {
            "責任危機": "你站在第一線。這回合的核心是把責任說清楚，同時不讓上級把你變成代罪者。",
            "資訊戰": "你掌握部分資料，但公開與保密都會有代價。你的難題是讓制度說人話。",
            default: "你知道流程怎麼運作，也知道流程常被拿來拖延。玩家的位置就在這個矛盾裡。"
        },
        citizen: {
            default: "你不是掌控全局的人，但你的表態會被各方拿來判斷下一步該靠近還是反制。"
        }
    };
    const group = lines[role] || lines.citizen;
    return group[lens.label] || group.default;
}

function directorDemandForEvent(event = {}, lensOverride = null) {
    const lens = lensOverride || issueLens(event);
    const role = playerRoleKey();
    const roleSpecific = {
        business: {
            "世代衝突": {
                issue: "年輕員工要求透明升遷與合理排班",
                demand: "員工代表要求公開升遷標準、限制臨時加班，並在一個月內公布改善時程。",
                opposition: "老員工與店家擔心規則改太快，會增加人事成本，也破壞原本的工作默契。",
                question: "你要不要承諾具體改革時程，同時說清楚成本怎麼分攤？"
            },
            "生計壓力": {
                issue: "薪資與店家生存壓力同時爆發",
                demand: "員工要求調薪與更穩定工時；中小店家要求市府補助、稅費緩衝或租金協調。",
                opposition: "商會擔心一次加太多會讓小店倒閉，工會則擔心又被要求等待。",
                question: "你要先承認員工訴求，還是先保住企業現金流？"
            }
        },
        student: {
            "世代衝突": {
                issue: "學生要求校方與市府正式回應改革",
                demand: "學生團體要求公開協調會、改革時程，以及學生代表進入決策流程。",
                opposition: "社區與長輩擔心抗爭失控，讓日常生活被政治衝突佔據。",
                question: "你要把街頭壓力推進制度，還是先修補社區信任？"
            },
            "生計壓力": {
                issue: "學費、租屋與工讀壓力成為抗爭核心",
                demand: "學生要求提高補助、改善工讀保障，並公開學校與市府的資源分配。",
                opposition: "校方和市府擔心財源不足，反對沒有預算來源的承諾。",
                question: "你要把生活壓力變成制度訴求，還是先降低外界反彈？"
            }
        },
        civil: {
            "責任危機": {
                issue: "事故責任與通報時間線需要公開",
                demand: "民眾要求市府公布通報紀錄、責任窗口與後續修補時程。",
                opposition: "上級擔心資料公開後引爆究責，要求第一線先統一說法。",
                question: "你要先公開可查證資料，還是先保住行政程序？"
            },
            "資訊戰": {
                issue: "假消息擴散，官方說法失去可信度",
                demand: "媒體與公民團體要求公開資料來源、查證流程和更正機制。",
                opposition: "安全單位要求先限制擴散，避免謠言造成更大傷害。",
                question: "你要先公開查證資料，還是先控管未證實消息？"
            }
        }
    };

    const common = {
        "責任危機": {
            issue: "事故或失誤後，責任鏈必須被說清楚",
            demand: "受影響者要求公開時間線、通報紀錄、責任窗口與補救時程。",
            opposition: "市府與相關單位擔心被直接定罪，要求先調查再公開定論。",
            question: "你要先追責公開，還是先穩住處理流程？"
        },
        "生計壓力": {
            issue: "生活成本上升，基層要求看得見的保障",
            demand: "工會與受薪者要求調薪、補助或基本收入方案，並要求政府提出時程。",
            opposition: "企業與財政單位擔心成本失控，要求分階段處理。",
            question: "你要先回應生活壓力，還是先確認財源與成本？"
        },
        "世代衝突": {
            issue: "年輕世代要求進入決策，不再只被安撫",
            demand: "青年團體要求代表席次、公開協調會與具體改革時程。",
            opposition: "社區與既有組織擔心改變太快，讓日常秩序被衝突打亂。",
            question: "你要加快改革，還是先取得社區信任？"
        },
        "資訊戰": {
            issue: "假消息與片面剪輯正在改寫公共判斷",
            demand: "媒體與公民團體要求公開資料、查證流程與平台責任。",
            opposition: "安全派擔心資訊傷害已經擴散，主張先限制再查證。",
            question: "你要先保護言論自由，還是先阻止明確傷害？"
        },
        "發展代價": {
            issue: "開發帶來工作，也把污染與風險留給居民",
            demand: "居民與環團要求環境審查、補償方案與公開監測資料。",
            opposition: "企業與就業支持者擔心開發停下來，工作和投資會一起流失。",
            question: "你要先保護居民與環境，還是先保住工作與投資？"
        },
        "安全焦慮": {
            issue: "安全威脅升高，政府要求更大權限",
            demand: "安全單位要求擴大授權、快速處置與資訊控管。",
            opposition: "公民團體擔心權力擴張後缺乏監督，會壓縮自由。",
            question: "你要先給政府更多安全權限，還是先建立監督邊界？"
        },
        "價值衝突": {
            issue: "婚姻平權與家庭價值發生正面衝突",
            demand: "平權團體要求市府表態支持婚姻平權、公布公聽會與法案時程，並保障伴侶權利。",
            opposition: "傳統家庭與宗教團體要求保留家庭教育與信仰發言空間，反對被貼上歧視標籤。",
            question: "你要不要支持平權訴求進入正式法案，同時回應傳統社群的擔憂？"
        },
        "信任危機": {
            issue: "民眾不相信制度會真的回應",
            demand: "公民團體要求公開資料、具體時程與可追蹤的責任窗口。",
            opposition: "市府擔心承諾太快會被追責，反對在資訊不足時定案。",
            question: "你要用透明換信任，還是先保留行政彈性？"
        }
    };

    return roleSpecific[role]?.[lens.label] || common[lens.label] || common["信任危機"];
}

function directorTopicVariant(lens = {}, event = {}, occurrence = 0) {
    const variants = {
        "生計壓力": [
            {
                title: "薪資與工時談判",
                demand: {
                    issue: "薪資與工時壓力需要被正面處理",
                    demand: "受薪者要求調薪、穩定排班與公開談判時程。",
                    opposition: "雇主與財政單位擔心成本一次升高，讓小店、預算或服務承受不了。",
                    question: "你要先承認生活壓力，還是先說清楚成本來源？"
                }
            },
            {
                title: "租金與補助缺口",
                lens: {
                    cause: "房租、物價與通勤成本一起上升，補助制度卻跟不上實際生活。",
                    stakes: "補助太慢會讓民怨升高；補助太快又會被要求說清楚財源。"
                },
                demand: {
                    issue: "租金與補助缺口讓生活壓力外溢",
                    demand: "租屋族與基層家庭要求租金協調、交通補貼與明確申請流程。",
                    opposition: "財政單位與房東團體擔心補助變成長期負擔，要求先設限。",
                    question: "你要把資源先給最痛的人，還是先設計可持續的門檻？"
                }
            },
            {
                title: "基本保障財源爭議",
                lens: {
                    cause: "基本收入或社會保障被提出來，但誰付錢、誰受益還沒有說清楚。",
                    stakes: "保障可以降低恐懼，也可能引發財源與公平爭議。"
                },
                demand: {
                    issue: "基本保障方案需要財源與對象",
                    demand: "改革派要求建立最低保障，先照顧最脆弱的人。",
                    opposition: "企業與財政派要求先說明稅源、排富條件與長期成本。",
                    question: "你要先承諾保障方向，還是先要求完整財源設計？"
                }
            }
        ],
        "責任危機": [
            {
                title: "事故責任時間線",
                demand: {
                    issue: "事故責任時間線必須公開",
                    demand: "受影響者要求通報紀錄、責任窗口、補償方式與修補時程。",
                    opposition: "市府與相關單位擔心未調查完就被定罪，要求先穩住現場。",
                    question: "你要先公開追責，還是先保住處理流程？"
                }
            },
            {
                title: "補償與究責分工",
                lens: {
                    cause: "初步事故已被看見，但補償、究責與制度修補仍沒有人願意完整承擔。",
                    stakes: "只給補償會被說買沉默；只談究責又可能讓修補拖慢。"
                },
                demand: {
                    issue: "補償、究責與制度修補要分工",
                    demand: "受害者要求立即補償，媒體要求責任鏈，改革派要求修法。",
                    opposition: "相關單位擔心責任被無限擴大，要求分階段處理。",
                    question: "你要先安置受害者，還是先咬住責任鏈？"
                }
            }
        ],
        "價值衝突": [
            {
                title: "婚姻平權與家庭價值",
                demand: {
                    issue: "婚姻平權與家庭價值發生正面衝突",
                    demand: "平權團體要求市府表態支持婚姻平權、公布公聽會與法案時程，並保障伴侶權利。",
                    opposition: "傳統家庭與宗教團體要求保留家庭教育與信仰發言空間，反對被貼上歧視標籤。",
                    question: "你要不要支持平權訴求進入正式法案，同時回應傳統社群的擔憂？"
                }
            },
            {
                title: "家庭教育與公共權利",
                lens: {
                    cause: "平權訴求進入公共議程後，爭議轉向學校教育、家庭價值與政府是否該表態。",
                    stakes: "只談權利會讓傳統社群覺得被否定；只談傳統會讓少數者繼續沒有保障。"
                },
                demand: {
                    issue: "家庭教育與公共權利需要被同時安排",
                    demand: "平權團體要求把伴侶權利、校園反歧視與公共服務保障寫清楚。",
                    opposition: "家長與宗教團體要求保留教材討論空間，不要把疑慮直接等同歧視。",
                    question: "你要用制度保障少數權利，還是先安排更長的社會溝通？"
                }
            }
        ],
        "資訊戰": [
            {
                title: "假消息與查證戰"
            },
            {
                title: "平台責任與言論界線",
                lens: {
                    cause: "假消息事件後，焦點轉向平台、媒體與政府該如何界定有害內容。",
                    stakes: "平台不管會傷害公共判斷；政府管太多又會被視為審查。"
                },
                demand: {
                    issue: "平台責任與言論界線需要被訂出來",
                    demand: "媒體與公民團體要求公開演算法、標記查證來源與更正流程。",
                    opposition: "自由派與平台方擔心政府過度介入，讓批評聲音也被下架。",
                    question: "你要先要求平台負責，還是先限制政府介入範圍？"
                }
            }
        ],
        "發展代價": [
            {
                title: "環境審查與居民補償"
            },
            {
                title: "能源轉型與就業風險",
                lens: {
                    cause: "污染爭議尚未解決，能源轉型又把就業、電價與產業競爭拉進同一張桌子。",
                    stakes: "轉型太慢會留下污染；轉型太快會讓勞工與地方產業付出代價。"
                },
                demand: {
                    issue: "能源轉型需要同時安排就業與補償",
                    demand: "環團要求減排時程，勞工要求轉職保障，居民要求公開監測。",
                    opposition: "企業與地方政府擔心電價、工作與投資同時受衝擊。",
                    question: "你要先推轉型時程，還是先處理地方與就業成本？"
                }
            }
        ],
        "安全焦慮": [
            {
                title: "安全授權與自由界線"
            },
            {
                title: "國安管制與監督機制",
                lens: {
                    cause: "安全威脅被放大後，社會開始追問授權、監督與錯判的代價。",
                    stakes: "授權不足會被說放任風險；授權過大會讓異議失去空間。"
                },
                demand: {
                    issue: "國安管制需要監督機制",
                    demand: "安全單位要求快速處置權，公民團體要求司法或議會監督。",
                    opposition: "安全派認為監督會拖慢反應，自由派則擔心權力失控。",
                    question: "你要先給安全單位權限，還是先設下可檢驗的邊界？"
                }
            }
        ],
        "信任危機": [
            {
                title: "制度信任破口"
            },
            {
                title: "公開承諾與追蹤機制",
                lens: {
                    cause: "前面承諾越來越多，民眾開始要求不是再開會，而是要看得到誰負責。",
                    stakes: "沒有追蹤機制，承諾會變成空話；追蹤太硬，決策者會更防衛。"
                },
                demand: {
                    issue: "公開承諾需要追蹤機制",
                    demand: "公民團體要求承諾清單、責任人、期限與公開進度表。",
                    opposition: "市府與協調者擔心期限過死，讓談判失去彈性。",
                    question: "你要把承諾釘死，還是保留談判彈性？"
                }
            }
        ]
    };

    const list = variants[lens.label] || [{ title: directorLensTitle(lens.label) }];
    const variant = list[occurrence % list.length];
    return {
        title: variant.title || directorLensTitle(lens.label),
        lens: variant.lens ? { ...lens, ...variant.lens } : lens,
        demand: variant.demand || null
    };
}

function renderIssueDemand(event = {}) {
    const demand = event.director_demand_data || directorDemandForEvent(event);
    return `
        <section class="issue-demand">
            <span>主要議題訴求</span>
            <h3>${escapeHTML(demand.issue)}</h3>
            <div class="issue-demand-grid">
                <article>
                    <small>提出方要求</small>
                    <b>${escapeHTML(demand.demand)}</b>
                </article>
                <article>
                    <small>反對方擔心</small>
                    <b>${escapeHTML(demand.opposition)}</b>
                </article>
            </div>
        </section>`;
}

function newsOriginalHeadline(event = {}) {
    const raw = polishNarrativeText(event.original_title || event.title || "");
    if (!raw || raw.startsWith("新聞：")) return event.director_topic_title || "新聞事件";
    return raw.replace(/^新聞[:：]\s*/, "");
}

function newsOriginalBody(event = {}, demand = null) {
    const raw = polishNarrativeText(event.original_description || "");
    if (raw && raw !== polishNarrativeText(event.description || "")) return raw;
    if (raw && !raw.includes("選前倒數開始")) return raw;
    const info = demand || event.director_demand_data || directorDemandForEvent(event);
    return `${info.issue}出現新進展。提出方要求「${info.demand}」；反對方則擔心「${info.opposition}」。`;
}

function newsConcreteBody(event = {}, demand = null, named = "") {
    const lens = issueLens(event);
    const info = demand || event.director_demand_data || directorDemandForEvent(event, lens);
    const headline = newsOriginalHeadline(event).replace(/。$/, "");
    const actor = named || involvedCharactersForEvent(event)
        .filter((name) => name !== gameState.character?.name)
        .slice(0, 2)
        .join("、") || "相關單位";
    const raw = polishNarrativeText(event.original_description || "");
    const rawIsConcrete = raw
        && raw !== polishNarrativeText(event.description || "")
        && !raw.includes("選前倒數開始")
        && !raw.includes("前幾回合留下")
        && raw.length >= 14
        && raw.length <= 140;

    if (rawIsConcrete) {
        return raw.includes(headline) ? raw : `${headline}。${raw}`;
    }

    const templates = {
        "責任危機": `快訊指出，${headline}。通報時間、現場處置與責任窗口對不上，${actor}被要求說清楚誰在什麼時間做了哪些決定。`,
        "生計壓力": `快訊指出，${headline}。租金、物價或薪資壓力被帶到市府前，受影響者要求把帳單、補助和談判時程攤開。`,
        "世代衝突": `快訊指出，${headline}。青年團體把訴求帶進公共場域，長輩、學校和社區則擔心日常秩序被抗爭打亂。`,
        "資訊戰": `快訊指出，${headline}。匿名帳號、媒體片段與未查證消息同時擴散，社會還沒確認事實就開始站隊。`,
        "發展代價": `快訊指出，${headline}。開發、污染或能源方案的資料被公開後，居民要求監測與補償，企業要求不要讓投資停擺。`,
        "安全焦慮": `快訊指出，${headline}。安全單位要求擴大授權，公民團體則要求先說清楚監督邊界與誤判代價。`,
        "價值衝突": `快訊指出，${headline}。平權團體與傳統社群在公聽會外正面交鋒，爭點從價值表態推進到制度保障。`,
        "信任危機": `快訊指出，${headline}。前面的承諾開始被檢查，民眾要求責任人、期限和公開進度，不再接受只說會處理。`
    };

    return templates[lens.label] || `${headline}。${info.issue}成為新的公共爭議，提出方要求「${info.demand}」，反對方擔心「${info.opposition}」。`;
}

function renderNewsContent(event = {}) {
    if (!event.is_news) return "";
    const lens = issueLens(event);
    const demand = event.director_demand_data || directorDemandForEvent(event, lens);
    const named = involvedCharactersForEvent(event)
        .filter((name) => name !== gameState.character?.name)
        .slice(0, 3)
        .join("、");
    return `
        <section class="news-content">
            <span>新聞內容</span>
            <h3>${escapeHTML(newsOriginalHeadline(event))}</h3>
            <div class="news-content-grid">
                <article>
                    <small>發生什麼</small>
                    <b>${escapeHTML(newsConcreteBody(event, demand, named))}</b>
                </article>
                <article>
                    <small>被點名的人</small>
                    <b>${escapeHTML(named ? `${named}必須回應「${demand.issue}」。` : `各方必須回應「${demand.issue}」。`)}</b>
                </article>
                <article>
                    <small>接下來的壓力</small>
                    <b>${escapeHTML(demand.question)}</b>
                </article>
            </div>
        </section>`;
}

function directorSceneDescription(event = {}, index = 0, total = 1, lensOverride = null) {
    const lens = lensOverride || issueLens(event);
    const lensEvent = { ...event, director_lens_data: lens };
    const beat = directorChapterBeat(index, total);
    const actors = involvedCharactersForEvent(lensEvent).slice(0, 4);
    const actorLines = actors.map((name) => {
        const position = npcIssuePosition(name, event);
        return `${name}主張「${position.label}」`;
    }).join("；");
    return `${beat.trigger} ${lens.cause} ${actorLines}。你被推到場中央，必須決定這件事要走向公開追問、制度處理、秩序控管，還是群眾動員。${beat.pressure}`;
}

function directorChoiceVerb(effects = {}, order = 0) {
    const [key, value] = strongestEffect(effects);
    const table = {
        freedom: value >= 0
            ? ["公開資料，讓受影響的人先說話", "把現場聲音帶進媒體與會議"]
            : ["先收斂發言，避免衝突繼續擴大", "要求各方暫停公開指控"],
        order: value >= 0
            ? ["先劃清現場邊界，要求各方降溫", "把安全與流程放在第一步"]
            : ["保留街頭壓力，逼決策者正面回應", "讓現場繼續施壓，不急著收場"],
        progress: value >= 0
            ? ["要求建立正式時程與責任名單", "把訴求送進可追蹤的程序"]
            : ["暫緩改革，先避免新的承諾失控", "先守住現有流程，不立刻推制度改動"],
        populism: value >= 0
            ? ["把矛盾推到台前，逼所有人表態", "用高聲量讓議題不能被壓下去"]
            : ["先降低情緒，讓查證和談判回到前面", "拆掉口號，要求各方說清楚證據"],
        balance: ["保留談判空間，不讓任何一方直接出局", "先把各方帶回同一張桌子"]
    };
    const options = table[key] || table.balance;
    return options[order % options.length];
}

function normalizeChoiceText(text = "") {
    return polishNarrativeText(text).replace(/[，。！？\s]/g, "");
}

function directorGenericChoiceText(effects = {}, order = 0) {
    const [key, value] = strongestEffect(effects);
    const lines = {
        freedom: value >= 0
            ? ["公開關鍵資料，讓受影響的人先把事實說清楚。", "開放一場公開聽證，讓支持與反對方都留下紀錄。"]
            : ["先收斂公開發言，要求各方把指控送交查證。", "暫停未證實指控，避免衝突在社群失控。"],
        order: value >= 0
            ? ["先劃清現場邊界，讓協調能在安全條件下開始。", "請各方撤回最激烈行動，換取正式會議時程。"]
            : ["保留街頭壓力，逼決策者不能再拖延。", "讓現場繼續施壓，直到責任窗口被公開點名。"],
        progress: value >= 0
            ? ["要求建立正式時程、責任窗口和公開追蹤表。", "把訴求拆成三項可審議方案，送進議會或協調會。"]
            : ["暫緩改革承諾，先補齊資料、財源與責任分工。", "先守住現有流程，要求下一回合再提出完整方案。"],
        populism: value >= 0
            ? ["把矛盾推到台前，迫使沉默的權力者公開回應。", "用短影音與街頭行動放大訴求，讓議題不能被壓下去。"]
            : ["先降低情緒，讓查證和談判回到前面。", "拆掉口號，要求各方用證據說清楚立場。"],
        balance: ["保留談判空間，不讓任何一方直接出局。", "先把各方帶回同一張桌子，交換可接受底線。"]
    }[key] || ["保留談判空間，不讓任何一方直接出局。", "先把各方帶回同一張桌子，交換可接受底線。"];
    return lines[order % lines.length];
}

function ensureDistinctChoiceTexts(options = [], event = {}, lens = null) {
    const seen = new Set();
    return options.map((option, index) => {
        if (!option || event.is_news) return option;
        let text = polishNarrativeText(option.text || "");
        let normalized = normalizeChoiceText(text);
        if (!normalized || seen.has(normalized)) {
            const alternatives = [
                directorGenericChoiceText(option.effects || {}, index + 1),
                directorChoiceVerb(option.effects || {}, index + 1),
                directorGenericChoiceText(option.effects || {}, index + 2),
                directorChoiceVerb(option.effects || {}, index + 2),
                `${directorGenericChoiceText(option.effects || {}, index + 3)}（把責任寫清楚）`,
                `${directorGenericChoiceText(option.effects || {}, index + 4)}（先處理代價）`
            ];
            text = alternatives.find((candidate) => !seen.has(normalizeChoiceText(candidate))) || `${text}（改以不同節奏處理）`;
            normalized = normalizeChoiceText(text);
        }
        seen.add(normalized);
        return { ...option, text };
    });
}

function directorChoiceText(option = {}, event = {}, order = 0, lensOverride = null) {
    const lens = lensOverride || issueLens(event);
    const role = playerRoleKey();
    const [key, value] = strongestEffect(option.effects || {});
    const roleLines = {
        business: {
            "世代衝突": [
                "提出分階段改善工時與升遷規則，先公開成本與時程。",
                "先守住店內現有流程，召開員工會議重新談可負擔的改變。"
            ],
            "生計壓力": [
                "公開帳目壓力，和員工代表一起向市府要求補助方案。",
                "先穩住現金流，承諾一週內提出可執行的薪資調整。"
            ]
        },
        student: {
            "世代衝突": [
                "把抗議訴求整理成正式時程，要求校方和市府公開回應。",
                "先拜訪社區代表，讓長輩知道學生不是來摧毀日常生活。"
            ],
            "生計壓力": [
                "公開學生生活壓力資料，要求補助和工讀制度進入議程。",
                "先和工會及議員協調，避免運動被說成只會喊口號。"
            ]
        },
        civil: {
            "責任危機": [
                "整理時間線和文件，要求上級指定可追蹤的責任窗口。",
                "先穩住對外說法，再把內部缺口送進正式程序。"
            ],
            "資訊戰": [
                "公開可查證資料，讓謠言失去空間。",
                "先限制未查證消息擴散，同時承諾補上公開說明。"
            ]
        }
    };

    const picked = roleLines[role]?.[lens.label]?.[order];
    if (picked) return picked;

    return directorGenericChoiceText(option.effects || {}, order);
}

function directorResultText(option = {}, event = {}, order = 0, lensOverride = null) {
    const effects = option.effects || {};
    const [key, value] = strongestEffect(effects);
    const lens = lensOverride || issueLens(event);
    const actors = involvedCharactersForEvent({ ...event, director_lens_data: lens });
    const first = actors[order % Math.max(actors.length, 1)] || "場上角色";
    const second = actors[(order + 1) % Math.max(actors.length, 1)] || "另一方";
    const movement = {
        freedom: value >= 0 ? "更多人敢公開說話" : "公開討論先被壓低",
        order: value >= 0 ? "現場暫時穩住" : "街頭壓力繼續升高",
        progress: value >= 0 ? "議題進入正式流程" : "改革暫時回到舊路徑",
        populism: value >= 0 ? "聲量快速擴散" : "情緒暫時降溫",
        balance: "各方重新估算彼此底線"
    }[key] || "各方重新估算彼此底線";
    const cost = {
        freedom: value >= 0 ? "怕失控的人會更緊張" : "等著被聽見的人會失望",
        order: value >= 0 ? "街頭會懷疑你退讓" : "一般民眾和第一線承擔混亂",
        progress: value >= 0 ? "既有利益者開始反制" : "改革支持者失去耐心",
        populism: value >= 0 ? "複雜問題被剪成敵我" : "需要聲量的人可能被看不見",
        balance: "沒有人真正滿意"
    }[key] || "沒有人真正滿意";
    return `${movement}。${first}看到可利用的空間，${second}則開始計算自己的損失。代價是：${cost}。`;
}

function directorNewsResult(event = {}, index = 0, total = 1, lensOverride = null) {
    const lens = lensOverride || issueLens(event);
    const beat = directorChapterBeat(index, total);
    return `${beat.label}被外部新聞推了一把。${lens.stakes} 場上角色不會再把這件事當成背景消息，而會拿它來要求你下一步表態。`;
}

function applyStoryDirector(events = []) {
    const total = Math.max(events.length, 1);
    const lensCounts = {};
    return events.map((event, index) => {
        const baseLens = issueLens(event);
        const roleLens = directorLensForPlayer(baseLens, event);
        const occurrence = lensCounts[roleLens.label] || 0;
        lensCounts[roleLens.label] = occurrence + 1;
        const topic = directorTopicVariant(roleLens, event, occurrence);
        const lens = topic.lens;
        const beat = directorChapterBeat(index, total);
        const demand = topic.demand || directorDemandForEvent(event, lens);
        const directed = {
            ...event,
            original_title: event.original_title || event.title,
            original_description: event.original_description || event.description,
            director_lens_data: lens,
            director_demand_data: demand,
            director_topic_title: topic.title,
            title: event.is_news
                ? `新聞：${compactText(newsOriginalHeadline(event), 22).replace(/。$/, "")}`
                : `${beat.label}：${topic.title}`,
            description: directorSceneDescription(event, index, total, lens),
            relationship_effects_text: event.relationship_effects_text || `${lens.label}讓${lens.actors.slice(0, 3).join("、")}重新計算和你的距離。`
        };

        directed.options = (event.options || []).map((option, optionIndex) => ({
            ...option,
            original_text: option.original_text || option.text,
            original_result_text: option.original_result_text || option.result_text,
            text: event.is_news ? "把這則新聞納入下一步判斷" : directorChoiceText(option, event, optionIndex, lens),
            result_text: event.is_news ? directorNewsResult(event, index, total, lens) : directorResultText(option, event, optionIndex, lens)
        }));
        directed.options = ensureDistinctChoiceTexts(directed.options, directed, lens);

        if (directed.persuasion_config) {
            const target = directed.persuasion_config.target;
            const profile = npcInterestProfile(target);
            directed.persuasion_config = {
                ...directed.persuasion_config,
                reason: `${target}認為你的做法會傷到「${profile.interest}」。他不是隨機反對，而是在保護自己的底線。`,
                persuasion_high: {
                    ...directed.persuasion_config.persuasion_high,
                    text: `私下承認${target}的顧慮，換取他暫時留在談判桌上`,
                    result_text: `${target}沒有改變立場，但願意讓衝突先回到可談的範圍。`
                },
                persuasion_low: {
                    ...directed.persuasion_config.persuasion_low,
                    text: `公開要求${target}表態，讓支持者看見你的強硬`,
                    result_text: `${target}覺得自己被推到台前，開始把反對你變成自己的主線。`
                }
            };
        }

        return directed;
    });
}

function currentArcBeat() {
    const total = Math.max(gameState.events.length, 1);
    const turn = gameState.currentEventIndex + 1;
    const ratio = turn / total;

    if (ratio <= 0.25) {
        return {
            label: "起點",
            line: "先建立可信度，讓各方知道你用什麼方式處理衝突。"
        };
    }
    if (ratio <= 0.55) {
        return {
            label: "轉折",
            line: "前面的表態開始變成代價，支持者與反對者都會拿它來要求你。"
        };
    }
    if (ratio <= 0.8) {
        return {
            label: "壓力",
            line: "反對者開始串聯，盟友也會要求你把承諾落到具體流程。"
        };
    }
    return {
        label: "收束",
        line: "最後不是單次勝負，而是檢驗你前面留下的關係與承諾。"
    };
}

function buildArcThread(ev) {
    const beat = currentArcBeat();
    const previous = gameState.choiceHistory[gameState.choiceHistory.length - 1];
    const previousLine = previous
        ? `前情：你上回合選擇「${compactText(previous.choiceText, 18)}」；${previous.threadLine}`
        : `主線：${compactText(roleProfile().throughline, 42)}`;

    return `
        <div class="arc-thread">
            <span>${escapeHTML(beat.label)}</span>
            <strong>${escapeHTML(beat.line)}</strong>
            <small>${escapeHTML(previousLine)}</small>
        </div>`;
}

function storyThreadLine(effects = {}, reaction = {}) {
    const [key, value] = strongestEffect(effects);
    if (value === 0) return "各方還在觀望，下一步會決定誰願意靠近。";

    const consequence = {
        freedom: value > 0 ? "公共發聲被打開，反對者會要求你證明不是只會喊口號。" : "場面安靜下來，但支持者會追問你是不是退讓。",
        order: value > 0 ? "秩序暫時穩住，降溫能不能變成承諾仍未確定。" : "街頭壓力升高，失控風險被更多人看見。",
        progress: value > 0 ? "議題進入流程，承擔責任的人也開始被點名。" : "改革退回舊路徑，政策窗口變得更窄。",
        populism: value > 0 ? "聲量快速擴散，反彈與誤讀也跟著放大。" : "情緒被降溫，但議題是否被看見仍未確定。"
    }[key];

    if (reaction.tone === "oppose") return `${consequence} ${reaction.npc}會成為新的阻力。`;
    if (reaction.tone === "support") return `${consequence} ${reaction.npc}願意暫時靠近。`;
    return `${consequence} ${reaction.npc}還在等待你下一步。`;
}

function scoreBehaviorChoice(effects = {}, pOption = null, reaction = {}) {
    const scores = gameState.behaviorScores;

    if ((effects.freedom || 0) > 0) {
        scores.assertiveness += 2;
        scores.empathy += 1;
    }
    if ((effects.freedom || 0) < 0) {
        scores.conflictAvoidance += 1;
    }
    if ((effects.order || 0) > 0) {
        scores.cooperation += 1;
        scores.pragmatism += 1;
        scores.conflictAvoidance += 1;
    }
    if ((effects.order || 0) < 0) {
        scores.riskTolerance += 2;
        scores.assertiveness += 1;
    }
    if ((effects.progress || 0) > 0) {
        scores.institutionTrust += 2;
        scores.pragmatism += 1;
    }
    if ((effects.progress || 0) < 0) {
        scores.conflictAvoidance += 1;
    }
    if ((effects.populism || 0) > 0) {
        scores.riskTolerance += 2;
        scores.assertiveness += 1;
    }
    if ((effects.populism || 0) < 0) {
        scores.cooperation += 1;
        scores.empathy += 1;
    }
    if (pOption) {
        scores.cooperation += 1;
        scores.pragmatism += 1;
    }
    if (reaction.tone === "oppose") {
        scores.riskTolerance += 1;
    }
    if (reaction.tone === "support") {
        scores.cooperation += 1;
    }
}

function recordBehaviorChoice(option, ev, effects, pOption, reaction, beat) {
    if (ev.is_news) return;
    scoreBehaviorChoice(effects, pOption, reaction);
    gameState.choiceHistory.push({
        turn: gameState.currentEventIndex + 1,
        chapter: chapterInfo().label,
        lens: issueLens(ev).label,
        eventTitle: ev.title,
        choiceText: polishNarrativeText(option.text),
        effect: effectToken(effects),
        beat: beat.label,
        npc: reaction.npc,
        tone: reaction.tone,
        threadLine: storyThreadLine(effects, reaction)
    });
    gameState.choiceHistory = gameState.choiceHistory.slice(-10);
}

function characterArcDefaults(name = "") {
    const arcs = {
        "柯爾市長": {
            goal: "守住執政合法性，同時避免任何單一陣營綁架市府。",
            fear: "局勢失控後，他只能用行政命令收場。",
            plan: "先拖進協調會，再看誰有足夠籌碼。"
        },
        "莫長老": {
            goal: "保護社區秩序與長輩網絡，不讓街頭衝突進入日常生活。",
            fear: "社區被貼上守舊或失控的標籤。",
            plan: "用場地、人脈與輿論壓力要求運動降溫。"
        },
        "艾達議員": {
            goal: "把民間怒氣轉成可審議的法案與質詢。",
            fear: "議題只剩口號，無法進入制度。",
            plan: "尋找能公開承擔風險的倡議者。"
        },
        "威廉總裁": {
            goal: "維持投資穩定與企業談判空間。",
            fear: "政策被情緒推著走，成本無法預測。",
            plan: "靠資源與專家話語把改革速度壓慢。"
        },
        "莉亞記者": {
            goal: "把傳聞整理成可查證的公共事件。",
            fear: "自己變成某一方的宣傳工具。",
            plan: "追時間線、找證據、逼各方說清楚。"
        },
        "龐頭目": {
            goal: "證明街頭組織仍然能影響政策。",
            fear: "群眾被安撫後，基層又被排除在談判外。",
            plan: "用動員能力換取議程上的席位。"
        },
        "雷將軍": {
            goal: "守住國安與秩序邊界。",
            fear: "外部勢力與內部混亂互相放大。",
            plan: "在安全名義下要求更強控制。"
        },
        "費教授": {
            goal: "讓公共討論回到證據與制度設計。",
            fear: "民粹語言取代事實，讓政策無法被檢驗。",
            plan: "拆解論點，提醒大家看長期成本。"
        },
        "蘇網紅": {
            goal: "抓住能引爆注意力的矛盾。",
            fear: "事件太複雜，觀眾失去興趣。",
            plan: "把衝突剪成容易傳播的敘事。"
        }
    };

    return arcs[name] || {
        goal: "在混亂中保住自己的位置。",
        fear: "局勢變化太快，原本的籌碼失效。",
        plan: "先觀望，再向有優勢的一方靠近。"
    };
}

function initializeCharacterArcs() {
    const names = new Set([
        ...Object.keys(gameState.npcApprovals || {}),
        ...gameState.characters.map((character) => character.name).filter(Boolean)
    ]);
    gameState.characterArcs = {};
    names.forEach((name) => {
        gameState.characterArcs[name] = {
            ...characterArcDefaults(name),
            relation: playerRelationshipSeed(name),
            relationState: "open",
            relationText: playerRelationshipSeed(name).open,
            trust: gameState.npcApprovals[name] ?? 50,
            momentum: 0,
            tension: 0,
            appearanceCount: 0,
            lastSeenTurn: -1,
            lastChange: "還在觀望你的第一步。"
        };
    });
    gameState.lastArcChanges = [];
}

function ensureCharacterArc(name = "") {
    if (!name) return null;
    if (!gameState.characterArcs[name]) {
        gameState.characterArcs[name] = {
            ...characterArcDefaults(name),
            relation: playerRelationshipSeed(name),
            relationState: "open",
            relationText: playerRelationshipSeed(name).open,
            trust: gameState.npcApprovals[name] ?? 50,
            momentum: 0,
            tension: 0,
            appearanceCount: 0,
            lastSeenTurn: -1,
            lastChange: "剛被捲入局勢。"
        };
    }
    return gameState.characterArcs[name];
}

function issueLens(event = {}) {
    if (event.director_lens_data) return event.director_lens_data;
    const text = `${event.title || ""} ${event.description || ""} ${event.image_filename || ""}`.toLowerCase();
    if (/accident|車禍|事故|工安|傷亡|災害/.test(text)) {
        return {
            label: "責任危機",
            cause: "事故發生後，市府、現場單位和相關利益方都被要求說明責任。",
            stakes: "查清楚會得罪人；草草收場會讓信任更低。",
            actors: ["柯爾市長", "莉亞記者", "艾達議員", "費教授"]
        };
    }
    if (/wage|ubi|工資|基本收入|社會福利/.test(text)) {
        return {
            label: "生計壓力",
            cause: "薪水追不上生活，基層要求政府和企業給答案。",
            stakes: "加快改革會增加成本；拖太久會讓街頭更不滿。",
            actors: ["龐頭目", "艾達議員", "威廉總裁", "柯爾市長"]
        };
    }
    if (/education|學生|教育|校園/.test(text)) {
        return {
            label: "世代衝突",
            cause: "年輕人想改變，長輩和學校怕生活被打亂。",
            stakes: "你要讓訴求被聽見，也不能讓社區覺得被攻擊。",
            actors: ["艾達議員", "莫長老", "莉亞記者", "費教授"]
        };
    }
    if (/fakenews|media|scandal|bribe|網路|言論|假消息|媒體|醜聞|賄賂/.test(text)) {
        return {
            label: "資訊戰",
            cause: "網路先把消息傳開，大家還沒查證就開始站隊。",
            stakes: "管太多會傷害自由；不處理又會讓謠言擴散。",
            actors: ["莉亞記者", "蘇網紅", "雷將軍", "費教授"]
        };
    }
    if (/pollution|energy|污染|能源|環境/.test(text)) {
        return {
            label: "發展代價",
            cause: "發展帶來工作，也留下污染和風險。",
            stakes: "保護環境會增加成本；放著不管會傷害居民。",
            actors: ["威廉總裁", "艾達議員", "柯爾市長", "費教授"]
        };
    }
    if (/military|國安|軍事|安全|外部勢力/.test(text)) {
        return {
            label: "安全焦慮",
            cause: "安全威脅升高，秩序派要求更強控制。",
            stakes: "提高安全會讓人安心，也可能壓縮自由。",
            actors: ["雷將軍", "柯爾市長", "艾達議員", "蘇網紅"]
        };
    }
    if (/marriage|婚姻|平權|家庭/.test(text)) {
        return {
            label: "價值衝突",
            cause: "新的權利要求碰到傳統家庭觀念。",
            stakes: "只挺一邊會讓另一邊覺得被排除。",
            actors: ["艾達議員", "莫長老", "費教授", "莉亞記者"]
        };
    }
    return {
        label: "信任危機",
        cause: "大家不信任制度，所以小事件也會被放大。",
        stakes: "你要先讓人相信：這不是又一次空話。",
        actors: [roleProfile().ally, roleProfile().skeptic, "柯爾市長", "莉亞記者"]
    };
}

function involvedCharactersForEvent(event = {}, reaction = null, pTarget = null) {
    const preferred = [
        pTarget,
        reaction?.npc,
        ...issueLens(event).actors,
        roleProfile().ally,
        roleProfile().skeptic
    ].filter(Boolean);
    const names = [...new Set(preferred)].filter((name) => name !== gameState.character?.name);
    const needed = Math.max(0, 6 - names.length);
    const fillers = allNpcNames()
        .filter((name) => !names.includes(name))
        .sort((a, b) => {
            const arcA = ensureCharacterArc(a);
            const arcB = ensureCharacterArc(b);
            return (arcA.appearanceCount || 0) - (arcB.appearanceCount || 0);
        })
        .slice(0, needed);
    return [...names, ...fillers].slice(0, 6);
}

function markStakeholderAppearances(names = []) {
    names.forEach((name) => {
        const arc = ensureCharacterArc(name);
        if (!arc) return;
        if (arc.lastSeenTurn !== gameState.currentEventIndex) {
            arc.appearanceCount += 1;
            arc.lastSeenTurn = gameState.currentEventIndex;
        }
    });
}

function buildWhyPanel(event = {}) {
    const lens = issueLens(event);
    const previous = gameState.choiceHistory[gameState.choiceHistory.length - 1];
    const why = previous
        ? `因為你上回合讓「${previous.effect}」成為焦點，${lens.cause}`
        : lens.cause;

    return `
        <div class="why-panel">
            <span>${escapeHTML(lens.label)}</span>
            <b>為什麼現在發生</b>
            <p>${escapeHTML(why)}</p>
            <small>${escapeHTML(lens.stakes)}</small>
        </div>`;
}

function sceneQuestion(event = {}) {
    const lens = issueLens(event);
    const questions = {
        "生計壓力": "誰先付改革成本？",
        "世代衝突": "要加快改變，還是先安撫社區？",
        "資訊戰": "先保護言論，還是先阻止傷害？",
        "發展代價": "工作和環境，誰先被保護？",
        "安全焦慮": "安全和自由，要怎麼取捨？",
        "價值衝突": "怎麼讓雙方都被聽見？",
        "責任危機": "誰要負責？",
        "信任危機": "誰能讓大家重新相信制度？"
    };
    return questions[lens.label] || questions["信任危機"];
}

function scenePlayerPosition(event = {}) {
    const previous = gameState.choiceHistory[gameState.choiceHistory.length - 1];
    if (!previous) return directorPlayerPosition(event);

    const toneRead = previous.tone === "oppose"
        ? `${previous.npc}會先找你的破綻。`
        : previous.tone === "support"
            ? `${previous.npc}剛給你一點空間。`
            : `${previous.npc}還在觀望。`;
    return `你上一回合選擇「${compactText(previous.choiceText, 18)}」，讓${previous.effect}變成新的判斷標準。${toneRead}`;
}

function scenePressureLine(event = {}) {
    const lens = issueLens(event);
    const chapter = chapterInfo();
    const lines = {
        "生計壓力": "如果沒有人付錢，承諾就只是口號。",
        "世代衝突": "年輕人要速度，社區要安全感。",
        "資訊戰": "誰先定義真相，誰就先拿到政治優勢。",
        "發展代價": "工作、污染與補償不能再分開談。",
        "安全焦慮": "安全單位想要權限，公民團體要求監督。",
        "價值衝突": "雙方都覺得自己正在被否定。",
        "責任危機": "所有人都想知道：誰早就知道風險？",
        "信任危機": "制度如果不給答案，大家就會找自己的答案。"
    };
    return `${chapter.pressure} ${lines[lens.label] || lines["信任危機"]}`;
}

function sceneDecisionFocus(event = {}) {
    const lens = issueLens(event);
    if (event.director_demand_data?.question) return event.director_demand_data.question;
    const lines = {
        "生計壓力": "你要決定先保護生活，還是先保護制度可行性。",
        "世代衝突": "你要決定把衝突推進改革，還是先讓社區願意聽。",
        "資訊戰": "你要決定先查證、先控管，還是先保護發聲空間。",
        "發展代價": "你要決定誰先承擔轉型成本。",
        "安全焦慮": "你要決定權力要先擴張，還是先被監督。",
        "價值衝突": "你要決定如何讓一方不必靠消滅另一方來安心。",
        "責任危機": "你要決定先追責、先救場，還是先保住談判空間。",
        "信任危機": "你要決定用透明、秩序、改革或聲量修補信任。"
    };
    return lines[lens.label] || lines["信任危機"];
}

function buildSceneDossier(event = {}) {
    const lens = issueLens(event);
    const previous = gameState.choiceHistory[gameState.choiceHistory.length - 1];
    const continuity = previous
        ? `上一幕留下的焦點是「${previous.effect}」。這一幕，各方開始把它轉成自己的說法。`
        : "故事剛開始，各方還不知道你會用街頭、制度、協商或聲量處理政治。";

    return `
        <div class="scene-dossier">
            <article>
                <span>前情</span>
                <b>${escapeHTML(continuity)}</b>
            </article>
            <article>
                <span>此刻的問題</span>
                <b>${escapeHTML(sceneQuestion(event))}</b>
            </article>
            <article>
                <span>這不是單一事件</span>
                <b>${escapeHTML(lens.stakes)}</b>
            </article>
        </div>`;
}

function pickLine(lines = [], seed = "") {
    if (!lines.length) return "";
    return lines[Math.abs(hashText(seed)) % lines.length];
}

function npcInterestProfile(name = "") {
    const profiles = {
        "柯爾市長": {
            interest: "治理正當性",
            risk: "市府被看成卸責或失控",
            stance: "制度控場派",
            redLine: "市府承擔無法說明的責任，或現場秩序失控。",
            compromise: "可以開協調會、成立專案或讓議題進入行政程序。",
            support: [
                "我可以開協調會，但你要給我一個能向市民交代的責任版本。",
                "只要局勢不失控，市府還有空間把衝突放進程序。"
            ],
            oppose: [
                "如果你把所有責任都推到市府，我會先把程序門檻拉高。",
                "你要的是改革，還是讓市府替所有人的怒氣買單？"
            ],
            watch: [
                "我先看你能不能把壓力變成可處理的方案。",
                "市府不是不回應，是還沒看到誰願意承擔後果。"
            ]
        },
        "莫長老": {
            interest: "社區安全感與長輩網絡",
            risk: "社區被當成動員素材",
            stance: "社區保守派",
            redLine: "社區、長輩或家庭被當成政治敵人。",
            compromise: "可以接受漸進溝通、旁聽協調與保留台階的改革。",
            support: [
                "如果你願意先讓居民知道風險，我可以幫你把話帶進社區。",
                "你沒有把長輩當成阻礙，這點我會記住。"
            ],
            oppose: [
                "社區不是你的舞台，別把長輩推成改革的敵人。",
                "你每放大一次衝突，居民就更不想借你任何場地。"
            ],
            watch: [
                "我不反對年輕人說話，但我要知道誰會收拾後果。",
                "先別急著喊口號，社區要的是可預期的生活。"
            ]
        },
        "艾達議員": {
            interest: "把民意轉成法案與質詢",
            risk: "議題被情緒吃掉，無法進入制度",
            stance: "制度改革派",
            redLine: "訴求只剩聲量，沒有證據、責任與條文方向。",
            compromise: "願意承擔政治風險，但要能進入議會程序。",
            support: [
                "這個版本可以進質詢，但你要準備證人與時間線。",
                "你把訴求整理得夠清楚，我就能讓它不只停在街頭。"
            ],
            oppose: [
                "如果只剩怒氣，我沒辦法把它寫成條文。",
                "你讓反對派有理由說這不是改革，而是施壓。"
            ],
            watch: [
                "我等你拿出能被審議的版本。",
                "政治不是只讓人聽見，還要讓承諾能被追蹤。"
            ]
        },
        "威廉總裁": {
            interest: "成本、投資與企業談判空間",
            risk: "政策被聲量推著走，成本失控",
            stance: "市場穩定派",
            redLine: "企業被指定為唯一買單者，規則因聲量突然改寫。",
            compromise: "能接受分期轉型、成本分攤與可預測規則。",
            support: [
                "如果你承認成本需要分攤，我願意坐下來談。",
                "改革可以談，但不能把所有風險丟給企業。"
            ],
            oppose: [
                "你把成本說得太輕，最後受傷的是工作與投資。",
                "如果規則今天被聲量改寫，明天就沒有人敢投入。"
            ],
            watch: [
                "我先看你是在談制度，還是在替壓力找出口。",
                "你要我讓步，就要說清楚誰付錢、誰負責。"
            ]
        },
        "莉亞記者": {
            interest: "可查證的時間線與公共真相",
            risk: "被任何一方當成擴音器",
            stance: "查證揭露派",
            redLine: "任何陣營要求她只報有利版本，或避開關鍵證據。",
            compromise: "願意讓情緒成為入口，但結論必須回到證據。",
            support: [
                "給我文件與時間線，我可以讓事件不被一句話帶走。",
                "你願意把證據攤開，這就值得追下去。"
            ],
            oppose: [
                "你想要報導，就不要只給我情緒和標語。",
                "我不會替任何人補敘事漏洞，包含你。"
            ],
            watch: [
                "我先不站隊，我要看誰的說法經得起查證。",
                "故事現在還缺關鍵證據，誰急著定調都可疑。"
            ]
        },
        "龐頭目": {
            interest: "基層談判籌碼與組織能見度",
            risk: "基層再次被安撫後排除",
            stance: "基層動員派",
            redLine: "基層只被拿來當背景，最後沒有談判位置。",
            compromise: "可以降溫，但前提是桌上有席位與具體交換。",
            support: [
                "你讓基層坐上桌，我的人就願意先穩住場面。",
                "只要不是空頭承諾，我可以把壓力轉成談判。"
            ],
            oppose: [
                "別拿基層當背景，事情收場後又叫我們回去等。",
                "你如果只想漂亮落幕，我的人不會替你鼓掌。"
            ],
            watch: [
                "我看的是你有沒有把痛苦換成籌碼。",
                "話說得再好，沒有談判位置就只是安撫。"
            ]
        },
        "雷將軍": {
            interest: "安全邊界與秩序可控",
            risk: "外部威脅與內部混亂互相放大",
            stance: "安全秩序派",
            redLine: "現場失控、外部勢力可介入，或權責邊界模糊。",
            compromise: "可以退後一步，但要有清楚風險控管與授權邊界。",
            support: [
                "你先把現場風險壓住，我才有理由不升高管制。",
                "只要邊界清楚，安全系統可以暫時退到後面。"
            ],
            oppose: [
                "你低估混亂的傳染速度，安全部門不會陪你賭。",
                "自由不是失控的通行證，誰負責收尾？"
            ],
            watch: [
                "我先看現場會不會被人利用。",
                "安全問題不能只靠善意，它需要邊界。"
            ]
        },
        "費教授": {
            interest: "證據、制度設計與長期成本",
            risk: "公共討論被情緒取代",
            stance: "理性制度派",
            redLine: "情緒、陰謀或口號取代證據與制度設計。",
            compromise: "可以承認價值衝突，但要把成本與責任拆清楚。",
            support: [
                "你把問題拆成責任與制度缺口，討論才有機會前進。",
                "這個選擇至少讓長期成本被看見。"
            ],
            oppose: [
                "你把複雜問題剪成口號，最後會讓政策不可檢驗。",
                "情緒可以啟動政治，但不能替代制度設計。"
            ],
            watch: [
                "我需要看見證據，而不是誰的聲量比較大。",
                "先把價值判斷和事實判斷分開。"
            ]
        },
        "蘇網紅": {
            interest: "注意力、敘事速度與可傳播性",
            risk: "事件太複雜，觀眾失去興趣",
            stance: "聲量敘事派",
            redLine: "訊息太慢、太複雜，無法讓大眾理解或轉發。",
            compromise: "願意幫忙擴散，但會把複雜議題剪成清楚衝突。",
            support: [
                "這句話能剪出去，而且觀眾聽得懂。",
                "你給了我一個清楚衝突點，聲量會自己長。"
            ],
            oppose: [
                "這太像會議紀錄了，沒有人會轉。",
                "你講得越複雜，我越能把它剪成另一個故事。"
            ],
            watch: [
                "我先看哪一句能讓大家停下來。",
                "事件要爆，不是因為完整，是因為夠尖。"
            ]
        }
    };

    return profiles[name] || {
        interest: "保住自己的位置",
        risk: "籌碼失效",
        stance: "觀望派",
        redLine: "自己的籌碼被消耗。",
        compromise: "願意向優勢方靠近。",
        support: ["這一步讓我看見合作空間。"],
        oppose: ["這一步讓我更難相信你。"],
        watch: ["我還在看你下一步。"]
    };
}

function lensSpecificVoice(name = "", lensLabel = "", text = "") {
    const lines = {
        "柯爾市長": {
            "生計壓力": ["薪資與補貼不能只靠市府喊話，財源與責任要同時交代。"],
            "世代衝突": ["學生不是問題，問題是誰能把抗議帶回可治理的流程。"],
            "資訊戰": ["如果真相被網路先定義，市府再慢半拍就會變成被告。"],
            "發展代價": ["污染與開發都會回到市府桌上，沒有人會接受『不歸我管』。"],
            "安全焦慮": ["安全牌一旦打出來，市府就不能再只當旁觀者。"],
            "價值衝突": ["我不能只討好一邊，否則另一邊會覺得市府放棄他們。"]
        },
        "莫長老": {
            "生計壓力": ["社區裡也有人撐不下去，但他們怕抗爭把生活弄得更亂。"],
            "世代衝突": ["年輕人要改變可以，但不能把長輩都推成壞人。"],
            "資訊戰": ["群組裡一句話就能讓鄰里翻臉，我最怕這個。"],
            "發展代價": ["居民不是反對發展，是不想最後只剩我們承擔污染。"],
            "價值衝突": ["傳統不是武器，但也不能被一句進步就掃掉。"]
        },
        "艾達議員": {
            "生計壓力": ["如果有明確受害者與財源，我可以把它變成質詢。"],
            "世代衝突": ["我要的是能讓學生、家長與校方同桌的版本。"],
            "資訊戰": ["言論自由和傷害防制要分開設計，不然法案會被打爛。"],
            "發展代價": ["環境成本要進入審查，不然改革只是換一群人受傷。"],
            "安全焦慮": ["國安不能成為空白授權，權力邊界要寫清楚。"],
            "價值衝突": ["權利要被寫進制度，才不會每次都重新吵一遍。"]
        },
        "威廉總裁": {
            "生計壓力": ["加薪不是一句正義就能完成，現金流和訂單也會一起動。"],
            "世代衝突": ["年輕人要未來，企業也要可預測的規則。"],
            "資訊戰": ["市場最怕不確定，謠言一天就能讓投資縮手。"],
            "發展代價": ["環保可以談，但不能把轉型成本假裝不存在。"],
            "安全焦慮": ["安全風險升高，供應鏈就會先收縮。"]
        },
        "莉亞記者": {
            "生計壓力": ["我要找的是誰被犧牲、誰把責任說成技術問題。"],
            "世代衝突": ["如果只拍衝突畫面，真正的訴求就會消失。"],
            "資訊戰": ["所有人都想先定調，我偏要從時間線開始查。"],
            "發展代價": ["污染數據、會議紀錄、居民證詞，缺一個都不能結案。"],
            "安全焦慮": ["安全單位越急，我越要問授權依據在哪裡。"],
            "價值衝突": ["我不只要拍支持者，也要拍害怕的人為什麼害怕。"]
        },
        "龐頭目": {
            "生計壓力": ["工人不是數字，沒有談判位置就只能把壓力留在街上。"],
            "世代衝突": ["學生有聲量，基層有身體，兩邊如果接不起來就會被各個擊破。"],
            "資訊戰": ["網路吵得再大，現場有沒有人才是真的。"],
            "發展代價": ["污染和低薪常常落在同一群人身上，別把它拆開談。"],
            "安全焦慮": ["一扣上安全帽子，基層訴求就很容易被消音。"]
        },
        "雷將軍": {
            "資訊戰": ["假消息不是意見，是能被外部勢力利用的破口。"],
            "安全焦慮": ["我只問一件事：失控時誰有權下命令？"],
            "世代衝突": ["學生行動如果被人借力，後果不是校園自己能承擔。"],
            "發展代價": ["能源與工業安全不是地方議題，它會牽動整個國家韌性。"]
        },
        "費教授": {
            "生計壓力": ["分配問題不能只問誰可憐，也要問制度怎麼持續。"],
            "世代衝突": ["世代不是答案，真正的問題是誰被排除在決策外。"],
            "資訊戰": ["資訊戰最怕的是大家用立場代替查證。"],
            "發展代價": ["外部成本被藏起來時，市場價格本身就會說謊。"],
            "安全焦慮": ["安全和自由不是二選一，而是權力如何被監督。"],
            "價值衝突": ["價值衝突需要制度翻譯，不是誰比較大聲。"]
        },
        "蘇網紅": {
            "生計壓力": ["『誰付不起帳單』比『制度改革』更容易讓人停下來看。"],
            "世代衝突": ["年輕人對長輩，這標題很爆，但也最容易失真。"],
            "資訊戰": ["你不先說故事，別人就會替你剪一版。"],
            "發展代價": ["污染畫面很好傳，但誰要付轉型成本就比較難講。"],
            "安全焦慮": ["國安兩個字自帶流量，也自帶恐懼。"],
            "價值衝突": ["這種議題不能太抽象，要讓觀眾看到一個家庭怎麼被影響。"]
        }
    };

    const roleLines = lines[name]?.[lensLabel] || [];
    if (/車禍|事故|意外|工安|傷亡/.test(text)) {
        const accident = {
            "柯爾市長": ["我第一個要知道的是：市府有沒有提早收到風險通報。"],
            "莉亞記者": ["事故不是悲劇標題而已，我要的是責任鏈。"],
            "雷將軍": ["現場秩序如果再亂，事故會立刻變成治理危機。"],
            "費教授": ["先分清楚意外、疏失與制度漏洞，否則只會找代罪者。"],
            "艾達議員": ["如果有制度漏洞，這就不能只用慰問收場。"]
        }[name] || [];
        return accident.length ? accident : roleLines;
    }
    if (/醜聞|賄|貪腐|黑箱|弊案/.test(text)) {
        const scandal = {
            "柯爾市長": ["如果被看成包庇，市府後面說什麼都會被當成遮掩。"],
            "莉亞記者": ["有人越急著切割，越代表文件還沒攤開。"],
            "費教授": ["透明不是形象工程，是讓責任可以被檢驗。"],
            "蘇網紅": ["黑箱兩個字就夠了，接下來大家會自己補故事。"],
            "威廉總裁": ["企業最怕被拖進政治醜聞，投資會先縮手。"]
        }[name] || [];
        return scandal.length ? scandal : roleLines;
    }
    return roleLines;
}

function stakeholderVoice(name, event = {}) {
    const lens = issueLens(event);
    const text = eventText(event);
    const trust = gameState.npcApprovals?.[name] ?? ensureCharacterArc(name)?.trust ?? 50;
    const profile = npcInterestProfile(name);
    const posture = trust >= 70
        ? `因為你先前沒有踩到他的核心利益，`
        : trust <= 30
            ? `因為你已經碰到他的「${profile.risk}」，`
            : "";
    const specific = lensSpecificVoice(name, lens.label, text);
    const candidates = specific.length ? specific : profile.watch;
    const line = pickLine(candidates, `${name}|${lens.label}|${event.title}|${gameState.currentEventIndex}|${trust}`);
    return `${posture}${line}`;
}

function npcIssuePosition(name = "", event = {}) {
    const lens = issueLens(event).label;
    const profile = npcInterestProfile(name);
    const table = {
        "柯爾市長": {
            "責任危機": ["自保但必須回應", "要查清責任，但不能讓市府變成唯一代罪者。"],
            "生計壓力": ["條件支持", "只要財源與責任清楚，就願意進行政程序。"],
            "世代衝突": ["控場優先", "支持學生被聽見，但不能讓市府被街頭拖著走。"],
            "資訊戰": ["查證後回應", "怕市府慢半拍變成遮掩，但也怕倉促定調。"],
            "發展代價": ["風險治理", "污染與開發都要有人負責，不能只靠公關。"],
            "安全焦慮": ["秩序優先", "一旦被定義成安全問題，市府會先保守。"],
            "價值衝突": ["平衡兩端", "不想讓任何一邊覺得市府放棄他們。"]
        },
        "莫長老": {
            "責任危機": ["保護居民", "要求先照顧受影響的人，不要只開記者會。"],
            "生計壓力": ["謹慎同情", "理解壓力，但反對把社區拖進衝突。"],
            "世代衝突": ["保護社區", "願意聽年輕人，但不能把長輩塑造成敵人。"],
            "資訊戰": ["防止撕裂", "最怕群組謠言讓鄰里互相仇視。"],
            "發展代價": ["居民優先", "反對居民承擔發展後果卻沒有發言權。"],
            "價值衝突": ["傳統保留", "接受討論，但要保留傳統社群的尊嚴。"]
        },
        "艾達議員": {
            "責任危機": ["要求調查", "要把事故從慰問推進到調查和制度修補。"],
            "生計壓力": ["改革推進", "只要能說明受害者與財源，就能推質詢。"],
            "世代衝突": ["程序轉化", "要把街頭壓力轉成校方或市府必須回應的流程。"],
            "資訊戰": ["權利設計", "同時保護言論與降低傷害，需要清楚邊界。"],
            "發展代價": ["制度審查", "要求把環境成本寫進審查與補償。"],
            "安全焦慮": ["監督權力", "國安不能成為空白授權。"],
            "價值衝突": ["權利入法", "把權利寫進制度，避免每次重新撕裂。"]
        },
        "威廉總裁": {
            "責任危機": ["切清責任", "支持調查，但反對還沒查清就把成本丟給企業。"],
            "生計壓力": ["成本警戒", "支持改善待遇，但反對無財源、無緩衝的改革。"],
            "世代衝突": ["規則穩定", "年輕人要未來，企業要可預測規則。"],
            "資訊戰": ["市場避險", "謠言會讓投資先縮手。"],
            "發展代價": ["轉型分攤", "環保可以談，但成本不能被假裝不存在。"],
            "安全焦慮": ["供應鏈安全", "安全風險升高會先傷害投資與就業。"]
        },
        "莉亞記者": {
            "責任危機": ["追責查證", "要時間線、通報紀錄和誰延誤了處理。"],
            "生計壓力": ["追責查證", "要找誰被犧牲、誰把責任說成技術問題。"],
            "世代衝突": ["避免扁平化", "不只拍衝突，也追真正訴求。"],
            "資訊戰": ["時間線優先", "不讓任何陣營先替真相定稿。"],
            "發展代價": ["證據揭露", "數據、會議紀錄、居民證詞缺一不可。"],
            "安全焦慮": ["追問授權", "越是安全名義，越要問依據。"],
            "價值衝突": ["多方可見", "支持者和害怕的人都要被看見。"]
        },
        "龐頭目": {
            "責任危機": ["要求補償", "如果受傷的是基層，就不能只用道歉收場。"],
            "生計壓力": ["談判施壓", "沒有談判位置，基層只能留在街上。"],
            "世代衝突": ["街頭串聯", "學生聲量要接上基層身體，否則會被切開。"],
            "資訊戰": ["現場為真", "網路再吵，現場有沒有人才是籌碼。"],
            "發展代價": ["成本正義", "污染和低薪常落在同一群人身上。"],
            "安全焦慮": ["反消音", "一扣上安全帽子，基層訴求就容易被消音。"]
        },
        "雷將軍": {
            "責任危機": ["先穩現場", "事故會變成秩序危機，現場不能再亂。"],
            "世代衝突": ["防滲透", "學生行動若被外力借力，後果不是校園能承擔。"],
            "資訊戰": ["安全破口", "假消息不是意見，而是可被利用的破口。"],
            "發展代價": ["韌性安全", "能源與工安會牽動國家韌性。"],
            "安全焦慮": ["邊界優先", "先問失控時誰有權下命令。"]
        },
        "費教授": {
            "責任危機": ["拆清責任", "先分清意外、疏失和制度漏洞。"],
            "生計壓力": ["制度持續", "分配問題要同時問正義與可持續。"],
            "世代衝突": ["排除分析", "不是世代本身，而是誰被排除在決策外。"],
            "資訊戰": ["反立場先行", "最怕大家用立場代替查證。"],
            "發展代價": ["外部成本", "成本被藏起來時，價格本身會說謊。"],
            "安全焦慮": ["權力監督", "安全和自由不是二選一，而是權力如何被監督。"],
            "價值衝突": ["制度翻譯", "價值衝突要被制度翻譯，不是誰比較大聲。"]
        },
        "蘇網紅": {
            "責任危機": ["放大矛盾", "事故需要一個清楚問題：誰害大家受傷？"],
            "生計壓力": ["故事化", "具體帳單比制度改革更容易被理解。"],
            "世代衝突": ["高傳播風險", "世代對立很爆，也最容易失真。"],
            "資訊戰": ["先搶敘事", "你不先說故事，別人就會替你剪一版。"],
            "發展代價": ["視覺衝突", "污染畫面好傳，成本分攤難講。"],
            "安全焦慮": ["恐懼流量", "國安自帶流量，也自帶恐懼。"],
            "價值衝突": ["生活化", "抽象權利要變成一個家庭如何受影響。"]
        }
    };
    const [label, reason] = table[name]?.[lens] || [profile.stance, `核心利益：${profile.interest}；可妥協：${profile.compromise}`];
    return { label, reason };
}

function continuityLead(name = "", tone = "watch", event = {}) {
    const previous = gameState.npcContinuity?.[name];
    const profile = npcInterestProfile(name);
    const lens = issueLens(event).label;
    if (!previous) return `他的基本立場是「${profile.stance}」。`;
    if (previous.tone !== tone) {
        if (tone === "support") {
            return `雖然上一回合他在「${previous.lens}」對你保留，但這次沒有踩到「${profile.redLine}」，所以態度轉為鬆動。`;
        }
        if (tone === "oppose") {
            return `雖然上一回合他曾靠近你，但這次碰到紅線：「${profile.redLine}」，所以開始反制。`;
        }
        return `上一回合他是「${previous.label}」，這次先退回觀望，因為他要確認「${profile.interest}」有沒有被照顧。`;
    }
    if (previous.lens === lens) return `延續他在「${lens}」上的立場，`;
    return `從上一回合「${previous.lens}」轉到「${lens}」，他仍用「${profile.interest}」判斷，`;
}

function rememberNpcContinuity(reaction = {}, event = {}) {
    if (!reaction.npc) return;
    const lens = issueLens(event).label;
    const position = npcIssuePosition(reaction.npc, event);
    gameState.npcContinuity[reaction.npc] = {
        tone: reaction.tone,
        lens,
        label: position.label,
        turn: gameState.currentEventIndex + 1
    };
}

function renderStakeholderCouncil(event = {}) {
    const names = involvedCharactersForEvent(event);
    return `
        <div class="stakeholder-council">
            <div class="council-title">這回合會影響誰</div>
            ${names.slice(0, 4).map((name) => {
                const position = npcIssuePosition(name, event);
                return `
                    <article>
                        ${renderAvatar(name, "council-avatar")}
                        <div>
                            <b>${escapeHTML(name)} · ${escapeHTML(position.label)}</b>
                            <span>${escapeHTML(stakeholderVoice(name, event))}</span>
                            <em>${escapeHTML(position.reason)}</em>
                        </div>
                    </article>`;
            }).join("")}
        </div>`;
}

function arcStatusText(arc) {
    if (!arc) return "觀望中";
    if (arc.relationState === "repaired") return "關係修復";
    if (arc.relationState === "ruptured") return "關係決裂";
    if (arc.tension >= 4) return "準備反制";
    if (arc.momentum >= 4) return "主線推進";
    if (arc.trust >= 70) return "願意靠近";
    if (arc.trust <= 30) return "保持距離";
    return "觀望拉扯";
}

function relationshipStateForArc(arc) {
    if (!arc) return "open";
    if (arc.trust >= 68 && arc.momentum >= 3) return "repaired";
    if (arc.trust <= 28 || arc.tension >= 5) return "ruptured";
    if (arc.momentum >= 2) return "repairing";
    if (arc.tension >= 2) return "fraying";
    return "open";
}

function relationshipLineForState(arc, state = arc?.relationState) {
    if (!arc) return "";
    if (state === "repaired") return arc.relation.repair;
    if (state === "ruptured") return arc.relation.rupture;
    if (state === "repairing") return `這段關係正在被修復：${arc.relation.repair}`;
    if (state === "fraying") return `這段關係正在惡化：${arc.relation.rupture}`;
    return arc.relation.open;
}

function stakeholderImpactLine(name, event = {}) {
    const lens = issueLens(event);
    if (lens.actors.includes(name)) return `${lens.label}直接牽動他的主線。`;
    const lines = {
        "柯爾市長": "他會評估這件事是否威脅市府治理正當性。",
        "莫長老": "他會看這件事會不會侵入社區日常與長輩網絡。",
        "艾達議員": "她會尋找能不能把衝突轉成質詢或法案。",
        "威廉總裁": "他會計算這件事會不會改變投資與成本預期。",
        "莉亞記者": "她會追問誰在說真話、誰在轉移焦點。",
        "龐頭目": "他會判斷街頭組織能不能換到談判位置。",
        "雷將軍": "他會觀察這件事是否能被定義成安全問題。",
        "費教授": "他會檢查公共討論有沒有被情緒取代。",
        "蘇網紅": "他會尋找能不能把矛盾剪成可傳播的敘事。"
    };
    return lines[name] || "他會重新計算自己和你的距離。";
}

function renderCharacterArcCard(name, event = null) {
    const arc = ensureCharacterArc(name);
    const focus = event ? issueLens(event).label : "主線";
    return `
        <article class="arc-card ${arc.tension >= 4 ? "tense" : arc.momentum >= 4 ? "moving" : ""}">
            ${renderAvatar(name, "arc-avatar")}
            <div>
                <span>${escapeHTML(arcStatusText(arc))}</span>
                <b>${escapeHTML(name)}</b>
                <small>${escapeHTML(stakeholderImpactLine(name, event))}</small>
                <em>${escapeHTML(focus)}：${escapeHTML(compactText(relationshipLineForState(arc), 34))}</em>
            </div>
        </article>`;
}

function renderCharacterArcBoard(event = {}) {
    const names = involvedCharactersForEvent(event);
    return `
        <div class="character-arc-board">
            <div class="arc-board-title">牽動角色主線</div>
            <div class="stakeholder-grid">
                ${names.slice(0, 6).map((name) => renderCharacterArcCard(name, event)).join("")}
            </div>
        </div>`;
}

function arcChangeLine(name, effects = {}, reaction = {}) {
    const [key, value] = strongestEffect(effects);
    if (reaction.npc === name && reaction.tone === "oppose") {
        return "你的選擇碰到他的底線，他會把自己的主線推向反制。";
    }
    if (reaction.npc === name && reaction.tone === "support") {
        return "你給了他可利用的入口，他的主線暫時和你靠近。";
    }

    if (name === "艾達議員" && (effects.progress > 0 || effects.freedom > 0)) return "她更有理由把民間壓力送進正式議程。";
    if (name === "莫長老" && (effects.populism > 0 || effects.order < 0)) return "他會把事件說成社區秩序被威脅。";
    if (name === "莉亞記者" && (effects.progress > 0 || effects.freedom > 0)) return "她拿到追查線索，準備把事件做成連續報導。";
    if (name === "雷將軍" && (effects.order < 0 || effects.populism > 0)) return "他得到更多理由主張安全控管。";
    if (name === "費教授" && (effects.populism > 0)) return "他會公開提醒大家不要被情緒牽著走。";
    if (name === "蘇網紅" && (effects.populism > 0)) return "他抓到可傳播的衝突，會把事件剪成更尖銳的版本。";
    if (name === "威廉總裁" && (effects.progress > 0)) return "他開始評估改革會不會改變成本結構。";
    if (name === "龐頭目" && (effects.order < 0 || effects.freedom > 0)) return "他看到街頭籌碼增加，會要求更多談判位置。";

    return `${effectLabel(key)}${effectDirection(value)}，讓他重新計算自己的站位。`;
}

function updateCharacterArcs(event = {}, effects = {}, reaction = {}, pTarget = null, isPHigh = false) {
    const names = involvedCharactersForEvent(event, reaction, pTarget);
    const changes = [];
    names.forEach((name) => {
        const arc = ensureCharacterArc(name);
        if (!arc) return;
        const previousRelationState = arc.relationState;

        if (reaction.npc === name) {
            if (reaction.tone === "support") {
                arc.trust += 8;
                arc.momentum += 2;
            } else if (reaction.tone === "oppose") {
                arc.trust -= 8;
                arc.tension += 2;
            } else {
                arc.tension += 1;
            }
        }

        if (pTarget === name) {
            arc.trust += isPHigh ? 6 : -10;
            arc.tension += isPHigh ? 0 : 2;
        }

        if (name === "艾達議員" && ((effects.progress || 0) > 0 || (effects.freedom || 0) > 0)) arc.momentum += 1;
        if (name === "莫長老" && ((effects.populism || 0) > 0 || (effects.order || 0) < 0)) arc.tension += 1;
        if (name === "莉亞記者" && ((effects.progress || 0) > 0 || (effects.freedom || 0) > 0)) arc.momentum += 1;
        if (name === "雷將軍" && ((effects.order || 0) < 0 || (effects.populism || 0) > 0)) arc.tension += 1;
        if (name === "費教授" && ((effects.populism || 0) > 0)) arc.tension += 1;
        if (name === "蘇網紅" && ((effects.populism || 0) > 0)) arc.momentum += 2;
        if (name === "威廉總裁" && ((effects.progress || 0) > 0)) arc.tension += 1;
        if (name === "龐頭目" && ((effects.order || 0) < 0 || (effects.freedom || 0) > 0)) arc.momentum += 1;

        arc.trust = Math.max(0, Math.min(100, arc.trust));
        arc.relationState = relationshipStateForArc(arc);
        arc.relationText = relationshipLineForState(arc);
        arc.lastChange = arcChangeLine(name, effects, reaction);
        changes.push({
            name,
            status: arcStatusText(arc),
            text: arc.lastChange,
            relation: arc.relationText,
            completed: ["repaired", "ruptured"].includes(arc.relationState) && arc.relationState !== previousRelationState
        });
    });
    gameState.lastArcChanges = changes
        .sort((a, b) => Number(b.completed) - Number(a.completed))
        .slice(0, 5);
    return gameState.lastArcChanges;
}

function renderArcChanges(changes = gameState.lastArcChanges) {
    if (!changes.length) return "";
    return `
        <div class="arc-change-panel">
            <b>角色主線變化</b>
            ${changes.slice(0, 3).map((change) => `
                <article>
                    ${renderAvatar(change.name, "arc-change-avatar")}
                    <div>
                        <span>${escapeHTML(change.name)} · ${escapeHTML(change.status)}</span>
                        <small>${escapeHTML(change.text)}</small>
                        <em>${escapeHTML(change.relation)}</em>
                    </div>
                </article>
            `).join("")}
        </div>`;
}

function compactText(text = "", max = 58) {
    const cleaned = polishNarrativeText(text)
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    const first = cleaned.split(/[。！？]/).filter(Boolean)[0];
    const sentence = first ? `${first}。` : cleaned;
    return sentence.length > max ? `${sentence.slice(0, max)}...` : sentence;
}

function effectToken(effects = {}) {
    const [key, value] = strongestEffect(effects);
    const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "·";
    return `${effectLabel(key)} ${arrow}`;
}

function sceneBeat(effects = {}, reaction = {}) {
    if ((effects.populism || 0) > 0) {
        return {
            type: "viral",
            label: "社群爆量",
            line: "截圖開始流傳。",
            next: "下一幕：輿論反噬"
        };
    }
    if ((effects.order || 0) < 0) {
        return {
            type: "street",
            label: "現場升溫",
            line: "人群往前擠。",
            next: "下一幕：秩序壓力"
        };
    }
    if ((effects.progress || 0) > 0) {
        return {
            type: "meeting",
            label: "程序打開",
            line: "有人遞出會議名單。",
            next: "下一幕：閉門協調"
        };
    }
    if ((effects.freedom || 0) < 0) {
        return {
            type: "silence",
            label: "聲音退後",
            line: "群組突然安靜。",
            next: "下一幕：沉默代價"
        };
    }
    if (reaction.tone === "oppose") {
        return {
            type: "block",
            label: "有人擋路",
            line: "反對者開始串聯。",
            next: "下一幕：反對派集結"
        };
    }
    return {
        type: "call",
        label: "電話響起",
        line: "有人要你私下談。",
        next: "下一幕：試探交換"
    };
}

function renderSceneBeat(beat, reaction) {
    return `
        <div class="beat-card ${beat.type}">
            <div class="beat-pulse"></div>
            ${renderAvatar(reaction.npc, "beat-avatar")}
            <div>
                <b>${escapeHTML(beat.label)}</b>
                <span>${escapeHTML(beat.line)}</span>
            </div>
        </div>
    `;
}

function choiceCostLine(choice = {}) {
    const effects = choice.effects || {};
    const [key, value] = strongestEffect(effects);
    if (!value) return "後果不明";
    const lines = {
        freedom: value > 0 ? "發聲↑ 秩序派不滿" : "安靜↑ 支持者不滿",
        order: value > 0 ? "秩序↑ 被看成退讓" : "壓力↑ 失控風險",
        progress: value > 0 ? "改革↑ 需要承擔者" : "好收場 改革↓",
        populism: value > 0 ? "聲量↑ 對立↑" : "降溫↑ 力道被質疑"
    };
    return lines[key] || "局勢改寫";
}

function recentMemoryLine() {
    const memory = gameState.memories[gameState.memories.length - 1];
    if (!memory) return "";
    return `<div class="memory-strip"><strong>上一個痕跡</strong><span>${escapeHTML(memory.text)}</span></div>`;
}

function watcherLine(name, role) {
    const lines = {
        ally: "等你的下一步。",
        skeptic: "正在盯著你。",
        memory: "記得上一回合。"
    };
    return lines[role] || "觀望中。";
}

function renderWatcherCard(name, role, label) {
    return `
        <article class="watcher-card ${role}">
            ${renderAvatar(name, "watcher-avatar")}
            <div>
                <b>${escapeHTML(name)}</b>
                <small>${escapeHTML(label)}</small>
                <span>${escapeHTML(watcherLine(name, role))}</span>
            </div>
        </article>
    `;
}

function renderSceneWatchers() {
    const profile = roleProfile();
    const previous = gameState.memories[gameState.memories.length - 1];
    const watchers = [
        { name: profile.ally, role: "ally", label: "可能伸手的人" },
        { name: profile.skeptic, role: "skeptic", label: "正在懷疑你的人" }
    ];

    if (previous && !watchers.some((item) => item.name === previous.npc)) {
        watchers.unshift({ name: previous.npc, role: "memory", label: "記得上一回合的人" });
    }

    return `
        <div class="watcher-stage">
            <div class="watcher-heading">場上目光</div>
            ${watchers.slice(0, 3).map((item) => renderWatcherCard(item.name, item.role, item.label)).join("")}
        </div>
    `;
}

function buildStoryBridge(ev) {
    const profile = roleProfile();
    const previous = gameState.memories[gameState.memories.length - 1];

    if (!previous) {
        return `
            <div class="story-bridge">
                <b>當前目標</b>
                <span>${escapeHTML(compactText(profile.throughline, 42))}</span>
            </div>`;
    }

    const connector = previous.tone === "oppose"
        ? `${previous.npc}還在反彈。`
        : previous.tone === "support"
            ? `${previous.npc}剛給你一點空間。`
            : `${previous.npc}還在觀望。`;

    return `
        <div class="story-bridge">
            <b>承接上一回合</b>
            <span>${escapeHTML(connector)}</span>
        </div>`;
}

function buildEventBrief(ev) {
    const chapter = chapterInfo();
    const lens = issueLens(ev);
    const playerLine = ev.is_news
        ? "這則新聞不是插曲，它會改變場上角色的談判籌碼。"
        : scenePlayerPosition(ev);
    return `
        <div class="chapter-strip">
            <span>${escapeHTML(chapter.label)}</span>
            <strong>第 ${gameState.currentEventIndex + 1} / ${gameState.events.length} 回合</strong>
        </div>
        <p class="event-one-line">${escapeHTML(compactText(ev.description, 72))}</p>
        ${renderNewsContent(ev)}
        ${renderIssueDemand(ev)}
        <section class="scene-brief">
            <header>
                <span>${escapeHTML(lens.label)}</span>
                <b>${escapeHTML(sceneQuestion(ev))}</b>
            </header>
            <div class="scene-brief-grid">
                <article>
                    <small>引爆點</small>
                    <strong>${escapeHTML(lens.cause)}</strong>
                </article>
                <article>
                    <small>你的位置</small>
                    <strong>${escapeHTML(playerLine)}</strong>
                </article>
                <article>
                    <small>現在的壓力</small>
                    <strong>${escapeHTML(scenePressureLine(ev))}</strong>
                </article>
            </div>
        </section>
        <div class="scene-focus">
            <b>本回合主要問題</b>
            <span>${escapeHTML(sceneDecisionFocus(ev))}</span>
        </div>
        ${renderStakeholderCouncil(ev)}
    `;
}

function formatChoiceButton(button, choice) {
    if (!button || !choice) return;
    button.innerHTML = `
        <span class="choice-main">${escapeHTML(polishNarrativeText(choice.text))}</span>
    `;
}

function neutralizePersuasionLabel(text = "") {
    return polishNarrativeText(text)
        .replace(/[（(][^）)]*(高|低)\s*說服力?[^）)]*[)）]/g, "")
        .replace(/[（(][^）)]*(高|低)\s*說服[^）)]*[)）]/g, "")
        .replace(/\s*(高|低)\s*說服力?\s*/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function npcShiftReactionText(npc, delta, effects = {}, event = {}) {
    const lens = issueLens(event).label;
    const profile = npcInterestProfile(npc);
    const seed = `${npc}|${delta}|${lens}|${effectToken(effects)}|${gameState.currentEventIndex}`;
    if (delta < 0) {
        const lines = {
            "柯爾市長": [
                "市長幕僚開始擔心這件事會被寫成治理失能，而不是單一事件。",
                `你讓「${profile.interest}」受傷，市府會先保護自己的責任邊界。`
            ],
            "莫長老": [
                "莫長老把你的路線看成對社區秩序的冒進，開始提醒熟人保持距離。",
                "他不是單純討厭改變，而是覺得你把社區安全感拿去交換聲量。"
            ],
            "艾達議員": [
                "艾達議員覺得你讓議題更難進入正式程序，暫時收回支援。",
                "她擔心這一幕會被反對派拿來證明改革派只會施壓。"
            ],
            "威廉總裁": [
                "威廉總裁認為成本被你推到企業身上，開始尋找反制盟友。",
                "他會把你的選擇包裝成投資不確定性，拿去說服商會。"
            ],
            "莉亞記者": [
                "莉亞記者覺得你避開了關鍵事實，準備用報導檢視你的說法。",
                "她開始把鏡頭轉向你：為什麼你選擇這個版本的真相？"
            ],
            "龐頭目": [
                "龐頭目覺得基層又被要求等待，街頭組織開始不耐。",
                "他會告訴群眾：沒有壓力，桌上就不會有基層的位置。"
            ],
            "雷將軍": [
                "雷將軍認為你低估失控風險，會把安全牌拿得更高。",
                "他會把這件事重新定義成秩序破口，要求更強邊界。"
            ],
            "費教授": [
                "費教授認為你的說法過度簡化，準備公開拆解。",
                "他會把這一幕當成案例，提醒大家情緒不能替代制度設計。"
            ],
            "蘇網紅": [
                "蘇網紅覺得你給了他反向剪輯的素材。",
                "他會把你的矛盾剪成短片，讓觀眾先笑再站隊。"
            ]
        };
        return pickLine(lines[npc] || [`${npc}把這次選擇記成你的政治弱點。`], seed);
    }

    const [key, value] = strongestEffect(effects);
    const lines = {
        "柯爾市長": [
            "市府暫時看見可控的收場方式，但仍要求你補上責任歸屬。",
            "他願意給你一點行政空間，因為這一幕沒有直接炸掉治理正當性。"
        ],
        "莫長老": [
            "莫長老覺得你至少沒有把社區安全感完全推開。",
            "他會先壓住社區群組裡的反彈，看看你是否真的願意溝通。"
        ],
        "艾達議員": [
            "艾達議員看見能把議題送進質詢或法案的入口。",
            "她會要求幕僚整理材料，因為這次有機會從口號變成程序。"
        ],
        "威廉總裁": [
            "威廉總裁願意談，但會要求你承認改革成本。",
            "他暫時不反擊，因為你還沒有把企業塑造成唯一壞人。"
        ],
        "莉亞記者": [
            "莉亞記者拿到可追查的線索，準備延伸報導。",
            "她願意繼續跟，因為這次有文件、時間線或責任鏈可查。"
        ],
        "龐頭目": [
            "龐頭目看見談判籌碼增加，願意先不翻桌。",
            "他會把街頭壓力收束成談判條件，而不是立刻升高行動。"
        ],
        "雷將軍": [
            "雷將軍認為場面還能被控住，暫時放低警戒。",
            "他願意退一步，前提是安全邊界沒有被你說成多餘。"
        ],
        "費教授": [
            "費教授認為討論還有機會回到證據與制度設計。",
            "他會把你的選擇拿來示範：情緒可以降溫，問題仍要處理。"
        ],
        "蘇網紅": [
            "蘇網紅抓到能讓更多人理解事件的敘事。",
            "他覺得這一幕可以做成一支不只煽動、也能解釋的短片。"
        ]
    };
    return pickLine(lines[npc] || [`${npc}看見${effectLabel(key)}${effectDirection(value)}，暫時願意靠近。`], seed);
}

function buildNpcReaction(beforeApprovals, effects, pTarget, isPHigh, event = {}) {
    let npc = pTarget || "";
    let text = "";
    let tone = "watch";

    if (npc) {
        const after = gameState.npcApprovals[npc];
        const before = beforeApprovals[npc] ?? after;
        tone = after >= before ? "support" : "oppose";
        if (isPHigh && tone === "support") {
            text = `${npcDialogueLine(npc, "support", event, effects, "persuasion")} 他沒有完全放心，但願意暫時留在談判桌上。`;
        } else if (isPHigh) {
            text = `${npcDialogueLine(npc, "oppose", event, effects, "persuasion")} 他聽懂你的理由，卻仍認為代價被推到自己身上。`;
        } else if (tone === "support") {
            text = `${npcDialogueLine(npc, "watch", event, effects, "persuasion")} 你的說服不漂亮，但局勢讓他暫時不反制。`;
        } else {
            text = `${npcDialogueLine(npc, "oppose", event, effects, "persuasion")} 他把這次衝突記下來，之後更可能在關鍵場合阻擋你。`;
        }
    } else {
        const shifted = Object.entries(gameState.npcApprovals || {})
            .map(([name, after]) => [name, after - (beforeApprovals[name] ?? after)])
            .filter(([name, delta]) => name !== gameState.character?.name && Math.abs(delta) >= 8)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

        if (shifted) {
            npc = shifted[0];
            tone = shifted[1] >= 0 ? "support" : "oppose";
            text = npcShiftReactionText(npc, shifted[1], effects, event);
        } else if ((effects.freedom || 0) > 0) {
            npc = "艾達議員";
            tone = "support";
            text = npcDialogueLine(npc, tone, event, effects, "reaction");
        } else if ((effects.order || 0) > 0) {
            npc = "雷將軍";
            tone = "support";
            text = npcDialogueLine(npc, tone, event, effects, "reaction");
        } else if ((effects.populism || 0) > 0 || (effects.order || 0) < 0) {
            npc = "莫長老";
            tone = "oppose";
            text = npcDialogueLine(npc, tone, event, effects, "reaction");
        } else if ((effects.progress || 0) > 0) {
            npc = "莉亞記者";
            tone = "support";
            text = npcDialogueLine(npc, tone, event, effects, "reaction");
        } else {
            npc = "柯爾市長";
            tone = "watch";
            text = npcDialogueLine(npc, tone, event, effects, "reaction");
        }
    }

    text = `${continuityLead(npc, tone, event)}${text}`;
    const memory = { turn: gameState.currentEventIndex + 1, npc, tone, text };
    gameState.memories.push(memory);
    gameState.memories = gameState.memories.slice(-4);
    rememberNpcContinuity(memory, event);
    return memory;
}

function buildNpcInteraction(reaction, effects) {
    return buildNpcExchange(reaction, effects).summary;
}

function npcDialogueLine(name = "", tone = "watch", event = {}, effects = {}, side = "actor") {
    const profile = npcInterestProfile(name);
    const lens = issueLens(event).label;
    const [key, value] = strongestEffect(effects);
    const seed = `${name}|${tone}|${lens}|${key}|${value}|${side}|${gameState.currentEventIndex}`;
    const issueLine = pickLine(lensSpecificVoice(name, lens, eventText(event)) || [], `${seed}|issue`);
    if (issueLine) {
        const endings = {
            support: [
                `所以我可以靠近，但條件是：${profile.compromise}`,
                `這次沒有踩到我的底線，我願意把「${profile.interest}」放進合作。`
            ],
            oppose: [
                `但你的做法踩到我的底線：${profile.redLine}`,
                `如果你不補上代價說明，我會從「${profile.risk}」這裡反制。`
            ],
            watch: [
                `我先看你下一步有沒有照顧「${profile.interest}」。`,
                `這件事還不能只看口號，我要看誰承擔成本。`
            ]
        };
        return `${issueLine}${pickLine(endings[tone] || endings.watch, `${seed}|ending`)}`;
    }
    const roleLines = {
        "柯爾市長": {
            support: ["我可以給你一場協調會，但你要讓市府有能說出口的責任分工。", "如果這能穩住局勢，我願意把它排進正式議程。"],
            oppose: ["你把治理正當性打穿，我就只能先守住市府邊界。", "我不會讓市府變成所有怒氣的出口。"],
            watch: ["先拿出能處理的版本，不然這只會變成下一場記者會。"]
        },
        "莫長老": {
            support: ["你願意先說清楚對社區的影響，我就能幫你擋一點反彈。", "別把長輩當敵人，這樣我還能替你說話。"],
            oppose: ["你又把社區推到衝突前線，這會逼我站出來擋。", "居民要生活，不是每天替政治收尾。"],
            watch: ["我看你下一步是不是還願意給社區台階。"]
        },
        "艾達議員": {
            support: ["這能變成質詢題目，但你要把人證和文件補齊。", "你給我一個制度入口，我就能把它推進議會。"],
            oppose: ["這樣進不了程序，只會被對手說成情緒勒索。", "我不能替沒有責任設計的口號背書。"],
            watch: ["我等你把訴求整理成可以被審議的版本。"]
        },
        "威廉總裁": {
            support: ["承認成本，我們才有談判空間。", "只要規則可預測，企業不是不能讓步。"],
            oppose: ["你把成本講得像不存在，投資會先撤。", "如果今天用聲量改規則，明天就沒人敢負責。"],
            watch: ["我先看你是談制度，還是只想找人付錢。"]
        },
        "莉亞記者": {
            support: ["給我時間線，我會追到責任鏈完整為止。", "這次你沒有只給口號，我可以繼續查。"],
            oppose: ["別把我當擴音器，我要的是證據。", "你避開的那一段，才是我要追的地方。"],
            watch: ["我還不寫結論，先看誰的說法經得起查。"]
        },
        "龐頭目": {
            support: ["有談判位置，我就能讓街頭先穩住。", "你把基層放進桌上，我的人會看見。"],
            oppose: ["你又要我們等，等到最後什麼都沒有。", "沒有籌碼，就不要叫大家理性。"],
            watch: ["我看的是痛苦有沒有換到位置。"]
        },
        "雷將軍": {
            support: ["邊界清楚，我可以不升高管制。", "先穩住風險，安全系統才不用站到最前面。"],
            oppose: ["你在拿失控賭政治收益，這我不能放。", "自由不能替安全破口背書。"],
            watch: ["我先看這會不會被外部或極端者利用。"]
        },
        "費教授": {
            support: ["你把責任與制度缺口分開了，討論才有品質。", "這至少讓長期成本被看見。"],
            oppose: ["你把問題剪成口號，政策就無法被檢驗。", "情緒能動員，但不能替制度設計交卷。"],
            watch: ["我先問證據在哪裡，然後才談價值。"]
        },
        "蘇網紅": {
            support: ["這句話能剪出去，觀眾會懂。", "你給我一個清楚衝突點，聲量會自己跑。"],
            oppose: ["你講得太完整，我反而能剪成另一個版本。", "這不夠尖，觀眾不會停下來。"],
            watch: ["我先看哪一句會被轉發。"]
        }
    };

    const fallback = {
        support: [`這一步有碰到我的「${profile.interest}」，我可以先靠近。`],
        oppose: [`你踩到我的「${profile.risk}」，我會開始反制。`],
        watch: [`${effectLabel(key)}${effectDirection(value)}，我還在看局勢。`]
    };
    return pickLine(roleLines[name]?.[tone] || fallback[tone] || fallback.watch, seed);
}

function buildNpcExchange(reaction, effects, event = {}) {
    const [key, value] = strongestEffect(effects);
    const profile = roleProfile();
    const ally = profile.ally || "莉亞記者";
    const skeptic = profile.skeptic || "莫長老";
    const actor = reaction.npc;

    let other = reaction.tone === "oppose" ? ally : skeptic;
    if (other === actor) {
        other = reaction.tone === "oppose" ? "莉亞記者" : "雷將軍";
    }

    if (reaction.tone === "oppose") {
        return {
            actor,
            other,
            actorLine: npcDialogueLine(actor, "oppose", event, effects, "actor"),
            otherLine: npcDialogueLine(other, "watch", event, effects, "other"),
            summary: `${actor}把焦點放在「${npcInterestProfile(actor).risk}」，${other}則先觀望你能不能補上下一步。`
        };
    }

    if (reaction.tone === "support") {
        return {
            actor,
            other,
            actorLine: npcDialogueLine(actor, "support", event, effects, "actor"),
            otherLine: npcDialogueLine(other, "watch", event, effects, "other"),
            summary: `${actor}願意給你一點空間，因為這一步碰到他的「${npcInterestProfile(actor).interest}」；${other}仍在等你證明這不是臨時表態。`
        };
    }

    return {
        actor,
        other,
        actorLine: npcDialogueLine(actor, "watch", event, effects, "actor"),
        otherLine: npcDialogueLine(other, "watch", event, effects, "other"),
        summary: `${actor}沒有立刻站隊，只把消息轉給${other}。局勢還沒定型，但下一次選擇會更難被當成偶然。`
    };
}

function renderSpeakerSpotlight(reaction) {
    return `
        <div class="speaker-spotlight ${reaction.tone}">
            ${renderAvatar(reaction.npc, "speaker-avatar")}
            <div class="speech-bubble">
                <b>${escapeHTML(reaction.npc)}</b>
                <span>${escapeHTML(reaction.text)}</span>
            </div>
        </div>
    `;
}

function renderInteractionDialogue(reaction, effects, event = {}, exchangeOverride = null) {
    const exchange = exchangeOverride || buildNpcExchange(reaction, effects, event);
    return `
        <div class="interaction-card">
            <b>主要衝突</b>
            <div class="dialogue-pair">
                <article>
                    ${renderAvatar(exchange.actor, "dialogue-avatar")}
                    <div>
                        <strong>${escapeHTML(exchange.actor)}</strong>
                        <span>${escapeHTML(exchange.actorLine)}</span>
                    </div>
                </article>
                <article>
                    ${renderAvatar(exchange.other, "dialogue-avatar")}
                    <div>
                        <strong>${escapeHTML(exchange.other)}</strong>
                        <span>${escapeHTML(exchange.otherLine)}</span>
                    </div>
                </article>
            </div>
        </div>
    `;
}

function stakeholderStanceLine(name = "", trust = 50, profile = {}, lens = {}, effects = {}) {
    const [key, value] = strongestEffect(effects);
    const seed = `${name}|stance|${lens.label}|${key}|${value}|${Math.round(trust / 10)}`;
    if (trust >= 70) {
        return pickLine([
            `他會暫時把自己的「${profile.interest}」放進你的路線，替你爭取一點時間。`,
            `他願意幫你擋下部分反彈，但會要求你下一步兌現「${profile.compromise}」。`,
            `他把這次選擇視為合作訊號，開始替你連接自己的支持網絡。`
        ], seed);
    }
    if (trust <= 30) {
        return pickLine([
            `他會從「${profile.risk}」放大你的破口，提醒旁觀者不要太快相信你。`,
            `他把這次選擇記成警訊，準備在下一個議題上要求更高代價。`,
            `他不只是反對你，而是擔心自己的底線「${profile.redLine}」被推倒。`
        ], seed);
    }
    return pickLine([
        `他還沒有站隊，只在看你會不會把「${profile.interest}」也放進成本表。`,
        `他暫時保持距離，因為這一步還看不出誰要承擔後果。`,
        `他把態度留到下一回合，等你證明這不是臨時表態。`
    ], seed);
}

function socialReactionLine(name, event = {}, effects = {}, reaction = {}) {
    const lens = issueLens(event);
    const [key, value] = strongestEffect(effects);
    const trust = gameState.npcApprovals?.[name] ?? 50;
    const profile = npcInterestProfile(name);
    const stance = stakeholderStanceLine(name, trust, profile, lens, effects);

    if (name === reaction.npc) {
        if (reaction.tone === "oppose") return `${npcDialogueLine(name, "oppose", event, effects, "pulse")} ${stance}。`;
        if (reaction.tone === "support") return `${npcDialogueLine(name, "support", event, effects, "pulse")} ${stance}。`;
        return `${npcDialogueLine(name, "watch", event, effects, "pulse")} ${stance}。`;
    }

    const roleLines = {
        "柯爾市長": value < 0 && key === "order" ? "市府會把焦點放在失控風險，避免治理正當性被拖垮。" : "市府先計算這會不會傷到執政正當性與責任分工。",
        "莫長老": (effects.populism || 0) > 0 ? "社區群組開始擔心衝突進入日常生活。" : "他想知道你是不是願意給傳統社群台階。",
        "艾達議員": (effects.progress || 0) > 0 ? "她看見把議題送進程序的機會，開始找質詢切口。" : "她暫時找不到能進議會的版本。",
        "威廉總裁": (effects.progress || 0) > 0 ? "他開始盤算改革會改變多少成本與投資預期。" : "他會用穩定與就業說服觀望者。",
        "莉亞記者": "她開始補時間線，準備追誰在改寫敘事、誰在迴避責任。",
        "龐頭目": (effects.order || 0) < 0 ? "他認為街頭籌碼變強了，可以要求談判位置。" : "他擔心基層又被請回去等待。",
        "雷將軍": lens.label === "安全焦慮" || (effects.order || 0) < 0 ? "他會把事件往安全問題定義，要求明確邊界。" : "他暫時按兵不動，但要求更清楚的風險控管。",
        "費教授": (effects.populism || 0) > 0 ? "他會公開拆解情緒動員的代價。" : "他要求把討論拉回證據與制度設計。",
        "蘇網紅": (effects.populism || 0) > 0 ? "他找到可剪輯的衝突點，準備讓事件變短、變尖。" : "他覺得這一幕聲量還不夠尖銳。"
    };

    const lensLine = pickLine(lensSpecificVoice(name, lens.label, eventText(event)) || [], `${name}|pulse|${lens.label}|${event.title}`);
    return `${lensLine || roleLines[name] || "他重新計算自己在這個議題的位置。"} ${stance}。`;
}

function renderSocietyPulse(event = {}, effects = {}, reaction = {}, excludeNames = []) {
    const excluded = new Set(excludeNames.filter(Boolean));
    const names = involvedCharactersForEvent(event, reaction)
        .filter((name) => name !== gameState.character?.name)
        .filter((name) => !excluded.has(name))
        .slice(0, 4);
    if (!names.length) return "";

    return `
        <div class="society-pulse">
            <b>其他人的反應</b>
            ${names.map((name) => `
                <article>
                    ${renderAvatar(name, "pulse-avatar")}
                    <div>
                        <span>${escapeHTML(name)}</span>
                        <small>${escapeHTML(socialReactionLine(name, event, effects, reaction))}</small>
                    </div>
                </article>
            `).join("")}
        </div>`;
}

function buildPlainDecisionRead(option, ev, effects, reaction) {
    const [key, value] = strongestEffect(effects);
    const first = value === 0
        ? "局勢暫時沒有大變化。"
        : `${effectLabel(key)}${effectDirection(value)}。`;

    const second = reaction.tone === "oppose"
        ? `${reaction.npc}會設路障。`
        : reaction.tone === "support"
            ? `${reaction.npc}願意靠近。`
            : `${reaction.npc}還在觀望。`;

    const third = (effects.progress || 0) > 0
        ? "下一步：找承擔者。"
        : (effects.populism || 0) > 0
            ? "下一步：別被聲量拖走。"
            : (effects.order || 0) < 0
                ? "下一步：處理失控風險。"
                : "下一步：把行動延續下去。";

    return `
        <div class="plain-read">
            <span>${escapeHTML(first)}</span>
            <span>${escapeHTML(second)}</span>
            <span>${escapeHTML(third)}</span>
        </div>`;
}

function buildOptionAnalysis(option, ev, effects, pOption, reaction) {
    const [key, value] = strongestEffect(effects);
    const frame = {
        freedom: value > 0 ? "讓更多人公開說話。" : "先把衝突壓低。",
        order: value > 0 ? "先穩住場面。" : "讓壓力留在現場。",
        progress: value > 0 ? "把訴求送進制度。" : "先不要推改革。",
        populism: value > 0 ? "放大聲量。" : "讓情緒降溫。",
        balance: "先保留空間。"
    }[key];

    const tradeoff = {
        freedom: value > 0 ? "怕失序的人會更緊張。" : "支持者可能覺得你退縮。",
        order: value > 0 ? "街頭會覺得力道變小。" : "反對者會說你製造混亂。",
        progress: value > 0 ? "接下來要有人負責執行。" : "改革會變慢。",
        populism: value > 0 ? "聲量可能反過來傷到你。" : "議題可能很快被忘記。",
        balance: "大家都還不放心。"
    }[key];

    const socialRead = reaction.tone === "oppose"
        ? `${reaction.npc}會把這個選擇理解成威脅。`
        : reaction.tone === "support"
            ? `${reaction.npc}會把這個選擇理解成合作入口。`
            : `${reaction.npc}還沒有下判斷，但會繼續觀察你是否一致。`;

    const persuasionRead = pOption
        ? `<small>說服也會留下關係成本。</small>`
        : "";

    return `
        <div class="option-analysis">
            <b>選項剖析</b>
            <article>
                <span>你做了什麼</span>
                <strong>${escapeHTML(frame)}</strong>
            </article>
            <article>
                <span>代價</span>
                <strong>${escapeHTML(tradeoff)}</strong>
            </article>
            <article>
                <span>別人怎麼看</span>
                <strong>${escapeHTML(socialRead)}</strong>
            </article>
            ${persuasionRead}
        </div>`;
}

function politicalCostReflection(ev, option, effects, reaction) {
    const [key, value] = strongestEffect(effects);
    const lens = issueLens(ev);
    const beneficiaries = {
        freedom: value > 0 ? "想說話的人" : "想先降溫的人",
        order: value > 0 ? "需要穩定的人" : "街頭抗議者",
        progress: value > 0 ? "改革派" : "想拖慢改革的人",
        populism: value > 0 ? "擅長動員的人" : "想查證的人",
        balance: "觀望的人"
    }[key];
    const payers = {
        freedom: value > 0 ? "害怕失序的人" : "等著被聽見的人",
        order: value > 0 ? "街頭訴求" : "一般民眾與第一線人員",
        progress: value > 0 ? "既有利益者" : "改革支持者",
        populism: value > 0 ? "被簡化的人" : "需要聲量的人",
        balance: "還沒被處理的人"
    }[key];
    const question = {
        "生計壓力": "這個成本應該由誰付？",
        "世代衝突": "你保護的是改變，還是安全感？",
        "資訊戰": "誰可以決定哪些話不能說？",
        "發展代價": "誰替發展付代價？",
        "安全焦慮": "為了安全，誰少了自由？",
        "價值衝突": "你是在說服，還是在讓一方退場？",
        "信任危機": "你是在修復信任，還是在利用不信任？"
    }[lens.label] || "誰得到好處？誰付代價？";

    return {
        lens: lens.label,
        beneficiary: beneficiaries,
        payer: payers,
        question,
        reaction: reaction.npc
    };
}

function recordReflection(ev, option, effects, reaction) {
    const reflection = politicalCostReflection(ev, option, effects, reaction);
    gameState.reflectionLog.push({
        turn: gameState.currentEventIndex + 1,
        eventTitle: ev.title,
        choiceText: polishNarrativeText(option.text),
        ...reflection
    });
    gameState.reflectionLog = gameState.reflectionLog.slice(-10);
    return reflection;
}

function renderReflectionPanel(reflection) {
    return `
        <div class="reflection-panel">
            <b>這一步留下什麼</b>
            <article>
                <span>誰得到空間</span>
                <strong>${escapeHTML(reflection.beneficiary)}</strong>
            </article>
            <article>
                <span>誰承擔代價</span>
                <strong>${escapeHTML(reflection.payer)}</strong>
            </article>
            <article class="question">
                <span>留給玩家的問題</span>
                <strong>${escapeHTML(reflection.question)}</strong>
            </article>
        </div>`;
}

function resultImmediateLine(effects = {}) {
    const [key, value] = strongestEffect(effects);
    if (value === 0) return "局勢沒有大幅移動，但每個人都在重新估算你的立場。";
    const lines = {
        freedom: value > 0 ? "更多人敢把話說出口。" : "公開討論變少，不滿轉進私下。",
        order: value > 0 ? "現場暫時可控，但訴求被放慢。" : "壓力留在現場，失控風險升高。",
        progress: value > 0 ? "訴求被送進制度，接下來要有人簽字負責。" : "改革窗口變窄，舊流程重新取得主導。",
        populism: value > 0 ? "聲量快速升高，也更容易被剪輯和誤讀。" : "情緒降下來，但議題可能跟著失去能見度。"
    };
    return lines[key] || "場上籌碼重新分配。";
}

function resultCostLine(effects = {}, reaction = {}) {
    const [key, value] = strongestEffect(effects);
    const lines = {
        freedom: value > 0 ? "秩序派和害怕失控的人會承擔壓力。" : "等著被聽見的人會覺得自己又被壓下去。",
        order: value > 0 ? "街頭和改革派會懷疑你退讓。" : "一般民眾、第一線人員和市府都要承擔混亂成本。",
        progress: value > 0 ? "既有利益者被迫讓出空間。" : "改革支持者付出時間和信任成本。",
        populism: value > 0 ? "複雜的人被簡化成敵我。" : "需要聲量的人可能又回到沉默。"
    };
    const base = lines[key] || "還沒被處理的人繼續付代價。";
    if (reaction?.tone === "oppose") return `${base} ${reaction.npc}會把這筆帳記在你身上。`;
    if (reaction?.tone === "support") return `${base} ${reaction.npc}願意暫時幫你分擔一點風險。`;
    return base;
}

function resultNextStepLine(effects = {}, reaction = {}, beat = {}) {
    if ((effects.progress || 0) > 0) return "下一步要把承諾變成文件、會議或可追蹤的責任。";
    if ((effects.populism || 0) > 0) return "下一步要避免聲量替你做出你沒準備好的承諾。";
    if ((effects.order || 0) < 0) return "下一步要處理現場風險，否則安全派會接管敘事。";
    if ((effects.freedom || 0) < 0) return "下一步要回應被壓下去的聲音，否則沉默會變成不信任。";
    if (reaction?.tone === "oppose") return `${reaction.npc}已經成為下一個阻力，你需要決定修補或對抗。`;
    return beat?.next ? beat.next.replace("下一幕：", "下一步：") : "下一步要讓選擇不只停在表態。";
}

function renderConsequenceFlow(option, ev, effects, reaction, beat) {
    return `
        <div class="consequence-flow">
            <article>
                <span>你的動作</span>
                <b>${escapeHTML(compactText(polishNarrativeText(option.text), 36))}</b>
            </article>
            <article>
                <span>立刻發生</span>
                <b>${escapeHTML(resultImmediateLine(effects))}</b>
            </article>
            <article>
                <span>誰付代價</span>
                <b>${escapeHTML(resultCostLine(effects, reaction))}</b>
            </article>
            <article>
                <span>接下來</span>
                <b>${escapeHTML(resultNextStepLine(effects, reaction, beat))}</b>
            </article>
        </div>`;
}

function buildOutcomeReport(option, ev, effects, pOption, reaction, beat) {
    const [mainKey, mainValue] = strongestEffect(effects);
    const shortTerm = mainValue === 0
        ? "各方重新估算你。"
        : {
            freedom: mainValue > 0 ? "更多人敢發聲。" : "討論轉入私下。",
            order: mainValue > 0 ? "場面暫時穩住。" : "失控風險升高。",
            progress: mainValue > 0 ? "訴求進入流程。" : "議題退回舊流程。",
            populism: mainValue > 0 ? "聲量快速衝高。" : "情緒暫時降溫。"
        }[mainKey];

    const hook = (effects.progress || 0) > 0
        ? "要找承擔者。"
        : (effects.populism || 0) > 0
            ? "聲量會反咬你。"
            : (effects.freedom || 0) < 0
                ? "沉默會累積不滿。"
                : "下一步決定走向。";

    const reflection = recordReflection(ev, option, effects, reaction);
    const exchange = buildNpcExchange(reaction, effects, ev);

    return `
        ${renderSpeakerSpotlight(reaction)}
        ${renderConsequenceFlow(option, ev, effects, reaction, beat)}
        <div class="impact-row">
            <span>${escapeHTML(effectToken(effects))}</span>
            <span>${escapeHTML(shortTerm)}</span>
            <span>${escapeHTML(hook)}</span>
        </div>
        ${buildOptionAnalysis(option, ev, effects, pOption, reaction)}
        ${renderInteractionDialogue(reaction, effects, ev, exchange)}
        ${renderSocietyPulse(ev, effects, reaction, [exchange.actor, exchange.other])}
        ${renderArcChanges()}
        ${renderReflectionPanel(reflection)}
        ${pOption ? `<div class="pressure-note danger">這次說服會影響之後關係。</div>` : ""}
    `;
}

function renderMemoryPanel() {
    if (!gameState.memories.length) return "";
    return `
        <div class="memory-panel">
            <h4>近期記憶</h4>
            ${gameState.memories.slice(-3).map((memory) => `
                <div class="memory-row ${memory.tone}">
                    <span>${escapeHTML(memory.npc)}</span>
                    <small>${escapeHTML(memory.text)}</small>
                </div>
            `).join("")}
        </div>
    `;
}

function behaviorTraitCatalog() {
    return {
        assertiveness: {
            label: "行動主導",
            concept: "趨近動機",
            read: "你傾向先推動局勢，讓議題因行動而被迫回應。",
            blind: "容易低估被點名者的防衛反應。"
        },
        cooperation: {
            label: "協商取向",
            concept: "親社會取向",
            read: "你會嘗試把對立拉回談判桌，讓人際連結成為資源。",
            blind: "有時會讓立場看起來不夠銳利。"
        },
        riskTolerance: {
            label: "風險承受",
            concept: "不確定性容忍",
            read: "你能接受短期混亂，換取更大的議題能見度。",
            blind: "聲量上升時，局勢也更容易失控。"
        },
        institutionTrust: {
            label: "制度信任",
            concept: "內控傾向",
            read: "你相信把議題放進流程，能讓改變變得可持續。",
            blind: "程序太慢時，支持者可能覺得你被體制吸收。"
        },
        empathy: {
            label: "共感敏銳",
            concept: "觀點取替",
            read: "你會注意誰被壓低、誰沒有被聽見，並試著重新命名問題。",
            blind: "共感太廣時，決策焦點會被拉散。"
        },
        pragmatism: {
            label: "務實整合",
            concept: "成本效益評估",
            read: "你會計算哪一步能把聲量換成承諾或流程。",
            blind: "太快談交換時，容易被質疑失去原則。"
        },
        conflictAvoidance: {
            label: "穩定優先",
            concept: "損失厭惡",
            read: "你會先降低衝突，避免局勢因一次選擇失去控制。",
            blind: "過度避險會讓現狀偏誤變強，改革窗口也會變窄。"
        }
    };
}

function topBehaviorTraits(limit = 3) {
    const catalog = behaviorTraitCatalog();
    const entries = Object.entries(gameState.behaviorScores)
        .map(([key, score]) => ({ key, score, ...catalog[key] }))
        .sort((a, b) => b.score - a.score);
    const picked = entries.filter((trait) => trait.score > 0).slice(0, limit);
    return picked.length ? picked : entries.slice(0, limit);
}

function personalityArchetype(traits) {
    const keys = new Set(traits.slice(0, 2).map((trait) => trait.key));
    if (keys.has("assertiveness") && keys.has("riskTolerance")) return "高行動倡議者";
    if (keys.has("cooperation") && keys.has("pragmatism")) return "協商型改革者";
    if (keys.has("institutionTrust") && keys.has("pragmatism")) return "制度設計型玩家";
    if (keys.has("empathy") && keys.has("cooperation")) return "關係修復型玩家";
    if (keys.has("conflictAvoidance")) return "穩定優先型玩家";
    if (keys.has("assertiveness") && keys.has("empathy")) return "價值動員型玩家";
    return "情勢閱讀型玩家";
}

function buildBehaviorConceptLine(traits, choiceCount) {
    const main = traits[0];
    const second = traits[1] || traits[0];
    const control = ["assertiveness", "institutionTrust", "pragmatism"].includes(main.key)
        ? "你比較接近內控傾向：相信自己的介入能改變局勢。"
        : "你對外部風險很敏感，會先評估局勢會不會反咬自己。";
    return `${control} 你的選擇特別呈現「${main.concept}」與「${second.concept}」：在 ${choiceCount} 次關鍵選擇中，你反覆用同一種心理策略處理衝突。`;
}

function buildChoiceTimeline() {
    if (!gameState.choiceHistory.length) return "";
    return `
        <div class="choice-timeline">
            ${gameState.choiceHistory.slice(-2).map((choice) => `
                <article>
                    <span>${escapeHTML(choice.chapter.replace(/：.*/, ""))}</span>
                    <b>${escapeHTML(compactText(choice.choiceText, 24))}</b>
                    <small>${escapeHTML(choice.effect)} · ${escapeHTML(choice.beat)}</small>
                </article>
            `).join("")}
        </div>`;
}

function politicalAxisValue(leftValue, rightValue) {
    return Math.max(-100, Math.min(100, Math.round(leftValue - rightValue)));
}

function stanceLevel(value, highLabel, lowLabel, middleLabel = "平衡取向") {
    if (value >= 18) return highLabel;
    if (value <= -18) return lowLabel;
    return middleLabel;
}

function politicalArchetype() {
    const { freedom, order, progress, populism } = gameState.stats;
    if (populism >= 72 && order <= 42) return "群眾動員改革派";
    if (populism >= 72 && order >= 62) return "多數意志秩序派";
    if (freedom >= 64 && progress >= 62) return "自由改革派";
    if (order >= 66 && progress >= 58) return "制度治理改革派";
    if (order >= 66 && progress <= 48) return "秩序保守派";
    if (progress >= 68 && populism <= 45) return "程序改革派";
    if (freedom >= 62 && order >= 58) return "權利與秩序平衡派";
    return "協商型中間派";
}

function buildPoliticalAxisRows() {
    const { freedom, order, progress, populism } = gameState.stats;
    const axes = [
        {
            name: "自由發聲 ↔ 秩序治理",
            value: politicalAxisValue(freedom, order),
            left: "自由發聲",
            right: "秩序治理",
            read: stanceLevel(freedom - order, "你較願意讓公共發聲先打開政治空間。", "你較重視先讓局勢可控。")
        },
        {
            name: "制度改革 ↔ 現狀維持",
            value: Math.max(-100, Math.min(100, Math.round((progress - 50) * 2))),
            left: "制度改革",
            right: "現狀維持",
            read: progress >= 62 ? "你傾向把衝突導入制度改變。" : progress <= 42 ? "你傾向先保留既有安排，避免改革過快。" : "你在改革與穩定之間保留彈性。"
        },
        {
            name: "制度說服 ↔ 情緒動員",
            value: Math.max(-100, Math.min(100, Math.round((50 - populism) * 2))),
            left: "制度說服",
            right: "情緒動員",
            read: populism >= 62 ? "你常使用聲量與情緒壓力迫使政治回應。" : populism <= 38 ? "你傾向降低情緒，把討論拉回查證與程序。" : "你會視情況在聲量與程序之間切換。"
        }
    ];

    return axes.map((axis) => {
        const leftWidth = 50 + axis.value / 2;
        return `
            <article class="spectrum-row">
                <div class="spectrum-head">
                    <b>${escapeHTML(axis.name)}</b>
                    <span>${escapeHTML(axis.read)}</span>
                </div>
                <div class="spectrum-track">
                    <small>${escapeHTML(axis.left)}</small>
                    <div class="spectrum-bar"><i style="left: ${leftWidth}%;"></i></div>
                    <small>${escapeHTML(axis.right)}</small>
                </div>
            </article>`;
    }).join("");
}

function buildPoliticalStanceSummary() {
    const { freedom, order, progress, populism } = gameState.stats;
    const items = [
        ["公共發聲", freedom >= 60 ? "願意擴大發聲空間" : freedom <= 40 ? "傾向限制衝突擴散" : "保留彈性"],
        ["治理秩序", order >= 60 ? "重視可控與穩定" : order <= 40 ? "願意承受失序壓力" : "維持中線"],
        ["改革速度", progress >= 60 ? "偏向制度改革" : progress <= 40 ? "偏向延後或保守處理" : "漸進調整"],
        ["群眾動員", populism >= 60 ? "常借用聲量施壓" : populism <= 40 ? "偏好降溫與查證" : "視局勢使用"]
    ];

    return `
        <div class="stance-grid">
            ${items.map(([label, read]) => `
                <article>
                    <span>${escapeHTML(label)}</span>
                    <b>${escapeHTML(read)}</b>
                </article>
            `).join("")}
        </div>`;
}

function buildPoliticalReflectionSummary() {
    if (!gameState.reflectionLog.length) return "";
    const unique = [];
    gameState.reflectionLog.slice().reverse().forEach((item) => {
        const key = `${item.beneficiary}|${item.payer}|${item.question}`;
        if (!unique.some((existing) => existing.key === key)) {
            unique.push({ key, item });
        }
    });
    const picked = unique.slice(0, 3).map(({ item }) => item).reverse();
    return `
        <div class="political-reflection-list">
            <b>這局反覆出現的政治代價</b>
            ${picked.map((item) => `
                <article>
                    <span>${escapeHTML(compactText(item.eventTitle, 22))}</span>
                    <small>讓 ${escapeHTML(item.beneficiary)}；也讓 ${escapeHTML(item.payer)}。</small>
                </article>
            `).join("")}
        </div>`;
}

function topHistoryValue(history = [], key = "lens", fallback = "多重議題") {
    const counts = history.reduce((acc, item) => {
        const value = item[key] || fallback;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
}

function finalSocialConsequence(stats = gameState.stats) {
    const { freedom, order, progress, populism } = stats;
    if (populism >= 65 && order < 55) return "議題被看見了，但社會也更習慣用敵我和聲量判斷政治。";
    if (order >= 65 && freedom < 50) return "場面被穩住了，但一部分異議轉到私下累積，信任沒有真正修復。";
    if (progress >= 65 && freedom >= 55) return "改革有入口，公共討論也留下紀錄，但後續仍要有人承擔財源與責任。";
    if (progress <= 45) return "許多承諾停在協調與安撫，支持者會開始懷疑制度是否真的會動。";
    if (freedom >= 65 && order <= 45) return "更多人敢說話，卻也讓第一線承受更高混亂成本。";
    return "社會沒有被單一陣營完全拿走，但每個選擇留下的成本仍會回到下一輪政治。";
}

function buildFinalSynthesis(archetype = politicalArchetype()) {
    const { freedom, order, progress, populism } = gameState.stats;
    const history = gameState.choiceHistory || [];
    const lastChoices = history.slice(-3);
    const openingChoice = history[0];
    const closingChoice = history[history.length - 1];
    const repeatedLens = topHistoryValue(history, "lens", "多重議題");
    const repeatedEffect = topHistoryValue(history, "effect", "沒有固定方向");
    const strongestStat = Object.entries(gameState.stats)
        .sort((a, b) => b[1] - a[1])[0] || ["balance", 50];
    const weakestStat = Object.entries(gameState.stats)
        .sort((a, b) => a[1] - b[1])[0] || ["balance", 50];
    const direction = [];
    if (progress >= 60) direction.push("把議題推進制度");
    if (freedom >= 60) direction.push("打開公共發聲");
    if (order >= 60) direction.push("維持可控秩序");
    if (populism >= 60) direction.push("使用聲量施壓");
    if (!direction.length) direction.push("在多方壓力間保留彈性");

    const tradeoffs = [];
    if (populism >= 60) tradeoffs.push("對立和誤讀變得更容易擴散");
    if (order <= 45) tradeoffs.push("秩序成本被推給第一線和一般民眾");
    if (freedom <= 45) tradeoffs.push("部分聲音被壓低，只是沒有消失");
    if (progress <= 45) tradeoffs.push("改革支持者會覺得承諾沒有落地");
    if (!tradeoffs.length) tradeoffs.push("每一方都得到一點空間，也都沒有完全滿意");

    const finalTopic = lastChoices[lastChoices.length - 1]?.eventTitle || "最後議題";
    const closure = progress >= 60 && order >= 50
        ? `最後，${finalTopic}沒有靠單一勝利收場，而是被推進可追蹤的改革入口。`
        : populism >= 65 && order < 55
            ? `最後，${finalTopic}被推上檯面，但制度還沒有足夠能力把衝突收回來。`
            : order >= 65 && freedom < 50
                ? `最後，${finalTopic}暫時被穩住，但部分異議退到私下，成為下一輪不信任。`
                : `最後，${finalTopic}沒有被完全解決，但玩家留下了一條可被檢視、也會被追問的政治路線。`;

    return `
        <div class="final-synthesis">
            <span>總結判讀</span>
            <h4>${escapeHTML(archetype)}</h4>
            <p>你的主要路線是：${escapeHTML(direction.join("、"))}。最高指標是「${escapeHTML(effectLabel(strongestStat[0]))} ${Math.round(strongestStat[1])}」，最低指標是「${escapeHTML(effectLabel(weakestStat[0]))} ${Math.round(weakestStat[1])}」。</p>
            <p>整局最常被你推到前面的議題是「${escapeHTML(repeatedLens)}」，最常出現的政治效果是「${escapeHTML(repeatedEffect)}」。這代表你的路線不是隨機反應，而是在反覆選擇同一種政治代價。</p>
            ${openingChoice && closingChoice ? `<p>開局你用「${escapeHTML(compactText(openingChoice.choiceText, 28))}」建立位置；收尾你用「${escapeHTML(compactText(closingChoice.choiceText, 28))}」決定社會最後承受哪一種壓力。</p>` : ""}
            ${lastChoices.length ? `
                <div class="final-turning-points">
                    <b>最後三個關鍵選擇</b>
                    ${lastChoices.map((choice) => `
                        <article>
                            <span>${escapeHTML(compactText(choice.eventTitle, 20))}</span>
                            <small>${escapeHTML(compactText(choice.choiceText, 34))} / ${escapeHTML(choice.effect)}</small>
                        </article>
                    `).join("")}
                </div>` : ""}
            <p>具體代價是：${escapeHTML(tradeoffs.join("；"))}。</p>
            <p>社會後果是：${escapeHTML(finalSocialConsequence(gameState.stats))}</p>
            <b>${escapeHTML(closure)}</b>
        </div>`;
}

function buildPersonalityAnalysis() {
    const history = gameState.choiceHistory;
    if (!history.length) {
        return `
            <section class="personality-report">
                <h3>政治光譜與立場整理</h3>
                <p>這次沒有足夠的選擇紀錄可以分析。下一輪完成幾個關鍵抉擇後，結局會整理你的政治位置與決策代價。</p>
            </section>`;
    }

    const archetype = politicalArchetype();

    return `
        <section class="personality-report">
            <h3>政治光譜與立場整理</h3>
            <div class="analysis-card primary">
                <b>${escapeHTML(archetype)}</b>
                <span>這不是人格診斷，而是你在這局遊戲中用選擇留下的政治位置。</span>
            </div>
            ${buildFinalSynthesis(archetype)}
            ${buildPoliticalStanceSummary()}
            <div class="spectrum-panel">
                ${buildPoliticalAxisRows()}
            </div>
            ${buildPoliticalReflectionSummary()}
            ${buildChoiceTimeline()}
        </section>`;
}

function relationshipPriority(arc) {
    if (!arc) return 0;
    const completed = ["repaired", "ruptured"].includes(arc.relationState) ? 10 : 0;
    return completed + (arc.momentum || 0) + (arc.tension || 0) + Math.abs((arc.trust || 50) - 50) / 20 + (arc.appearanceCount || 0) / 2;
}

function buildRelationshipClosureReport() {
    const entries = Object.entries(gameState.characterArcs || {})
        .filter(([name]) => name !== gameState.character?.name)
        .map(([name, arc]) => {
            arc.relationState = relationshipStateForArc(arc);
            arc.relationText = relationshipLineForState(arc);
            return { name, arc };
        })
        .sort((a, b) => relationshipPriority(b.arc) - relationshipPriority(a.arc))
        .slice(0, 3);

    if (!entries.length) return "";

    return `
        <section class="relationship-closure">
            <h3>關係線收束</h3>
            ${entries.map(({ name, arc }) => `
                <article class="${escapeHTML(arc.relationState)}">
                    ${renderAvatar(name, "closure-avatar")}
                    <div>
                        <span>${escapeHTML(name)} · ${escapeHTML(arcStatusText(arc))}</span>
                        <b>${escapeHTML(relationshipLineForState(arc))}</b>
                        <small>出場 ${arc.appearanceCount || 0} 次 · 信任 ${Math.round(arc.trust)}</small>
                    </div>
                </article>
            `).join("")}
        </section>`;
}

// DOM 元素參考
const els = {
    startScreen: document.getElementById('start-screen'),
    gameScreen: document.getElementById('game-screen'),
    playerNameInput: document.getElementById('player-name'),
    startBtn: document.getElementById('start-btn'),
    
    roleName: document.getElementById('role-name'),
    roleDesc: document.getElementById('role-desc'),
    
    introModal: document.getElementById('intro-modal'),
    introTitle: document.getElementById('intro-title'),
    introDesc: document.getElementById('intro-desc'),
    introNextBtn: document.getElementById('intro-next-btn'),
    
    eventModal: document.getElementById('event-modal'),
    eventTitle: document.getElementById('event-title'),
    eventImage: document.getElementById('event-image'),
    eventDesc: document.getElementById('event-desc'),
    btnOptA: document.getElementById('btn-opt-a'),
    btnOptB: document.getElementById('btn-opt-b'),
    closeEventModalBtn: document.getElementById('close-event-modal'),
    
    newsFlash: document.getElementById('news-flash'),
    newsText: document.getElementById('news-text'),
    nextTurnBtn: document.getElementById('next-turn-btn'),
    closeNewsModalBtn: document.getElementById('close-news-modal'),
    
    endScreen: document.getElementById('end-screen'),
    endText: document.getElementById('end-text'),
    restartBtn: document.getElementById('restart-btn'),
    
    networkModal: document.getElementById('network-modal'),
    toggleNetworkBtn: document.getElementById('toggle-network'),
    closeNetworkBtn: document.getElementById('close-network'),
    networkGrid: document.getElementById('network-grid'),
    
    worldMap: document.getElementById('world-map'),
    mapContainer: document.getElementById('map-container'),
    triggerEventBtn: document.getElementById('trigger-event-btn'),
    
    detailModal: document.getElementById('detail-modal'),
    closeDetailBtn: document.getElementById('close-detail'),
    detailTitle: document.getElementById('detail-title'),
    detailDesc: document.getElementById('detail-desc'),
    detailImage: document.getElementById('detail-image'),
    detailExtra: document.getElementById('detail-extra'),
    detailRelationships: document.getElementById('detail-relationships'),
    detailStances: document.getElementById('detail-stances'),
    
    progressBar: document.getElementById('progress-bar'),
    personalStatsPanel: document.getElementById('personal-stats-panel'),
    personalStatsContainer: document.getElementById('personal-stats-container'),
    newsStatChanges: document.getElementById('news-stat-changes'),
    
    npcApprovalsList: document.getElementById('npc-approvals-list'),
    persuasionModal: document.getElementById('persuasion-modal'),
    persuasionTargetImg: document.getElementById('persuasion-target-img'),
    persuasionTargetName: document.getElementById('persuasion-target-name'),
    persuasionReason: document.getElementById('persuasion-reason'),
    btnPersuadeHigh: document.getElementById('btn-persuade-high'),
    btnPersuadeLow: document.getElementById('btn-persuade-low')
};

function resetModalScroll(modal) {
    if (!modal) return;
    const content = modal.querySelector?.('.modal-content');
    modal.scrollTop = 0;
    if (content) content.scrollTop = 0;
    const defer = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback) => setTimeout(callback, 0);
    defer(() => {
        modal.scrollTop = 0;
        if (content) content.scrollTop = 0;
    });
}

function openModal(modal) {
    if (!modal) return;
    modal.classList.remove('hidden');
    resetModalScroll(modal);
}

function restartGame() {
    location.reload();
}

// 初始化事件監聽
els.startBtn.addEventListener('click', startGame);
els.introNextBtn.addEventListener('click', handleIntroNext);
els.triggerEventBtn.addEventListener('click', showEvent);
els.btnOptA.addEventListener('click', () => handleDecision(0));
els.btnOptB.addEventListener('click', () => handleDecision(1));
els.nextTurnBtn.addEventListener('click', nextTurn);
els.closeEventModalBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.eventModal.classList.add('hidden');
    gameState.decisionLocked = false;
    gameState.persuasionLocked = false;
    els.btnOptA.disabled = false;
    els.btnOptB.disabled = false;
    clearMapHighlights();
    els.triggerEventBtn.classList.remove('hidden');
});
els.closeNewsModalBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    nextTurn();
});
els.toggleNetworkBtn.addEventListener('click', () => openModal(els.networkModal));
els.closeNetworkBtn.addEventListener('click', () => els.networkModal.classList.add('hidden'));
els.closeDetailBtn.addEventListener('click', () => els.detailModal.classList.add('hidden'));
els.restartBtn?.addEventListener('click', restartGame);

// 固定地圖座標 (百分比)，避免跑出邊界，並與區域對應
// 對應角色順序：市長, 長老, 議員, 總裁, 記者, 頭目, 將軍, 網紅, 教授, 公務員, 學生, 企業主
const characterPositions = [
    {x: 50, y: 40}, {x: 70, y: 75}, {x: 35, y: 60}, {x: 75, y: 30},
    {x: 30, y: 40}, {x: 85, y: 45}, {x: 60, y: 25}, {x: 40, y: 30},
    {x: 25, y: 65}, {x: 45, y: 45}, {x: 55, y: 55}, {x: 65, y: 55}
];

async function fetchGameData() {
    try {
        const [charsRes, eventsRes, locsRes] = await Promise.all([
            apiFetch('/api/characters'),
            apiFetch('/api/events'),
            apiFetch('/api/locations')
        ]);
        gameState.characters = await charsRes.json();
        gameState.events = await eventsRes.json();
        gameState.locations = await locsRes.json();
        
        // 分配坐標並渲染關係網與地圖標籤
        gameState.characters.forEach((c, idx) => {
            c.pos = characterPositions[idx % characterPositions.length];
        });
        
        renderNetwork();
        renderMapPins();
        renderLocations();
    } catch (err) {
        console.error("Failed to load game data", err);
        alert("載入遊戲資料失敗，請確認後端已啟動。");
    }
}

function renderLocations() {
    gameState.locations.forEach(loc => {
        const hotspot = document.createElement('div');
        hotspot.className = 'location-hotspot';
        hotspot.style.left = `${loc.x_pos}%`;
        hotspot.style.top = `${loc.y_pos}%`;
        hotspot.innerHTML = `<div class="hotspot-label">${loc.name}</div>`;
        
        hotspot.addEventListener('click', () => {
            showDetailModal(loc.name, loc.description, null, null, null);
        });
        
        els.worldMap.appendChild(hotspot);
    });
}

function renderMapPins() {
    // 渲染人物前，先確保不清除掉已經加入的 hotspots
    // 所以改用 createElement 方式加入
    gameState.characters.forEach(c => {
        const imageFile = characterImageFile(c.name);
        let imgSrc = imagePath(imageFile, 'char_generic.png');
        
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.dataset.characterName = c.name;
        pin.style.left = `${c.pos.x}%`;
        pin.style.top = `${c.pos.y}%`;
        pin.innerHTML = `
            <img src="${imgSrc}" alt="${c.name}">
            <div class="pin-label">${c.name}</div>
        `;
        setImageSource(pin.querySelector('img'), imageFile, 'char_generic.png');
        
        pin.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetailModal(c.name, c.description, imgSrc, c.relationships_text, c.stances_text, imageFile);
        });
        
        els.worldMap.appendChild(pin);
    });
}

function showDetailModal(title, desc, imgSrc, relationships, stances, imageFileName = "") {
    els.detailTitle.innerText = title;
    els.detailDesc.innerText = desc;
    
    if (imgSrc || imageFileName) {
        if (imageFileName) {
            setImageSource(els.detailImage, imageFileName, 'char_generic.png');
        } else {
            els.detailImage.src = imgSrc;
        }
        els.detailImage.style.display = 'block';
    } else {
        els.detailImage.style.display = 'none';
    }
    
    const arc = gameState.characterArcs?.[title] || null;
    const hasCharacterStance = Boolean(arc || characterByName(title) || Object.prototype.hasOwnProperty.call(gameState.npcApprovals || {}, title));
    const profile = hasCharacterStance ? npcInterestProfile(title) : null;
    const profileText = profile
        ? `政治立場：${profile.stance}\n核心利益：${profile.interest}\n紅線：${profile.redLine}\n可妥協條件：${profile.compromise}`
        : (stances || "中立。");
    if (relationships || stances || arc || profile) {
        els.detailExtra.style.display = 'block';
        els.detailRelationships.innerText = relationships || arc?.goal || "無特別關聯。";
        els.detailStances.innerText = arc
            ? `${profileText}\n\n角色主線：${arc.goal}\n目前狀態：${arcStatusText(arc)}\n最近變化：${arc.lastChange}`
            : profileText;
    } else {
        els.detailExtra.style.display = 'none';
    }
    
    openModal(els.detailModal);
}

function renderNetwork() {
    els.networkGrid.innerHTML = '';
    gameState.characters.forEach(c => {
        const imageFile = characterImageFile(c.name);
        let imgSrc = imagePath(imageFile, 'char_generic.png');
        let imgHtml = `<img src="${imgSrc}" data-image-file="${imageFile}" alt="${c.name}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">`;
        const arc = gameState.characterArcs?.[c.name] || null;
        const arcHtml = arc ? `
            <div class="network-arc">
                <b>${escapeHTML(arcStatusText(arc))}</b>
                <span>${escapeHTML(compactText(arc.goal, 42))}</span>
                <small>${escapeHTML(compactText(relationshipLineForState(arc), 42))}</small>
            </div>` : "";
        els.networkGrid.innerHTML += `
            <div class="char-card" style="text-align: center;">
                ${imgHtml}
                <h4>${c.name}</h4>
                <span class="role">${c.role}</span>
                <p style="text-align: left;">${c.description}</p>
                ${arcHtml}
            </div>
        `;
    });
    els.networkGrid.querySelectorAll('img[data-image-file]').forEach((img) => {
        setImageSource(img, img.dataset.imageFile, 'char_generic.png');
    });
}

async function startGame() {
    const name = els.playerNameInput.value.trim();
    if (!name) return alert("請輸入你的名字");
    
    await fetchGameData();
    
    if(gameState.events.length === 0) return alert("沒有事件資料！");

    gameState.playerName = name;
    gameState.currentEventIndex = 0;
    gameState.stats = { freedom: 50, order: 50, progress: 50, populism: 20 };
    gameState.pendingDecision = null;
    gameState.memories = [];
    gameState.lastOutcome = null;
    gameState.nextHook = null;
    gameState.decisionLocked = false;
    gameState.persuasionLocked = false;
    gameState.appliedDecisionKeys = {};
    resetBehaviorTracking();
    
    // 隨機分配可玩角色
    const playableChars = gameState.characters.filter(c => c.is_playable);
    gameState.character = playableChars[Math.floor(Math.random() * playableChars.length)];
    
    // 根據角色身分初始化 NPC 支持度
    gameState.npcApprovals = { "柯爾市長": 50, "莫長老": 50, "艾達議員": 50, "威廉總裁": 50, "莉亞記者": 50, "龐頭目": 50, "雷將軍": 50, "費教授": 50, "蘇網紅": 50 };
    
    if (gameState.character.name === "學生運動者") {
        gameState.npcApprovals["艾達議員"] = 75;
        gameState.npcApprovals["龐頭目"] = 70;
        gameState.npcApprovals["蘇網紅"] = 65;
        gameState.npcApprovals["柯爾市長"] = 30;
        gameState.npcApprovals["威廉總裁"] = 20;
        gameState.npcApprovals["雷將軍"] = 25;
        gameState.npcApprovals["莫長老"] = 35;
    } else if (gameState.character.name === "中小企業主") {
        gameState.npcApprovals["威廉總裁"] = 80;
        gameState.npcApprovals["柯爾市長"] = 70;
        gameState.npcApprovals["莫長老"] = 60;
        gameState.npcApprovals["龐頭目"] = 30;
        gameState.npcApprovals["艾達議員"] = 40;
    } else if (gameState.character.name === "基層公務員") {
        gameState.npcApprovals["柯爾市長"] = 80;
        gameState.npcApprovals["雷將軍"] = 65;
        gameState.npcApprovals["威廉總裁"] = 60;
        gameState.npcApprovals["蘇網紅"] = 30;
        gameState.npcApprovals["龐頭目"] = 40;
        gameState.npcApprovals["莉亞記者"] = 40;
    }
    initializeCharacterArcs();
    renderNetwork();
    
    // 隨機安插新聞事件與過濾專屬事件
    const normalEvents = smoothStoryEvents(gameState.events.filter(e => {
        if (e.is_news) return false;
        if (e.target_role && e.target_role !== gameState.character.name && e.target_role !== gameState.character.role) {
            return false; // 過濾掉不屬於自己角色的專屬事件
        }
        return true;
    }));
    const newsEvents = smoothStoryEvents(gameState.events.filter(e => e.is_news));
    
    // 將新聞平均插入正常事件之間
    let mixedEvents = [];
    let step = Math.ceil(normalEvents.length / (newsEvents.length + 1));
    for (let i = 0; i < normalEvents.length; i++) {
        mixedEvents.push(normalEvents[i]);
        if ((i + 1) % step === 0 && newsEvents.length > 0) {
            mixedEvents.push(newsEvents.pop());
        }
    }
    // 把剩下的加進去
    while(newsEvents.length > 0) {
        mixedEvents.push(newsEvents.pop());
    }
    gameState.events = applyStoryDirector(mixedEvents);
    
    // 渲染專屬屬性面板
    if (gameState.character.personal_stats && Object.keys(gameState.character.personal_stats).length > 0) {
        els.personalStatsPanel.style.display = 'block';
        renderPersonalStats();
    }
    
    // 初始化 NPC 好感度 UI
    renderNPCApprovals();
    
    // 更新進度條
    updateProgressBar();
    
    // 更新 UI
    els.roleName.innerText = `${gameState.playerName} - ${gameState.character.name} (${gameState.character.role})`;
    els.roleDesc.innerText = gameState.character.description;
    
    updateStatsUI();
    
    // 切換畫面
    els.startScreen.classList.remove('active');
    els.gameScreen.classList.add('active');
    
    // 開始介紹序列
    startIntroSequence();
}

let introStep = 0;
function startIntroSequence() {
    introStep = 0;
    openModal(els.introModal);
    handleIntroNext();
}

function handleIntroNext() {
    const profile = roleProfile();
    if (introStep === 0) {
        els.introTitle.innerText = "蓬萊共和國的現況";
        els.introDesc.innerHTML = `
            <p>這個島國剛從威權陰影裡走出來，制度看似完整，信任卻很薄。每一次改革都會撞到舊利益、身份認同與媒體聲量。</p>
            ${renderWorldIntro()}
        `;
        introStep++;
    } else if (introStep === 1) {
        els.introTitle.innerText = "場上的人都想要什麼";
        els.introDesc.innerHTML = `
            <p>你不是掌控全局的人。你只是站在局勢中間，被支持者、反對者、朋友與利益交換推著往前走。</p>
            ${renderOpeningCast(profile)}
        `;
        introStep++;
    } else if (introStep === 2) {
        els.introTitle.innerText = "你的身份：" + gameState.character.name;
        els.introDesc.innerHTML = renderRoleIntro(profile);
        introStep++;
    } else if (introStep === 3) {
        els.introTitle.innerText = "今天早上的三則訊息";
        els.introDesc.innerHTML = `
            ${renderInbox(profile)}
            <div class="pressure-note">從現在開始，每個選擇都會留下痕跡。有人會幫你，也有人會記住你怎麼得罪他。</div>
        `;
        introStep++;
    } else {
        els.introModal.classList.add('hidden');
        els.triggerEventBtn.classList.remove('hidden');
    }
    hydrateDynamicImages(els.introDesc);
    resetModalScroll(els.introModal);
}

function updateStatsUI() {
    for (let key in gameState.stats) {
        let val = Math.max(0, Math.min(100, gameState.stats[key]));
        gameState.stats[key] = val; // 確保在 0-100 之間
        document.getElementById(`val-${key}`).innerText = val;
        document.getElementById(`bar-${key}`).style.width = `${val}%`;
    }
    
    renderPersonalStats();
}

function renderPersonalStats() {
    if (!gameState.character || !gameState.character.personal_stats) return;
    els.personalStatsContainer.innerHTML = '';
    const stats = gameState.character.personal_stats;
    for (let key in stats) {
        let val = Math.max(0, Math.min(100, stats[key]));
        stats[key] = val;
        
        // 根據數值給予顏色 (簡單邏輯：低於30紅色，高於70綠色)
        let color = '#4a90e2';
        if (val <= 30) color = '#f44336';
        if (val >= 70) color = '#4caf50';
        
        els.personalStatsContainer.innerHTML += `
            <div style="font-size: 0.9rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>${key}</span>
                    <strong>${val}</strong>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${val}%; height: 100%; background: ${color}; transition: width 0.5s;"></div>
                </div>
            </div>
        `;
    }
}

function renderNPCApprovals() {
    if (!els.npcApprovalsList) return;
    els.npcApprovalsList.innerHTML = '';
    for (let npc in gameState.npcApprovals) {
        // 如果玩家剛好是這個 NPC，就不顯示自己的好感度
        if (npc === gameState.character.name) continue;
        
        let val = Math.max(0, Math.min(100, gameState.npcApprovals[npc]));
        gameState.npcApprovals[npc] = val;
        
        let color = '#555';
        let emoji = '😐';
        if (val >= 70) { color = '#4caf50'; emoji = '🤝'; }
        else if (val <= 30) { color = '#f44336'; emoji = '💢'; }
        
        els.npcApprovalsList.innerHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem; align-items: center; background: rgba(255,255,255,0.4); padding: 4px 8px; border-radius: 4px;">
                <span>${emoji} ${npc}</span>
                <strong style="color: ${color};">${val}</strong>
            </div>
        `;
    }
    els.npcApprovalsList.innerHTML += renderMemoryPanel();
}

function updateProgressBar() {
    const total = gameState.events.length;
    const current = Math.min(gameState.currentEventIndex + 1, total);
    const pct = (current / total) * 100;
    if(els.progressBar) els.progressBar.style.width = `${pct}%`;
}

function showIndexExplanation(type) {
    let title = "";
    let desc = "";
    if (type === 'freedom') {
        title = "自由平權 (Freedom)";
        desc = "代表社會對多元價值的包容度與公民基本權利。指數越高，社會越開放多元；指數過低則代表社會封閉，甚至走向威權體制。";
    } else if (type === 'order') {
        title = "社會秩序 (Order)";
        desc = "代表法治與社會的穩定程度。指數越高，社會越安全穩定；指數過低則代表法治崩壞，可能引發暴動與無政府狀態。";
    } else if (type === 'progress') {
        title = "進步主義 (Progress)";
        desc = "代表經濟、科技與制度改革的驅動力。指數越高，國家發展越迅速且願意改革；指數過低則代表社會趨於保守、發展停滯。";
    } else if (type === 'populism') {
        title = "民粹激進 (Populism)";
        desc = "代表群眾非理性情緒與盲從程度。指數過高將導致社會被極端情緒綁架，引發非理性抗爭；適度或較低則代表社會能進行理性對話。";
    }
    showDetailModal(title, desc, null, null, null);
}

// 背景色動態改變已移除，維持穩定色調

function handleDecision(optIndex) {
    if (gameState.decisionLocked) return;
    const ev = gameState.events[gameState.currentEventIndex];
    let option = ev.options[0]; // 預設拿第一個
    if (!ev.is_news && ev.options[optIndex]) {
        option = ev.options[optIndex];
    }
    gameState.decisionLocked = true;
    els.btnOptA.disabled = true;
    els.btnOptB.disabled = true;
    
    // 檢查是否有說服設定且觸發條件符合
    if (ev.persuasion_config && ev.persuasion_config.if_option === optIndex) {
        const persuasionConfig = adaptPersuasionConfig(ev.persuasion_config);
        gameState.pendingDecision = { option, optIndex, ev, persuasionConfig };
        showPersuasionModal(persuasionConfig);
        return;
    }
    
    applyDecisionAndShowNews(option, ev, null);
}

function showPersuasionModal(config) {
    els.eventModal.classList.add('hidden');
    gameState.persuasionLocked = false;
    els.btnPersuadeHigh.disabled = false;
    els.btnPersuadeLow.disabled = false;
    
    let targetChar = gameState.characters.find(c => c.name === config.target);
    setImageSource(
        els.persuasionTargetImg,
        targetChar ? characterImageFile(targetChar.name) : imageAliasFromText(config.target, "char_generic.png"),
        'char_generic.png'
    );
    els.persuasionTargetName.innerText = config.target;
    els.persuasionReason.innerText = config.reason;
    
    els.btnPersuadeHigh.innerText = neutralizePersuasionLabel(config.persuasion_high.text);
    els.btnPersuadeLow.innerText = neutralizePersuasionLabel(config.persuasion_low.text);
    
    els.btnPersuadeHigh.onclick = () => handlePersuasion(true);
    els.btnPersuadeLow.onclick = () => handlePersuasion(false);
    
    openModal(els.persuasionModal);
}

function handlePersuasion(isHigh) {
    if (gameState.persuasionLocked || !gameState.pendingDecision) return;
    gameState.persuasionLocked = true;
    els.btnPersuadeHigh.disabled = true;
    els.btnPersuadeLow.disabled = true;
    const config = gameState.pendingDecision.persuasionConfig || gameState.pendingDecision.ev.persuasion_config;
    const pOption = isHigh ? config.persuasion_high : config.persuasion_low;
    els.persuasionModal.classList.add('hidden');
    applyDecisionAndShowNews(gameState.pendingDecision.option, gameState.pendingDecision.ev, pOption, config.target, isHigh);
}

function updateNPCApprovalsBasedOnEffects(effects, pTarget, isPHigh) {
    // 根據大環境變化影響對應派系
    if (effects.freedom > 0) { gameState.npcApprovals["艾達議員"] += 5; gameState.npcApprovals["莫長老"] -= 5; gameState.npcApprovals["雷將軍"] -= 5; }
    if (effects.freedom < 0) { gameState.npcApprovals["艾達議員"] -= 5; gameState.npcApprovals["莫長老"] += 5; gameState.npcApprovals["雷將軍"] += 5; }
    
    if (effects.order > 0) { gameState.npcApprovals["雷將軍"] += 5; gameState.npcApprovals["龐頭目"] -= 5; }
    if (effects.order < 0) { gameState.npcApprovals["龐頭目"] += 5; gameState.npcApprovals["雷將軍"] -= 5; }
    
    if (effects.progress > 0) { gameState.npcApprovals["威廉總裁"] += 5; gameState.npcApprovals["柯爾市長"] += 5; }
    if (effects.progress < 0) { gameState.npcApprovals["威廉總裁"] -= 10; }
    
    if (effects.populism > 0) { gameState.npcApprovals["蘇網紅"] += 10; gameState.npcApprovals["費教授"] -= 5; }
    
    // 說服目標的直接好感度影響
    if (pTarget && gameState.npcApprovals[pTarget] !== undefined) {
        if (isPHigh) {
            gameState.npcApprovals[pTarget] += 4;
        } else {
            gameState.npcApprovals[pTarget] -= 25;
        }
    }
}

function eventText(event = {}, option = {}, pOption = null) {
    return [
        event.title,
        event.original_title,
        event.description,
        event.original_description,
        event.image_filename,
        event.relationship_effects_text,
        option.text,
        option.original_text,
        option.result_text,
        option.original_result_text,
        pOption?.text,
        pOption?.result_text
    ].filter(Boolean).join(" ").toLowerCase();
}

function queueNpcDelta(deltas, name, value) {
    if (!name || !Object.prototype.hasOwnProperty.call(gameState.npcApprovals, name)) return;
    deltas[name] = (deltas[name] || 0) + value;
}

function applyNpcDelta(name, value) {
    if (!Object.prototype.hasOwnProperty.call(gameState.npcApprovals, name)) return;
    gameState.npcApprovals[name] = Math.max(0, Math.min(100, gameState.npcApprovals[name] + value));
}

function clampNpcApprovals() {
    Object.keys(gameState.npcApprovals || {}).forEach((name) => {
        gameState.npcApprovals[name] = Math.max(0, Math.min(100, gameState.npcApprovals[name]));
    });
}

function syncArcTrustFromApprovals(names = Object.keys(gameState.npcApprovals || {})) {
    names.forEach((name) => {
        const arc = ensureCharacterArc(name);
        if (!arc || gameState.npcApprovals[name] === undefined) return;
        arc.trust = gameState.npcApprovals[name];
        arc.relationState = relationshipStateForArc(arc);
        arc.relationText = relationshipLineForState(arc);
    });
}

function contextualNpcDeltas(event = {}, option = {}, effects = {}, pOption = null) {
    const text = eventText(event, option, pOption);
    const lens = issueLens(event);
    const deltas = {};

    if (/車禍|事故|意外|工安|交通|傷亡|災害/.test(text)) {
        queueNpcDelta(deltas, "柯爾市長", -14);
        queueNpcDelta(deltas, "莉亞記者", 6);
        queueNpcDelta(deltas, "費教授", 4);
        if ((effects.order || 0) > 0) queueNpcDelta(deltas, "雷將軍", 5);
        if ((effects.progress || 0) > 0) queueNpcDelta(deltas, "艾達議員", 4);
    }

    if (/信任受挫|信任度受挫|受挫|卸責|究責|市府.*質疑|質疑.*市府|市長.*質疑|質疑.*市長/.test(text)) {
        queueNpcDelta(deltas, "柯爾市長", -12);
    }

    if (/醜聞|賄|貪腐|黑箱|弊案|特權|利益輸送/.test(text)) {
        queueNpcDelta(deltas, "柯爾市長", -12);
        queueNpcDelta(deltas, "莉亞記者", 8);
        queueNpcDelta(deltas, "費教授", 4);
        queueNpcDelta(deltas, "蘇網紅", 4);
        queueNpcDelta(deltas, "威廉總裁", -3);
    }

    if (lens.label === "資訊戰" || /假消息|網軍|媒體|言論|造謠|謠言|蘇網紅/.test(text)) {
        queueNpcDelta(deltas, "莉亞記者", 5);
        queueNpcDelta(deltas, "費教授", 4);
        queueNpcDelta(deltas, "蘇網紅", (effects.populism || 0) > 0 ? 8 : -2);
        if ((effects.order || 0) > 0 || /國安|安全|境外/.test(text)) queueNpcDelta(deltas, "雷將軍", 5);
    }

    if (lens.label === "生計壓力" || /工資|薪資|罷工|基本收入|勞工|升遷|考績/.test(text)) {
        queueNpcDelta(deltas, "龐頭目", 8);
        queueNpcDelta(deltas, "威廉總裁", -5);
        queueNpcDelta(deltas, "柯爾市長", (effects.progress || 0) > 0 ? -4 : -8);
        if ((effects.progress || 0) > 0) queueNpcDelta(deltas, "艾達議員", 5);
    }

    if (lens.label === "發展代價" || /污染|能源|環境|工廠|開發/.test(text)) {
        queueNpcDelta(deltas, "威廉總裁", -8);
        queueNpcDelta(deltas, "柯爾市長", -5);
        queueNpcDelta(deltas, "費教授", 5);
        queueNpcDelta(deltas, "艾達議員", 4);
    }

    if (lens.label === "安全焦慮" || /國安|軍事|安全|外部勢力|邊境/.test(text)) {
        queueNpcDelta(deltas, "雷將軍", 8);
        if ((effects.freedom || 0) < 0) queueNpcDelta(deltas, "艾達議員", -4);
        queueNpcDelta(deltas, "費教授", 3);
    }

    if (lens.label === "世代衝突") {
        queueNpcDelta(deltas, "莫長老", (effects.populism || 0) > 0 || (effects.order || 0) < 0 ? -7 : 3);
        queueNpcDelta(deltas, "艾達議員", (effects.progress || 0) > 0 ? 5 : 0);
        queueNpcDelta(deltas, "莉亞記者", 3);
    }

    if ((effects.progress || 0) > 0 && /車禍|事故|醜聞|卸責|信任/.test(text)) {
        queueNpcDelta(deltas, "柯爾市長", -8);
    }

    return deltas;
}

function applyContextualNpcDeltas(event = {}, option = {}, effects = {}, pOption = null) {
    const deltas = contextualNpcDeltas(event, option, effects, pOption);
    Object.entries(deltas).forEach(([name, value]) => applyNpcDelta(name, value));
    clampNpcApprovals();
    syncArcTrustFromApprovals(Object.keys(deltas));
    return deltas;
}

function nextTurn() {
    els.newsFlash.classList.add('hidden');
    gameState.currentEventIndex++;
    
    if (gameState.currentEventIndex >= gameState.events.length) {
        // 如果沒有下一個事件了，也顯示按鈕，點擊後會進入結局
        els.triggerEventBtn.innerText = "查看結局";
    } else {
        els.triggerEventBtn.innerText = gameState.nextHook || "推進時間";
    }
    els.nextTurnBtn.innerText = "確認";
    els.triggerEventBtn.classList.remove('hidden');
}

function determineEnding() {
    const { freedom, order, progress, populism } = gameState.stats;

    if (populism >= 80 && order <= 30) {
        return {
            key: "anarchy",
            title: "制度失靈與街頭失控",
            line: "這不是突然變成無政府，而是前面多次選擇讓聲量變強、秩序變弱，最後制度失去仲裁能力。"
        };
    }
    if (order >= 80 && freedom <= 30) {
        return {
            key: "authoritarian",
            title: "新威權時代",
            line: "社會換到穩定，但異議、查證與少數立場也一起被壓低。"
        };
    }
    if (freedom >= 70 && progress >= 70 && order >= 50) {
        return {
            key: "progressive",
            title: "艱難的改革共識",
            line: "自由發聲、制度改革與基本秩序勉強接上，改革因此能被延續。"
        };
    }
    if (populism >= 70 && order >= 70) {
        return {
            key: "populistOrder",
            title: "多數意志的高壓秩序",
            line: "秩序被保住，但主要靠多數情緒施壓，不同聲音很難留下。"
        };
    }
    return {
        key: "democraticMud",
        title: "泥淖中的民主",
        line: "社會沒有崩潰，但也沒有真正解開彼此的不信任。"
    };
}

function endingCauseItems(result) {
    const { freedom, order, progress, populism } = gameState.stats;
    const items = [];

    if (populism >= 70) items.push("你常用聲量推動事情，所以對立變強。");
    if (order <= 35) items.push("秩序太低，大家開始覺得制度管不住局面。");
    if (order >= 70) items.push("你常先穩住場面，但有些訴求被延後。");
    if (freedom <= 35) items.push("發聲空間太小，很多不滿只是不說出口。");
    if (freedom >= 65) items.push("更多人能說話，但衝突也更難收束。");
    if (progress >= 65) items.push("改革往前走了，但需要有人承擔成本。");
    if (progress <= 40) items.push("改革太慢，支持者開始失望。");

    if (result.key === "anarchy") {
        items.unshift("這不是突然失控，而是聲量一直升高、制度卻收不回來。");
    }
    if (result.key === "authoritarian") {
        items.unshift("社會變穩了，但代價是更多控制。");
    }
    if (result.key === "progressive") {
        items.unshift("你讓問題被看見，也保住了處理問題的制度。");
    }

    return [...new Set(items)].slice(0, 4);
}

function endingAccountabilityLine(result) {
    const strongest = Object.entries(gameState.stats).sort((a, b) => b[1] - a[1])[0] || ["balance", 50];
    const weakest = Object.entries(gameState.stats).sort((a, b) => a[1] - b[1])[0] || ["balance", 50];
    const base = `你的「${effectLabel(strongest[0])}」最高，「${effectLabel(weakest[0])}」最低，所以結局不是突然跳出來，而是一路累積出來。`;
    const costs = {
        anarchy: "最後付出代價的是第一線、一般民眾，以及原本只想被好好處理的受影響者。",
        authoritarian: "最後付出代價的是公共發聲空間，許多反對意見被換成表面穩定。",
        progressive: "最後付出代價的是願意承擔改革成本的人，因為制度往前走也需要財源、時間與責任人。",
        populistOrder: "最後付出代價的是少數聲音和複雜討論，因為多數情緒成了最容易動員的工具。",
        democraticMud: "最後付出代價的是信任本身，因為每一方都得到一點，卻也都覺得自己被拖欠。"
    };
    return `${base}${costs[result.key] || costs.democraticMud}`;
}

function buildEndingNarrative(result) {
    const causes = endingCauseItems(result);
    const lastChoices = gameState.choiceHistory.slice(-2);

    return `
        <section class="ending-report ${escapeHTML(result.key)}">
            <h3>結局：${escapeHTML(result.title)}</h3>
            <p>${escapeHTML(result.line)}</p>
            <div class="ending-verdict">
                <b>這個結局怎麼來的</b>
                <span>${escapeHTML(endingAccountabilityLine(result))}</span>
            </div>
            <div class="ending-causes">
                <b>原因</b>
                ${causes.map((cause) => `<span>${escapeHTML(cause)}</span>`).join("")}
            </div>
            ${lastChoices.length ? `
                <div class="ending-trail">
                    <b>壓成結局的最後兩步</b>
                    ${lastChoices.map((choice) => `
                        <small>${escapeHTML(compactText(choice.eventTitle, 22))}：${escapeHTML(compactText(choice.choiceText, 30))}，造成${escapeHTML(choice.effect)}</small>
                    `).join("")}
                </div>` : ""}
        </section>`;
}

async function endGame() {
    const { freedom, order, progress, populism } = gameState.stats;
    const endingResult = determineEnding();
    els.endText.innerHTML = `${buildEndingNarrative(endingResult)}${buildRelationshipClosureReport()}${buildPersonalityAnalysis()}`;
    hydrateDynamicImages(els.endText);
    openModal(els.endScreen);
    
    // 送出數據到後端
    try {
        await apiFetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_name: gameState.playerName,
                character_id: gameState.character.id,
                final_freedom: freedom,
                final_order: order,
                final_progress: progress,
                final_populism: populism
            })
        });
    } catch (err) {
        console.error("Failed to save log", err);
    }
}

function eventIllustrationDataUri(seedName = "") {
    const key = seedName.toLowerCase();
    let motif = `
        <path d="M23 72h74M31 57h54M39 46h38"/>
        <circle cx="36" cy="34" r="7"/><circle cx="82" cy="34" r="7"/>
        <path d="M22 82c8-12 22-12 30 0M68 82c8-12 22-12 30 0"/>
        <path d="M54 23h18l8 8-8 8H54z"/>`;

    if (key.includes("pollution") || key.includes("energy")) {
        motif = `
            <path d="M20 74h82M28 74V48h18v26M56 74V34h26v40"/>
            <path d="M62 34l10-12 10 12M66 46h10M66 58h10"/>
            <path d="M22 87c9-5 18-5 27 0s18 5 27 0 18-5 27 0"/>
            <circle cx="36" cy="36" r="7"/>`;
    } else if (key.includes("marriage") || key.includes("education")) {
        motif = `
            <path d="M23 76h74M31 76V42l29-16 29 16v34"/>
            <path d="M43 76V55h34v21M50 43h20"/>
            <circle cx="36" cy="27" r="6"/><path d="M28 35c5-7 12-7 17 0"/>
            <path d="M77 28l14 8-14 8z"/>`;
    } else if (key.includes("fakenews") || key.includes("media") || key.includes("bribe") || key.includes("scandal")) {
        motif = `
            <rect x="24" y="28" width="60" height="44" rx="4"/>
            <path d="M34 42h28M34 52h40M34 62h24"/>
            <path d="M88 40l14-8v36l-14-8z"/>
            <circle cx="90" cy="76" r="8"/><path d="M100 86l-6-6"/>`;
    } else if (key.includes("wage") || key.includes("ubi") || key.includes("accident")) {
        motif = `
            <path d="M36 24h42l12 12v48H36z"/>
            <path d="M78 24v14h12M48 46h26M48 58h30M48 70h18"/>
            <circle cx="26" cy="62" r="7"/><path d="M15 84c6-12 17-12 23 0"/>
            <path d="M72 78l8 8 18-24"/>`;
    } else if (key.includes("military")) {
        motif = `
            <path d="M24 70h72M34 70V48l26-14 26 14v22"/>
            <path d="M46 50h28M46 60h28"/>
            <path d="M31 32l18 8M89 32l-18 8"/>
            <circle cx="60" cy="25" r="7"/>`;
    }

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
            <rect width="120" height="100" fill="#f4f7f7"/>
            <rect x="10" y="10" width="100" height="80" rx="10" fill="#ffffff" stroke="#cbd9df" stroke-width="1.4"/>
            <g fill="none" stroke="#386f8f" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">${motif}</g>
        </svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function hashText(text) {
    return String(text || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function conceptCard(title, body) {
    return `
        <div class="concept-chip">
            <b>${title}</b>
            <span>${body}</span>
        </div>`;
}

function buildAgencyExplanation(option, ev, effects) {
    const [mainKey, mainValue] = strongestEffect(effects);
    const context = polishNarrativeText(`${ev.title} ${option.text} ${option.result_text} ${option.explanation}`);

    if (/暫時擱置|未給出實質承諾|沒有進入具體承諾/.test(context)) {
        return conceptCard(
            "政策窗口",
            "沒有時程，就還沒前進。"
        );
    }

    const candidates = [];
    if ((effects.progress || 0) > 0) {
        candidates.push({
            title: "進入流程",
            body: "訴求開始有人處理。"
        });
        candidates.push({
            title: "找到入口",
            body: "事情不只停在抗議。"
        });
    }
    if ((effects.freedom || 0) > 0) {
        candidates.push({
            title: "更多人發聲",
            body: "原本沉默的人站出來了。"
        });
    }
    if ((effects.order || 0) > 0) {
        candidates.push({
            title: "場面穩住",
            body: "大家比較願意談。"
        });
    }
    if ((effects.populism || 0) > 0 || (effects.order || 0) < 0) {
        candidates.push({
            title: "反彈效應",
            body: "聲量越大，反擊越快。"
        });
    }
    if ((effects.populism || 0) < 0) {
        candidates.push({
            title: "降溫",
            body: "安靜了，但問題還在。"
        });
    }
    if ((effects.freedom || 0) < 0) {
        candidates.push({
            title: "沉默螺旋",
            body: "安靜不代表同意。"
        });
    }
    if ((effects.progress || 0) < 0) {
        candidates.push({
            title: "回到舊路",
            body: "改革變慢了。"
        });
    }

    candidates.push({
        title: "焦點改變",
        body: `${effectLabel(mainKey)}${effectDirection(mainValue)}。`
    });

    const picked = candidates[hashText(`${ev.title}${option.text}${gameState.currentEventIndex}`) % candidates.length];
    return conceptCard(picked.title, picked.body);
}

function showEvent() {
    els.triggerEventBtn.classList.add('hidden');
    if (gameState.currentEventIndex >= gameState.events.length) {
        return endGame();
    }

    gameState.decisionLocked = false;
    gameState.persuasionLocked = false;
    els.btnOptA.disabled = false;
    els.btnOptB.disabled = false;

    const ev = gameState.events[gameState.currentEventIndex];
    const chapter = chapterInfo();
    const profile = roleProfile();
    const previous = gameState.memories[gameState.memories.length - 1];
    const stakeholders = involvedCharactersForEvent(ev);
    markStakeholderAppearances(stakeholders);
    clearMapHighlights();
    highlightMapCharacters([profile.ally, profile.skeptic, previous?.npc, ...stakeholders], "speaker-watch");
    els.eventTitle.innerHTML = `<span class="event-kicker">${escapeHTML(chapter.label)}</span>${escapeHTML(ev.title)}`;
    const imageFile = eventImageFile(ev);
    setImageSource(
        els.eventImage,
        imageFile,
        imageFile || "event_fakenews.png",
        eventIllustrationDataUri(ev.image_filename || ev.title)
    );
    els.eventImage.style.display = 'block';
    els.eventImage.alt = `${ev.title} 的事件插圖`;
    els.eventDesc.innerHTML = buildEventBrief(ev);
    hydrateDynamicImages(els.eventDesc);

    if (ev.is_news) {
        formatChoiceButton(els.btnOptA, ev.options[0]);
        els.btnOptB.style.display = 'none';
        els.eventTitle.innerHTML = `<span class="event-kicker">新聞快訊</span>${escapeHTML(ev.title)}`;
        els.eventTitle.style.color = "var(--text-main)";
    } else {
        formatChoiceButton(els.btnOptA, ev.options[0]);
        if (ev.options[1]) {
            els.btnOptB.style.display = 'inline-block';
            formatChoiceButton(els.btnOptB, ev.options[1]);
        } else {
            els.btnOptB.style.display = 'none';
        }
        els.eventTitle.style.color = "var(--text-main)";
    }

    openModal(els.eventModal);
    updateProgressBar();
}

function applyDecisionAndShowNews(option, ev, pOption, pTarget = null, isPHigh = false) {
    const effects = { freedom: 0, order: 0, progress: 0, populism: 0, ...(option.effects || {}) };
    const beforeApprovals = { ...gameState.npcApprovals };
    const decisionKey = [
        gameState.currentEventIndex,
        ev.id || ev.title || "event",
        polishNarrativeText(option.text || ""),
        pOption ? polishNarrativeText(pOption.text || "") : "direct"
    ].join("|");
    const alreadyAppliedPersonalStats = Boolean(gameState.appliedDecisionKeys?.[decisionKey]);

    if (pOption && pOption.effects) {
        effects.freedom = (effects.freedom || 0) + (pOption.effects.freedom || 0);
        effects.order = (effects.order || 0) + (pOption.effects.order || 0);
        effects.progress = (effects.progress || 0) + (pOption.effects.progress || 0);
        effects.populism = (effects.populism || 0) + (pOption.effects.populism || 0);
    }

    gameState.stats.freedom += effects.freedom;
    gameState.stats.order += effects.order;
    gameState.stats.progress += effects.progress;
    gameState.stats.populism += effects.populism;

    let statChangesHtml = "";
    const personalChanges = {};
    function queuePersonalStatChange(key, change) {
        personalChanges[key] = (personalChanges[key] || 0) + change;
    }

    if (!alreadyAppliedPersonalStats && option.personal_effects && gameState.character.personal_stats) {
        if (!ev.target_role || ev.target_role === gameState.character.role || ev.target_role === gameState.character.name) {
            for (let key in option.personal_effects) {
                queuePersonalStatChange(key, option.personal_effects[key]);
            }
        }
    }

    if (!alreadyAppliedPersonalStats && pOption && pOption.cost && gameState.character.personal_stats) {
        for (let key in pOption.cost) {
            queuePersonalStatChange(key, pOption.cost[key]);
        }
    }

    if (!alreadyAppliedPersonalStats) {
        Object.entries(personalChanges).forEach(([key, change]) => applyPersonalStatChange(key, change));
        gameState.appliedDecisionKeys[decisionKey] = true;
    }

    function applyPersonalStatChange(key, change) {
        if (gameState.character.personal_stats[key] !== undefined) {
            gameState.character.personal_stats[key] += change;
            const color = change > 0 ? 'var(--steady)' : 'var(--danger)';
            const sign = change > 0 ? '+' : '';
            statChangesHtml += `<span style="color: ${color}; background: rgba(255,255,255,0.82); padding: 5px 10px; border-radius: 5px;">${key} ${sign}${change}</span>`;
        }
    }

    updateNPCApprovalsBasedOnEffects(effects, pTarget, isPHigh);
    applyContextualNpcDeltas(ev, option, effects, pOption);
    const reaction = buildNpcReaction(beforeApprovals, effects, pTarget, isPHigh, ev);
    const beat = sceneBeat(effects, reaction);
    gameState.lastOutcome = reaction;
    gameState.nextHook = beat.next;
    updateCharacterArcs(ev, effects, reaction, pTarget, isPHigh);
    recordBehaviorChoice(option, ev, effects, pOption, reaction, beat);
    updateStatsUI();
    renderNPCApprovals();
    els.eventModal.classList.add('hidden');

    let newsHTML = "";
    if (ev.is_news) {
        newsHTML = `
            <div class="result-headline">
                <span>局勢更新</span>
                <strong>${escapeHTML(ev.title)}</strong>
            </div>
            <p>${escapeHTML(compactText(ev.options[0].result_text, 54))}</p>
        `;
        if (ev.relationship_effects_text) {
            newsHTML += `<div class="pressure-note">影響：${escapeHTML(compactText(ev.relationship_effects_text, 42))}</div>`;
        }
    } else {
        newsHTML = `
            <div class="result-headline">
                <span>${escapeHTML(chapterInfo().label)}後果</span>
                <strong>${escapeHTML(gameState.playerName)} 選擇了：${escapeHTML(polishNarrativeText(option.text))}</strong>
            </div>
            <p>${escapeHTML(compactText(option.result_text, 58))}</p>
            ${buildOutcomeReport(option, ev, effects, pOption, reaction, beat)}
        `;
        if (pOption) {
            newsHTML += `<div class="pressure-note danger"><strong>說服</strong> ${escapeHTML(compactText(pOption.result_text, 42))}</div>`;
        }

    }

    els.newsText.innerHTML = newsHTML;
    hydrateDynamicImages(els.newsText);
    clearMapHighlights();
    highlightMapCharacters([reaction.npc], "speaker-active");
    if (els.newsStatChanges) {
        els.newsStatChanges.innerHTML = statChangesHtml;
    }

    els.nextTurnBtn.innerText = beat.next || "確認";
    openModal(els.newsFlash);
}
