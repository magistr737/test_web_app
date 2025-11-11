const API_BASE_URL = 'https://testapi.capyhub.su/v1';
let currentPage = 1;
let currentFilter = 'all';
const PAGE_SIZE = 20;

// Система мониторинга соединений и производительности
const ConnectionMonitor = {
    requests: [],
    connectionId: null,
    
    init() {
        this.connectionId = Date.now();
        console.log(`%c🔌 Connection Monitor инициализирован`, 'color: #4CAF50; font-weight: bold');
        console.log(`%c📊 Connection ID: ${this.connectionId}`, 'color: #2196F3');
        
        // Проверка поддержки Performance API
        if (window.performance && window.performance.getEntriesByType) {
            console.log('%c✅ Performance API поддерживается', 'color: #4CAF50');
        } else {
            console.warn('%c⚠️ Performance API не поддерживается', 'color: #FF9800');
        }
    },
    
    logRequest(url, method, startTime) {
        const request = {
            url,
            method,
            startTime,
            id: this.requests.length + 1
        };
        this.requests.push(request);
        
        console.groupCollapsed(`%c📤 Запрос #${request.id}: ${method} ${url}`, 'color: #2196F3; font-weight: bold');
        console.log(`%c⏰ Время начала: ${new Date(startTime).toISOString()}`, 'color: #9E9E9E');
        console.log(`%c🔗 URL: ${url}`, 'color: #9E9E9E');
        console.groupEnd();
        
        return request.id;
    },
    
    logResponse(requestId, responseData, error = null) {
        const request = this.requests[requestId - 1];
        const endTime = Date.now();
        const duration = endTime - request.startTime;
        
        request.endTime = endTime;
        request.duration = duration;
        request.success = !error;
        
        if (error) {
            console.groupCollapsed(`%c❌ Ответ #${requestId}: ОШИБКА (${duration}ms)`, 'color: #F44336; font-weight: bold');
            console.error('Ошибка:', error);
        } else {
            console.groupCollapsed(`%c📥 Ответ #${requestId}: SUCCESS (${duration}ms)`, 'color: #4CAF50; font-weight: bold');
        }
        
        console.log(`%c⏱️ Длительность: ${duration}ms`, duration > 1000 ? 'color: #FF9800' : 'color: #4CAF50');
        
        // Анализ Performance API
        this.analyzeConnectionReuse(request.url);
        
        console.groupEnd();
    },
    
    analyzeConnectionReuse(url) {
        if (!window.performance || !window.performance.getEntriesByType) return;
        
        const resources = performance.getEntriesByType('resource');
        const matchingResource = resources.filter(r => r.name.includes('characters/list')).pop();
        
        if (matchingResource) {
            console.groupCollapsed('%c🔍 Детальный анализ соединения', 'color: #9C27B0; font-weight: bold');
            
            const timing = {
                dns: matchingResource.domainLookupEnd - matchingResource.domainLookupStart,
                tcp: matchingResource.connectEnd - matchingResource.connectStart,
                ssl: matchingResource.secureConnectionStart > 0 ? 
                     matchingResource.connectEnd - matchingResource.secureConnectionStart : 0,
                ttfb: matchingResource.responseStart - matchingResource.requestStart,
                download: matchingResource.responseEnd - matchingResource.responseStart,
                total: matchingResource.duration
            };
            
            // Проверка переиспользования соединения
            const isConnectionReused = timing.tcp === 0 && timing.dns === 0;
            
            console.log(`%c🔌 TCP соединение переиспользовано: ${isConnectionReused ? '✅ ДА' : '❌ НЕТ'}`, 
                       isConnectionReused ? 'color: #4CAF50; font-weight: bold; font-size: 14px' : 'color: #FF9800; font-weight: bold; font-size: 14px');
            
            if (isConnectionReused) {
                console.log('%c💡 Отлично! CloudFlare эффективно использует существующее соединение', 'color: #4CAF50');
            } else {
                console.log('%c⚠️ Создано новое TCP соединение. Возможны проблемы с keep-alive', 'color: #FF9800');
            }
            
            console.table({
                'DNS Lookup': `${timing.dns.toFixed(2)}ms`,
                'TCP Handshake': `${timing.tcp.toFixed(2)}ms`,
                'SSL/TLS': `${timing.ssl.toFixed(2)}ms`,
                'Time to First Byte': `${timing.ttfb.toFixed(2)}ms`,
                'Download': `${timing.download.toFixed(2)}ms`,
                'Total': `${timing.total.toFixed(2)}ms`
            });
            
            // HTTP/2 или HTTP/3 проверка
            if (matchingResource.nextHopProtocol) {
                console.log(`%c🌐 Протокол: ${matchingResource.nextHopProtocol}`, 'color: #2196F3');
                
                if (matchingResource.nextHopProtocol.includes('h2') || matchingResource.nextHopProtocol.includes('h3')) {
                    console.log('%c✨ Используется современный протокол с мультиплексированием', 'color: #4CAF50');
                }
            }
            
            console.groupEnd();
        }
    },
    
    getStatistics() {
        const successful = this.requests.filter(r => r.success).length;
        const failed = this.requests.filter(r => !r.success).length;
        const avgDuration = this.requests.reduce((sum, r) => sum + (r.duration || 0), 0) / this.requests.length;
        
        console.groupCollapsed('%c📊 Статистика соединений', 'color: #9C27B0; font-weight: bold; font-size: 16px');
        console.log(`%c📈 Всего запросов: ${this.requests.length}`, 'color: #2196F3');
        console.log(`%c✅ Успешных: ${successful}`, 'color: #4CAF50');
        console.log(`%c❌ Ошибок: ${failed}`, 'color: #F44336');
        console.log(`%c⏱️ Средняя длительность: ${avgDuration.toFixed(2)}ms`, 'color: #FF9800');
        console.table(this.requests.map(r => ({
            'ID': r.id,
            'Метод': r.method,
            'Успех': r.success ? '✅' : '❌',
            'Длительность': r.duration ? `${r.duration}ms` : 'N/A'
        })));
        console.groupEnd();
    }
};

