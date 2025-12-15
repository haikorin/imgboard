// Управление темой
function initTheme() {
    const themeToggle = document.getElementById('nav-theme-toggle');
    const body = document.body;
    
    // Загружаем сохранённую тему
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        body.classList.add(savedTheme);
    }
    
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('light-theme');
        const currentTheme = body.classList.contains('light-theme') ? 'light-theme' : '';
        localStorage.setItem('theme', currentTheme);
    });
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}