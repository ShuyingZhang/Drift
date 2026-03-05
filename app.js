/**
 * Finalwork: Drift - Creative Linkage Activation Tool
 * Logic for Card Management, Random Drawing, and Wander Mode
 */

// 1. Core State
let cards = JSON.parse(localStorage.getItem('drift_cards')) || [];
let currentMode = '1'; // '1', '2', 'n'
let isWandering = false;
let wanderTimer = null;

// 2. DOM Elements
const stage = document.getElementById('stage');
const emptyState = document.getElementById('empty-state');
const cardsContainer = document.getElementById('cards-container');
const cardCountDisplay = document.getElementById('card-count-display');
const btnDraw = document.getElementById('btn-draw');
const btnWander = document.getElementById('btn-wander');
const modalBackdrop = document.getElementById('modal-backdrop');
const importModal = document.getElementById('import-modal');
const pasteArea = document.getElementById('paste-area');
const nInput = document.getElementById('n-input');
const wanderInterval = document.getElementById('wander-interval');
const intervalDisplay = document.getElementById('interval-display');

// 3. Initialization
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    updateUIState();
    setupEventListeners();
});

// 4. Canvas Particle Background
function initCanvas() {
    const canvas = document.getElementById('canvas-bg');
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x > canvas.width) this.x = 0;
            if (this.x < 0) this.x = canvas.width;
            if (this.y > canvas.height) this.y = 0;
            if (this.y < 0) this.y = canvas.height;
        }
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    for (let i = 0; i < 60; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

// 5. Data Management
function updateUIState() {
    const hasCards = cards.length > 0;
    emptyState.style.display = hasCards ? 'none' : 'block';
    cardCountDisplay.textContent = `共 ${cards.length} 张卡片`;
    
    // Switch between empty state and stage controls
    document.getElementById('controls').style.opacity = hasCards ? '1' : '0.3';
    document.getElementById('controls').style.pointerEvents = hasCards ? 'all' : 'none';
}

function saveCards() {
    localStorage.setItem('drift_cards', JSON.stringify(cards));
    updateUIState();
    renderManageList();
}

function parseAndImport() {
    const text = pasteArea.value.trim();
    if (!text) return showToast('请输入内容');
    
    let newCards = [];
    if (text.includes('---')) {
        newCards = text.split('---').map(c => c.trim()).filter(c => c);
    } else {
        newCards = text.split('\n').map(c => c.trim()).filter(c => c && c.length > 2);
    }
    
    const cardsWithMeta = newCards.map(content => ({
        id: Date.now() + Math.random(),
        content: content,
        date: new Date().toLocaleDateString()
    }));
    
    cards = [...cards, ...cardsWithMeta];
    saveCards();
    pasteArea.value = '';
    closeModal();
    showToast(`导入成功：新增 ${newCards.length} 张卡片`);
}

// 6. UI Rendering Actions
function drawCards() {
    stopWander();
    
    let count = 1;
    if (currentMode === '1') count = 1;
    else if (currentMode === '2') count = 2;
    else count = parseInt(nInput.value) || 3;
    
    if (cards.length < count) {
        return showToast(`卡片不足，当前仅有 ${cards.length} 张`);
    }
    
    // Select random cards
    const shuffled = [...cards].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    
    // Clear & Render
    cardsContainer.innerHTML = '';
    selected.forEach((card, index) => {
        setTimeout(() => {
            const cardEl = createCardElement(card);
            cardsContainer.appendChild(cardEl);
        }, index * 150); // Staggered appearance
    });
}

function createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
        <div class="card-inner">${card.content}</div>
        <div class="card-meta">
            <span>MEMO</span>
            <span>${card.date}</span>
        </div>
    `;
    div.addEventListener('click', () => showDetail(card));
    return div;
}

function showDetail(card) {
    const backdrop = document.getElementById('card-detail-backdrop');
    const content = document.getElementById('card-detail-content');
    content.textContent = card.content;
    backdrop.style.display = 'flex';
}

function closeDetail() {
    document.getElementById('card-detail-backdrop').style.display = 'none';
}

// 7. Wander Mode (Auto Play)
function toggleWander() {
    if (isWandering) {
        stopWander();
    } else {
        startWander();
    }
}

function startWander() {
    if (cards.length === 0) return showToast('请先导入笔记');
    isWandering = true;
    btnWander.classList.add('active');
    btnWander.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        暂停漫游
    `;
    
    // Initial draw
    drawCards();
    
    const interval = parseInt(wanderInterval.value) * 1000;
    wanderTimer = setInterval(() => {
        // Apply exit animation to old cards
        const oldCards = cardsContainer.querySelectorAll('.card');
        oldCards.forEach(c => c.classList.add('exit'));
        
        // After fade out, draw new ones
        setTimeout(drawCards, 600);
    }, interval);
    
    showToast('漫游模式已开启');
}

