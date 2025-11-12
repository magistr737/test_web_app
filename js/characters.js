// js/main.js - Оптимизированная версия

const API_BASE_URL = 'https://testapi.capyhub.su';
let currentPage = 1;
let currentFilter = 'all';
let currentCategory = null;
const PAGE_SIZE = 20;
let selectedCategories = [];

let categoriesLoaded = false;
let categoriesLoading = false;

// ==============================================
// API Утилиты
// ==============================================

/**
 * Базовый метод для отправки запросов к API
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
}

/**
 * Получение списка категорий
 */
async function fetchCategories() {
    return apiRequest('/v1/characters/categories', { method: 'GET' });
}

/**
 * Получение списка персонажей
 */
async function fetchCharacters(filter, page, categories) {
    const params = new URLSearchParams({
        filter_type: filter,
        page: page.toString(),
        page_size: PAGE_SIZE.toString()
    });
    
    if (categories && categories.length > 0) {
        categories.forEach(cat => params.append('category', cat));
    }
    
    return apiRequest(`/v1/characters/list?${params}`, { method: 'GET' });
}

// ==============================================
// DOM Утилиты (безопасная работа)
// ==============================================

/**
 * Создание элемента с текстовым содержимым (защита от XSS)
 */
function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }
    if (options.styles) {
        Object.assign(element.style, options.styles);
    }
    
    return element;
}

/**
 * Массовое удаление элементов
 */
function removeElements(selector, parent = document) {
    parent.querySelectorAll(selector).forEach(el => el.remove());
}

/**
 * Очистка контейнера
 */
function clearContainer(selector) {
    const container = document.querySelector(selector);
    if (container) container.innerHTML = '';
    return container;
}

// ==============================================
// Обработка ошибок
// ==============================================

/**
 * Показ ошибки загрузки категорий
 */
function showCategoriesError(container) {
    removeElements('[data-category]', container);
    
    const error = createElement('p', {
        className: 'text-center small text-danger mt-3',
        text: '😔 Билин, не получится категориями воспользоваться. Перезагрузите страницу, и по идееееееее должно заработать :)'
    });
    
    const header = container.querySelector('h6');
    if (header) header.after(error);
}

/**
 * Показ ошибки загрузки персонажей
 */
function showCharactersError(container) {
    if (!container) return;
    
    const col = createElement('div', { className: 'col-12 text-center py-5' });
    
    const errorText = createElement('p', {
        text: 'Произошла ошибка при загрузке персонажей',
        styles: { color: '#ff4444' }
    });
    
    const retryBtn = createElement('button', {
        className: 'btn btn-primary mt-3',
        text: 'Попробовать снова',
        styles: { backgroundColor: '#0088cc', borderColor: '#0088cc' }
    });
    
    retryBtn.addEventListener('click', () => 
        loadCharacters(currentFilter, currentPage, currentCategory)
    );
    
    col.append(errorText, retryBtn);
    container.appendChild(col);
}

// ==============================================
// Загрузка категорий
// ==============================================

async function loadCategories() {
    if (categoriesLoaded || categoriesLoading) return;
    
    categoriesLoading = true;
    
    const container = document.querySelector('#offcanvasFilters .offcanvas-body .d-grid');
    const header = container?.querySelector('h6');
    
    if (!header) {
        categoriesLoading = false;
        return;
    }
    
    try {
        const data = await fetchCategories();
        const categories = Array.isArray(data.categories) ? data.categories : [];

        removeElements('[data-category]', container);

        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            const btn = createElement('button', {
                className: 'filter-btn',
                text: category,
                attributes: { 
                    type: 'button',
                    'data-category': category 
                }
            });
            
            // Проверяем, выбрана ли категория
            if (selectedCategories.includes(category)) {
                btn.classList.add('active');
            }
            
            btn.addEventListener('click', handleCategoryClick);
            fragment.appendChild(btn);
        });
        
        header.after(fragment);
        categoriesLoaded = true;

    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        showCategoriesError(container);
    } finally {
        categoriesLoading = false;
    }
}

function handleCategoryClick(event) {
    const button = event.currentTarget;
    const category = button.getAttribute('data-category');
    
    toggleCategory(category);
}

// ==============================================
// Загрузка персонажей
// ==============================================

async function loadCharacters(filter = 'all', page = 1, categories = []) {
    const container = document.querySelector('.cards-container .row');
    
    // Показываем индикатор загрузки
    showLoadingSpinner(container?.parentElement);
    
    try {
        const data = await fetchCharacters(filter, page, categories);
        
        renderCharacters(data.characters || []);
        renderPagination(data.current_page || 1, data.total_pages || 1);
        
        currentPage = data.current_page || 1;
        currentFilter = filter;
        
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        clearContainer('.cards-container .row');
        showCharactersError(container);
    } finally {
        // Скрываем индикатор загрузки
        hideLoadingSpinner(container?.parentElement);
    }
}

