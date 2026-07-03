(function initDriftModule(root) {
  'use strict';

  const STORAGE_KEY = 'drift_cards';
  const MIN_LINE_LENGTH = 2;
  const MIN_CUSTOM_DRAW = 3;
  const MAX_CUSTOM_DRAW = 12;

  const ICONS = {
    import:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    play:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    pause:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    trash:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  };

  function parseNotes(text) {
    const source = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!source) return [];

    const hasSeparator = /(^|\n)\s*---+\s*(\n|$)/.test(source);
    const parts = hasSeparator
      ? source.split(/(?:^|\n)\s*---+\s*(?:\n|$)/)
      : source.split('\n');

    return parts.map((part) => part.trim()).filter((part) => part.length > MIN_LINE_LENGTH);
  }

  function getDrawCount(mode, requestedCount, availableCount) {
    const available = Math.max(0, Number(availableCount) || 0);
    if (available === 0) return 0;

    let count = 1;
    if (mode === '2') count = 2;
    if (mode === 'n') {
      const requested = Number.parseInt(requestedCount, 10);
      count = Number.isFinite(requested) && requested >= MIN_CUSTOM_DRAW ? requested : MIN_CUSTOM_DRAW;
      count = Math.min(MAX_CUSTOM_DRAW, count);
    }

    return Math.min(count, available);
  }

  function pickRandomCards(sourceCards, count, random = Math.random) {
    const cards = Array.isArray(sourceCards) ? [...sourceCards] : [];
    for (let index = cards.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
    }
    return cards.slice(0, Math.max(0, count));
  }

  const api = { getDrawCount, parseNotes, pickRandomCards };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (!root.document) {
    return;
  }

  const state = {
    cards: [],
    currentMode: '1',
    isWandering: false,
    wanderTimer: null,
    exitTimer: null,
  };

  const dom = {};

  root.document.addEventListener('DOMContentLoaded', startApp);

  function startApp() {
    cacheDom();
    state.cards = loadCards();
    initCanvas();
    bindEvents();
    updateParseInfo();
    renderAll();
  }

  function cacheDom() {
    Object.assign(dom, {
      canvas: root.document.getElementById('canvas-bg'),
      emptyState: root.document.getElementById('empty-state'),
      cardsContainer: root.document.getElementById('cards-container'),
      cardCountDisplay: root.document.getElementById('card-count-display'),
      controls: root.document.getElementById('controls'),
      btnDraw: root.document.getElementById('btn-draw'),
      btnImport: root.document.getElementById('btn-import'),
      btnStart: root.document.getElementById('btn-start'),
      btnWander: root.document.getElementById('btn-wander'),
      modalBackdrop: root.document.getElementById('modal-backdrop'),
      modalClose: root.document.getElementById('modal-close'),
      pasteArea: root.document.getElementById('paste-area'),
      btnParse: root.document.getElementById('btn-parse'),
      parseInfo: root.document.getElementById('parse-info'),
      fileInput: root.document.getElementById('file-input'),
      btnChooseFile: root.document.getElementById('btn-choose-file'),
      dropZone: root.document.getElementById('drop-zone'),
      manageCount: root.document.getElementById('manage-count'),
      cardsList: root.document.getElementById('cards-list'),
      btnClearAll: root.document.getElementById('btn-clear-all'),
      nInput: root.document.getElementById('n-input'),
      modeButtons: Array.from(root.document.querySelectorAll('.mode-btn')),
      tabButtons: Array.from(root.document.querySelectorAll('.tab-btn')),
      tabPanels: Array.from(root.document.querySelectorAll('.tab-panel')),
      wanderInterval: root.document.getElementById('wander-interval'),
      intervalDisplay: root.document.getElementById('interval-display'),
      detailBackdrop: root.document.getElementById('card-detail-backdrop'),
      detailContent: root.document.getElementById('card-detail-content'),
      detailClose: root.document.getElementById('card-detail-close'),
      toastWrap: root.document.getElementById('toast-wrap'),
    });
  }

  function bindEvents() {
    dom.btnImport.addEventListener('click', openModal);
    dom.btnStart.addEventListener('click', openModal);
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalBackdrop.addEventListener('click', closeOnBackdrop);
    dom.btnParse.addEventListener('click', importFromPaste);
    dom.pasteArea.addEventListener('input', updateParseInfo);
    dom.btnDraw.addEventListener('click', () => drawCards());
    dom.btnWander.addEventListener('click', toggleWander);
    dom.wanderInterval.addEventListener('input', updateWanderInterval);
    dom.nInput.addEventListener('focus', () => setMode('n'));
    dom.nInput.addEventListener('input', handleCustomCountInput);
    dom.btnChooseFile.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', importFromFiles);
    dom.btnClearAll.addEventListener('click', clearAllCards);
    dom.cardsList.addEventListener('click', handleManageListClick);
    dom.detailClose.addEventListener('click', closeDetail);
    dom.detailBackdrop.addEventListener('click', closeOnBackdrop);
    root.document.addEventListener('keydown', handleKeydown);

    dom.modeButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        if (event.target === dom.nInput) return;
        setMode(button.dataset.mode);
      });
    });

    dom.tabButtons.forEach((button) => {
      button.addEventListener('click', () => setActiveTab(button.dataset.tab));
    });

    dom.dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dom.dropZone.classList.add('is-dragover');
    });
    dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('is-dragover'));
    dom.dropZone.addEventListener('drop', handleDrop);
  }

  function loadCards() {
    try {
      const rawCards = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(rawCards)
        ? rawCards.filter((card) => card && typeof card.content === 'string' && card.content.trim())
        : [];
    } catch (error) {
      showToast('本地卡片数据损坏，已为你重置。', 'error');
      root.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  }

  function saveCards() {
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cards));
    renderAll();
  }

  function renderAll() {
    const hasCards = state.cards.length > 0;
    dom.emptyState.hidden = hasCards;
    dom.controls.classList.toggle('is-disabled', !hasCards);
    dom.btnDraw.disabled = !hasCards;
    dom.btnWander.disabled = !hasCards;
    dom.cardCountDisplay.textContent = `共 ${state.cards.length} 张卡片`;
    dom.manageCount.textContent = `${state.cards.length} 张卡片`;
    renderModeButtons();
    renderWanderButton();
    renderManageList();
  }

  function renderModeButtons() {
    dom.modeButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.mode === state.currentMode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === state.currentMode));
    });
  }

  function renderWanderButton() {
    dom.btnWander.classList.toggle('active', state.isWandering);
    dom.btnWander.setAttribute('aria-pressed', String(state.isWandering));
    dom.btnWander.innerHTML = `${state.isWandering ? ICONS.pause : ICONS.play}<span>${state.isWandering ? '暂停漫游' : '漫游'}</span>`;
  }

  function renderManageList() {
    dom.cardsList.replaceChildren();

    if (state.cards.length === 0) {
      const empty = root.document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = '还没有卡片。粘贴文本或上传 .txt / .md 文件后，它们会出现在这里。';
      dom.cardsList.appendChild(empty);
      return;
    }

    state.cards.forEach((card) => {
      const item = root.document.createElement('div');
      item.className = 'manage-item';

      const text = root.document.createElement('span');
      text.className = 'manage-text';
      text.textContent = card.content;

      const deleteButton = root.document.createElement('button');
      deleteButton.className = 'btn-icon-danger';
      deleteButton.type = 'button';
      deleteButton.dataset.cardId = card.id;
      deleteButton.setAttribute('aria-label', '删除这张卡片');
      deleteButton.innerHTML = ICONS.trash;

      item.append(text, deleteButton);
      dom.cardsList.appendChild(item);
    });
  }

  function createCard(content) {
    const randomId = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    return {
      id: randomId,
      content,
      date: new Date().toLocaleDateString('zh-CN'),
    };
  }

  function importFromPaste() {
    const notes = parseNotes(dom.pasteArea.value);
    if (notes.length === 0) {
      showToast('没有找到可导入的卡片。请用 --- 分隔，或每行写一条。', 'error');
      dom.pasteArea.focus();
      return;
    }

    state.cards = [...state.cards, ...notes.map(createCard)];
    dom.pasteArea.value = '';
    updateParseInfo();
    saveCards();
    closeModal();
    showToast(`已导入 ${notes.length} 张卡片。`);
  }

  async function importFromFiles(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const textFiles = files.filter(isSupportedFile);
    if (textFiles.length === 0) {
      showToast('请选择 .txt 或 .md 文件。', 'error');
      resetFileInput();
      return;
    }

    try {
      const imported = await Promise.all(textFiles.map(readFileAsText));
      const notes = imported.flatMap(parseNotes);
      if (notes.length === 0) {
        showToast('文件里没有找到可导入的卡片。', 'error');
        return;
      }

      state.cards = [...state.cards, ...notes.map(createCard)];
      saveCards();
      closeModal();
      showToast(`已从 ${textFiles.length} 个文件导入 ${notes.length} 张卡片。`);
    } catch (error) {
      showToast('读取文件失败，请确认文件是文本格式。', 'error');
    } finally {
      resetFileInput();
    }
  }

  function isSupportedFile(file) {
    return /\.(txt|md)$/i.test(file.name || '') || /^text\//.test(file.type || '');
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  function handleDrop(event) {
    event.preventDefault();
    dom.dropZone.classList.remove('is-dragover');
    importFromFiles({ target: { files: event.dataTransfer.files } });
  }

  function resetFileInput() {
    dom.fileInput.value = '';
  }

  function updateParseInfo() {
    const count = parseNotes(dom.pasteArea.value).length;
    dom.parseInfo.textContent = count > 0 ? `将导入 ${count} 张卡片` : '等待可解析的内容';
  }

  function drawCards(options = {}) {
    const fromWander = Boolean(options.fromWander);
    if (!fromWander) stopWander();

    const count = getDrawCount(state.currentMode, dom.nInput.value, state.cards.length);
    if (count === 0) {
      showToast('请先导入笔记。', 'error');
      return false;
    }

    const selectedCards = pickRandomCards(state.cards, count);
    renderDrawnCards(selectedCards);
    return true;
  }

  function renderDrawnCards(selectedCards) {
    dom.cardsContainer.replaceChildren();
    selectedCards.forEach((card, index) => {
      const cardElement = root.document.createElement('article');
      cardElement.className = 'card';
      cardElement.style.setProperty('--delay', `${index * 80}ms`);
      cardElement.tabIndex = 0;
      cardElement.setAttribute('role', 'button');
      cardElement.setAttribute('aria-label', '查看卡片详情');

      const content = root.document.createElement('div');
      content.className = 'card-inner';
      content.textContent = card.content;

      const meta = root.document.createElement('div');
      meta.className = 'card-meta';

      const label = root.document.createElement('span');
      label.textContent = 'MEMO';
      const date = root.document.createElement('span');
      date.textContent = card.date;

      meta.append(label, date);
      cardElement.append(content, meta);
      cardElement.addEventListener('click', () => openDetail(card));
      cardElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail(card);
        }
      });

      dom.cardsContainer.appendChild(cardElement);
    });
  }

  function toggleWander() {
    if (state.isWandering) {
      stopWander();
      return;
    }
    startWander();
  }

  function startWander() {
    const didDraw = drawCards({ fromWander: true });
    if (!didDraw) return;

    state.isWandering = true;
    renderWanderButton();
    scheduleWander();
    showToast('漫游模式已开启。');
  }

  function scheduleWander() {
    clearInterval(state.wanderTimer);
    state.wanderTimer = root.setInterval(() => {
      Array.from(dom.cardsContainer.children).forEach((card) => card.classList.add('exit'));
      clearTimeout(state.exitTimer);
      state.exitTimer = root.setTimeout(() => drawCards({ fromWander: true }), 360);
    }, Number.parseInt(dom.wanderInterval.value, 10) * 1000);
  }

  function stopWander() {
    if (!state.isWandering && !state.wanderTimer) return;
    state.isWandering = false;
    clearInterval(state.wanderTimer);
    clearTimeout(state.exitTimer);
    state.wanderTimer = null;
    state.exitTimer = null;
    renderWanderButton();
  }

  function updateWanderInterval() {
    dom.intervalDisplay.textContent = `${dom.wanderInterval.value}s`;
    if (state.isWandering) scheduleWander();
  }

  function setMode(mode) {
    state.currentMode = mode || '1';
    renderModeButtons();
  }

  function handleCustomCountInput() {
    setMode('n');
    const count = Number.parseInt(dom.nInput.value, 10);
    if (Number.isFinite(count) && count > MAX_CUSTOM_DRAW) dom.nInput.value = MAX_CUSTOM_DRAW;
  }

  function setActiveTab(tabName) {
    dom.tabButtons.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    dom.tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });

    if (tabName === 'manage') renderManageList();
  }

  function handleManageListClick(event) {
    const button = event.target.closest('[data-card-id]');
    if (!button) return;
    const cardId = button.dataset.cardId;
    state.cards = state.cards.filter((card) => card.id !== cardId);
    saveCards();
    if (state.cards.length === 0) {
      stopWander();
      dom.cardsContainer.replaceChildren();
    }
    showToast('已删除 1 张卡片。');
  }

  function clearAllCards() {
    if (state.cards.length === 0) {
      showToast('当前没有可清空的卡片。');
      return;
    }

    if (!root.confirm('确定要清空所有卡片吗？')) return;

    state.cards = [];
    stopWander();
    dom.cardsContainer.replaceChildren();
    saveCards();
    showToast('已清空全部卡片。');
  }

  function openModal() {
    dom.modalBackdrop.classList.add('is-open');
    dom.modalBackdrop.setAttribute('aria-hidden', 'false');
    setActiveTab('paste');
    root.setTimeout(() => dom.pasteArea.focus(), 0);
  }

  function closeModal() {
    dom.modalBackdrop.classList.remove('is-open');
    dom.modalBackdrop.setAttribute('aria-hidden', 'true');
  }

  function openDetail(card) {
    dom.detailContent.textContent = card.content;
    dom.detailBackdrop.classList.add('is-open');
    dom.detailBackdrop.setAttribute('aria-hidden', 'false');
    dom.detailClose.focus();
  }

  function closeDetail() {
    dom.detailBackdrop.classList.remove('is-open');
    dom.detailBackdrop.setAttribute('aria-hidden', 'true');
  }

  function closeOnBackdrop(event) {
    if (event.target === dom.modalBackdrop) closeModal();
    if (event.target === dom.detailBackdrop) closeDetail();
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') return;
    closeModal();
    closeDetail();
  }

  function showToast(message, type = 'info') {
    if (!dom.toastWrap) return;
    const toast = root.document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;

    dom.toastWrap.appendChild(toast);
    root.requestAnimationFrame(() => toast.classList.add('show'));
    root.setTimeout(() => {
      toast.classList.remove('show');
      root.setTimeout(() => toast.remove(), 240);
    }, 2800);
  }

  function initCanvas() {
    const canvas = dom.canvas;
    const context = canvas.getContext('2d');
    const reducedMotion = root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const particles = Array.from({ length: reducedMotion ? 18 : 42 }, createParticle);

    function resize() {
      canvas.width = root.innerWidth * root.devicePixelRatio;
      canvas.height = root.innerHeight * root.devicePixelRatio;
      context.setTransform(root.devicePixelRatio, 0, 0, root.devicePixelRatio, 0, 0);
    }

    function createParticle() {
      return {
        x: Math.random() * root.innerWidth,
        y: Math.random() * root.innerHeight,
        size: Math.random() * 1.7 + 0.5,
        speedX: Math.random() * 0.16 - 0.08,
        speedY: Math.random() * 0.16 - 0.08,
        opacity: Math.random() * 0.28 + 0.08,
      };
    }

    function draw() {
      context.clearRect(0, 0, root.innerWidth, root.innerHeight);
      particles.forEach((particle) => {
        particle.x = (particle.x + particle.speedX + root.innerWidth) % root.innerWidth;
        particle.y = (particle.y + particle.speedY + root.innerHeight) % root.innerHeight;
        context.fillStyle = `rgba(236, 239, 232, ${particle.opacity})`;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      });
      if (!reducedMotion) root.requestAnimationFrame(draw);
    }

    root.addEventListener('resize', resize);
    resize();
    draw();
  }
})(typeof window !== 'undefined' ? window : globalThis);
