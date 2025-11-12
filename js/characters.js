const API_BASE_URL = 'https://testapi.capyhub.su';
const PAGE_SIZE = 20;

let currentPage = 1;
let currentFilter = 'all';
let selectedCategories = [];
let categoriesLoaded = false;
let categoriesLoading = false;

const DOM = {
    cardsContainer: document.querySelector('.cards-container'),
    cardsRow: document.querySelector('.cards-container .row'),
    paginationWrapper: null,
    categories: {
        section: document.getElementById('categories-section'),
        inline: document.getElementById('categories-inline'),
    },
    selectedCategories: {
        container: document.querySelector('#selected-categories'),
        wrapper: document.querySelector('#selected-categories .d-flex'),
    },
    filterButtons: document.querySelectorAll('.filter-btn[data-filter]'),
    offcanvasFilters: document.getElementById('offcanvasFilters'),
};

async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
        'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

const fetchCategories = () => apiRequest('/v1/characters/categories');

const fetchCharacters = (filter, page, categories) => {
    const params = new URLSearchParams({
        filter_type: filter,
        page: page.toString(),
        page_size: PAGE_SIZE.toString(),
    });
    if (categories?.length) {
        categories.forEach(cat => params.append('category', cat));
    }
    return apiRequest(`/v1/characters/list?${params.toString()}`);
};

function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text) element.textContent = options.text;
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) =>
            element.setAttribute(key, value)
        );
    }
    if (options.styles) Object.assign(element.style, options.styles);
    return element;
}

function clearContainer(element) {
    if (element) element.innerHTML = '';
    return element;
}

function showCharactersError() {
    clearContainer(DOM.cardsRow);
    const col = createElement('div', { className: 'col-12 text-center py-5' });
    const errorText = createElement('p', { text: 'Произошла ошибка при загрузке персонажей.' });
    const retryBtn = createElement('button', { className: 'btn btn-primary mt-3', text: 'Попробовать снова' });
    
    retryBtn.addEventListener('click', () => loadCharacters(currentFilter, currentPage, selectedCategories));
    col.append(errorText, retryBtn);
    DOM.cardsRow.appendChild(col);
}

function showLoadingSpinner(show = true) {
    if (show) {
        let overlay = DOM.cardsContainer.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = createElement('div', { className: 'loading-overlay' });
            overlay.appendChild(createElement('div', { className: 'spinner-border-custom' }));
            DOM.cardsContainer.style.position = 'relative';
            DOM.cardsContainer.appendChild(overlay);
        }
    } else {
        DOM.cardsContainer.querySelector('.loading-overlay')?.remove();
    }
}

