let currentPage = 0;
let allPosts = []; // Храним все загруженные посты
let currentCategory = 'all'; // Текущая выбранная категория
let currentSort = 'date'; // Текущая сортировка (date, upvotes)
let currentSortDirection = 'desc'; // Направление сортировки (asc, desc)

// Функция для получения токена динамически (использует функцию из auth.js, если доступна)
function getAuthToken() {
    return localStorage.getItem('access_token');
}

async function getData() {
    const response = await fetch(`${API_BASE}/posts`)
    const data = await response.json();
    return data
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Отображение постов
function displayPosts(posts) {
    const container = document.getElementById('posts');

    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// Сортировка постов
function sortPosts(posts, sortBy, direction) {
    const sortedPosts = [...posts];
    
    sortedPosts.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'date') {
            // Сортировка по дате создания
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            comparison = dateA - dateB;
        } else if (sortBy === 'upvotes') {
            // Сортировка по апвоутам
            comparison = (a.upvotes || 0) - (b.upvotes || 0);
        }
        
        // Применяем направление сортировки
        return direction === 'asc' ? comparison : -comparison;
    });
    
    return sortedPosts;
}

// Фильтрация постов по категории
function filterPostsByCategory(category) {
    currentCategory = category;
    applyFiltersAndSort();
}

// Применение фильтров и сортировки
function applyFiltersAndSort() {
    let filteredPosts = [];
    
    // Фильтрация по категории
    if (currentCategory === 'all') {
        filteredPosts = allPosts;
    } else if (currentCategory === 'image') {
        filteredPosts = allPosts.filter(post => post.file_type?.startsWith('image/'));
    } else if (currentCategory === 'video') {
        filteredPosts = allPosts.filter(post => post.file_type?.startsWith('video/'));
    } else if (currentCategory === 'audio') {
        filteredPosts = allPosts.filter(post => post.file_type?.startsWith('audio/'));
    } else if (currentCategory === 'text') {
        filteredPosts = allPosts.filter(post => !post.file_type || post.file_type === null);
    } else if (currentCategory === 'other') {
        filteredPosts = allPosts.filter(post => {
            const fileType = post.file_type;
            return fileType && 
                   !fileType.startsWith('image/') && 
                   !fileType.startsWith('video/') && 
                   !fileType.startsWith('audio/');
        });
    }
    
    // Применяем сортировку
    filteredPosts = sortPosts(filteredPosts, currentSort, currentSortDirection);
    
    // Очищаем контейнер и отображаем отфильтрованные посты
    const container = document.getElementById('posts');
    container.innerHTML = '';
    displayPosts(filteredPosts);
    
    // Обновляем активную категорию в UI
    updateActiveCategory(currentCategory);
    // Обновляем активную сортировку в UI
    updateActiveSort();
}

