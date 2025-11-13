class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.baseHeaders = {
            'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            ...this.baseHeaders,
            ...options.headers,
        };

        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    fetchCategories() {
        return this.request('/v1/characters/categories');
    }

    fetchCharacters(filter, page, pageSize, categories, searchQuery) {
        const params = new URLSearchParams({
            filter_type: filter,
            page: page.toString(),
            page_size: pageSize.toString(),
        });
        if (categories?.length) {
            categories.forEach(cat => params.append('category', cat));
        }
        if (searchQuery) {
            params.append('search_query', searchQuery);
        }
        return this.request(`/v1/characters/list?${params.toString()}`);
    }
}

class UI {
    constructor() {
        this.dom = {};
        this.paginationWrapper = null;
    }

    bindDOM() {
        this.dom = {
            cardsContainer: document.querySelector('.cards-container'),
            cardsRow: document.querySelector('.cards-container .row'),
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
            searchInput: document.getElementById('searchInput'),
            searchButton: document.getElementById('searchButton'),
            clearSearchButton: document.getElementById('clearSearchButton'),
            categoriesScrollContainer: document.querySelector('.categories-scroll-container'),
        };
    }

    createElement(tag, options = {}) {
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

    clearContainer(element) {
        if (element) element.innerHTML = '';
        return element;
    }

    showLoadingSpinner(show = true) {
        if (show) {
            let overlay = this.dom.cardsContainer.querySelector('.loading-overlay');
            if (!overlay) {
                overlay = this.createElement('div', { className: 'loading-overlay' });
                overlay.appendChild(this.createElement('div', { className: 'spinner-border-custom' }));
                this.dom.cardsContainer.style.position = 'relative';
                this.dom.cardsContainer.appendChild(overlay);
            }
        } else {
            this.dom.cardsContainer.querySelector('.loading-overlay')?.remove();
        }
    }

    renderCharacters(characters) {
        this.clearContainer(this.dom.cardsRow);
        if (!characters?.length) {
            return;
        }
        const fragment = document.createDocumentFragment();
        characters.forEach(char => fragment.appendChild(this._createCharacterCard(char)));
        this.dom.cardsRow.appendChild(fragment);
    }

    renderCategories(categories, selectedCategories) {
        if (!this.dom.categories.section) return;
        this.dom.categories.section.style.display = 'block';
        this.clearContainer(this.dom.categories.inline);
        const fragment = document.createDocumentFragment();
        categories.forEach(category => {
            fragment.appendChild(this._createCategoryButton(category, selectedCategories, 'category-inline-btn filter-btn'));
        });
        this.dom.categories.inline.appendChild(fragment);
    }
    
    renderPagination(current, total) {
        this.paginationWrapper?.remove();
        if (total <= 1) return;

        this.paginationWrapper = this.createElement('div', { className: 'pagination-wrapper mt-4 mb-4' });
        const nav = this.createElement('nav', { attributes: { 'aria-label': 'Навигация по страницам' } });
        const ul = this.createElement('ul', { className: 'pagination justify-content-center' });

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
            const li = this.createElement('li', { className: `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}` });
            const link = this.createElement('a', { className: 'page-link', text: text, attributes: { href: '#', 'data-page': page } });
            li.appendChild(link);
            return li;
        };
        
        ul.appendChild(createPageItem('‹', current - 1, current === 1));
        getPageRange().forEach(page => {
            if (page === '...') {
                const li = this.createElement('li', { className: 'page-item disabled' });
                li.appendChild(this.createElement('span', { className: 'page-link', text: '...' }));
                ul.appendChild(li);
            } else {
                ul.appendChild(createPageItem(page.toString(), page, false, page === current));
            }
        });
        ul.appendChild(createPageItem('›', current + 1, current === total));

        nav.appendChild(ul);
        this.paginationWrapper.appendChild(nav);
        this.dom.cardsContainer.appendChild(this.paginationWrapper);
    }
    
    showCharactersError(retryCallback) {
        this.clearContainer(this.dom.cardsRow);
        const col = this.createElement('div', { className: 'col-12 text-center py-5' });
        const errorText = this.createElement('p', { text: 'Произошла ошибка при загрузке персонажей.' });
        const retryBtn = this.createElement('button', { className: 'btn btn-primary mt-3', text: 'Попробовать снова' });
        
        retryBtn.addEventListener('click', retryCallback);
        col.append(errorText, retryBtn);
        this.dom.cardsRow.appendChild(col);
    }

