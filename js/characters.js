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

    fetchCharacterDetail(publicId) {
        return this.request(`/v1/characters/${publicId}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    fetchCharacterStats(publicId) {
        return this.request(`/v1/characters/stats?public_id=${publicId}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    fetchReactionStatus(publicId) {
        return this.request(`/v1/characters/reactions/status/${publicId}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    setLike(publicId) {
        return this.request('/v1/characters/reactions/like', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({ public_id: publicId })
        });
    }

    setDislike(publicId) {
        return this.request('/v1/characters/reactions/dislike', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({ public_id: publicId })
        });
    }

    fetchLikesCount(publicId) {
        return this.request(`/v1/characters/reactions/count/${publicId}`, {
            headers: { 'Cache-Control': 'no-cache' }
        });
    }

    toggleFavorite(publicId) {
        return this.request(`/v1/characters/favorite/${publicId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }

    fetchSubsData(){
        return this.request(`/v1/profile/`, {
            headers: { 
                'Cache-Control': 'no-cache'
            }
        });
    }
}

class ImageLoader {
    constructor(apiService, baseUrl) {
        this.api = apiService;
        this.baseUrl = baseUrl;
        this.queue = [];
        this.loading = false;
        this.delay = 100;
        this.observer = null;
        this.initObserver();
    }

    initObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const fileId = img.dataset.fileId;
                    if (fileId && !img.classList.contains('loaded')) {
                        this.addToQueue(fileId, img);
                        this.observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });
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

    observeImage(fileId, imgElement) {
        imgElement.dataset.fileId = fileId;
        this.observer.observe(imgElement);
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
            navLinksContainer: document.getElementById('navItem'),
            tags: {
                modalContainer: document.getElementById('tags-modal-container'),
            },
            allTagsButton: document.querySelector('button[data-bs-target="#tagsModal"]'),
            filterButtons: document.querySelectorAll('.filter-btn[data-filter]'),
            offcanvasFilters: document.getElementById('offcanvasFilters'),
            searchInput: document.getElementById('searchInput'),
            searchButton: document.getElementById('searchButton'),
            clearSearchButton: document.getElementById('clearSearchButton'),
            characterModal: {
                element: document.getElementById('characterInfoModal'),
                image: document.getElementById('char-modal-image'),
                name: document.getElementById('char-modal-name'),
                description: document.getElementById('char-modal-description'),
                tags: document.getElementById('char-modal-tags'),
                favoritesCount: document.getElementById('char-favorites-count'),
                chatsCount: document.getElementById('char-chats-count'),
                likesCount: document.getElementById('char-likes-count'),
                dislikesCount: document.getElementById('char-dislikes-count'),
                favoriteBtn: document.getElementById('char-favorite-btn'),
                likeBtn: document.getElementById('char-like-btn'),
                dislikeBtn: document.getElementById('char-dislike-btn'),
            },
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
        const card = this.createElement('div', { 
            className: 'character-card', 
            attributes: { 
                'data-character-id': char.public_id,
                'data-bs-toggle': 'modal',
                'data-bs-target': '#characterInfoModal'
            } 
        });
        
        const img = this.createElement('img', {
            className: 'card-img-top img-fluid',
            attributes: {
                alt: char.name,
                loading: 'lazy',
                style: 'min-height: 200px; max-height: 350px; object-fit: cover;'
            }
        });

        if (char.file_id && this.imageLoader) {
            this.imageLoader.observeImage(char.file_id, img);
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

    renderCharacterModal(character, stats = null, reactionStatus = null, likesCount = null) {
        const modal = this.dom.characterModal;
        
        modal.name.textContent = character.name;
        modal.description.textContent = character.description || 'Описание отсутствует';
        
        if (character.file_id && this.imageLoader) {
            modal.image.src = '';
            modal.image.classList.add('placeholder', 'bg-secondary');
            this.imageLoader.addToQueue(character.file_id, modal.image);
        }
        
        this.clearContainer(modal.tags);
        if (character.tags && Array.isArray(character.tags)) {
            character.tags.forEach(tag => {
                modal.tags.appendChild(this.createElement('span', {
                    className: 'badge bg-primary rounded-pill me-1 mb-1',
                    text: tag
                }));
            });
        }
        
        modal.favoritesCount.parentElement.setAttribute('aria-hidden', 'true');
        modal.favoritesCount.classList.add('placeholder');
        modal.chatsCount.parentElement.setAttribute('aria-hidden', 'true');
        modal.chatsCount.classList.add('placeholder');
        modal.likesCount.parentElement.setAttribute('aria-hidden', 'true');
        modal.likesCount.classList.add('placeholder');
        modal.dislikesCount.parentElement.setAttribute('aria-hidden', 'true');
        modal.dislikesCount.classList.add('placeholder');
        
        modal.likeBtn.setAttribute('aria-hidden', 'true');
        modal.likeBtn.classList.add('disabled', 'placeholder');
        modal.dislikeBtn.setAttribute('aria-hidden', 'true');
        modal.dislikeBtn.classList.add('disabled', 'placeholder');
        
        if (stats) {
            this.updateCharacterStats(stats);
        }
        
        if (likesCount) {
            this.updateLikesCounts(likesCount);
        }
        
        if (character.is_favorite) {
            modal.favoriteBtn.classList.remove('btn-outline-warning');
            modal.favoriteBtn.classList.add('btn-outline-danger');
            modal.favoriteBtn.innerHTML = '<i class="bi bi-heart-break-fill"></i> Убрать из избранного';
        } else {
            modal.favoriteBtn.classList.remove('btn-outline-danger');
            modal.favoriteBtn.classList.add('btn-outline-warning');
            modal.favoriteBtn.innerHTML = '<i class="bi bi-star-fill"></i> В избранное';
        }
        
        if (reactionStatus) {
            this.updateReactionButtons(reactionStatus);
        }
        
        modal.element.dataset.currentCharacterId = character.public_id;
    }

    updateCharacterStats(stats) {
        const modal = this.dom.characterModal;
        
        modal.favoritesCount.parentElement.removeAttribute('aria-hidden');
        modal.favoritesCount.classList.remove('placeholder');
        modal.favoritesCount.textContent = stats.favorites_count || 0;
        
        modal.chatsCount.parentElement.removeAttribute('aria-hidden');
        modal.chatsCount.classList.remove('placeholder');
        modal.chatsCount.textContent = stats.selected_count || 0;
    }

    updateLikesCounts(likesCount) {
        const modal = this.dom.characterModal;
        
        modal.likesCount.parentElement.removeAttribute('aria-hidden');
        modal.likesCount.classList.remove('placeholder');
        modal.likesCount.textContent = likesCount.likes_count || 0;
        
        modal.dislikesCount.parentElement.removeAttribute('aria-hidden');
        modal.dislikesCount.classList.remove('placeholder');
        modal.dislikesCount.textContent = likesCount.dislikes_count || 0;
    }

    updateReactionButtons(reactionStatus) {
        const modal = this.dom.characterModal;
        
        modal.likeBtn.removeAttribute('aria-hidden');
        modal.likeBtn.classList.remove('disabled', 'placeholder');
        modal.dislikeBtn.removeAttribute('aria-hidden');
        modal.dislikeBtn.classList.remove('disabled', 'placeholder');
        
        if (reactionStatus.is_liked) {
            modal.likeBtn.classList.remove('btn-outline-success');
            modal.likeBtn.classList.add('btn-success');
        } else {
            modal.likeBtn.classList.remove('btn-success');
            modal.likeBtn.classList.add('btn-outline-success');
        }
        
        if (reactionStatus.is_disliked) {
            modal.dislikeBtn.classList.remove('btn-outline-danger');
            modal.dislikeBtn.classList.add('btn-danger');
        } else {
            modal.dislikeBtn.classList.remove('btn-danger');
            modal.dislikeBtn.classList.add('btn-outline-danger');
        }
    }

    showInProgressMessage(pageName, backCallback) {
        this.clearContainer(this.dom.cardsRow);
        
        this.paginationWrapper?.remove();
        this.paginationWrapper = null;
        
        const col = this.createElement('div', { className: 'col-12 text-center py-5' });
        const backBtn = this.createElement('button', {
            className: 'btn btn-primary mt-4',
            text: '🏠 Вернуться на главную'
        });
        backBtn.addEventListener('click', backCallback);

        col.append(
            this.createElement('div', { text: '🚧', styles: { fontSize: '72px', marginBottom: '20px' } }),
            this.createElement('h4', { text: `Страница "${pageName}" в разработке`, styles: { marginBottom: '15px' } }),
            this.createElement('p', { 
                className: 'lead text-muted',
                text: 'Мы усердно работаем, чтобы сделать эту функцию доступной как можно скорее!', 
                styles: { maxWidth: '500px', margin: '0 auto' } 
            }),
            backBtn
        );

        this.dom.cardsRow.appendChild(col);
    }

    updateNavLinks(activeLink) {
        this.dom.navLinksContainer.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        if (activeLink) {
            activeLink.classList.add('active');
        } else {
            const homeLink = Array.from(this.dom.navLinksContainer.querySelectorAll('.nav-link'))
                                .find(l => l.textContent.includes('Главная'));
            if (homeLink) homeLink.classList.add('active');
        }
    }

    renderProfile(profileData, userData) {
        this.clearContainer(this.dom.cardsRow);
        
        this.paginationWrapper?.remove();
        this.paginationWrapper = null;
        
        const col = this.createElement('div', { className: 'col-12' });
        
        const profileCard = this.createElement('div', { 
            className: 'card border-0 shadow-lg'
        });
        
        const cardHeader = this.createElement('div', { 
            className: 'card-header border-0 text-white',
            styles: {
                background: profileData.is_premium 
                    ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' 
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '2rem'
            }
        });
        
        const userInfoWrapper = this.createElement('div', { 
            className: 'd-flex align-items-center gap-3'
        });
        
        let avatarElement;
        if (userData.photo_url) {
            avatarElement = this.createElement('img', {
                className: 'rounded-circle',
                attributes: {
                    src: userData.photo_url,
                    alt: 'Avatar',
                    width: '80',
                    height: '80'
                },
                styles: {
                    objectFit: 'cover',
                    border: '3px solid rgba(255,255,255,0.3)'
                }
            });
        } else {
            avatarElement = this.createElement('div', {
                className: 'rounded-circle d-flex align-items-center justify-content-center',
                text: (userData.first_name?.[0] || '?').toUpperCase(),
                styles: {
                    width: '80px',
                    height: '80px',
                    fontSize: '32px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    border: '3px solid rgba(255,255,255,0.3)'
                }
            });
        }
        
        const userInfo = this.createElement('div', { className: 'flex-grow-1' });
        const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || 'Пользователь';
        
        userInfo.appendChild(this.createElement('h4', { 
            text: fullName, 
            className: 'mb-1 fw-bold'
        }));
        
        if (userData.username) {
            userInfo.appendChild(this.createElement('p', { 
                text: `@${userData.username}`, 
                className: 'mb-0 opacity-75'
            }));
        }
        
        userInfo.appendChild(this.createElement('small', {
            text: `ID: ${profileData.user_id}`,
            className: 'opacity-50'
        }));
        
        userInfoWrapper.append(avatarElement, userInfo);
        cardHeader.appendChild(userInfoWrapper);
        
        const cardBody = this.createElement('div', { 
            className: 'card-body',
            styles: { padding: '1.5rem' }
        });
        
        // Секция подписки
        const subscriptionSection = this.createElement('div', { className: 'mb-3' });
        
        const subscriptionHeader = this.createElement('div', { 
            className: 'd-flex align-items-center justify-content-between mb-2'
        });
        
        const subscriptionTitleWrapper = this.createElement('div', {
            className: 'd-flex align-items-center gap-2'
        });
        
        subscriptionTitleWrapper.appendChild(this.createElement('span', {
            text: '💎',
            styles: { fontSize: '1.2rem' }
        }));
        
        subscriptionTitleWrapper.appendChild(this.createElement('h6', { 
            text: 'Подписка', 
            className: 'mb-0'
        }));
        
        subscriptionHeader.appendChild(subscriptionTitleWrapper);
        
        const tariffBadge = this.createElement('span', {
            className: `badge ${profileData.is_premium ? 'bg-warning' : 'bg-secondary'}`,
            text: profileData.tariff_name || 'Базовый'
        });
        
        subscriptionHeader.appendChild(tariffBadge);
        subscriptionSection.appendChild(subscriptionHeader);
        
        if (profileData.subscription_end_date) {
            const endDate = new Date(profileData.subscription_end_date).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            subscriptionSection.appendChild(this.createElement('p', {
                text: `Активна до: ${endDate}`,
                className: 'text-muted mb-0 small'
            }));
        }
        
        subscriptionSection.appendChild(this.createElement('hr', { className: 'my-3' }));
        
        // Секция запросов
        const requestsSection = this.createElement('div', { className: 'mb-3' });
        
        const requestsHeader = this.createElement('div', { 
            className: 'd-flex align-items-center gap-2 mb-2'
        });
        
        requestsHeader.appendChild(this.createElement('span', {
            text: '📊',
            styles: { fontSize: '1.2rem' }
        }));
        
        requestsHeader.appendChild(this.createElement('h6', { 
            text: 'Использование запросов', 
            className: 'mb-0'
        }));
        
        requestsSection.appendChild(requestsHeader);
        
        const requestsLabel = this.createElement('div', {
            className: 'd-flex justify-content-between mb-2 small'
        });
        
        requestsLabel.appendChild(this.createElement('span', {
            text: 'Запросы сегодня',
            className: 'text-muted'
        }));
        
        requestsLabel.appendChild(this.createElement('span', {
            text: `${profileData.requests_used_today} / ${profileData.daily_requests_limit}`,
            className: 'fw-semibold'
        }));
        
        requestsSection.appendChild(requestsLabel);
        
        const progressBar = this.createElement('div', { 
            className: 'progress mb-2',
            styles: { height: '8px' }
        });
        
        const progressValue = Math.min((profileData.requests_used_today / profileData.daily_requests_limit) * 100, 100);
        const progressFill = this.createElement('div', {
            className: `progress-bar ${progressValue >= 90 ? 'bg-danger' : progressValue >= 70 ? 'bg-warning' : 'bg-success'}`,
            attributes: {
                role: 'progressbar',
                'aria-valuenow': progressValue,
                'aria-valuemin': '0',
                'aria-valuemax': '100'
            },
            styles: { width: `${progressValue}%` }
        });
        
        progressBar.appendChild(progressFill);
        requestsSection.appendChild(progressBar);
        
        const remainingText = this.createElement('div', {
            className: 'alert alert-info py-2 px-3 mb-0 small',
            text: `Осталось запросов: ${profileData.requests_remaining_today}`
        });
        
        requestsSection.appendChild(remainingText);
        requestsSection.appendChild(this.createElement('hr', { className: 'my-3' }));
        
        // Секция персонажей (только создание)
        const charactersSection = this.createElement('div');

        const charactersHeader = this.createElement('div', { 
            className: 'd-flex align-items-center gap-2 mb-3'
        });

        charactersHeader.appendChild(this.createElement('span', {
            text: '👥',
            styles: { fontSize: '1.2rem' }
        }));

        charactersHeader.appendChild(this.createElement('h6', { 
            text: 'Лимит создания персонажей', 
            className: 'mb-0'
        }));

        charactersSection.appendChild(charactersHeader);

        const createCard = this.createElement('div', { 
            className: 'card border-0 bg-secondary bg-opacity-10'
        });
        const createCardBody = this.createElement('div', {
            className: 'card-body text-center py-4'
        });
        createCardBody.appendChild(this.createElement('div', {
            text: profileData.max_characters_create,
            className: 'display-4 fw-bold text-primary mb-2'
        }));
        createCardBody.appendChild(this.createElement('div', {
            text: 'Максимум персонажей',
            className: 'text-muted fw-medium'
        }));
        createCard.appendChild(createCardBody);
        charactersSection.appendChild(createCard);
        
        cardBody.append(subscriptionSection, requestsSection, charactersSection);
        profileCard.append(cardHeader, cardBody);
        col.appendChild(profileCard);
        
        this.dom.cardsRow.appendChild(col);
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
        this.ui.dom.cardsContainer.addEventListener('click', this.handleCharacterCardClick.bind(this));

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

        if (this.ui.dom.characterModal.likeBtn) {
            this.ui.dom.characterModal.likeBtn.addEventListener('click', this.handleLikeClick.bind(this));
        }

        if (this.ui.dom.characterModal.dislikeBtn) {
            this.ui.dom.characterModal.dislikeBtn.addEventListener('click', this.handleDislikeClick.bind(this));
        }

        if (this.ui.dom.characterModal.favoriteBtn) {
            this.ui.dom.characterModal.favoriteBtn.addEventListener('click', this.handleFavoriteClick.bind(this));
        }

        if (this.ui.dom.navLinksContainer) {
            this.ui.dom.navLinksContainer.addEventListener('click', this.handleNavClick.bind(this));
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
        this.ui.updateNavLinks(null);

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
        this.ui.updateNavLinks(null);
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
        this.ui.updateNavLinks(null);
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
        this.ui.updateNavLinks(null);

        this.ui.updateFilterButtons(this.state.currentFilter);
        this.ui.resetSearchUI();
        this.ui.updateTagsUI(this.state.selectedTags);

        this.loadCharacters();
    }

    async handleCharacterCardClick(event) {
        const card = event.target.closest('.character-card');
        if (!card) return;
        
        const characterId = card.dataset.characterId;
        if (!characterId) return;
        
        try {
            const characterData = await this.api.fetchCharacterDetail(characterId);
            this.ui.renderCharacterModal(characterData, null, null, null);

            const [statsData, reactionData, likesCountData] = await Promise.all([
                this.api.fetchCharacterStats(characterId),
                this.api.fetchReactionStatus(characterId),
                this.api.fetchLikesCount(characterId)
            ]).catch(error => {
                console.log('Err Promise.all modal:', error);
                return [null, null, null];
            });

            if (statsData) this.ui.updateCharacterStats(statsData);
            if (reactionData) this.ui.updateReactionButtons(reactionData);
            if (likesCountData) this.ui.updateLikesCounts(likesCountData);
            
        } catch (error) {
            console.error('Ошибка загрузки информации о персонаже:', error);
            window.Telegram.WebApp.showAlert('Не удалось загрузить информацию о персонаже');
        }
    }

    async handleLikeClick() {
        const characterId = this.ui.dom.characterModal.element.dataset.currentCharacterId;
        if (!characterId) return;
        
        try {
            const modal = this.ui.dom.characterModal;
            const currentLikes = parseInt(modal.likesCount.textContent) || 0;
            const currentDislikes = parseInt(modal.dislikesCount.textContent) || 0;
            
            const wasLiked = modal.likeBtn.classList.contains('btn-success');
            const wasDisliked = modal.dislikeBtn.classList.contains('btn-danger');
            
            const reactionData = await this.api.setLike(characterId);
            this.ui.updateReactionButtons(reactionData);
            
            if (reactionData.is_liked && !wasLiked) {
                modal.likesCount.textContent = currentLikes + 1;
                if (wasDisliked) {
                    modal.dislikesCount.textContent = Math.max(0, currentDislikes - 1);
                }
            } else if (!reactionData.is_liked && wasLiked) {
                modal.likesCount.textContent = Math.max(0, currentLikes - 1);
            }
        } catch (error) {
            console.error('Ошибка при лайке:', error);
            window.Telegram.WebApp.showAlert('Не удалось поставить лайк');
        }
    }

    async handleDislikeClick() {
        const characterId = this.ui.dom.characterModal.element.dataset.currentCharacterId;
        if (!characterId) return;
        
        try {
            const modal = this.ui.dom.characterModal;
            const currentLikes = parseInt(modal.likesCount.textContent) || 0;
            const currentDislikes = parseInt(modal.dislikesCount.textContent) || 0;
            
            const wasLiked = modal.likeBtn.classList.contains('btn-success');
            const wasDisliked = modal.dislikeBtn.classList.contains('btn-danger');
            
            const reactionData = await this.api.setDislike(characterId);
            this.ui.updateReactionButtons(reactionData);
            
            if (reactionData.is_disliked && !wasDisliked) {
                modal.dislikesCount.textContent = currentDislikes + 1;
                if (wasLiked) {
                    modal.likesCount.textContent = Math.max(0, currentLikes - 1);
                }
            } else if (!reactionData.is_disliked && wasDisliked) {
                modal.dislikesCount.textContent = Math.max(0, currentDislikes - 1);
            }
        } catch (error) {
            console.error('Ошибка при дизлайке:', error);
            window.Telegram.WebApp.showAlert('Не удалось поставить дизлайк');
        }
    }

    async handleFavoriteClick() {
        const characterId = this.ui.dom.characterModal.element.dataset.currentCharacterId;
        if (!characterId) return;
        
        try {
            const modal = this.ui.dom.characterModal;
            const favoriteData = await this.api.toggleFavorite(characterId);
            
            if (favoriteData.is_favorite) {
                modal.favoriteBtn.classList.remove('btn-outline-warning');
                modal.favoriteBtn.classList.add('btn-outline-danger');
                modal.favoriteBtn.innerHTML = '<i class="bi bi-heart-break-fill"></i> Убрать из избранного';
            } else {
                modal.favoriteBtn.classList.remove('btn-outline-danger');
                modal.favoriteBtn.classList.add('btn-outline-warning');
                modal.favoriteBtn.innerHTML = '<i class="bi bi-star-fill"></i> В избранное';
            }
        } catch (error) {
            console.error('Ошибка при добавлении/удалении из избранного:', error);
            window.Telegram.WebApp.showAlert('Не удалось изменить статус избранного');
        }
    }

    handleNavClick(event) {
        const link = event.target.closest('a.nav-link');
        if (!link) return;

        event.preventDefault();

        if (this.ui.dom.offcanvasFilters) {
            const offcanvas = bootstrap.Offcanvas.getInstance(this.ui.dom.offcanvasFilters);
            offcanvas?.hide();
        }

        const linkText = link.textContent.trim();

        switch (linkText) {
            case '🏠 Главная':
                this.handleHomeClick(link);
                break;
            
            case '✨ Создать персонажа':
                this.handleCreateCharacterClick(link);
                break;

            case '👤 Профиль':
                this.handleProfileClick(link);
                break;

            case '💎 Тарифы':
                this.handleTariffsClick(link);
                break;
        }
    }

    handleHomeClick(link) {
        this.ui.updateNavLinks(link);
        this.resetAndLoad();
    }

    handleCreateCharacterClick(link) {
        this.ui.updateNavLinks(link);
        this.ui.showInProgressMessage('Создать персонажа', this.resetAndLoad.bind(this));
    }

    async handleProfileClick(link) {
        this.ui.updateNavLinks(link);
        this.ui.showLoadingSpinner(true);
        
        try {
            const tgUser = window.Telegram.WebApp.initDataUnsafe?.user || {};
            const userData = {
                user_id: tgUser.id,
                first_name: tgUser.first_name,
                last_name: tgUser.last_name,
                username: tgUser.username,
                photo_url: tgUser.photo_url
            };
            
            const profileData = await this.api.fetchSubsData();
            this.ui.renderProfile(profileData, userData);
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            this.ui.showCharactersError(() => this.handleProfileClick(link));
        } finally {
            this.ui.showLoadingSpinner(false);
        }
    }

    handleTariffsClick(link) {
        this.ui.updateNavLinks(link);
        this.ui.showInProgressMessage('Тарифы', this.resetAndLoad.bind(this));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