// Обновление активной категории в UI
function updateActiveCategory(category) {
    const categoryItems = document.querySelectorAll('.category-item');
    categoryItems.forEach(item => {
        if (item.dataset.category === category) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

async function loadPosts(reset = false) {
    if (reset) {
        currentPage = 0;
        document.getElementById('posts').innerHTML = '';
    }

    const authToken = getAuthToken();

    if (!authToken) {
        console.error('Токен не найден. Пожалуйста, войдите.');
        return;
    }

    try {
        const response = await fetch(
            `${API_BASE}/posts?skip=${currentPage * POSTS_PER_PAGE}&limit=${POSTS_PER_PAGE}&include_deleted=false`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );

        if (response.ok) {
            const posts = await response.json();
            
            if (reset) {
                allPosts = posts; // Сохраняем все посты
            } else {
                allPosts = allPosts.concat(posts); // Добавляем новые посты
            }
            
            // Применяем фильтр и сортировку к загруженным постам
            applyFiltersAndSort();
            currentPage++;

            // Скрываем кнопку, если постов меньше лимита
            if (posts.length < 10) {
                const loadMoreBtn = document.getElementById('loadMoreBtn');
                if (loadMoreBtn) {
                    loadMoreBtn.style.display = 'none';
                }
            }
        } else {
            console.error('Ошибка загрузки постов:', response.status);
        }
    } catch (error) {
        console.error('Ошибка загрузки постов:', error);
    }
}

function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.id = `post-${post.id}`;

    const date = new Date(post.date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Заголовок: номер поста (кликабельный), дата, ник (если есть)
    const header = document.createElement('div');
    header.className = 'post-header';
    header.innerHTML = `
        <a href="#" class="post-id-link" onclick="showPostPage(${post.id}); return false;">№${post.id}</a>
        <span class="post-date">${date}</span>
        ${post.author_nick ? `<span class="post-author">${escapeHtml(post.author_nick)}</span>` : ''}
    `;

    // Текст поста
    const content = document.createElement('div');
    content.className = 'post-content';
    
    // Текст поста (если есть)
    const postText = post.text || '';
    if (postText.trim()) {
        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.id = `post-text-${post.id}`;
        
        if (postText.length > MAX_TEXT_LENGTH) {
            // Обрезанный текст
            const shortText = postText.substring(0, MAX_TEXT_LENGTH);
            textDiv.textContent = shortText;
            textDiv.dataset.fullText = postText;
            textDiv.dataset.isShort = 'true';
            
            // Кнопка "читать далее..."
            const readMoreBtn = document.createElement('button');
            readMoreBtn.className = 'read-more-btn';
            readMoreBtn.textContent = 'читать далее...';
            readMoreBtn.onclick = () => togglePostText(post.id);
            
            content.appendChild(textDiv);
            content.appendChild(readMoreBtn);
        } else {
            // Полный текст, если он короткий
            textDiv.textContent = postText;
            content.appendChild(textDiv);
        }
    }

    // Файлы поста (новый способ - массив files)
    const files = post.files || [];
    
    // Если есть файлы в новом формате, используем их
    if (files.length > 0) {
        // Группируем файлы по типам
        const audioFiles = files.filter(f => f.file_type?.startsWith('audio/'));
        const imageFiles = files.filter(f => f.file_type?.startsWith('image/'));
        const videoFiles = files.filter(f => f.file_type?.startsWith('video/'));
        const otherFiles = files.filter(f => 
            !f.file_type?.startsWith('audio/') && 
            !f.file_type?.startsWith('image/') && 
            !f.file_type?.startsWith('video/')
        );
        
        // Аудио файлы - альбом с переключением треков
        if (audioFiles.length > 0) {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-album';
            audioContainer.id = `audio-album-${post.id}`;
            
            // Контейнер для обложки (будет заполнен после загрузки метаданных)
            const coverContainer = document.createElement('div');
            coverContainer.className = 'audio-cover-container';
            coverContainer.id = `audio-cover-${post.id}`;
            audioContainer.appendChild(coverContainer);
            
            // Список треков
            if (audioFiles.length > 1) {
                const trackList = document.createElement('div');
                trackList.className = 'track-list';
                trackList.id = `track-list-${post.id}`;
                trackList.innerHTML = '<div class="track-list-title">Треки:</div>';
                
                const shouldCollapse = audioFiles.length > MAX_VISIBLE_TRACKS;
                
                audioFiles.forEach((file, index) => {
                    const trackItem = document.createElement('div');
                    trackItem.className = 'track-item';
                    trackItem.dataset.trackIndex = index;
                    trackItem.textContent = `${index + 1}. ${escapeHtml(file.file_name)}`;
                    trackItem.onclick = () => switchTrack(post.id, index, audioFiles);
                    
                    // Скрываем треки после 4-го, если нужно сворачивать
                    if (shouldCollapse && index >= MAX_VISIBLE_TRACKS) {
                        trackItem.style.display = 'none';
                        trackItem.dataset.isHidden = 'true';
                    }
                    
                    trackList.appendChild(trackItem);
                });
                
                audioContainer.appendChild(trackList);
                
                // Добавляем кнопку "показать все", если треков больше 4
                if (shouldCollapse) {
                    const showMoreBtn = document.createElement('button');
                    showMoreBtn.className = 'read-more-btn';
                    showMoreBtn.id = `show-more-tracks-${post.id}`;
                    showMoreBtn.textContent = `показать все (${audioFiles.length - MAX_VISIBLE_TRACKS} ещё)`;
                    showMoreBtn.onclick = () => toggleTrackList(post.id, audioFiles.length);
                    audioContainer.appendChild(showMoreBtn);
                }
            }
            
            // Плеер для текущего трека
            const playerContainer = document.createElement('div');
            playerContainer.className = 'audio-player';
            playerContainer.id = `audio-player-${post.id}`;
            playerContainer.innerHTML = '<div class="audio-loading">Загрузка метаданных...</div>';
            audioContainer.appendChild(playerContainer);
            
            content.appendChild(audioContainer);
            
            // Загружаем метаданные для первого трека
            loadAudioMetadata({...post, file_url: audioFiles[0].file_url, file_type: audioFiles[0].file_type, file_name: audioFiles[0].file_name}, audioFiles);
            
            // Загружаем метаданные для всех треков, чтобы обновить их названия
            loadAllTracksMetadata(post.id, audioFiles);
        }
        
        // Изображения
        imageFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'post-file';
            const fileUrl = normalizeFileUrl(file.file_url);
            const img = document.createElement('img');
            img.src = fileUrl;
            img.alt = escapeHtml(file.file_name);
            img.loading = 'lazy';
            img.className = 'post-image';
            img.onclick = () => window.open(fileUrl, '_blank');
            img.onerror = function() {
                console.error('Ошибка загрузки изображения:', this.src);
                this.style.display = 'none';
            };
            fileDiv.appendChild(img);
            content.appendChild(fileDiv);
        });
        
        // Видео
        videoFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'post-file';
            const fileUrl = normalizeFileUrl(file.file_url);
            const video = document.createElement('video');
            video.controls = true;
            video.className = 'post-video';
            const source = document.createElement('source');
            source.src = fileUrl;
            source.type = file.file_type;
            video.appendChild(source);
            video.onerror = () => console.error('Ошибка загрузки видео');
            fileDiv.appendChild(video);
            content.appendChild(fileDiv);
        });
        
        // Другие файлы - ссылки для скачивания
        otherFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'post-file-download';
            const fileUrl = normalizeFileUrl(file.file_url);
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = file.file_name;
            link.className = 'download-link';
            link.textContent = `📥 ${escapeHtml(file.file_name)}`;
            if (file.file_size) {
                const size = formatFileSize(file.file_size);
                link.textContent += ` (${size})`;
            }
            fileDiv.appendChild(link);
            content.appendChild(fileDiv);
        });
    } 
    // Обратная совместимость со старым форматом (одиночный файл)
    else if (post.file_url) {
        let fileUrl = post.file_url;
        
        if (fileUrl.startsWith('/')) {
            fileUrl = `${API_BASE}${fileUrl}`;
        } else if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
            fileUrl = `${API_BASE}/${fileUrl}`;
        }
        
        fileUrl = fileUrl.replace(/^https:\/\//, 'http://');
        
        const fileDiv = document.createElement('div');
        fileDiv.className = 'post-file';
        
        if (post.file_type?.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = fileUrl;
            img.alt = 'Изображение';
            img.loading = 'lazy';
            img.className = 'post-image';
            img.onclick = () => window.open(fileUrl, '_blank');
            img.onerror = function() {
                console.error('Ошибка загрузки изображения:', this.src);
                this.style.display = 'none';
            };
            fileDiv.appendChild(img);
            content.appendChild(fileDiv);
        } else if (post.file_type?.startsWith('video/')) {
            const video = document.createElement('video');
            video.controls = true;
            video.className = 'post-video';
            const source = document.createElement('source');
            source.src = fileUrl;
            source.type = post.file_type;
            video.appendChild(source);
            video.onerror = () => console.error('Ошибка загрузки видео');
            fileDiv.appendChild(video);
            content.appendChild(fileDiv);
        } else if (post.file_type?.startsWith('audio/')) {
            // Для аудио создаём контейнер для обложки и плеера
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-player';
            audioContainer.id = `audio-player-${post.id}`;
            audioContainer.innerHTML = '<div class="audio-loading">Загрузка метаданных...</div>';
            fileDiv.appendChild(audioContainer);
            content.appendChild(fileDiv);
            // Загружаем метаданные асинхронно
            loadAudioMetadata(post);
        } else {
            // Другие файлы - ссылка для скачивания
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = post.file_name || 'file';
            link.className = 'download-link';
            link.textContent = `📥 ${escapeHtml(post.file_name || 'Скачать файл')}`;
            fileDiv.appendChild(link);
            content.appendChild(fileDiv);
        }
    }

    // Футер с апвоутами и даунвоутами
    const footer = document.createElement('div');
    footer.className = 'post-footer';
    
    // Проверяем, является ли пост созданным текущим пользователем
    let currentUserId = null;
    try {
        if (typeof getUserId === 'function') {
            currentUserId = getUserId();
        } else if (typeof window.getUserId === 'function') {
            currentUserId = window.getUserId();
        }
    } catch (e) {
        console.error('Ошибка получения ID пользователя:', e);
    }
    
    // Приводим к числам для корректного сравнения
    const authorId = post.author_id ? parseInt(post.author_id) : null;
    const userId = currentUserId ? parseInt(currentUserId) : null;
    
    // Отладочная информация
    console.log('Post ID:', post.id, 'Author ID:', authorId, 'Current User ID:', userId, 'Match:', authorId === userId);
    
    const isOwnPost = authorId && userId && authorId === userId;
    
    let deleteButtonHtml = '';
    if (isOwnPost) {
        deleteButtonHtml = `<button class="delete-btn" onclick="deletePost(${post.id})" title="Удалить пост">🗑️</button>`;
        // console.log('Кнопка удаления добавлена для поста', post.id);
    } else {
        console.log('Кнопка удаления НЕ добавлена для поста', post.id, '- isOwnPost:', isOwnPost);
    }
    
    footer.innerHTML = `
        <div class="votes">
            <button class="vote-btn upvote-btn" onclick="upvotePost(${post.id})" title="Апвоут">▲</button>
            <span class="vote-count">${post.upvotes}</span>
            <button class="vote-btn downvote-btn" onclick="downvotePost(${post.id})" title="Даунвоут">▼</button>
        </div>
        ${deleteButtonHtml}
    `;

    postDiv.appendChild(header);
    postDiv.appendChild(content);
    postDiv.appendChild(footer);

    return postDiv;
}


