const API_BASE_URL = '';

let authToken = localStorage.getItem('authToken');
let currentUser = null;
let currentPage = 0;
const POSTS_PER_PAGE = 20;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        checkAuth();
    } else {
        showLoginModal();
    }

    setupEventListeners();
});

// Настройка обработчиков событий
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('createPostForm').addEventListener('submit', handleCreatePost);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('registerModal').style.display = 'flex';
    });
    document.getElementById('backToLoginBtn').addEventListener('click', () => {
        document.getElementById('registerModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'flex';
    });
    document.getElementById('loadMoreBtn').addEventListener('click', loadMorePosts);
}

// Проверка авторизации
async function checkAuth() {
    try {
        // Используем эндпоинт для получения текущего пользователя
        const response = await fetch(`/users/me/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            showMainContent();
            loadPosts();
        } else {
            localStorage.removeItem('authToken');
            showLoginModal();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        showLoginModal();
    }
}

// Вход
async function handleLogin(e) {
    e.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch(`/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            errorDiv.textContent = '';
            await checkAuth();
        } else {
            errorDiv.textContent = data.detail || 'Ошибка входа';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка подключения к серверу';
        console.error('Ошибка входа:', error);
    }
}

// Регистрация
async function handleRegister(e) {
    e.preventDefault();
    const login = document.getElementById('regLogin').value;
    const password = document.getElementById('regPassword').value;
    const nick = document.getElementById('regNick').value;
    const errorDiv = document.getElementById('registerError');

    try {
        const response = await fetch(`/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ login, password, nick, is_admin: false })
        });

        const data = await response.json();

        if (response.ok) {
            errorDiv.textContent = '';
            // Автоматически входим после регистрации
            await handleLogin({ preventDefault: () => {} });
            document.getElementById('login').value = login;
            document.getElementById('password').value = password;
        } else {
            errorDiv.textContent = data.detail || 'Ошибка регистрации';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка подключения к серверу';
        console.error('Ошибка регистрации:', error);
    }
}

// Выход
function handleLogout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showLoginModal();
    document.getElementById('postsContainer').innerHTML = '';
    currentPage = 0;
}

// Показать модальное окно входа
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
}

// Показать основной контент
function showMainContent() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('userNick').textContent = currentUser.nick;
}

// Загрузка постов
async function loadPosts(reset = false) {
    if (reset) {
        currentPage = 0;
        document.getElementById('postsContainer').innerHTML = '';
    }

    try {
        const response = await fetch(
            `/posts?skip=${currentPage * POSTS_PER_PAGE}&limit=${POSTS_PER_PAGE}`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        if (response.ok) {
            const posts = await response.json();
            displayPosts(posts);
            currentPage++;

            // Скрываем кнопку, если постов меньше лимита
            if (posts.length < POSTS_PER_PAGE) {
                document.getElementById('loadMoreBtn').style.display = 'none';
            }
        } else {
            console.error('Ошибка загрузки постов');
        }
    } catch (error) {
        console.error('Ошибка загрузки постов:', error);
    }
}

// Загрузить еще постов
function loadMorePosts() {
    loadPosts(false);
}

// Отображение постов
function displayPosts(posts) {
    const container = document.getElementById('postsContainer');

    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// Создание элемента поста
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.id = `post-${post.id}`;

    const date = new Date(post.date).toLocaleString('ru-RU');

    let fileHtml = '';
    if (post.file_url) {
        if (post.file_type?.startsWith('image/')) {
            fileHtml = `<div class="post-file">
                <img src="${post.file_url}" alt="Изображение" onclick="window.open('${post.file_url}', '_blank')">
            </div>`;
        } else if (post.file_type?.startsWith('video/')) {
            fileHtml = `<div class="post-file">
                <video controls>
                    <source src="${post.file_url}" type="${post.file_type}">
                    Ваш браузер не поддерживает видео.
                </video>
            </div>`;
        } else if (post.file_type?.startsWith('audio/')) {
            // Для аудио загружаем метаданные
            fileHtml = `<div class="post-file">
                <div class="audio-player" id="audio-player-${post.id}">
                    <div class="audio-loading">Загрузка метаданных...</div>
                </div>
            </div>`;
            // Загружаем метаданные асинхронно
            loadAudioMetadata(post);
        }
    }

    postDiv.innerHTML = `
        <div class="post-header">
            <span class="post-id">№${post.id}</span>
            <span class="post-date">${date}</span>
        </div>
        <div class="post-content">
            <div class="post-text">${escapeHtml(post.text)}</div>
            ${fileHtml}
        </div>
        <div class="post-footer">
            <div class="upvotes">
                <button class="upvote-btn" onclick="upvotePost(${post.id})">▲</button>
                <span>${post.upvotes}</span>
            </div>
        </div>
    `;

    return postDiv;
}

// Загрузка метаданных аудио
async function loadAudioMetadata(post) {
    try {
        const response = await fetch(`/posts/${post.id}/metadata`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const metadata = await response.json();
            displayAudioPlayer(post, metadata);
        } else {
            // Если метаданные не найдены, показываем обычный плеер
            displayAudioPlayer(post, null);
        }
    } catch (error) {
        console.error('Ошибка загрузки метаданных:', error);
        displayAudioPlayer(post, null);
    }
}

// Отображение аудио плеера с метаданными
function displayAudioPlayer(post, metadata) {
    const playerDiv = document.getElementById(`audio-player-${post.id}`);
    if (!playerDiv) return;

    // Используем base64 обложку напрямую, если она есть, иначе cover_url
    let coverImg = '';
    if (metadata?.cover) {
        // cover уже содержит data URL (data:image/jpeg;base64,...)
        coverImg = `<img src="${metadata.cover}" alt="Обложка" class="audio-cover">`;
    } else if (metadata?.cover_url) {
        // Если нет base64, используем URL
        coverImg = `<img src="${metadata.cover_url}" alt="Обложка" class="audio-cover">`;
    }
    
    const title = metadata?.title || post.file_name || 'Без названия';
    const artist = metadata?.artist || 'Неизвестный исполнитель';

    playerDiv.innerHTML = `
        ${coverImg}
        <div class="audio-info">
            <div class="audio-title">${escapeHtml(title)}</div>
            <div class="audio-artist">${escapeHtml(artist)}</div>
            <audio controls class="audio-player-element">
                <source src="${post.file_url}" type="${post.file_type}">
                Ваш браузер не поддерживает аудио.
            </audio>
        </div>
    `;
}

// Создание поста
async function handleCreatePost(e) {
    e.preventDefault();
    const text = document.getElementById('postText').value;
    const fileInput = document.getElementById('postFile');
    const file = fileInput.files[0];

    if (!text.trim()) {
        alert('Введите текст поста');
        return;
    }

    const formData = new FormData();
    formData.append('text', text);
    if (file) {
        formData.append('file', file);
    }

    try {
        const response = await fetch(`/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (response.ok) {
            const newPost = await response.json();
            // Очищаем форму
            document.getElementById('createPostForm').reset();
            // Перезагружаем посты с начала
            loadPosts(true);
        } else {
            const error = await response.json();
            alert(error.detail || 'Ошибка создания поста');
        }
    } catch (error) {
        console.error('Ошибка создания поста:', error);
        alert('Ошибка подключения к серверу');
    }
}

// Апвоут поста
async function upvotePost(postId) {
    try {
        const response = await fetch(`/posts/${postId}/upvote`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const updatedPost = await response.json();
            // Обновляем счетчик апвоутов
            const postElement = document.getElementById(`post-${postId}`);
            if (postElement) {
                const upvotesSpan = postElement.querySelector('.upvotes span');
                if (upvotesSpan) {
                    upvotesSpan.textContent = updatedPost.upvotes;
                }
            }
        }
    } catch (error) {
        console.error('Ошибка апвоута:', error);
    }
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

