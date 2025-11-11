const API_BASE_URL = 'https://testapi.capyhub.su/v1';
let currentPage = 1;
let currentFilter = 'all';
const PAGE_SIZE = 20;

// Загрузка персонажей
async function loadCharacters(filter = 'all', page = 1) {
    try {
        const response = await $.ajax({
            url: `${API_BASE_URL}/characters/list`,
            method: 'GET',
            data: {
                filter_type: filter,
                page: page,
                page_size: PAGE_SIZE
            },
            headers: {
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
            timeout: 10000
        });

        renderCharacters(response.characters);
        renderPagination(response.current_page, response.total_pages);
        
        currentPage = response.current_page;
        currentFilter = filter;
    } catch (error) {
        console.error('Ошибка загрузки персонажей:', error);
        console.error('Детали ошибки:', {
            status: error.status,
            statusText: error.statusText,
            responseText: error.responseText
        });
        showError();
    }
}

// Отображение персонажей
function renderCharacters(characters) {
    const container = $('.cards-container .row');
    container.empty();

    if (characters.length === 0) {
        const emptyMessages = [
            {
                emoji: '🦗',
                title: 'Тут сверчки поют...',
                text: 'В этой категории нет персонажей! Серьёзно? 😱 Надо срочно что-то с этим делать!'
            },
            {
                emoji: '🌵',
                title: 'Пустыня Сахара',
                text: 'Здесь суше, чем в пустыне! 🏜️ Где все персонажи? Это какой-то заговор!'
            },
            {
                emoji: '👻',
                title: 'Привидения унесли всех',
                text: 'Тут пусто, как в заброшенном доме 🏚️ Даже привидения разбежались от скуки!'
            },
            {
                emoji: '🕳️',
                title: 'Чёрная дыра персонажей',
                text: 'Куда все пропали?! 🤷‍♂️ Может их Танос щёлкнул? Надо создавать новых!'
            },
            {
                emoji: '🎭',
                title: 'Занавес опущен',
                text: 'Актёры ушли на перерыв... навсегда 😅 Пора вызывать новых на сцену!'
            }
        ];

        const randomMessage = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

        container.html(`
            <div class="col-12 text-center py-5">
                <div style="font-size: 72px; margin-bottom: 20px;">${randomMessage.emoji}</div>
                <h4 style="color: #ffffff; margin-bottom: 15px;">${randomMessage.title}</h4>
                <p style="color: #b0b0b0; font-size: 16px; max-width: 400px; margin: 0 auto;">
                    ${randomMessage.text}
                </p>
            </div>
        `);
        return;
    }

    characters.forEach(char => {
        const badges = getBadges(char);
        const categoryBadge = char.category ? 
            `<span class="character-badge" style="background-color: #17a2b8;">${char.category}</span>` : '';
        
        const cardHtml = `
            <div class="col-12 col-sm-6 col-lg-4">
                <div class="character-card" data-character-id="${char.id}">
                    <img src="https://img.freepik.com/premium-photo/grey-textured-background_1310085-63603.jpg?semt=ais_hybrid&w=740&q=80" 
                        alt="${char.name}">
                    <div class="card-body">
                        <h5 class="card-title">${escapeHtml(char.name)}</h5>
                        <p class="card-text small mb-2" style="color: #b0b0b0; line-height: 1.4;">
                            ${escapeHtml(char.description.substring(0, 100))}${char.description.length > 100 ? '...' : ''}
                        </p>
                        <div>
                            ${categoryBadge}
                            ${badges}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.append(cardHtml);
    });
}

// Получение бейджей для персонажа
function getBadges(char) {
    let badges = '';
    
    if (char.is_selected) {
        badges += '<span class="character-badge badge-started">💬 Начато</span>';
    }
    if (char.is_created) {
        badges += '<span class="character-badge badge-created">✨ Создан</span>';
    }
    if (char.is_imported) {
        badges += '<span class="character-badge badge-imported">📥 Импорт</span>';
    }
    
    return badges;
}

// Отображение пагинации
function renderPagination(currentPage, totalPages) {
    const paginationContainer = $('.cards-container .container');
    $('.pagination-wrapper').remove();

    if (totalPages <= 1) return;

    const paginationHtml = `
        <div class="pagination-wrapper mt-4 mb-4">
            <nav aria-label="Навигация по страницам">
                <ul class="pagination justify-content-center">
                    ${getPaginationItems(currentPage, totalPages)}
                </ul>
            </nav>
        </div>
    `;
    
    paginationContainer.append(paginationHtml);
}

// Генерация элементов пагинации
function getPaginationItems(current, total) {
    let items = '';
    
    // Кнопка "Назад"
    items += `
        <li class="page-item ${current === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${current - 1}" style="background-color: #1a1a1a; border-color: #2a2a2a; color: #ffffff;">
                ‹
            </a>
        </li>
    `;

    // Номера страниц
    const range = getPageRange(current, total);
    range.forEach(page => {
        if (page === '...') {
            items += `
                <li class="page-item disabled">
                    <span class="page-link" style="background-color: #1a1a1a; border-color: #2a2a2a; color: #6a6a6a;">...</span>
                </li>
            `;
        } else {
            items += `
                <li class="page-item ${page === current ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${page}" 
                    style="background-color: ${page === current ? '#0088cc' : '#1a1a1a'}; 
                            border-color: ${page === current ? '#0088cc' : '#2a2a2a'}; 
                            color: #ffffff;">
                        ${page}
                    </a>
                </li>
            `;
        }
    });

    // Кнопка "Вперед"
    items += `
        <li class="page-item ${current === total ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${current + 1}" style="background-color: #1a1a1a; border-color: #2a2a2a; color: #ffffff;">
                ›
            </a>
        </li>
    `;

    return items;
}

// Определение диапазона страниц для отображения
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

// Обработчик клика по пагинации
$(document).on('click', '.pagination .page-link', function(e) {
    e.preventDefault();
    const page = $(this).data('page');
    
    if (page && page > 0) {
        loadCharacters(currentFilter, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

// Обработчик фильтров
document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');
        
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        loadCharacters(filter, 1);
        
        // Закрыть offcanvas после выбора фильтра
        const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasFilters'));
        if (offcanvas) {
            offcanvas.hide();
        }
    });
});

// Показать ошибку
function showError() {
    const container = $('.cards-container .row');
    container.html(`
        <div class="col-12 text-center py-5">
            <p style="color: #ff4444;">Произошла ошибка при загрузке персонажей</p>
            <button class="btn btn-primary mt-3" onclick="loadCharacters(currentFilter, currentPage)" 
                    style="background-color: #0088cc; border-color: #0088cc;">
                Попробовать снова
            </button>
        </div>
    `);
}

// Экранирование HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Инициализация при загрузке страницы
$(document).ready(function() {
    loadCharacters('all', 1);
});