async function main() {
    
    const postData = await getData();
    let currentPage = 1;
    let amount = 10;

    function display(_arrData, _amountPerPage, _page) {
        const postElement = document.querySelector('.content')
        const start = _amountPerPage * _page;
        const end = start + _amountPerPag;
        const slice = _arrData.slice(start, end);
        slice.forEach(element => {
            const postEl = document.createElement("img")
            postEl.classList.add("post");
            postEl.src = element.file_url;
            postEl.alt = "Пост";
            postElement.appendChild(postEl);
        });
    }


    function displayPagination() {}

    function displayPaginationButton() {}

    createPostElement(1);
}

// Загрузка метаданных для всех треков альбома
async function loadAllTracksMetadata(postId, audioFiles, isViewPage = false) {
    if (!audioFiles || audioFiles.length === 0) return;
    
    const authToken = getAuthToken();
    const prefix = isViewPage ? 'view-' : '';
    
    // Загружаем метаданные для каждого трека параллельно
    const promises = audioFiles.map(async (file, index) => {
        if (!file.id) return; // Пропускаем, если нет ID файла
        
        try {
            const metadataUrl = `${API_BASE}/posts/${postId}/files/${file.id}/metadata`;
            const response = await fetch(metadataUrl, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const metadata = await response.json();
                // Обновляем название трека
                updateTrackName(postId, index, metadata?.title || file.file_name, isViewPage);
            }
        } catch (error) {
            console.error(`Ошибка загрузки метаданных для трека ${index}:`, error);
        }
    });
    
    // Ждём завершения всех загрузок
    await Promise.all(promises);
}