    showEmptyState(resetCallback) {
        this.clearContainer(this.dom.cardsRow);
        const messages = [
            { emoji: '🦗', title: 'Тут сверчки поют...', text: 'В этой категории нет персонажей! Серьёзно? 😱 Надо срочно что-то с этим делать!' },
            { emoji: '🌵', title: 'Пустыня Сахара', text: 'Здесь суше, чем в пустыне! 🏜️ Где все персонажи? Это какой-то заговор!' },
            { emoji: '👻', title: 'Привидения унесли всех', text: 'Тут пусто, как в заброшенном доме 🏚️ Даже привидения разбежались от скуки!' },
            { emoji: '🛸', title: 'Инопланетяне похитили всех', text: '👽 Ни одного персонажа не осталось… Зато, может, скоро вернут прокачанными!' },
            { emoji: '🕵️‍♀️', title: 'По следам исчезнувших', text: 'Следствие ведут колобки: персонажей нет, но подозрения есть!' }
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        const col = this.createElement('div', { className: 'col-12 text-center py-5' });
        
        const backBtn = this.createElement('button', { 
            className: 'btn btn-primary mt-3', 
            text: '🏠 Вернуться к путешествиям' 
        });
        
        backBtn.addEventListener('click', resetCallback);
        
        col.append(
            this.createElement('div', { text: msg.emoji, styles: { fontSize: '72px', marginBottom: '20px' } }),
            this.createElement('h4', { text: msg.title, styles: { marginBottom: '15px' } }),
            this.createElement('p', { text: msg.text, styles: { maxWidth: '400px', margin: '0 auto' } }),
            backBtn
        );
        this.dom.cardsRow.appendChild(col);
    }

    updateCategoryUI(selectedCategories) {
        document.querySelectorAll('[data-category]').forEach(el => {
            const category = el.dataset.category;
            const isSelected = selectedCategories.includes(category);
            el.classList.toggle('active', isSelected);
            el.textContent = isSelected ? `${category} ×` : category;
        });
        
        if (this.dom.selectedCategories.container) {
            this.dom.selectedCategories.container.style.display = 'none';
        }
    }

    updateFilterButtons(currentFilter) {
        this.dom.filterButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.filter === currentFilter);
        });
    }

    resetSearchUI() {
        if (this.dom.searchInput) {
            this.dom.searchInput.value = '';
            this.dom.searchInput.classList.remove('active', 'is-invalid');
        }
        if (this.dom.searchButton) {
            this.dom.searchButton.style.display = 'none';
        }
        this.toggleClearSearchButton(false);
    }

    toggleClearSearchButton(show) {
        if (this.dom.clearSearchButton) {
            this.dom.clearSearchButton.style.display = show ? 'block' : 'none';
        }
    }
    
    initCategoriesScroll() {
        const container = this.dom.categoriesScrollContainer;
        if (!container) return;
        
        let startX, scrollLeft;
        let isDragging = false, hasMoved = false, touchStartX = 0, touchHasMoved = false;

        const startDrag = (e) => {
            isDragging = true; hasMoved = false;
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
            container.style.cursor = 'grabbing'; container.style.userSelect = 'none'; container.style.scrollBehavior = 'auto';
        };
        const moveDrag = (e) => {
            if (!isDragging) return; e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX);
            if (Math.abs(walk) > 5) hasMoved = true;
            requestAnimationFrame(() => { container.scrollLeft = scrollLeft - walk; });
        };
        const endDrag = () => {
            isDragging = false; container.style.cursor = 'grab'; container.style.userSelect = '';
            setTimeout(() => { hasMoved = false; }, 50);
        };
        
        container.addEventListener('mousedown', startDrag);
        container.addEventListener('mousemove', moveDrag);
        container.addEventListener('mouseup', endDrag);
        container.addEventListener('mouseleave', endDrag);
        
        container.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].pageX; touchHasMoved = false; });
        container.addEventListener('touchmove', (e) => { if (Math.abs(e.touches[0].pageX - touchStartX) > 5) touchHasMoved = true; });
        container.addEventListener('touchend', () => { setTimeout(() => { touchHasMoved = false; }, 50); });
        
        container.style.cursor = 'grab';
        container._hasMoved = () => hasMoved;
        container._touchHasMoved = () => touchHasMoved;
    }

    _createCharacterCard(char) {
        const col = this.createElement('div', { className: 'col-12 col-md-6 col-lg-4' }); 
        const card = this.createElement('div', { className: 'character-card', attributes: { 'data-character-id': char.id } });
        const img = this.createElement('img', { attributes: { src: 'https://img.freepik.com/premium-photo/grey-textured-background_1310085-63603.jpg?w=740&q=80', alt: char.name, loading: 'lazy' } });
        const cardBody = this.createElement('div', { className: 'card-body' });
        const title = this.createElement('h5', { className: 'card-title', text: char.name });
        const description = this.createElement('p', { className: 'card-text small mb-2', text: (char.description || '').substring(0, 100) + ((char.description || '').length > 100 ? '...' : '') });
        const badgesContainer = this.createElement('div');

        if (char.category) {
            badgesContainer.appendChild(this.createElement('span', { 
                className: 'badge badge-category',
                text: char.category 
            }));
        }

        cardBody.append(title, description, badgesContainer);
        card.append(img, cardBody);
        col.appendChild(card);
        return col;
    }

    _createCategoryButton(category, selectedCategories, className, tag = 'button') {
        const isSelected = selectedCategories.includes(category);
        const attrs = { 'data-category': category };
        if (tag === 'button') attrs.type = 'button';
        if (tag === 'a') attrs.href = '#';

        const el = this.createElement(tag, {
            className: className,
            text: isSelected ? `${category} ×` : category,
            attributes: attrs,
        });
        if (isSelected) el.classList.add('active');
        return el;
    }
}