async function loadCategories() {
    if (categoriesLoaded || categoriesLoading) return;
    categoriesLoading = true;
    try {
        const data = await fetchCategories();
        const categories = data.categories || [];
        if (categories.length > 0) {
            renderCategories(categories);
            categoriesLoaded = true;
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    } finally {
        categoriesLoading = false;
    }
}

function renderCategories(categories) {
    if (!DOM.categories.section) return;
    DOM.categories.section.style.display = 'block';

    clearContainer(DOM.categories.inline);

    const fragment = document.createDocumentFragment();
    categories.forEach(category => {
        fragment.appendChild(createCategoryButton(category, 'category-inline-btn filter-btn'));
    });
    DOM.categories.inline.appendChild(fragment);
}

function createCategoryButton(category, className, tag = 'button') {
    const attrs = { 'data-category': category };
    if (tag === 'button') attrs.type = 'button';
    if (tag === 'a') attrs.href = '#';

    const isSelected = selectedCategories.includes(category);
    const displayText = isSelected ? `✓ ${category}` : category;

    const el = createElement(tag, {
        className: className,
        text: displayText,
        attributes: attrs,
    });
    if (isSelected) el.classList.add('active');
    return el;
}

async function loadCharacters(filter, page, categories) {
    showLoadingSpinner(true);
    try {
        const data = await fetchCharacters(filter, page, categories);
        renderCharacters(data.characters || []);
        renderPagination(data.current_page || 1, data.total_pages || 1);
        currentPage = data.current_page || 1;
        currentFilter = filter;
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        showCharactersError();
    } finally {
        showLoadingSpinner(false);
    }
}

function renderCharacters(characters) {
    clearContainer(DOM.cardsRow);
    if (!characters?.length) {
        showEmptyState();
        return;
    }
    const fragment = document.createDocumentFragment();
    characters.forEach(char => fragment.appendChild(createCharacterCard(char)));
    DOM.cardsRow.appendChild(fragment);
}

function createCharacterCard(char) {
    const col = createElement('div', { className: 'col-12 col-sm-6 col-lg-4' });
    const card = createElement('div', { className: 'character-card', attributes: { 'data-character-id': char.id } });
    const img = createElement('img', { attributes: { src: 'https://img.freepik.com/premium-photo/grey-textured-background_1310085-63603.jpg?w=740&q=80', alt: char.name, loading: 'lazy' } });
    const cardBody = createElement('div', { className: 'card-body' });
    const title = createElement('h5', { className: 'card-title', text: char.name });
    const description = createElement('p', { className: 'card-text small mb-2', text: (char.description || '').substring(0, 100) + ((char.description || '').length > 100 ? '...' : '') });
    const badgesContainer = createElement('div');

    if (char.category) badgesContainer.appendChild(createElement('span', { className: 'character-badge', text: char.category, styles: { backgroundColor: '#17a2b8' } }));
    if (char.is_selected) badgesContainer.appendChild(createElement('span', { className: 'character-badge badge-started', text: '💬 Начато' }));
    if (char.is_created) badgesContainer.appendChild(createElement('span', { className: 'character-badge badge-created', text: '✨ Создан' }));

    cardBody.append(title, description, badgesContainer);
    card.append(img, cardBody);
    col.appendChild(card);
    return col;
}

function showEmptyState() {
    const messages = [
        { emoji: '🦗', title: 'Тут сверчки поют...', text: 'В этой категории нет персонажей! Серьёзно? 😱 Надо срочно что-то с этим делать!' },
        { emoji: '🌵', title: 'Пустыня Сахара', text: 'Здесь суше, чем в пустыне! 🏜️ Где все персонажи? Это какой-то заговор!' },
        { emoji: '👻', title: 'Привидения унесли всех', text: 'Тут пусто, как в заброшенном доме 🏚️ Даже привидения разбежались от скуки!' },
        { emoji: '🛸', title: 'Инопланетяне похитили всех', text: '👽 Ни одного персонажа не осталось… Зато, может, скоро вернут прокачанными!' },
        { emoji: '🕵️‍♀️', title: 'По следам исчезнувших', text: 'Следствие ведут колобки: персонажей нет, но подозрения есть!' }
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const col = createElement('div', { className: 'col-12 text-center py-5' });
    col.append(
        createElement('div', { text: msg.emoji, styles: { fontSize: '72px', marginBottom: '20px' } }),
        createElement('h4', { text: msg.title, styles: { marginBottom: '15px' } }),
        createElement('p', { text: msg.text, styles: { maxWidth: '400px', margin: '0 auto' } })
    );
    DOM.cardsRow.appendChild(col);
}

function renderPagination(current, total) {
    DOM.paginationWrapper?.remove();
    if (total <= 1) return;

    DOM.paginationWrapper = createElement('div', { className: 'pagination-wrapper mt-4 mb-4' });
    const nav = createElement('nav', { attributes: { 'aria-label': 'Навигация по страницам' } });
    const ul = createElement('ul', { className: 'pagination justify-content-center' });

    const getPageRange = () => {
        const range = [], delta = 2;
        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
                range.push(i);
            } else if (range[range.length - 1] !== '...') {
                range.push('...');
            }
        }
        return range;
    };
    
    const createPageItem = (text, page, isDisabled = false, isActive = false) => {
        const li = createElement('li', { className: `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}` });
        const link = createElement('a', { className: 'page-link', text: text, attributes: { href: '#', 'data-page': page } });
        li.appendChild(link);
        return li;
    };
    
    ul.appendChild(createPageItem('‹', current - 1, current === 1));
    getPageRange().forEach(page => {
        if (page === '...') {
            const li = createElement('li', { className: 'page-item disabled' });
            li.appendChild(createElement('span', { className: 'page-link', text: '...' }));
            ul.appendChild(li);
        } else {
            ul.appendChild(createPageItem(page.toString(), page, false, page === current));
        }
    });
    ul.appendChild(createPageItem('›', current + 1, current === total));

    nav.appendChild(ul);
    DOM.paginationWrapper.appendChild(nav);
    DOM.cardsContainer.appendChild(DOM.paginationWrapper);
}

function updateCategoryUI() {
    document.querySelectorAll('[data-category]').forEach(el => {
        const category = el.dataset.category;
        const isSelected = selectedCategories.includes(category);
        
        el.classList.toggle('active', isSelected);
        el.textContent = isSelected ? `✓ ${category}` : category;
    });
    DOM.selectedCategories.container.style.display = 'none';
}

function toggleCategory(category) {
    const index = selectedCategories.indexOf(category);
    if (index > -1) {
        selectedCategories.splice(index, 1);
    } else {
        selectedCategories.push(category);
    }
    
    updateCategoryUI();
    loadCharacters(currentFilter, 1, selectedCategories);
}

function handleFilterClick(event) {
    const filter = event.currentTarget.dataset.filter;
    DOM.filterButtons.forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    selectedCategories = [];
    updateCategoryUI();

    loadCharacters(filter, 1, []);
    
    if (DOM.offcanvasFilters) {
        bootstrap.Offcanvas.getInstance(DOM.offcanvasFilters)?.hide();
    }
}

function handleCategoryClick(event) {
    event.preventDefault();
    const target = event.target.closest('[data-category]');
    if (target) toggleCategory(target.dataset.category);
}

function handlePaginationClick(event) {
    const link = event.target.closest('.page-link');
    if (link && !link.parentElement.classList.contains('disabled')) {
        event.preventDefault();
        const page = parseInt(link.dataset.page, 10);
        if (page) {
            loadCharacters(currentFilter, page, selectedCategories);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

function init() {
    DOM.filterButtons.forEach(btn => btn.addEventListener('click', handleFilterClick));
    DOM.categories.inline?.addEventListener('click', handleCategoryClick);
    DOM.categories.dropdownMenu?.addEventListener('click', handleCategoryClick);
    DOM.selectedCategories.wrapper?.addEventListener('click', handleCategoryClick);
    DOM.cardsContainer.addEventListener('click', handlePaginationClick);
    
    loadCharacters('all', 1, []);
    loadCategories();
}

document.addEventListener('DOMContentLoaded', init);