// Обновление названия трека в списке
function updateTrackName(postId, trackIndex, trackName, isViewPage = false) {
    const prefix = isViewPage ? 'view-' : '';
    const trackList = document.getElementById(`track-list-${prefix}${postId}`);
    if (!trackList) return;
    
    const trackItems = trackList.querySelectorAll('.track-item');
    if (trackItems[trackIndex]) {
        // Сохраняем оригинальный текст для номера трека
        const trackNumber = trackIndex + 1;
        trackItems[trackIndex].textContent = `${trackNumber}. ${escapeHtml(trackName)}`;
    }
}

// Загрузка метаданных аудио
async function loadAudioMetadata(post, audioFiles = null, trackIndex = 0, isViewPage = false) {
    try {
        // Получаем токен динамически
        const authToken = getAuthToken();
        
        // Если это альбом, используем file_id из audioFiles
        let metadataUrl;
        if (audioFiles && audioFiles[trackIndex]?.id) {
            // Для альбомов используем эндпоинт для конкретного файла
            metadataUrl = `${API_BASE}/posts/${post.id}/files/${audioFiles[trackIndex].id}/metadata`;
        } else {
            // Для одиночных файлов используем старый эндпоинт
            metadataUrl = `${API_BASE}/posts/${post.id}/metadata`;
        }
        
        const response = await fetch(metadataUrl, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const metadata = await response.json();
            displayAudioPlayer(post, metadata, audioFiles, trackIndex, isViewPage);
        } else {
            // Если метаданные не найдены, показываем обычный плеер
            displayAudioPlayer(post, null, audioFiles, trackIndex, isViewPage);
        }
    } catch (error) {
        console.error('Ошибка загрузки метаданных:', error);
        displayAudioPlayer(post, null, audioFiles, trackIndex, isViewPage);
    }
}

