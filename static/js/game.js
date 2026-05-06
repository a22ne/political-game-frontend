// 遊戲核心數值與狀態
const API_BASE = window.API_BASE_URL || "";
const apiFetch = (path, options) => fetch(`${API_BASE}${path}`, options);
const ASSET_BASE = window.ASSET_BASE_URL || "./";
const REMOTE_ASSET_BASE = window.REMOTE_ASSET_BASE_URL || API_BASE;

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

function imagePath(fileName, fallback = "char_generic.png", base = ASSET_BASE) {
    const normalized = normalizeImageName(fileName, fallback);
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
    return normalized ? imagePath(normalized, "", REMOTE_ASSET_BASE) : "";
}

function setImageSource(img, fileName, fallbackFile = "char_generic.png", fallbackDataUri = "") {
    if (!img) return;
    const localSrc = imagePath(fileName, fallbackFile);
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
    return characterByName(name)?.image_filename || "char_generic.png";
}

function renderAvatar(name, className = "dialogue-avatar") {
    const fileName = characterImageFile(name);
    return `<img class="${className}" src="${imagePath(fileName, 'char_generic.png')}" data-image-file="${escapeHTML(fileName)}" alt="${escapeHTML(name)}">`;
}

function hydrateDynamicImages(root = document) {
    root.querySelectorAll?.("img[data-image-file]").forEach((img) => {
        setImageSource(img, img.dataset.imageFile, "char_generic.png");
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
        ["舊利益與新世代", "改革不是一句口號。它會改變誰付錢、誰失去權力、誰第一次被聽見。"]
    ];

    return `
        <div class="intro-grid">
            ${cards.map(([title, body]) => `
                <article class="intro-card">
                    <b>${escapeHTML(title)}</b>
                    <span>${escapeHTML(body)}</span>
                </article>
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
    const text = `${event.title || ""} ${event.description || ""} ${event.image_filename || ""}`.toLowerCase();
    if (/wage|ubi|工資|基本收入|社會福利/.test(text)) {
        return {
            label: "生計壓力",
            cause: "物價與薪資落差累積太久，基層開始要求把補償寫進制度。",
            stakes: "企業成本、政府財政與街頭支持會同時被拉扯。",
            actors: ["龐頭目", "艾達議員", "威廉總裁", "柯爾市長"]
        };
    }
    if (/education|學生|教育|校園/.test(text)) {
        return {
            label: "世代衝突",
            cause: "年輕人的訴求碰到社區與學校的舊規則，雙方都怕自己被忽視。",
            stakes: "訴求能不能從街頭進入正式程序，會決定後面誰願意支援。",
            actors: ["艾達議員", "莫長老", "莉亞記者", "費教授"]
        };
    }
    if (/fakenews|media|scandal|bribe|網路|言論|假消息|媒體|醜聞|賄賂/.test(text)) {
        return {
            label: "資訊戰",
            cause: "選舉接近，各方都想先定義真相；假消息與言論管制因此被綁在一起。",
            stakes: "查證、自由與安全會互相衝突，任何表態都可能被剪成另一種敘事。",
            actors: ["莉亞記者", "蘇網紅", "雷將軍", "費教授"]
        };
    }
    if (/pollution|energy|污染|能源|環境/.test(text)) {
        return {
            label: "發展代價",
            cause: "經濟成長留下污染與能源壓力，居民不再相信企業與政府會自己處理。",
            stakes: "改革速度越快，投資與就業的反彈也越明顯。",
            actors: ["威廉總裁", "艾達議員", "柯爾市長", "費教授"]
        };
    }
    if (/military|國安|軍事|安全|外部勢力/.test(text)) {
        return {
            label: "安全焦慮",
            cause: "外部威脅被放大後，秩序派開始要求更強控制，改革派則擔心自由被交換掉。",
            stakes: "你要判斷安全需求是真問題，還是被拿來壓縮公共討論。",
            actors: ["雷將軍", "柯爾市長", "艾達議員", "蘇網紅"]
        };
    }
    if (/marriage|婚姻|平權|家庭/.test(text)) {
        return {
            label: "價值衝突",
            cause: "新的權利訴求碰到傳統家庭想像，雙方都覺得自己的生活方式被威脅。",
            stakes: "同理與制度設計如果斷開，議題會滑向身份對立。",
            actors: ["艾達議員", "莫長老", "費教授", "莉亞記者"]
        };
    }
    return {
        label: "信任危機",
        cause: "制度信任太薄，一個事件就能讓舊矛盾重新浮上來。",
        stakes: "誰先說服旁觀者，誰就能決定這件事被看成改革、失序或交換。",
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
        "生計壓力": "當生活撐不下去時，誰應該先承擔改革成本？",
        "世代衝突": "當新一代要求改變時，舊社群的不安該被說服、安撫，還是被推開？",
        "資訊戰": "當謠言與管制同時出現時，民主應該先保護自由，還是先阻止傷害？",
        "發展代價": "當發展留下污染與風險時，誰有權決定代價能不能被接受？",
        "安全焦慮": "當安全成為理由時，人民願意交出多少自由？",
        "價值衝突": "當權利擴張碰到傳統生活方式時，政治該怎麼讓雙方都被看見？",
        "信任危機": "當所有人都不相信制度時，誰還能讓公共討論重新開始？"
    };
    return questions[lens.label] || questions["信任危機"];
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

function stakeholderVoice(name, event = {}) {
    const lens = issueLens(event);
    const voices = {
        "柯爾市長": "我要知道這會不會讓市府失去控制。",
        "莫長老": "不要把社區變成政治衝突的戰場。",
        "艾達議員": "如果要改，就要能進入正式程序。",
        "威廉總裁": "改革不能讓成本完全失控。",
        "莉亞記者": "誰在說真話？誰只是改寫敘事？",
        "龐頭目": "沒有壓力，就不會有人坐下來談。",
        "雷將軍": "自由不能成為失序的藉口。",
        "費教授": "先把證據與長期成本講清楚。",
        "蘇網紅": "這件事如果說得夠簡單，就會爆。"
    };
    if (lens.label === "資訊戰" && name === "雷將軍") return "假消息不是意見，是安全破口。";
    if (lens.label === "生計壓力" && name === "龐頭目") return "如果大家活不下去，秩序只是好看的字。";
    if (lens.label === "發展代價" && name === "威廉總裁") return "太快轉彎，工廠、工作與投資都會一起掉下去。";
    return voices[name] || "我還在看你會把局勢推向哪裡。";
}

function renderStakeholderCouncil(event = {}) {
    const names = involvedCharactersForEvent(event);
    return `
        <div class="stakeholder-council">
            <div class="council-title">場上正在互相拉扯的人</div>
            ${names.slice(0, 5).map((name) => `
                <article>
                    ${renderAvatar(name, "council-avatar")}
                    <div>
                        <b>${escapeHTML(name)}</b>
                        <span>${escapeHTML(stakeholderVoice(name, event))}</span>
                    </div>
                </article>
            `).join("")}
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
    const hook = gameState.nextHook
        ? `<div class="next-hook">${escapeHTML(gameState.nextHook)}</div>`
        : "";
    return `
        <div class="chapter-strip">
            <span>${escapeHTML(chapter.label)}</span>
            <strong>第 ${gameState.currentEventIndex + 1} / ${gameState.events.length} 回合</strong>
        </div>
        ${hook}
        <p class="event-one-line">${escapeHTML(compactText(ev.description, 64))}</p>
        ${buildWhyPanel(ev)}
        ${buildSceneDossier(ev)}
        ${buildArcThread(ev)}
        ${renderStakeholderCouncil(ev)}
        ${renderCharacterArcBoard(ev)}
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

function buildNpcReaction(beforeApprovals, effects, pTarget, isPHigh) {
    let npc = pTarget || "";
    let text = "";
    let tone = "watch";

    if (npc) {
        const after = gameState.npcApprovals[npc];
        const before = beforeApprovals[npc] ?? after;
        tone = after >= before ? "support" : "oppose";
        text = isPHigh
            ? `${npc}沒有完全被說服，但願意暫時留在談判桌上。`
            : `${npc}把這次衝突記了下來，之後更可能在關鍵場合阻擋你。`;
    } else if ((effects.freedom || 0) > 0) {
        npc = "艾達議員";
        tone = "support";
        text = "艾達議員把你的說法轉給幕僚，暗示可以幫忙找正式質詢入口。";
    } else if ((effects.order || 0) > 0) {
        npc = "雷將軍";
        tone = "support";
        text = "雷將軍稱讚你讓場面降溫，但也提醒你別再把街頭壓力帶進市府。";
    } else if ((effects.populism || 0) > 0 || (effects.order || 0) < 0) {
        npc = "莫長老";
        tone = "oppose";
        text = "莫長老在社區群組提醒大家保持距離，說這件事已經被年輕人帶偏。";
    } else if ((effects.progress || 0) > 0) {
        npc = "莉亞記者";
        tone = "support";
        text = "莉亞記者要求你提供更完整的時間線，準備把事件做成追蹤報導。";
    } else {
        npc = "柯爾市長";
        tone = "watch";
        text = "市長辦公室沒有公開回應，但幕僚開始觀察你背後還有多少人。";
    }

    const memory = { turn: gameState.currentEventIndex + 1, npc, tone, text };
    gameState.memories.push(memory);
    gameState.memories = gameState.memories.slice(-4);
    return memory;
}

function buildNpcInteraction(reaction, effects) {
    return buildNpcExchange(reaction, effects).summary;
}

function buildNpcExchange(reaction, effects) {
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
            actorLine: `${effectLabel(key)}正在${effectDirection(value)}。`,
            otherLine: "先看他的下一步。",
            summary: `${actor}把你的選擇轉述給${other}，說這不是單一事件，而是你正在把${effectLabel(key)}推向${effectDirection(value)}。${other}沒有立刻表態，但開始要求你拿出更清楚的下一步。`
        };
    }

    if (reaction.tone === "support") {
        return {
            actor,
            other,
            actorLine: "我可以幫他開門。",
            otherLine: "別太快押寶。",
            summary: `${actor}願意替你打開一扇門，但${other}提醒他別太快押寶。兩人真正爭的不是你本人，而是這件事能不能被納入正式流程。`
        };
    }

    return {
        actor,
        other,
        actorLine: "我還不站隊。",
        otherLine: "看他下一步。",
        summary: `${actor}沒有站隊，只把消息轉給${other}。這代表局勢還沒定型，但下一次選擇會更難被當成偶然。`
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

function renderInteractionDialogue(reaction, effects) {
    const exchange = buildNpcExchange(reaction, effects);
    return `
        <div class="interaction-card">
            <b>人物互動</b>
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

function buildPlainDecisionRead(option, ev, effects, reaction) {
    const [key, value] = strongestEffect(effects);
    const first = value === 0
        ? "局勢沒有立刻翻盤。"
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
        freedom: value > 0 ? "你把事件定義成「誰有權發聲」的問題。" : "你把事件暫時放回低衝突的處理方式。",
        order: value > 0 ? "你優先處理現場穩定與可控性。" : "你接受較高的現場壓力，換取議題被看見。",
        progress: value > 0 ? "你把訴求往制度流程推進。" : "你讓事件先停在政治交換或觀望階段。",
        populism: value > 0 ? "你選擇放大情緒與注意力，讓事件更難被忽視。" : "你選擇降溫，避免事件被情緒綁架。",
        balance: "你沒有明顯推高單一指標，而是讓各方繼續觀望。"
    }[key];

    const tradeoff = {
        freedom: value > 0 ? "代價是保守派會更警戒，秩序派也會要求邊界。" : "代價是支持者可能覺得你沒有站出來。",
        order: value > 0 ? "代價是街頭支持者可能把這看成退讓。" : "代價是反對者更容易用失序來攻擊你。",
        progress: value > 0 ? "代價是你必須找到願意承擔責任的人，否則流程會變成空話。" : "代價是改革動能會被舊流程吸收。",
        populism: value > 0 ? "代價是敘事會被二創、剪輯或反向利用。" : "代價是議題聲量下降後，媒體可能轉向下一個事件。",
        balance: "代價是你暫時保留空間，但也沒有讓任何陣營真正放心。"
    }[key];

    const socialRead = reaction.tone === "oppose"
        ? `${reaction.npc}會把這個選擇理解成威脅。`
        : reaction.tone === "support"
            ? `${reaction.npc}會把這個選擇理解成合作入口。`
            : `${reaction.npc}還沒有下判斷，但會繼續觀察你是否一致。`;

    const persuasionRead = pOption
        ? `<small>說服段落：你不是只選政策，也選擇了面對衝突的語氣與關係成本。</small>`
        : "";

    return `
        <div class="option-analysis">
            <b>選項剖析</b>
            <article>
                <span>你剛才真正選的是</span>
                <strong>${escapeHTML(frame)}</strong>
            </article>
            <article>
                <span>它帶來的取捨</span>
                <strong>${escapeHTML(tradeoff)}</strong>
            </article>
            <article>
                <span>角色會怎麼讀你</span>
                <strong>${escapeHTML(socialRead)}</strong>
            </article>
            ${persuasionRead}
        </div>`;
}

function politicalCostReflection(ev, option, effects, reaction) {
    const [key, value] = strongestEffect(effects);
    const lens = issueLens(ev);
    const beneficiaries = {
        freedom: value > 0 ? "原本難以發聲的人得到更多公共空間" : "需要穩定處理的人暫時少了外部壓力",
        order: value > 0 ? "秩序派與行政系統得到喘息" : "街頭與抗議者得到更強的談判壓力",
        progress: value > 0 ? "改革派得到制度入口" : "保守或觀望陣營得到拖延空間",
        populism: value > 0 ? "擅長動員與傳播的人得到舞台" : "想降溫與查證的人得到空間",
        balance: "各方暫時都沒有輸到必須翻桌"
    }[key];
    const payers = {
        freedom: value > 0 ? "害怕失序的人承擔焦慮" : "等待被聽見的人承擔沉默",
        order: value > 0 ? "街頭訴求承擔被稀釋的風險" : "一般民眾與行政系統承擔混亂成本",
        progress: value > 0 ? "掌權者與既得利益者承擔制度改變成本" : "改革支持者承擔失望與疲乏",
        populism: value > 0 ? "被簡化或被貼標籤的人承擔誤讀" : "需要聲量的人承擔被忽視",
        balance: "未被明確處理的人繼續等待"
    }[key];
    const question = {
        "生計壓力": "如果你是被要求承擔成本的那一方，你還會覺得這個選擇公平嗎？",
        "世代衝突": "你剛才保護的是改變的速度，還是社群的安全感？",
        "資訊戰": "你願意為了降低傷害，讓誰有權決定哪些話可以被說？",
        "發展代價": "當改革看起來正確時，你有沒有看見被轉嫁成本的人？",
        "安全焦慮": "安全感增加時，誰的自由被放到比較後面？",
        "價值衝突": "你選擇的是說服對方，還是讓一方先退場？",
        "信任危機": "你的選擇是在修復信任，還是在利用不信任？"
    }[lens.label] || "這個選擇讓誰得到政治空間，又讓誰承擔代價？";

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
            <b>政治代價反思</b>
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

    return `
        ${renderSpeakerSpotlight(reaction)}
        <div class="impact-row">
            <span>${escapeHTML(effectToken(effects))}</span>
            <span>${escapeHTML(shortTerm)}</span>
            <span>${escapeHTML(hook)}</span>
        </div>
        ${renderSceneBeat(beat, reaction)}
        ${renderInteractionDialogue(reaction, effects)}
        ${buildOptionAnalysis(option, ev, effects, pOption, reaction)}
        ${renderArcChanges()}
        ${renderReflectionPanel(reflection)}
        ${pOption ? `<div class="pressure-note danger">說服留下記憶。</div>` : ""}
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
            ${gameState.choiceHistory.slice(-3).map((choice) => `
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
    return `
        <div class="political-reflection-list">
            <b>你的選擇反覆呈現的政治代價</b>
            ${gameState.reflectionLog.slice(-3).map((item) => `
                <article>
                    <span>${escapeHTML(compactText(item.eventTitle, 22))}</span>
                    <small>讓 ${escapeHTML(item.beneficiary)}；也讓 ${escapeHTML(item.payer)}。</small>
                </article>
            `).join("")}
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
        .slice(0, 5);

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

// 初始化事件監聽
els.startBtn.addEventListener('click', startGame);
els.introNextBtn.addEventListener('click', handleIntroNext);
els.triggerEventBtn.addEventListener('click', showEvent);
els.btnOptA.addEventListener('click', () => handleDecision(0));
els.btnOptB.addEventListener('click', () => handleDecision(1));
els.nextTurnBtn.addEventListener('click', nextTurn);
els.closeEventModalBtn?.addEventListener('click', () => {
    els.eventModal.classList.add('hidden');
    clearMapHighlights();
    els.triggerEventBtn.classList.remove('hidden');
});
els.closeNewsModalBtn?.addEventListener('click', nextTurn);
els.toggleNetworkBtn.addEventListener('click', () => els.networkModal.classList.remove('hidden'));
els.closeNetworkBtn.addEventListener('click', () => els.networkModal.classList.add('hidden'));
els.closeDetailBtn.addEventListener('click', () => els.detailModal.classList.add('hidden'));

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
        let imgSrc = imagePath(c.image_filename, 'char_generic.png');
        
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.dataset.characterName = c.name;
        pin.style.left = `${c.pos.x}%`;
        pin.style.top = `${c.pos.y}%`;
        pin.innerHTML = `
            <img src="${imgSrc}" alt="${c.name}">
            <div class="pin-label">${c.name}</div>
        `;
        setImageSource(pin.querySelector('img'), c.image_filename, 'char_generic.png');
        
        pin.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetailModal(c.name, c.description, imgSrc, c.relationships_text, c.stances_text, c.image_filename);
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
    if (relationships || stances || arc) {
        els.detailExtra.style.display = 'block';
        els.detailRelationships.innerText = relationships || arc?.goal || "無特別關聯。";
        els.detailStances.innerText = arc
            ? `${stances || "中立。"}\n\n角色主線：${arc.goal}\n目前狀態：${arcStatusText(arc)}\n最近變化：${arc.lastChange}`
            : (stances || "中立。");
    } else {
        els.detailExtra.style.display = 'none';
    }
    
    els.detailModal.classList.remove('hidden');
}

function renderNetwork() {
    els.networkGrid.innerHTML = '';
    gameState.characters.forEach(c => {
        let imgSrc = c.image_filename ? imagePath(c.image_filename, '') : '';
        let imgHtml = imgSrc ? `<img src="${imgSrc}" data-image-file="${c.image_filename}" alt="${c.name}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 10px;">` : '';
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
    const newsEvents = gameState.events.filter(e => e.is_news).sort(() => 0.5 - Math.random());
    
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
    gameState.events = mixedEvents;
    
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
    els.introModal.classList.remove('hidden');
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
    const ev = gameState.events[gameState.currentEventIndex];
    let option = ev.options[0]; // 預設拿第一個
    if (!ev.is_news && ev.options[optIndex]) {
        option = ev.options[optIndex];
    }
    
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
    
    let targetChar = gameState.characters.find(c => c.name === config.target);
    if (targetChar && targetChar.image_filename) {
        setImageSource(els.persuasionTargetImg, targetChar.image_filename, 'char_generic.png');
    }
    els.persuasionTargetName.innerText = config.target;
    els.persuasionReason.innerText = config.reason;
    
    els.btnPersuadeHigh.innerText = neutralizePersuasionLabel(config.persuasion_high.text);
    els.btnPersuadeLow.innerText = neutralizePersuasionLabel(config.persuasion_low.text);
    
    els.btnPersuadeHigh.onclick = () => handlePersuasion(true);
    els.btnPersuadeLow.onclick = () => handlePersuasion(false);
    
    els.persuasionModal.classList.remove('hidden');
}

function handlePersuasion(isHigh) {
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
            // 高說服力成功安撫，好感度小降或不降
            gameState.npcApprovals[pTarget] -= 5;
        } else {
            // 低說服力談判破裂，好感度大降
            gameState.npcApprovals[pTarget] -= 25;
        }
    }
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

async function endGame() {
    // 判斷結局
    let ending = "";
    const { freedom, order, progress, populism } = gameState.stats;
    
    if (populism >= 80 && order <= 30) {
        ending = "【結局：無政府暴動】極端的民粹摧毀了理智，社會陷入無止盡的街頭暴力與衝突，政府機能徹底癱瘓。";
    } else if (order >= 80 && freedom <= 30) {
        ending = "【結局：新威權時代】為了解決動亂，人民讓渡了自由。政府掌握了絕對的控制權，社會穩定但也寂靜無聲。";
    } else if (freedom >= 70 && progress >= 70 && order >= 50) {
        ending = "【結局：進步烏托邦】社會達成了難得的平衡，在高度自由與包容中持續發展，成為世界的典範。";
    } else if (populism >= 70 && order >= 70) {
        ending = "【結局：極端民粹政權】以多數暴力為名的獨裁。不同的聲音被排擠，社會被單一的狂熱情緒所支配。";
    } else {
        ending = "【結局：泥淖中的民主】跌跌撞撞，爭吵不休。社會雖然沒有崩潰，但也在內耗中停滯不前。這就是真實的政治。";
    }
    
    const remembered = gameState.memories.length
        ? `<div class="memory-panel"><h4>你留下的關係痕跡</h4>${gameState.memories.map((memory) => `
            <div class="memory-row ${memory.tone}">
                <span>${escapeHTML(memory.npc)}</span>
                <small>${escapeHTML(memory.text)}</small>
            </div>
        `).join("")}</div>`
        : "";
    els.endText.innerHTML = `<p>${escapeHTML(ending)}</p>${buildRelationshipClosureReport()}${buildPersonalityAnalysis()}${remembered}`;
    hydrateDynamicImages(els.endText);
    els.endScreen.classList.remove('hidden');
    
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
            title: "制度化",
            body: "口號開始變成流程。"
        });
        candidates.push({
            title: "政策企業家",
            body: "你幫議題找到入口。"
        });
    }
    if ((effects.freedom || 0) > 0) {
        candidates.push({
            title: "框架設定",
            body: "你改變大家怎麼描述問題。"
        });
    }
    if ((effects.order || 0) > 0) {
        candidates.push({
            title: "政治機會結構",
            body: "場面穩住，談判才有門。"
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
            title: "路徑依賴",
            body: "回到舊流程，就更難推。"
        });
    }

    candidates.push({
        title: "議程設定",
        body: `${effectLabel(mainKey)}${effectDirection(mainValue)}，追問方向改變。`
    });

    const picked = candidates[hashText(`${ev.title}${option.text}${gameState.currentEventIndex}`) % candidates.length];
    return conceptCard(picked.title, picked.body);
}

function showEvent() {
    els.triggerEventBtn.classList.add('hidden');
    if (gameState.currentEventIndex >= gameState.events.length) {
        return endGame();
    }

    const ev = gameState.events[gameState.currentEventIndex];
    const chapter = chapterInfo();
    const profile = roleProfile();
    const previous = gameState.memories[gameState.memories.length - 1];
    const stakeholders = involvedCharactersForEvent(ev);
    markStakeholderAppearances(stakeholders);
    clearMapHighlights();
    highlightMapCharacters([profile.ally, profile.skeptic, previous?.npc, ...stakeholders], "speaker-watch");
    els.eventTitle.innerHTML = `<span class="event-kicker">${escapeHTML(chapter.label)}</span>${escapeHTML(ev.title)}`;
    setImageSource(
        els.eventImage,
        ev.image_filename,
        "",
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

    els.eventModal.classList.remove('hidden');
    updateProgressBar();
}

function applyDecisionAndShowNews(option, ev, pOption, pTarget = null, isPHigh = false) {
    const effects = { freedom: 0, order: 0, progress: 0, populism: 0, ...(option.effects || {}) };
    const beforeApprovals = { ...gameState.npcApprovals };

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
    if (option.personal_effects && gameState.character.personal_stats) {
        if (!ev.target_role || ev.target_role === gameState.character.role || ev.target_role === gameState.character.name) {
            for (let key in option.personal_effects) {
                applyPersonalStatChange(key, option.personal_effects[key]);
            }
        }
    }

    if (pOption && pOption.cost && gameState.character.personal_stats) {
        for (let key in pOption.cost) {
            applyPersonalStatChange(key, pOption.cost[key]);
        }
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
    const reaction = buildNpcReaction(beforeApprovals, effects, pTarget, isPHigh);
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

        newsHTML += buildPlainDecisionRead(option, ev, effects, reaction);
        newsHTML += buildAgencyExplanation(option, ev, effects);
    }

    els.newsText.innerHTML = newsHTML;
    hydrateDynamicImages(els.newsText);
    clearMapHighlights();
    highlightMapCharacters([reaction.npc], "speaker-active");
    if (els.newsStatChanges) {
        els.newsStatChanges.innerHTML = statChangesHtml;
    }

    els.nextTurnBtn.innerText = beat.next || "確認";
    els.newsFlash.classList.remove('hidden');
}