function renderCharacters(characters) {
    const container = clearContainer('.cards-container .row');
    if (!container) return;

    if (!Array.isArray(characters) || characters.length === 0) {
        showEmptyState(container);
        return;
    }

    const fragment = document.createDocumentFragment();
    characters.forEach(char => fragment.appendChild(createCharacterCard(char)));
    container.appendChild(fragment);
}

function createCharacterCard(char) {
    const col = createElement('div', { className: 'col-12 col-sm-6 col-lg-4' });
    const card = createElement('div', { 
        className: 'character-card',
        attributes: { 'data-character-id': char.id }
    });
    
    const img = createElement('img', {
        attributes: { 
            src: 'https://img.freepik.com/premium-photo/grey-textured-background_1310085-63603.jpg?semt=ais_hybrid&w=740&q=80',
            alt: char.name,
            loading: 'lazy'
        }
    });
    
    const cardBody = createElement('div', { className: 'card-body' });
    const title = createElement('h5', { className: 'card-title', text: char.name });
    
    const description = createElement('p', {
        className: 'card-text small mb-2',
        text: truncateText(char.description, 100),
        styles: { color: '#b0b0b0', lineHeight: '1.4' }
    });
    
    const badgesContainer = createElement('div');
    
    if (char.category) {
        badgesContainer.appendChild(createBadge(char.category, '#17a2b8'));
    }
    
    if (char.is_selected) {
        badgesContainer.appendChild(createBadge('💬 Начато', '', 'badge-started'));
    }
    if (char.is_created) {
        badgesContainer.appendChild(createBadge('✨ Создан', '', 'badge-created'));
    }
    
    cardBody.append(title, description, badgesContainer);
    card.append(img, cardBody);
    col.appendChild(card);
    
    return col;
}

function createBadge(text, bgColor, extraClass = '') {
    const badge = createElement('span', {
        className: `character-badge ${extraClass}`,
        text: text,
        styles: bgColor ? { backgroundColor: bgColor } : {}
    });
    return badge;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function showEmptyState(container) {
    const messages = [
        { emoji: '🦗', title: 'Тут сверчки поют...', text: 'В этой категории нет персонажей! Серьёзно? 😱 Надо срочно что-то с этим делать!' },
        { emoji: '🌵', title: 'Пустыня Сахара', text: 'Здесь суше, чем в пустыне! 🏜️ Где все персонажи? Это какой-то заговор!' },
        { emoji: '👻', title: 'Привидения унесли всех', text: 'Тут пусто, как в заброшенном доме 🏚️ Даже привидения разбежались от скуки!' },
        { emoji: '🕳️', title: 'Чёрная дыра персонажей', text: 'Куда все пропали?! 🤷‍♂️ Может их Танос щёлкнул? Надо создавать новых!' },
        { emoji: '🎭', title: 'Занавес опущен', text: 'Актёры ушли на перерыв... навсегда 😅 Пора вызывать новых на сцену!' }
    ];

    const msg = messages[Math.floor(Math.random() * messages.length)];
    const col = createElement('div', { className: 'col-12 text-center py-5' });
    
    const emoji = createElement('div', { 
        text: msg.emoji,
        styles: { fontSize: '72px', marginBottom: '20px' }
    });
    const title = createElement('h4', { 
        text: msg.title,
        styles: { color: '#ffffff', marginBottom: '15px' }
    });
    const text = createElement('p', { 
        text: msg.text,
        styles: { color: '#b0b0b0', fontSize: '16px', maxWidth: '400px', margin: '0 auto' }
    });
    
    col.append(emoji, title, text);
    container.appendChild(col);
}

// ==============================================
// Пагинация
// ==============================================

function renderPagination(current, total) {
    const container = document.querySelector('.cards-container .container');
    if (!container) return;
    
    removeElements('.pagination-wrapper', container);
    if (total <= 1) return;

    const wrapper = createElement('div', { className: 'pagination-wrapper mt-4 mb-4' });
    const nav = createElement('nav', { attributes: { 'aria-label': 'Навигация по страницам' }});
    const ul = createElement('ul', { className: 'pagination justify-content-center' });
    
    ul.appendChild(createPageButton('‹', current - 1, current === 1));
    
    getPageRange(current, total).forEach(page => {
        ul.appendChild(page === '...' 
            ? createPageEllipsis() 
            : createPageButton(page.toString(), page, false, page === current)
        );
    });
    
    ul.appendChild(createPageButton('›', current + 1, current === total));
    
    nav.appendChild(ul);
    wrapper.appendChild(nav);
    container.appendChild(wrapper);
}

function createPageButton(text, page, disabled = false, active = false) {
    const li = createElement('li', { 
        className: `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`
    });
    
    const link = createElement('a', {
        className: 'page-link',
        text: text,
        attributes: { href: '#', 'data-page': page },
        styles: {
            backgroundColor: active ? '#0088cc' : '#1a1a1a',
            borderColor: active ? '#0088cc' : '#2a2a2a',
            color: '#ffffff'
        }
    });
    
    if (!disabled) {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const p = parseInt(e.currentTarget.getAttribute('data-page'), 10);
            if (p && p > 0) {
                loadCharacters(currentFilter, p, currentCategory);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    li.appendChild(link);
    return li;
}

function createPageEllipsis() {
    const li = createElement('li', { className: 'page-item disabled' });
    const span = createElement('span', {
        className: 'page-link',
        text: '...',
        styles: { backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', color: '#6a6a6a' }
    });
    li.appendChild(span);
    return li;
}

function getPageRange(current, total) {
    const range = [];
    const delta = 2;

    for (let i = 1; i <= total; i++) {
        if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        } else if (range[range.length - 1] !== '...') {
            range.push('...');
        }
    }

    return range;
}

// ==============================================
// Обработчики фильтров
// ==============================================

function initFilterHandlers() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.currentTarget.getAttribute('data-filter');
            
            // Убираем класс active у всех кнопок с data-filter
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => 
                b.classList.remove('active')
            );
            e.currentTarget.classList.add('active');
            
            currentCategory = null;
            loadCharacters(filter, 1, null);
            closeOffcanvas();
        });
    });
}