// Отображение аудио плеера с метаданными
function displayAudioPlayer(post, metadata, audioFiles = null, trackIndex = 0, isViewPage = false) {
    const prefix = isViewPage ? 'view-' : '';
    const playerDiv = document.getElementById(`audio-player-${prefix}${post.id}`);
    if (!playerDiv) return;

    // Определяем URL файла
    let fileUrl = post.file_url;
    if (audioFiles && audioFiles[trackIndex]) {
        fileUrl = normalizeFileUrl(audioFiles[trackIndex].file_url);
    } else {
        fileUrl = normalizeFileUrl(fileUrl);
    }

    // Обложка (если есть) - для альбомов выносим на уровень audio-album
    if (audioFiles) {
        // Это альбом - обложка должна быть в отдельном контейнере сверху
        const coverContainer = document.getElementById(`audio-cover-${prefix}${post.id}`);
        if (coverContainer) {
            if (metadata?.cover) {
                // cover - это data URL (base64), используем как есть
                const coverSrc = metadata.cover.startsWith('data:') 
                    ? metadata.cover 
                    : normalizeFileUrl(metadata.cover);
                coverContainer.innerHTML = `<img src="${coverSrc}" alt="Обложка" class="audio-cover">`;
            } else if (metadata?.cover_url) {
                // cover_url - это обычный URL, нормализуем
                coverContainer.innerHTML = `<img src="${normalizeFileUrl(metadata.cover_url)}" alt="Обложка" class="audio-cover">`;
            } else {
                coverContainer.innerHTML = '';
            }
        }
    } else {
        // Одиночный файл - обложка внутри плеера
        let coverImg = '';
        if (metadata?.cover) {
            // cover - это data URL (base64), используем как есть
            const coverSrc = metadata.cover.startsWith('data:') 
                ? metadata.cover 
                : normalizeFileUrl(metadata.cover);
            coverImg = `<img src="${coverSrc}" alt="Обложка" class="audio-cover">`;
        } else if (metadata?.cover_url) {
            // cover_url - это обычный URL, нормализуем
            coverImg = `<img src="${normalizeFileUrl(metadata.cover_url)}" alt="Обложка" class="audio-cover">`;
        }
        
        const title = metadata?.title || post.file_name || DEFAULT_TRACK_TITLE;
        const artist = metadata?.artist || DEFAULT_ARTIST;

        // Структура: обложка сверху, под ней плеер
        playerDiv.innerHTML = `
            ${coverImg}
            <audio controls class="audio-player-element">
                <source src="${fileUrl}" type="${post.file_type}">
                Ваш браузер не поддерживает аудио.
            </audio>
            <div class="audio-info">
                <div class="audio-title">${escapeHtml(title)}</div>
                <div class="audio-artist">${escapeHtml(artist)}</div>
            </div>
        `;
        return;
    }
    
    // Для альбомов - только плеер и информация о треке
    const title = metadata?.title || post.file_name || 'Без названия';
    const artist = metadata?.artist || 'Неизвестный исполнитель';

    playerDiv.innerHTML = `
        <audio controls class="audio-player-element">
            <source src="${fileUrl}" type="${post.file_type}">
            Ваш браузер не поддерживает аудио.
        </audio>
        <div class="audio-info">
            <div class="audio-title">${escapeHtml(title)}</div>
            <div class="audio-artist">${escapeHtml(artist)}</div>
        </div>
    `;
}


