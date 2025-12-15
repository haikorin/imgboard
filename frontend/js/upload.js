// Функция для создания поста
async function createPost(text, files) {
    const authToken = getAuthToken();
    
    if (!authToken) {
        throw new Error('Необходима авторизация');
    }
    
    const formData = new FormData();
    formData.append('text', text);
    
    // Поддержка нескольких файлов
    if (files && files.length > 0) {
        files.forEach(file => {
            if (file) {
                formData.append('files', file);
            }
        });
    }
    
    const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка создания поста');
    }
    
    return await response.json();
}

// Функция для переключения страниц
function showPage(pageId) {
    // Получаем контейнер с постами
    const postsContainer = document.getElementById('posts');
    
    // Скрываем все страницы
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => {
        page.style.display = 'none';
    });
    
    // Показываем нужную страницу
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    // Управляем видимостью контейнера с постами
    if (pageId === 'upload-page' || pageId === 'post-page') {
        // При открытии формы создания поста или просмотра поста - скрываем посты
        if (postsContainer) {
            postsContainer.style.display = 'none';
        }
    } else {
        // При возврате на страницу постов - показываем посты с grid layout
        if (postsContainer) {
            postsContainer.style.display = 'grid'; // Восстанавливаем grid layout
        }
    }
}

// Инициализация страницы загрузки
function initUploadPage() {
    const uploadForm = document.getElementById('create-post-form');
    const cancelBtn = document.getElementById('cancel-upload-btn');
    
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const text = document.getElementById('post-text').value;
            const fileInput = document.getElementById('post-file');
            const files = Array.from(fileInput.files); // Поддержка нескольких файлов
            
            // Проверяем, что есть либо текст, либо файлы
            if (!text.trim() && files.length === 0) {
                alert('Введите текст поста или загрузите файл');
                return;
            }
            
            try {
                await createPost(text, files);
                alert('Пост успешно создан!');
                
                // Очищаем форму
                uploadForm.reset();
                
                // Переключаемся на страницу постов
                showPage('posts-page');
                
                // Обновляем посты
                if (typeof loadPosts === 'function') {
                    loadPosts(true);
                }
            } catch (error) {
                alert('Ошибка создания поста: ' + error.message);
            }
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('create-post-form').reset();
            showPage('posts-page');
        });
    }
}

// Инициализация навигации
function initNavigation() {
    const navImgboard = document.getElementById('nav-imgboard');
    const navUpload = document.getElementById('nav-upload');
    
    if (navImgboard) {
        navImgboard.addEventListener('click', () => {
            showPage('posts-page');
        });
    }
    
    if (navUpload) {
        navUpload.addEventListener('click', () => {
            const authToken = getAuthToken();
            if (!authToken) {
                alert('Необходима авторизация для создания поста');
                return;
            }
            showPage('upload-page');
        });
    }
}