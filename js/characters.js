class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.baseHeaders = {};
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            ...this.baseHeaders,
            'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData,
            ...options.headers,
        };

        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    fetchTags() {
        return this.request('/v1/characters/tags', {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    fetchCharacters(filter, page, pageSize, tags, searchQuery) {
        const params = new URLSearchParams({
            filter_type: filter,
            page: page.toString(),
            page_size: pageSize.toString(),
        });
        if (tags?.length) {
            tags.forEach(tag => params.append('tags', tag));
        }
        if (searchQuery) {
            params.append('search_query', searchQuery);
        }
        return this.request(`/v1/characters/list?${params.toString()}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    fetchPhoto(fileId) {
        return this.request(`/v1/characters/photo?file_id=${fileId}`);
    }
}

class ImageLoader {
    constructor(apiService, baseUrl) {
        this.api = apiService;
        this.baseUrl = baseUrl;
        this.queue = [];
        this.loading = false;
        this.delay = 100;
    }

    addToQueue(fileId, imgElement) {
        this.queue.push({ fileId, imgElement });
        if (!this.loading) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.loading || this.queue.length === 0) return;
        
        this.loading = true;
        const item = this.queue.shift();
        
        await this.loadImage(item.fileId, item.imgElement);
        
        if (this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
        
        this.loading = false;
        
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }

    async loadImage(fileId, imgElement) {
        try {
            const data = await this.api.fetchPhoto(fileId);
            const photoUrl = `${this.baseUrl}/${data.path}`;
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    imgElement.src = photoUrl;
                    imgElement.classList.remove('placeholder', 'bg-secondary');
                    imgElement.classList.add('loaded');
                    resolve();
                };
                img.onerror = () => {
                    imgElement.classList.remove('placeholder', 'bg-secondary');
                    imgElement.classList.add('error');
                    resolve();
                };
                img.src = photoUrl;
            });
        } catch (error) {
            console.error('Ошибка загрузки изображения:', error);
            imgElement.classList.remove('placeholder', 'bg-secondary');
            imgElement.classList.add('error');
        }
    }

    clear() {
        this.queue = [];
        this.loading = false;
    }
}

class UI {
    constructor() {
        this.dom = {};
        this.paginationWrapper = null;
        this.imageLoader = null;
    }

    setImageLoader(imageLoader) {
        this.imageLoader = imageLoader;
    }

    bindDOM() {
        this.dom = {
            cardsContainer: document.querySelector('.cards-container'),
            cardsRow: document.querySelector('.cards-container .row'),
            tags: {
                modalContainer: document.getElementById('tags-modal-container'),
            },
            allTagsButton: document.querySelector('button[data-bs-target="#tagsModal"]'),
            filterButtons: document.querySelectorAll('.filter-btn[data-filter]'),
            offcanvasFilters: document.getElementById('offcanvasFilters'),
            searchInput: document.getElementById('searchInput'),
            searchButton: document.getElementById('searchButton'),
            clearSearchButton: document.getElementById('clearSearchButton'),
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
        if (this.imageLoader) {
            this.imageLoader.clear();
        }
        if (!characters?.length) {
            return;
        }
        const fragment = document.createDocumentFragment();
        characters.forEach(char => fragment.appendChild(this._createCharacterCard(char)));
        this.dom.cardsRow.appendChild(fragment);
    }

    renderTags(tags, selectedTags) {
        if (!this.dom.tags.modalContainer) return;
        this.clearContainer(this.dom.tags.modalContainer);
        const fragment = document.createDocumentFragment();
        tags.forEach(tag => {
            fragment.appendChild(this._createTagBadge(tag, selectedTags));
        });
        this.dom.tags.modalContainer.appendChild(fragment);
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

    updateTagsUI(selectedTags) {
        document.querySelectorAll('[data-tag]').forEach(el => {
            const tag = el.dataset.tag;
            const isSelected = selectedTags.includes(tag);
            if (isSelected) {
                el.classList.add('bg-primary', 'text-white');
            } else {
                el.classList.remove('bg-primary', 'text-white');
            }
            el.textContent = isSelected ? `${tag} ×` : tag;
        });
    }

    updateFilterButtons(currentFilter) {
        this.dom.filterButtons.forEach(b => {
            b.classList.toggle('active', b.dataset.filter === currentFilter);
        });
    }

    toggleTagsButton(show) {
        if (this.dom.allTagsButton) {
            this.dom.allTagsButton.style.display = show ? 'block' : 'none';
        }
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

    _createCharacterCard(char) {
        const col = this.createElement('div', { className: 'col-12 col-md-6 col-lg-4' });
        const card = this.createElement('div', { className: 'character-card', attributes: { 'data-character-id': char.id } });
        
        const img = this.createElement('img', {
            className: 'card-img-top img-fluid',
            attributes: {
                alt: char.name,
                loading: 'lazy',
                style: 'min-height: 200px; max-height: 350px; object-fit: cover;'
            }
        });

        if (char.file_id && this.imageLoader) {
            this.imageLoader.addToQueue(char.file_id, img);
        }
        
        const cardBody = this.createElement('div', { className: 'card-body' });
        const title = this.createElement('h5', { className: 'card-title', text: char.name });
        const description = this.createElement('p', { className: 'card-text small mb-2', text: (char.description || '').substring(0, 100) + ((char.description || '').length > 100 ? '...' : '') });
        const badgesContainer = this.createElement('div');

        if (char.tags && Array.isArray(char.tags)) {
            char.tags.forEach(tag => {
                badgesContainer.appendChild(this.createElement('span', {
                    className: 'badge bg-primary rounded-pill me-1 mb-1',
                    text: tag
                }));
            });
        }

        cardBody.append(title, description, badgesContainer);
        card.append(img, cardBody);
        col.appendChild(card);
        return col;
    }

    _createTagBadge(tag, selectedTags) {
        const isSelected = selectedTags.includes(tag);
        const attrs = { 'data-tag': tag, 'role': 'button' };

        const el = this.createElement('span', {
            className: `tag-badge ${isSelected ? 'bg-primary text-white' : ''}`,
            text: isSelected ? `${tag} ×` : tag,
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
            selectedTags: [],
            tags: [],
            tagsLoaded: false,
            tagsLoading: false,
            currentSearchQuery: '',
        };

        this.searchTimeout = null;
        this.api = new ApiService(this.config.API_BASE_URL);
        this.ui = new UI();
        this.imageLoader = new ImageLoader(this.api, this.config.API_BASE_URL);
        this.ui.setImageLoader(this.imageLoader);
    }

    init() {
        this.ui.bindDOM();
        this._bindEvents();
        this.loadCharacters();
        this.loadTags();
    }

    _bindEvents() {
        this.ui.dom.filterButtons.forEach(btn => btn.addEventListener('click', this.handleFilterClick.bind(this)));
        this.ui.dom.tags.modalContainer?.addEventListener('click', this.handleTagClick.bind(this));
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
                this.state.selectedTags,
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

    async loadTags() {
        if (this.state.tagsLoaded || this.state.tagsLoading) return;
        this.state.tagsLoading = true;
        this.ui.toggleTagsButton(false);
        try {
            const data = await this.api.fetchTags();
            this.state.tags = data.tags || [];
            if (this.state.tags.length > 0) {
                this.ui.renderTags(this.state.tags, this.state.selectedTags);
                this.ui.toggleTagsButton(true);
            }
            this.state.tagsLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки тегов:', error);
            this.ui.toggleTagsButton(false);
        } finally {
            this.state.tagsLoading = false;
        }
    }

    handleFilterClick(event) {
        this.state.currentFilter = event.currentTarget.dataset.filter;
        this.state.selectedTags = [];
        this.state.currentPage = 1;

        this.ui.updateFilterButtons(this.state.currentFilter);
        this.ui.updateTagsUI(this.state.selectedTags);
        this.loadCharacters();

        if (this.ui.dom.offcanvasFilters) {
            bootstrap.Offcanvas.getInstance(this.ui.dom.offcanvasFilters)?.hide();
        }
    }

    handleTagClick(event) {
        event.preventDefault()

        const target = event.target.closest('[data-tag]');
        if (!target) return;

        const tag = target.dataset.tag;
        const index = this.state.selectedTags.indexOf(tag);
        
        if (index > -1) {
            this.state.selectedTags.splice(index, 1);
        } else {
            if (this.state.selectedTags.length >= 5) {
                window.Telegram.WebApp.showAlert('Не-не-не, больше 5 тегов низя !');
                return;
            }
            this.state.selectedTags.push(tag);
        }

        this.state.currentPage = 1;
        this.ui.updateTagsUI(this.state.selectedTags);
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
        this.state.selectedTags = [];
        this.state.currentSearchQuery = '';
        this.state.currentPage = 1;

        this.ui.updateFilterButtons(this.state.currentFilter);
        this.ui.resetSearchUI();
        this.ui.updateTagsUI(this.state.selectedTags);

        this.loadCharacters();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