function closeOffcanvas() {
    const offcanvas = document.getElementById('offcanvasFilters');
    if (offcanvas) {
        const instance = bootstrap.Offcanvas.getInstance(offcanvas);
        if (instance) instance.hide();
    }
}

function updateCategoryButtons() {
    document.querySelectorAll('[data-category]').forEach(btn => {
        const category = btn.getAttribute('data-category');
        if (selectedCategories.includes(category)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ==============================================
// Управление выбранными категориями
// ==============================================

/**
 * Отображение выбранных категорий
 */
function renderSelectedCategories() {
    const container = document.querySelector('#selected-categories');
    const wrapper = container?.querySelector('.d-flex');
    
    if (!container || !wrapper) return;
    
    if (selectedCategories.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    wrapper.innerHTML = '';
    
    selectedCategories.forEach(category => {
        const badge = createElement('span', {
            className: 'selected-category-badge',
            text: category
        });
        
        const removeIcon = createElement('span', {
            className: 'remove-icon',
            text: '×'
        });
        
        removeIcon.addEventListener('click', () => {
            toggleCategory(category);
        });
        
        badge.appendChild(removeIcon);
        wrapper.appendChild(badge);
    });
}

/**
 * Переключение категории (добавить/удалить)
 */
function toggleCategory(category) {
    const index = selectedCategories.indexOf(category);
    
    if (index > -1) {
        // Удаляем категорию
        selectedCategories.splice(index, 1);
    } else {
        // Добавляем категорию (максимум 5)
        if (selectedCategories.length < 5) {
            selectedCategories.push(category);
        } else {
            // Можно показать уведомление что максимум 5 категорий
            return;
        }
    }
    
    // Обновляем визуал кнопок категорий
    updateCategoryButtons();
    
    // Обновляем отображение выбранных категорий
    renderSelectedCategories();
    
    // Загружаем персонажей с новыми категориями
    loadCharacters(currentFilter, 1, selectedCategories);
}

// ==============================================
// Показ/скрытие индикатора загрузки
// ==============================================

/**
 * Показать индикатор загрузки
 */
function showLoadingSpinner(container) {
    if (!container) return;
    
    // Проверяем, есть ли уже overlay
    let overlay = container.querySelector('.loading-overlay');
    if (overlay) return;
    
    overlay = createElement('div', { className: 'loading-overlay' });
    const spinner = createElement('div', { className: 'spinner-border-custom' });
    
    overlay.appendChild(spinner);
    container.style.position = 'relative';
    container.appendChild(overlay);
}

/**
 * Скрыть индикатор загрузки
 */
function hideLoadingSpinner(container) {
    if (!container) return;
    
    const overlay = container.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
}

// ==============================================
// Инициализация
// ==============================================

function init() {
    const filtersOffcanvas = document.getElementById('offcanvasFilters');
    if (filtersOffcanvas) {
        filtersOffcanvas.addEventListener('show.bs.offcanvas', loadCategories);
    }
    
    initFilterHandlers();
    loadCharacters('all', 1, []);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
