let categoriesLoaded = false;
let categoriesLoading = false;

async function loadCategories() {
    // Предотвращаем повторную загрузку
    if (categoriesLoaded || categoriesLoading) {
        return;
    }
    
    categoriesLoading = true;
    
    const categoriesContainer = document.querySelector('#offcanvasFilters .offcanvas-body .d-grid');
    const categoryHeader = categoriesContainer.querySelector('h6');
    
    if (!categoryHeader) {
        console.error('Заголовок категорий не найден');
        categoriesLoading = false;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/characters/categories`, {
            method: 'GET',
            headers: {
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const categories = data.categories || [];

        // Удаляем старые кнопки категорий (если есть)
        const existingButtons = categoriesContainer.querySelectorAll('[data-category]');
        existingButtons.forEach(btn => btn.remove());

        // Создаем DocumentFragment для оптимизации DOM-операций
        const fragment = document.createDocumentFragment();
        
        // Вставляем все кнопки после заголовка "Категории"
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.setAttribute('data-category', category);
            button.textContent = category;
            
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
            
            // Вставляем после заголовка
            categoryHeader.insertAdjacentElement('afterend', button);
        });
        
        // Вставляем после заголовка "Категории"
        categoryHeader.insertAdjacentElement('afterend', fragment.firstChild);
        if (fragment.childNodes.length > 0) {
            let lastInserted = categoryHeader.nextElementSibling;
            fragment.childNodes.forEach(node => {
                lastInserted.insertAdjacentElement('afterend', node);
                lastInserted = node;
            });
        }
        
        categoriesLoaded = true;

    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        
        // Удаляем существующие кнопки категорий
        const existingButtons = categoriesContainer.querySelectorAll('[data-category]');
        existingButtons.forEach(btn => btn.remove());
        
        // Показываем сообщение об ошибке после заголовка
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center small text-danger mt-3';
        errorMessage.innerHTML = `
            😔 Билин, не получится категориями воспользоваться<br>
            Перезагрузите страницу, и по идееееееее должно заработать :)
        `;
        categoryHeader.insertAdjacentElement('afterend', errorMessage);
    } finally {
        categoriesLoading = false;
    }
}

// Ленивая загрузка при открытии offcanvas с фильтрами
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCategoriesLoader);
} else {
    initCategoriesLoader();
}

function initCategoriesLoader() {
    const filtersOffcanvas = document.getElementById('offcanvasFilters');
    
    if (filtersOffcanvas) {
        filtersOffcanvas.addEventListener('show.bs.offcanvas', loadCategories);
    }
}