function stopWander() {
    isWandering = false;
    btnWander.classList.remove('active');
    btnWander.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        漫游
    `;
    if (wanderTimer) clearInterval(wanderTimer);
}

// 8. Event Listeners
function setupEventListeners() {
    // Nav & Start
    document.getElementById('btn-import').onclick = openModal;
    document.getElementById('btn-start').onclick = openModal;
    document.getElementById('btn-wander').onclick = toggleWander;
    
    // Modal
    document.getElementById('modal-close').onclick = closeModal;
    document.getElementById('btn-parse').onclick = parseAndImport;
    
    // Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
            if (tab.dataset.tab === 'manage') renderManageList();
        };
    });
    
    // Drawing
    btnDraw.onclick = drawCards;
    
    // Modes
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.onclick = (e) => {
            // If click inside input, don't trigger button mode change for 'n' unless manually clicked
            if (e.target.tagName === 'INPUT') return;
            
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
        };
    });
    
    // N-Input focus auto-selects mode 'n'
    nInput.onfocus = () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        document.getElementById('mode-n').classList.add('active');
        currentMode = 'n';
    };
    
    // Interval Slider
    wanderInterval.oninput = (e) => {
        intervalDisplay.textContent = e.target.value + 's';
        if (isWandering) {
            stopWander();
            startWander();
        }
    };
    
    // Modal Close Backdrop
    modalBackdrop.onclick = (e) => {
        if (e.target === modalBackdrop) closeModal();
    };
    
    // Detail Close
    document.getElementById('card-detail-close').onclick = closeDetail;
    document.getElementById('card-detail-backdrop').onclick = (e) => {
        if (e.target === document.getElementById('card-detail-backdrop')) closeDetail();
    };
    
    // Clear All
    document.getElementById('btn-clear-all').onclick = () => {
        if (confirm('确定要清空所有卡片吗？')) {
            cards = [];
            saveCards();
            showToast('已清空全部卡片');
            renderManageList();
            cardsContainer.innerHTML = '';
        }
    };
    
    // File Upload
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-choose-file').onclick = () => fileInput.click();
    fileInput.onchange = handleFileUpload;
    
    const dropZone = document.getElementById('drop-zone');
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFileUpload({ target: { files: e.dataTransfer.files } });
    };
}

function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    let loadedCount = 0;
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            let fileCards = [];
            if (content.includes('---')) {
                fileCards = content.split('---').map(c => c.trim()).filter(c => c);
            } else {
                fileCards = content.split('\n').map(c => c.trim()).filter(c => c && c.length > 2);
            }
            
            const cardsWithMeta = fileCards.map(c => ({
                id: Date.now() + Math.random(),
                content: c,
                date: new Date().toLocaleDateString()
            }));
            
            cards = [...cards, ...cardsWithMeta];
            loadedCount++;
            if (loadedCount === files.length) {
                saveCards();
                closeModal();
                showToast(`导入成功：从 ${files.length} 个文件新增 ${cardsWithMeta.length} 张卡片`);
            }
        };
        reader.readAsText(file);
    });
}

function renderManageList() {
    const list = document.getElementById('cards-list');
    const countEl = document.getElementById('manage-count');
    countEl.textContent = `${cards.length} 张卡片`;
    
    list.innerHTML = cards.map(c => `
        <div class="manage-item">
            <span class="manage-text">${c.content.substring(0, 50)}${c.content.length > 50 ? '...' : ''}</span>
            <button class="btn-icon-danger" onclick="deleteCard(${c.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
        </div>
    `).join('');
}

window.deleteCard = (id) => {
    cards = cards.filter(c => c.id !== id);
    saveCards();
    renderManageList();
};

// Utils
function openModal() { modalBackdrop.style.display = 'flex'; }
function closeModal() { modalBackdrop.style.display = 'none'; }

function showToast(msg) {
    const wrap = document.getElementById('toast-wrap');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    wrap.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