// Инициализация монитора
ConnectionMonitor.init();

// Загрузка персонажей
async function loadCharacters(filter = 'all', page = 1) {
    const startTime = Date.now();
    const requestId = ConnectionMonitor.logRequest(
        `${API_BASE_URL}/characters/list?filter_type=${filter}&page=${page}`,
        'GET',
        startTime
    );
    
    console.log(`%c🎯 Загрузка персонажей: filter=${filter}, page=${page}`, 'color: #00BCD4; font-weight: bold');
    
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
                'Expires': '0'
            }
        });

        console.log(`%c✅ Данные получены:`, 'color: #4CAF50', {
            'Всего персонажей': response.characters.length,
            'Текущая страница': response.current_page,
            'Всего страниц': response.total_pages,
            'Фильтр': filter
        });

        renderCharacters(response.characters);
        renderPagination(response.current_page, response.total_pages);
        
        currentPage = response.current_page;
        currentFilter = filter;
        
        ConnectionMonitor.logResponse(requestId, response);
        
    } catch (error) {
        console.error('%c💥 КРИТИЧЕСКАЯ ОШИБКА загрузки персонажей:', 'color: #F44336; font-weight: bold', {
            'Статус': error.status,
            'Текст': error.statusText,
            'Ответ': error.responseText,
            'Фильтр': filter,
            'Страница': page
        });
        
        ConnectionMonitor.logResponse(requestId, null, error);
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

// Глобальная функция для просмотра статистики в консоли
window.showConnectionStats = function() {
    ConnectionMonitor.getStatistics();
};

// Инициализация при загрузке страницы
$(document).ready(function() {
    console.log('%c💡 Для просмотра статистики соединений введите: showConnectionStats()', 'color: #2196F3; font-size: 12px');
    loadCharacters('all', 1);
});