// Функция для нормализации URL
function normalizeUrl(url) {
    if (!url) return '';
    
    // Если URL уже полный, заменяем HTTPS на HTTP
    if (url.startsWith('https://')) {
        return url.replace('https://', 'http://');
    }
    
    // Если относительный, добавляем базовый URL
    if (url.startsWith('/')) {
        return `${API_BASE}${url}`;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `${API_BASE}/${url}`;
    }
    
    return url;
}

// Функция для нормализации URL файлов
function normalizeFileUrl(url) {
    if (!url) return '';
    let fileUrl = url;
    
    if (fileUrl.startsWith('/')) {
        fileUrl = `${API_BASE}${fileUrl}`;
    } else if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
        fileUrl = `${API_BASE}/${fileUrl}`;
    }
    
    return fileUrl.replace(/^https:\/\//, 'http://');
}

// Функция для форматирования размера файла
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Функция для переключения трека в альбоме
function switchTrack(postId, trackIndex, audioFiles, isViewPage = false) {
    const prefix = isViewPage ? 'view-' : '';
    const trackItems = document.querySelectorAll(`#audio-album-${prefix}${postId} .track-item`);
    trackItems.forEach((item, index) => {
        if (index === trackIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const currentFile = audioFiles[trackIndex];
    const post = {
        id: postId,
        file_url: currentFile.file_url,
        file_type: currentFile.file_type,
        file_name: currentFile.file_name
    };
    
    // Обновляем плеер
    const playerContainer = document.getElementById(`audio-player-${prefix}${postId}`);
    if (playerContainer) {
        playerContainer.innerHTML = '<div class="audio-loading">Загрузка метаданных...</div>';
        loadAudioMetadata(post, audioFiles, trackIndex, isViewPage);
    }
}

// Функция для переключения отображения текста поста
function togglePostText(postId) {
    const textDiv = document.getElementById(`post-text-${postId}`);
    if (!textDiv) return;
    
    const isShort = textDiv.dataset.isShort === 'true';
    const fullText = textDiv.dataset.fullText;
    
    if (isShort) {
        // Показываем полный текст
        textDiv.textContent = fullText;
        textDiv.dataset.isShort = 'false';
        
        // Меняем кнопку на "свернуть"
        const readMoreBtn = textDiv.nextElementSibling;
        if (readMoreBtn && readMoreBtn.classList.contains('read-more-btn')) {
            readMoreBtn.textContent = 'свернуть';
        }
    } else {
        // Показываем обрезанный текст
        const shortText = fullText.substring(0, 500);
        textDiv.textContent = shortText;
        textDiv.dataset.isShort = 'true';
        
        // Меняем кнопку на "читать далее..."
        const readMoreBtn = textDiv.nextElementSibling;
        if (readMoreBtn && readMoreBtn.classList.contains('read-more-btn')) {
            readMoreBtn.textContent = 'читать далее...';
        }
    }
}

// Функция для переключения отображения списка треков
function toggleTrackList(postId, totalTracks) {
    const trackList = document.getElementById(`track-list-${postId}`);
    const showMoreBtn = document.getElementById(`show-more-tracks-${postId}`);
    
    if (!trackList || !showMoreBtn) return;
    
    const trackItems = trackList.querySelectorAll('.track-item[data-is-hidden="true"]');
    const isCollapsed = trackItems.length > 0 && trackItems[0].style.display === 'none';
    
    if (isCollapsed) {
        // Показываем все треки
        trackItems.forEach(item => {
            item.style.display = '';
        });
        showMoreBtn.textContent = 'свернуть';
    } else {
        // Скрываем треки после 4-го
        trackItems.forEach(item => {
            item.style.display = 'none';
        });
        const hiddenCount = totalTracks - MAX_VISIBLE_TRACKS;
        showMoreBtn.textContent = `показать все (${hiddenCount} ещё)`;
    }
}

// Функция для даунвоута поста
async function downvotePost(postId) {
    const authToken = getAuthToken();
    
    if (!authToken) {
        alert('Необходима авторизация для голосования');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/downvote`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const updatedPost = await response.json();
            
            // Обновляем пост в массиве allPosts
            const postIndex = allPosts.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
                allPosts[postIndex].upvotes = updatedPost.upvotes;
            }
            
            // Если сортировка по апвоутам, пересортируем
            if (currentSort === 'upvotes') {
                applyFiltersAndSort();
            } else {
                // Иначе просто обновляем счётчик
                const voteCount = document.querySelector(`#post-${postId} .vote-count`);
                if (voteCount) {
                    voteCount.textContent = updatedPost.upvotes;
                }
            }
        } else {
            console.error('Ошибка даунвоута:', response.status);
        }
    } catch (error) {
        console.error('Ошибка даунвоута:', error);
    }
}

// Удаление поста
async function deletePost(postId) {
    const authToken = getAuthToken();
    
    if (!authToken) {
        alert('Необходима авторизация для удаления поста');
        return;
    }
    
    // Подтверждение удаления
    if (!confirm('Вы уверены, что хотите удалить этот пост?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            // Удаляем пост из DOM
            const postElement = document.getElementById(`post-${postId}`);
            if (postElement) {
                postElement.remove();
            }
            
            // Удаляем пост из массива allPosts
            const postIndex = allPosts.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
                allPosts.splice(postIndex, 1);
            }
            
            alert('Пост успешно удалён');
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert(errorData.detail || 'Ошибка удаления поста');
        }
    } catch (error) {
        console.error('Ошибка удаления поста:', error);
        alert('Ошибка удаления поста: ' + error.message);
    }
}