class App {
    constructor() {
        this.config = {
            API_BASE_URL: 'https://testapi.capyhub.su',
            PAGE_SIZE: 20,
        };

        this.state = {
            currentPage: 1,
            currentFilter: 'all',
            selectedCategories: [],
            categories: [],
            categoriesLoaded: false,
            categoriesLoading: false,
            currentSearchQuery: '',
        };

        this.searchTimeout = null;
        this.api = new ApiService(this.config.API_BASE_URL);
        this.ui = new UI();
    }

    init() {
        this.ui.bindDOM();
        this._bindEvents();
        this.ui.initCategoriesScroll();
        this.loadCharacters();
        this.loadCategories();
    }

    _bindEvents() {
        this.ui.dom.filterButtons.forEach(btn => btn.addEventListener('click', this.handleFilterClick.bind(this)));
        this.ui.dom.categories.inline?.addEventListener('click', this.handleCategoryClick.bind(this));
        this.ui.dom.selectedCategories.wrapper?.addEventListener('click', this.handleCategoryClick.bind(this));
        this.ui.dom.cardsContainer.addEventListener('click', this.handlePaginationClick.bind(this));

        if (this.ui.dom.searchInput) {
            this.ui.dom.searchInput.addEventListener('focus', this.handleSearchFocus.bind(this));
            this.ui.dom.searchInput.addEventListener('keypress', this.handleSearchKeyPress.bind(this));
            this.ui.dom.searchInput.addEventListener('input', this.handleSearchInput.bind(this));
        }
        
        if (this.ui.dom.searchButton) {
            this.ui.dom.searchButton.addEventListener('click', this.performSearch.bind(this));
        }

        if (this.ui.dom.clearSearchButton) {
            this.ui.dom.clearSearchButton.addEventListener('click', this.resetAndLoad.bind(this));
        }
    }

    async loadCharacters() {
        this.ui.showLoadingSpinner(true);
        try {
            const data = await this.api.fetchCharacters(
                this.state.currentFilter,
                this.state.currentPage,
                this.config.PAGE_SIZE,
                this.state.selectedCategories,
                this.state.currentSearchQuery
            );
            this.ui.renderCharacters(data.characters || []);
            this.ui.renderPagination(data.current_page || 1, data.total_pages || 1);
            
            if (!data.characters || data.characters.length === 0) {
                this.ui.showEmptyState(this.resetAndLoad.bind(this));
            }

            this.state.currentPage = data.current_page || 1;
        } catch (error) {
            console.error('Ошибка загрузки персонажей:', error);
            this.ui.showCharactersError(() => this.loadCharacters());
        } finally {
            this.ui.showLoadingSpinner(false);
        }
    }

