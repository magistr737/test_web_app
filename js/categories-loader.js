let categoriesLoaded = false;
let categoriesLoading = false;

async function loadCategories() {
    // Предотвращаем повторную загрузку
    if (categoriesLoaded || categoriesLoading) {
        return;
    }
    
    categoriesLoading = true;
    
    const categoriesContainer = document.getElementById('categories-container');
    
    if (!categoriesContainer) {
        console.error('Контейнер категорий не найден');
        categoriesLoading = false;
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/characters/categories`, {
            method: 'GET',
            headers: {
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const categories = data.categories || [];

        // Очищаем контейнер
        categoriesContainer.innerHTML = '';

        // Добавляем кнопки категорий
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.setAttribute('data-category', category);
            button.textContent = category;
            
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
            
            categoriesContainer.appendChild(button);
        });
        
        categoriesLoaded = true;

    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        
        // Очищаем контейнер
        categoriesContainer.innerHTML = '';
        
        // Показываем сообщение об ошибке
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center small text-danger mt-3';
        errorMessage.innerHTML = `
            😔 Билин, не получится категориями воспользоваться<br>
            Перезагрузите страницу, и по идееееееее должно заработать :)
        `;
        categoriesContainer.appendChild(errorMessage);
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
