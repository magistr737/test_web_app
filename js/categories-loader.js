// /js/categories-loader.js

const API_BASE_URL = 'https://testapi.capyhub.su/v1/characters';

async function loadCategories() {
    const categoriesContainer = document.querySelector('#offcanvasFilters .offcanvas-body');
    const categorySection = categoriesContainer.querySelector('h6').parentElement;
    
    try {
        const response = await fetch(`${API_BASE_URL}/categories`, {
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

        // Удаляем статичные кнопки категорий
        const staticButtons = categorySection.querySelectorAll('[data-category]');
        staticButtons.forEach(btn => btn.remove());

        // Создаем и вставляем кнопки для каждой категории
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.setAttribute('data-category', category);
            button.textContent = category;
            
            // Добавляем обработчик клика
            button.addEventListener('click', function() {
                document.querySelectorAll('[data-category]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
            
            categorySection.appendChild(button);
        });

    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
        
        // Удаляем статичные кнопки
        const staticButtons = categorySection.querySelectorAll('[data-category]');
        staticButtons.forEach(btn => btn.remove());
        
        // Показываем сообщение об ошибке
        const errorMessage = document.createElement('p');
        errorMessage.className = 'text-center small text-danger mt-3';
        errorMessage.innerHTML = `
            😔 Билин, не получится категориями воспользоваться<br>
            Перезагрузите страницу, и по идееееееее должно заработать :)
        `;
        categorySection.appendChild(errorMessage);
    }
}

// Запускаем загрузку категорий при загрузке страницы
document.addEventListener('DOMContentLoaded', loadCategories);
