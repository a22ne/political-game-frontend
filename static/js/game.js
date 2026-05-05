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
        "蘇網紅": 50
    },
    pendingDecision: null
};

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
    
    // 隨機分配可玩角色
    const playableChars = gameState.characters.filter(c => c.is_playable);
    gameState.character = playableChars[Math.floor(Math.random() * playableChars.length)];
    
    // 根據角色身分初始化 NPC 支持度
    gameState.npcApprovals = { "柯爾市長": 50, "莫長老": 50, "艾達議員": 50, "威廉總裁": 50, "莉亞記者": 50, "龐頭目": 50, "雷將軍": 50, "蘇網紅": 50 };
    
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
    if (introStep === 0) {
        els.introTitle.innerText = "蓬萊共和國的現況";
        els.introDesc.innerHTML = "這個名為「蓬萊共和國」的島國，曾經經歷過漫長的威權統治，如今已步入民主化的進程。<br><br>經濟快速發展的同時，社會卻也面臨著貧富差距、環境污染、以及不同世代間的價值觀衝突。各種利益團體與政治派系在這裡角力，每一個政策都牽動著國家的未來走向。<br><br>現在，歷史的舞台將為你開啟。";
        introStep++;
    } else if (introStep === 1) {
        els.introTitle.innerText = "你的身份：" + gameState.character.name;
        els.introDesc.innerHTML = `系統已為你分配了在這個世界中的角色：<br><br><strong>【${gameState.character.role}】</strong><br>${gameState.character.description}<br><br>這座城市中還有許多其他關鍵人物（可於左側關係網中查看）。你的選擇將與他們產生交互影響，共同決定這個國家的命運。`;
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
        gameState.pendingDecision = { option, optIndex, ev };
        showPersuasionModal(ev.persuasion_config);
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
    const config = gameState.pendingDecision.ev.persuasion_config;
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
    
    els.endText.innerText = ending;
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
    return `
        <div class="agency-explanation">
            <h4>為什麼個人能撼動整個議題走向</h4>
            <span>
                你的選擇不是單一事件的結尾，而是替社會提供一個新的理解框架。當一個人公開表態、整理證據、承擔風險或連結不同群體時，媒體會有新的敘事，旁觀者會重新判斷成本，決策者也會感受到支持或反彈的方向。這次行動特別影響的是：${direction}。因此，個人的行動會透過輿論、組織、人際網絡與制度程序一路擴散，最後改變 ${ev.title} 這個議題的公共走向。
            </span>
        </div>`;
}

function showEvent() {
    els.triggerEventBtn.classList.add('hidden');
    if (gameState.currentEventIndex >= gameState.events.length) {
        return endGame();
    }

    const ev = gameState.events[gameState.currentEventIndex];
    els.eventTitle.innerText = ev.title;
    setImageSource(
        els.eventImage,
        ev.image_filename,
        "",
        eventIllustrationDataUri(ev.image_filename || ev.title)
    );
    els.eventImage.style.display = 'block';
    els.eventImage.alt = `${ev.title} 的事件插圖`;
    els.eventDesc.innerText = ev.description;

    if (ev.is_news) {
        els.btnOptA.innerText = "了解";
        els.btnOptB.style.display = 'none';
        els.eventTitle.innerText = `新聞快訊：${ev.title}`;
        els.eventTitle.style.color = "var(--text-main)";
    } else {
        els.btnOptA.innerText = ev.options[0].text;
        els.btnOptB.style.display = 'inline-block';
        els.btnOptB.innerText = ev.options[1].text;
        els.eventTitle.style.color = "var(--text-main)";
    }

    els.eventModal.classList.remove('hidden');
    updateProgressBar();
}

function applyDecisionAndShowNews(option, ev, pOption, pTarget = null, isPHigh = false) {
    const effects = option.effects || {freedom:0, order:0, progress:0, populism:0};

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
    updateStatsUI();
    renderNPCApprovals();
    els.eventModal.classList.add('hidden');

    let newsHTML = "";
    if (ev.is_news) {
        newsHTML = `<strong>${ev.title}</strong><br><br>${ev.options[0].result_text}`;
        if (ev.relationship_effects_text) {
            newsHTML += `<br><br><em style="color: #555;">影響：${ev.relationship_effects_text}</em>`;
        }
    } else {
        newsHTML = `<strong>${gameState.playerName} 選擇了：${option.text}</strong><br><br>${option.result_text}`;
        if (pOption) {
            newsHTML += `<br><br><strong style="color: var(--danger);">說服結果</strong> ${pOption.result_text}`;
        }

        if (option.explanation) {
            newsHTML += `<hr style="border: 0; border-top: 1px dashed #ccc; margin: 15px 0;">
            <div style="background: rgba(56, 111, 143, 0.08); padding: 12px; border-radius: 8px; border-left: 4px solid var(--primary); margin-top: 10px;">
                <h4 style="margin: 0 0 5px 0; color: var(--primary);">決策解析</h4>
                <span style="font-size: 0.95rem; color: #333; line-height: 1.5;">${option.explanation}</span>
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
