let categoriesState = {
    loaded: false,
    loading: false,
    error: false
};

async function loadCategories() {
    // Если уже загружены, в процессе загрузки или была ошибка - ничего не делаем
    if (categoriesState.loaded || categoriesState.loading || categoriesState.error) {
        return;
    }
    
    categoriesState.loading = true;
    
    const categoriesContainer = document.querySelector('#offcanvasFilters .offcanvas-body .d-grid');
    const categoryHeader = categoriesContainer.querySelector('h6');
    
    if (!categoryHeader) {
        console.error('Заголовок категорий не найден');
        categoriesState.loading = false;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/characters/categories`, {
            method: 'GET',
            headers: {
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const categories = data.categories || [];

        // Создаем и вставляем кнопки
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.setAttribute('data-category', category);
            button.textContent = category;
            
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
            
            categoryHeader.insertAdjacentElement('afterend', button);
        });
        
        categoriesState.loaded = true;

    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        categoriesState.error = true;
        
        // Показываем сообщение об ошибке один раз
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center small text-danger mt-3';
        errorMessage.innerHTML = `
            😔 Категории в отпуске<br>
            Попробуйте перезагрузить страницу 🔄
        `;
        categoryHeader.insertAdjacentElement('afterend', errorMessage);
    } finally {
        categoriesState.loading = false;
    }
}

// Инициализация: загружаем категории при открытии фильтров
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
