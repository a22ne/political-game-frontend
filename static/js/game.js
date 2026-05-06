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
        adapted.persuasion_high.text = "透過師長與家長代表溝通，把訴求轉成正式程序（高說服力）";
        adapted.persuasion_low.text = "直接開直播點名批評長老守舊（低說服力）";
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
    lastOutcome: null
};

function escapeHTML(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function roleProfile() {
    const character = gameState.character || {};
    const text = `${character.name || ""}${character.role || ""}${character.description || ""}`;

    if (text.includes("學生")) {
        return {
            desire: "讓受傷的人得到制度回應，同時避免運動被貼上失控標籤。",
            fear: "支持者覺得你太軟，長輩與校方又覺得你在煽動。",
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

function choiceCostLine(choice = {}) {
    const effects = choice.effects || {};
    const [key, value] = strongestEffect(effects);
    if (!value) return "影響不明，主要取決於後續誰願意接住這個選擇。";
    const lines = {
        freedom: value > 0 ? "會放大公共發聲，但可能激怒秩序派。" : "能壓低爭議聲量，但會讓部分人選擇沉默。",
        order: value > 0 ? "能穩住場面，但可能被支持者看成退讓。" : "能製造壓力，但會提高失控與反彈風險。",
        progress: value > 0 ? "有機會推進制度，但需要找人承擔後續工作。" : "短期比較好收場，但改革會被拖回舊流程。",
        populism: value > 0 ? "能快速聚集注意力，但會讓對立升溫。" : "能讓情緒降溫，但可能被質疑不夠有力。"
    };
    return lines[key] || "這個選擇會改變局勢的解讀方式。";
}

function recentMemoryLine() {
    const memory = gameState.memories[gameState.memories.length - 1];
    if (!memory) return "";
    return `<div class="memory-strip"><strong>上一個痕跡</strong><span>${escapeHTML(memory.text)}</span></div>`;
}

function buildEventBrief(ev) {
    const chapter = chapterInfo();
    return `
        <div class="chapter-strip">
            <span>${escapeHTML(chapter.label)}</span>
            <strong>第 ${gameState.currentEventIndex + 1} / ${gameState.events.length} 回合</strong>
        </div>
        <p>${escapeHTML(polishNarrativeText(ev.description))}</p>
        <div class="pressure-note">${escapeHTML(chapter.pressure)}</div>
        <div class="pressure-note muted">${escapeHTML(chapter.prompt)}</div>
        ${recentMemoryLine()}
    `;
}

function formatChoiceButton(button, choice) {
    if (!button || !choice) return;
    button.innerHTML = `
        <span class="choice-main">${escapeHTML(polishNarrativeText(choice.text))}</span>
        <small>${escapeHTML(choiceCostLine(choice))}</small>
    `;
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

function buildOutcomeReport(option, ev, effects, pOption, reaction) {
    const [mainKey, mainValue] = strongestEffect(effects);
    const shortTerm = mainValue === 0
        ? "場面沒有立刻翻轉，但各方開始重新估算你能動員多少資源。"
        : {
            freedom: mainValue > 0 ? "更多人願意公開談論這件事，原本旁觀的人開始轉發與留言。" : "公開討論變少了，支持者改到私下群組交換消息。",
            order: mainValue > 0 ? "衝突暫時降溫，市府和警方有空間安排下一輪協調。" : "現場壓力升高，反對者開始要求更強硬的處置。",
            progress: mainValue > 0 ? "議題被翻成具體流程，開始有人追問時程、責任與預算。" : "議題退回舊流程，大家都知道問題還在，只是沒人立刻承諾。",
            populism: mainValue > 0 ? "聲量迅速上升，口號比細節傳得更快。" : "情緒降溫，討論回到比較慢、也比較難煽動的節奏。"
        }[mainKey];

    const hook = (effects.progress || 0) > 0
        ? "如果下回合找不到能簽字或承擔的人，這次推進會停在漂亮說法。"
        : (effects.populism || 0) > 0
            ? "聲量會帶來人潮，也會帶來截圖、斷章取義與更強的反擊。"
            : (effects.freedom || 0) < 0
                ? "沉默不會消除不滿，只會讓下一次爆發更難預測。"
                : "這件事還沒結束，下一個願意冒險的人會決定它往哪裡走。";

    return `
        <div class="outcome-grid">
            <article>
                <b>短期結果</b>
                <span>${escapeHTML(shortTerm)}</span>
            </article>
            <article>
                <b>人物反應</b>
                <span>${escapeHTML(reaction.text)}</span>
            </article>
            <article>
                <b>後續伏筆</b>
                <span>${escapeHTML(hook)}</span>
            </article>
        </div>
        ${pOption ? `<div class="pressure-note danger">這次說服留下了人情或衝突成本，之後同一個 NPC 會記得你的處理方式。</div>` : ""}
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
    
    newsFlash: document.getElementById('news-flash'),
    newsText: document.getElementById('news-text'),
    nextTurnBtn: document.getElementById('next-turn-btn'),
    
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
    
    if (relationships || stances) {
        els.detailExtra.style.display = 'block';
        els.detailRelationships.innerText = relationships || "無特別關聯。";
        els.detailStances.innerText = stances || "中立。";
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
        els.networkGrid.innerHTML += `
            <div class="char-card" style="text-align: center;">
                ${imgHtml}
                <h4>${c.name}</h4>
                <span class="role">${c.role}</span>
                <p style="text-align: left;">${c.description}</p>
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
    gameState.memories = [];
    gameState.lastOutcome = null;
    
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
    
    // 隨機安插新聞事件與過濾專屬事件
    const normalEvents = gameState.events.filter(e => {
        if (e.is_news) return false;
        if (e.target_role && e.target_role !== gameState.character.name && e.target_role !== gameState.character.role) {
            return false; // 過濾掉不屬於自己角色的專屬事件
        }
        return true;
    });
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
            <p>你不是掌控全局的人。你只是站在局勢中間，被支持者、反對者、朋友與利益交換推著往前走。</p>
        `;
        introStep++;
    } else if (introStep === 1) {
        els.introTitle.innerText = "你的身份：" + gameState.character.name;
        els.introDesc.innerHTML = `
            <div class="role-brief">
                <strong>【${escapeHTML(gameState.character.role)}】</strong>
                <p>${escapeHTML(gameState.character.description)}</p>
                <div><b>你想要：</b>${escapeHTML(profile.desire)}</div>
                <div><b>你害怕：</b>${escapeHTML(profile.fear)}</div>
            </div>
        `;
        introStep++;
    } else if (introStep === 2) {
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
    
    els.btnPersuadeHigh.innerText = config.persuasion_high.text;
    els.btnPersuadeLow.innerText = config.persuasion_low.text;
    
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
    }
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
    els.endText.innerHTML = `<p>${escapeHTML(ending)}</p>${remembered}`;
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
        <div class="agency-explanation">
            <h4>${title}</h4>
            <span>${body}</span>
        </div>`;
}

function buildAgencyExplanation(option, ev, effects) {
    const movement = [];
    if ((effects.freedom || 0) > 0) movement.push("擴大可發聲的人");
    if ((effects.order || 0) > 0) movement.push("降低混亂感並讓制度重新介入");
    if ((effects.progress || 0) > 0) movement.push("把議題推向制度或政策改革");
    if ((effects.populism || 0) > 0) movement.push("快速聚集情緒與注意力");
    if ((effects.freedom || 0) < 0) movement.push("收窄公共討論空間");
    if ((effects.order || 0) < 0) movement.push("增加街頭與制度之間的摩擦");
    if ((effects.progress || 0) < 0) movement.push("讓改革速度放慢");
    if ((effects.populism || 0) < 0) movement.push("讓情緒動員降溫");

    const direction = movement.length ? movement.join("、") : "改變大家衡量問題的標準";
    const context = polishNarrativeText(`${ev.title} ${option.text} ${option.result_text} ${option.explanation}`);

    if (/暫時擱置|未給出實質承諾|沒有進入具體承諾/.test(context)) {
        return conceptCard(
            "政策窗口為什麼會關上",
            `和平落幕不等於政策成功。若沒有承諾、時程、預算或負責單位，議題會從街頭退回等待狀態；這次選擇比較像把衝突暫時收束，留下日後再動員的理由，而不是立刻推動法案前進。`
        );
    }

    const candidates = [];
    if ((effects.progress || 0) > 0) {
        candidates.push({
            title: "制度化：把訴求變成程序",
            body: `公共議題能不能留下來，關鍵常常不是聲量，而是能否被翻成條文、會議、預算、時程或責任分工。這次選擇的重點是${direction}，讓訴求比較有機會進入可追蹤的制度流程。`
        });
        candidates.push({
            title: "政策企業家",
            body: `有些行動者的作用是把問題、方案和政治時機接在一起。你這次不是單純表態，而是在幫議題找到可被採納的說法與入口；因此影響集中在${direction}。`
        });
    }
    if ((effects.freedom || 0) > 0) {
        candidates.push({
            title: "框架設定",
            body: `誰能命名問題，誰就能影響大家怎麼判斷責任與成本。這次行動把焦點從單純對抗移到「這件事應該如何被理解」，所以效果落在${direction}。`
        });
    }
    if ((effects.order || 0) > 0) {
        candidates.push({
            title: "政治機會結構",
            body: `當制度願意開門、社會願意暫停對抗，行動才比較容易被接住。這次選擇的作用不是讓所有人服氣，而是創造一個較不混亂的入口，讓${direction}變得可能。`
        });
    }
    if ((effects.populism || 0) > 0 || (effects.order || 0) < 0) {
        candidates.push({
            title: "反彈效應",
            body: `改革碰到身份認同、既有利益或長期不信任時，反對者會把議題改寫成威脅。這次選擇雖然製造聲量，也提高了對立成本，特別表現在${direction}。`
        });
    }
    if ((effects.populism || 0) < 0) {
        candidates.push({
            title: "情緒降溫不等於問題消失",
            body: `讓場面冷靜下來能減少誤判，但真正的矛盾仍需要後續處理。這次選擇的價值在於先降低衝突熱度，讓${direction}，避免議題被口號完全接管。`
        });
    }
    if ((effects.freedom || 0) < 0) {
        candidates.push({
            title: "沉默螺旋",
            body: `當表態成本變高，不代表大家改變想法，而是更多人選擇不說。這次選擇可能讓場面看起來安靜，實際上卻把分歧壓到檯面下，造成${direction}。`
        });
    }
    if ((effects.progress || 0) < 0) {
        candidates.push({
            title: "路徑依賴",
            body: `一旦議題被放回舊流程，後續就容易照既有慣性前進。這次選擇讓改革速度放慢，並不表示事情結束，而是讓下一次推進需要更高的組織成本。`
        });
    }

    candidates.push({
        title: "議程設定",
        body: `公共注意力有限，議題要被處理，必須先被看見、被排序、被賦予急迫性。這次選擇影響的是${direction}，也會改變媒體、民代和旁觀者接下來願意追問什麼。`
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
    gameState.lastOutcome = reaction;
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
            <p>${escapeHTML(polishNarrativeText(ev.options[0].result_text))}</p>
        `;
        if (ev.relationship_effects_text) {
            newsHTML += `<div class="pressure-note">影響：${escapeHTML(polishNarrativeText(ev.relationship_effects_text))}</div>`;
        }
    } else {
        newsHTML = `
            <div class="result-headline">
                <span>${escapeHTML(chapterInfo().label)}後果</span>
                <strong>${escapeHTML(gameState.playerName)} 選擇了：${escapeHTML(polishNarrativeText(option.text))}</strong>
            </div>
            <p>${escapeHTML(polishNarrativeText(option.result_text))}</p>
            ${buildOutcomeReport(option, ev, effects, pOption, reaction)}
        `;
        if (pOption) {
            newsHTML += `<div class="pressure-note danger"><strong>說服結果</strong> ${escapeHTML(polishNarrativeText(pOption.result_text))}</div>`;
        }

        if (option.explanation) {
            newsHTML += `<hr style="border: 0; border-top: 1px dashed #ccc; margin: 15px 0;">
            <div style="background: rgba(56, 111, 143, 0.08); padding: 12px; border-radius: 8px; border-left: 4px solid var(--primary); margin-top: 10px;">
                <h4 style="margin: 0 0 5px 0; color: var(--primary);">決策解析</h4>
                <span style="font-size: 0.95rem; color: #333; line-height: 1.5;">${escapeHTML(polishNarrativeText(option.explanation))}</span>
            </div>`;
        }
        newsHTML += buildAgencyExplanation(option, ev, effects);
    }

    els.newsText.innerHTML = newsHTML;
    if (els.newsStatChanges) {
        els.newsStatChanges.innerHTML = statChangesHtml;
    }

    els.newsFlash.classList.remove('hidden');
}