async function upvotePost(postId) {
    // Примечание: эндпоинт не требует авторизации, но оставляем проверку на будущее
    const authToken = getAuthToken();
    
    try {
        const headers = {};
        // Отправляем токен, если он есть (для будущей авторизации)
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(`${API_BASE}/posts/${postId}/upvote`, {
            method: 'POST',
            headers: headers
        });
        
        if (response.ok) {
            const updatedPost = await response.json();
            
            // Обновляем пост в массиве allPosts
            const postIndex = allPosts.findIndex(p => p.id === postId);
            if (postIndex !== -1) {
                allPosts[postIndex].upvotes = updatedPost.upvotes;
            }
            
            // Если сортировка по апвоутам, пересортируем
            if (currentSort === 'upvotes') {
                applyFiltersAndSort();
            } else {
                // Иначе просто обновляем счётчик
                const voteCount = document.querySelector(`#post-${postId} .vote-count`);
                if (voteCount) {
                    voteCount.textContent = updatedPost.upvotes;
                }
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Ошибка апвоута:', response.status, errorData);
            alert(errorData.detail || 'Ошибка при голосовании');
        }
    } catch (error) {
        console.error('Ошибка апвоута:', error);
        alert('Ошибка при голосовании: ' + error.message);
    }
}


// Обновление активной сортировки в UI
function updateActiveSort() {
    const sortItems = document.querySelectorAll('.sort-item');
    const sortButtons = document.querySelectorAll('.sort-btn');
    
    // Обновляем активный элемент сортировки
    sortItems.forEach(item => {
        if (item.dataset.sort === currentSort) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Обновляем активную кнопку направления
    sortButtons.forEach(btn => {
        const sortItem = btn.closest('.sort-item');
        if (sortItem && sortItem.dataset.sort === currentSort) {
            if (btn.dataset.sortDirection === currentSortDirection) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        } else {
            btn.classList.remove('active');
        }
    });
}

// Инициализация фильтрации по категориям
function initCategoryFilter() {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            filterPostsByCategory(category);
        });
    });
    
    // Устанавливаем "Всё" как активную категорию по умолчанию
    updateActiveCategory('all');
}

// Инициализация сортировки
function initSort() {
    const sortButtons = document.querySelectorAll('.sort-btn');
    
    sortButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Предотвращаем всплытие события
            
            const sortItem = btn.closest('.sort-item');
            if (!sortItem) return;
            
            const sortBy = sortItem.dataset.sort;
            const direction = btn.dataset.sortDirection;
            
            currentSort = sortBy;
            currentSortDirection = direction;
            
            applyFiltersAndSort();
        });
    });
    
    // Устанавливаем сортировку по умолчанию
    updateActiveSort();
}
