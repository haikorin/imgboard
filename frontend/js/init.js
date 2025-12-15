// Функция для обновления UI в зависимости от статуса авторизации
function updateAuthUI() {
    const authToken = getAuthToken();
    const authContainer = document.getElementById('auth-container');
    const userInfo = document.getElementById('user-info');
    const userNickname = document.getElementById('user-nickname');
    
    if (authToken) {
        // Пользователь авторизован
        authContainer.style.display = 'none';
        userInfo.style.display = 'flex';
        const nickname = getUserNickname();
        const userId = getUserId();
        if (nickname && userId) {
            userNickname.textContent = nickname;
        } else {
            // Если ник или ID не сохранены, загружаем информацию о пользователе
            fetchUserInfo().then(() => {
                userNickname.textContent = getUserNickname();
                console.log('User ID после fetchUserInfo:', getUserId());
            });
        }
    } else {
        // Пользователь не авторизован
        authContainer.style.display = 'flex';
        userInfo.style.display = 'none';
        // Скрываем форму регистрации
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'flex';
    }
}

// Переключение между формами логина и регистрации
document.getElementById('show-register-btn').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'flex';
});

document.getElementById('show-login-btn').addEventListener('click', () => {
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'flex';
});

// Обработка формы логина
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const loginValue = form.login.value;
    const passwordValue = form.password.value;

    try {
        await login(loginValue, passwordValue);
        updateAuthUI();
        // Перезагружаем посты после успешного входа
        if (typeof loadPosts === 'function') {
            loadPosts(true);
        }
    } catch (error) {
        alert('Ошибка логина: ' + error.message);
    }
});

// Обработка формы регистрации
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const loginValue = form.reg_login.value;
    const passwordValue = form.reg_password.value;
    const nicknameValue = form.reg_nickname.value;

    try {
        await register(loginValue, passwordValue, nicknameValue);
        updateAuthUI();
        // Перезагружаем посты после успешной регистрации и входа
        if (typeof loadPosts === 'function') {
            loadPosts(true);
        }
    } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
    }
});

// Обработка кнопки выхода
document.getElementById('logout-btn').addEventListener('click', () => {
    logout();
    if (typeof loadPosts === 'function') {
        document.getElementById('posts').innerHTML = '';
    }
});

// Инициализация UI при загрузке страницы
updateAuthUI();

// Загружаем информацию о пользователе и посты при загрузке страницы (если есть токен)
if (getAuthToken()) {
    // Убеждаемся, что user_id сохранён
    if (!getUserId() && typeof fetchUserInfo === 'function') {
        fetchUserInfo().then(() => {
            console.log('User ID после fetchUserInfo при загрузке:', getUserId());
            // Загружаем посты после получения информации о пользователе
            if (typeof loadPosts === 'function') {
                loadPosts();
            }
        });
    } else {
        // Если user_id уже есть, просто загружаем посты
        if (typeof loadPosts === 'function') {
            loadPosts();
        }
    }
}

if (typeof initNavigation === 'function') {
    initNavigation();
}

if (typeof initUploadPage === 'function') {
    initUploadPage();
}

// Инициализация фильтрации по категориям
if (typeof initCategoryFilter === 'function') {
    initCategoryFilter();
}

// Инициализация сортировки
if (typeof initSort === 'function') {
    initSort();
}

// Обработчик кнопки "Назад" на странице поста
document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-to-posts-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            showPage('posts-page');
        });
    }
});