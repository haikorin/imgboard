// Функции авторизации
function getAuthToken() {
    return localStorage.getItem('access_token');
}

function setAuthToken(token) {
    localStorage.setItem('access_token', token);
}

function clearAuthToken() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_nickname');
    localStorage.removeItem('user_id');
}

function getUserNickname() {
    return localStorage.getItem('user_nickname');
}

function setUserNickname(nickname) {
    localStorage.setItem('user_nickname', nickname);
}

function getUserId() {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId) : null;
}

function setUserId(userId) {
    if (userId) {
        localStorage.setItem('user_id', userId.toString());
    } else {
        localStorage.removeItem('user_id');
    }
}

async function login(loginValue, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginValue, password })
    });
    
    if (!res.ok) {
        throw new Error('Ошибка логина');
    }
    
    const data = await res.json();
    setAuthToken(data.access_token);
    
    // Получаем информацию о пользователе
    await fetchUserInfo();
    
    return data.access_token;
}

async function register(loginValue, password, nickname) {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            login: loginValue, 
            password, 
            nick: nickname,
            is_admin: false
        })
    });
    
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка регистрации');
    }
    
    // После регистрации автоматически входим
    await login(loginValue, password);
}

async function fetchUserInfo() {
    const authToken = getAuthToken();
    if (!authToken) return null;
    
    try {
        const res = await fetch(`${API_BASE}/users/me/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (res.ok) {
            const userData = await res.json();
            console.log('Получены данные пользователя:', userData);
            setUserNickname(userData.nick);
            if (userData.id) {
                setUserId(userData.id);
                console.log('User ID сохранён в localStorage:', getUserId());
            } else {
                console.warn('User ID не найден в ответе API');
            }
            return userData;
        }
    } catch (error) {
        console.error('Ошибка получения информации о пользователе:', error);
    }
    
    return null;
}

function logout() {
    clearAuthToken();
    updateAuthUI();
}