    async loadCategories() {
        if (this.state.categoriesLoaded || this.state.categoriesLoading) return;
        this.state.categoriesLoading = true;
        try {
            const data = await this.api.fetchCategories();
            this.state.categories = data.categories || [];
            if (this.state.categories.length > 0) {
                this.ui.renderCategories(this.state.categories, this.state.selectedCategories);
                this.state.categoriesLoaded = true;
            }
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
        } finally {
            this.state.categoriesLoading = false;
        }
    }

    handleFilterClick(event) {
        this.state.currentFilter = event.currentTarget.dataset.filter;
        this.state.selectedCategories = [];
        this.state.currentPage = 1;

        this.ui.updateFilterButtons(this.state.currentFilter);
        this.ui.updateCategoryUI(this.state.selectedCategories);
        this.loadCharacters();
        
        if (this.ui.dom.offcanvasFilters) {
            bootstrap.Offcanvas.getInstance(this.ui.dom.offcanvasFilters)?.hide();
        }
    }

    handleCategoryClick(event) {
        event.preventDefault();
        
        const container = this.ui.dom.categoriesScrollContainer;
        if (container && (container._hasMoved?.() || container._touchHasMoved?.())) {
            return;
        }
        
        const target = event.target.closest('[data-category]');
        if (!target) return;

        const category = target.dataset.category;
        const index = this.state.selectedCategories.indexOf(category);
        if (index > -1) {
            this.state.selectedCategories.splice(index, 1);
        } else {
            this.state.selectedCategories.push(category);
        }
        
        this.state.currentPage = 1;
        this.ui.updateCategoryUI(this.state.selectedCategories);
        this.loadCharacters();
    }
    
    handlePaginationClick(event) {
        const link = event.target.closest('.page-link');
        if (link && !link.parentElement.classList.contains('disabled')) {
            event.preventDefault();
            const page = parseInt(link.dataset.page, 10);
            if (page) {
                this.state.currentPage = page;
                this.loadCharacters();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    _validateSearchQuery(query) {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
            window.Telegram.WebApp.showAlert('Введите что-нибудь для поиска.');
            return null;
        }
        if (query.length > 20) {
            window.Telegram.WebApp.showAlert('Куда?! Ты что собрался искать на 20 символов ?');
            return null;
        }
        if (!/^[a-zA-Zа-яА-ЯёЁ0-9\s]+$/.test(query)) {
            window.Telegram.WebApp.showAlert('Не, такое не работает тут. Давай не выпендривайся хацкер :)');
            return null;
        }
        return query.trim();
    }

    performSearch(event) {
        if (event) event.preventDefault();
        clearTimeout(this.searchTimeout);
        const query = this.ui.dom.searchInput.value;
        const validQuery = this._validateSearchQuery(query);
        
        if (query && validQuery === null) {
            this.ui.dom.searchInput.classList.add('is-invalid');
            return;
        }
        
        this.ui.dom.searchInput.classList.remove('is-invalid');
        this.state.currentSearchQuery = validQuery || '';
        this.state.currentPage = 1;
        this.loadCharacters();
    }

    handleSearchFocus() {
        this.ui.dom.searchInput.classList.add('active');
        if (this.ui.dom.searchButton) {
            this.ui.dom.searchButton.style.display = 'block';
        }
    }
    
    handleSearchKeyPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.performSearch();
            this.ui.dom.searchInput.blur();
        }
    }

    handleSearchInput() {
        clearTimeout(this.searchTimeout);
        this.ui.dom.searchInput.classList.remove('is-invalid');

        const hasText = this.ui.dom.searchInput.value.length > 0;
        this.ui.toggleClearSearchButton(hasText);
    }

    resetAndLoad() {
        this.state.currentFilter = 'all';
        this.state.selectedCategories = [];
        this.state.currentSearchQuery = '';
        this.state.currentPage = 1;

        this.ui.updateFilterButtons(this.state.currentFilter);
        this.ui.resetSearchUI();
        this.ui.updateCategoryUI(this.state.selectedCategories);
        
        this.loadCharacters();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
