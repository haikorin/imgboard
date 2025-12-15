// Функция для отображения страницы поста
async function showPostPage(postId) {
    showPage('post-page');
    
    const postViewContent = document.getElementById('post-view-content');
    const commentsList = document.getElementById('comments-list');
    const commentFormContainer = document.getElementById('comment-form-container');
    
    // Показываем загрузку
    postViewContent.innerHTML = '<div class="loading">Загрузка поста...</div>';
    commentsList.innerHTML = '<div class="loading">Загрузка комментариев...</div>';
    
    const authToken = getAuthToken();
    
    try {
        // Загружаем пост
        const response = await fetch(`${API_BASE}/posts/${postId}`, {
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
            } : {}
        });
        
        if (response.ok) {
            const post = await response.json();
            // Отображаем пост
            const postElement = createPostElementForView(post);
            postViewContent.innerHTML = '';
            postViewContent.appendChild(postElement);
            
            // Показываем форму комментария, если пользователь авторизован
            if (authToken) {
                commentFormContainer.style.display = 'block';
                // Инициализируем обработчик формы
                initCommentForm(postId);
            } else {
                commentFormContainer.style.display = 'none';
            }
            
            // Загружаем комментарии
            loadComments(postId);
        } else {
            postViewContent.innerHTML = '<div class="error">Пост не найден</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки поста:', error);
        postViewContent.innerHTML = '<div class="error">Ошибка загрузки поста</div>';
    }
}

// Создание элемента поста для страницы просмотра
function createPostElementForView(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post post-view';
    postDiv.id = `post-view-${post.id}`;

    const date = new Date(post.date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Заголовок
    const header = document.createElement('div');
    header.className = 'post-header';
    header.innerHTML = `
        <span class="post-id">№${post.id}</span>
        <span class="post-date">${date}</span>
        ${post.author_nick ? `<span class="post-author">${escapeHtml(post.author_nick)}</span>` : ''}
    `;

    // Контент
    const content = document.createElement('div');
    content.className = 'post-content';
    
    // Текст поста
    const postText = post.text || '';
    if (postText.trim()) {
        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.textContent = postText;
        content.appendChild(textDiv);
    }
    
    // Файлы
    const files = post.files || [];
    if (files.length > 0) {
        // Аудио файлы
        const audioFiles = files.filter(f => f.file_type?.startsWith('audio/'));
        if (audioFiles.length > 0) {
            const audioContainer = document.createElement('div');
            audioContainer.className = 'audio-album';
            audioContainer.id = `audio-album-view-${post.id}`;
            
            const coverContainer = document.createElement('div');
            coverContainer.className = 'audio-cover-container';
            coverContainer.id = `audio-cover-view-${post.id}`;
            audioContainer.appendChild(coverContainer);
            
            if (audioFiles.length > 1) {
                const trackList = document.createElement('div');
                trackList.className = 'track-list';
                trackList.id = `track-list-view-${post.id}`;
                trackList.innerHTML = '<div class="track-list-title">Треки:</div>';
                
                audioFiles.forEach((file, index) => {
                    const trackItem = document.createElement('div');
                    trackItem.className = 'track-item';
                    trackItem.dataset.trackIndex = index;
                    trackItem.textContent = `${index + 1}. ${escapeHtml(file.file_name)}`;
                    trackItem.onclick = () => switchTrack(post.id, index, audioFiles, true);
                    trackList.appendChild(trackItem);
                });
                
                audioContainer.appendChild(trackList);
            }
            
            const playerContainer = document.createElement('div');
            playerContainer.className = 'audio-player';
            playerContainer.id = `audio-player-view-${post.id}`;
            playerContainer.innerHTML = '<div class="audio-loading">Загрузка метаданных...</div>';
            audioContainer.appendChild(playerContainer);
            
            content.appendChild(audioContainer);
            
            loadAudioMetadata({...post, file_url: audioFiles[0].file_url, file_type: audioFiles[0].file_type, file_name: audioFiles[0].file_name}, audioFiles, 0, true);
            loadAllTracksMetadata(post.id, audioFiles, true);
        }
        
        // Изображения
        const imageFiles = files.filter(f => f.file_type?.startsWith('image/'));
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
            fileDiv.appendChild(img);
            content.appendChild(fileDiv);
        });
        
        // Видео
        const videoFiles = files.filter(f => f.file_type?.startsWith('video/'));
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
            fileDiv.appendChild(video);
            content.appendChild(fileDiv);
        });
        
        // Другие файлы
        const otherFiles = files.filter(f => !f.file_type?.startsWith('audio/') && !f.file_type?.startsWith('image/') && !f.file_type?.startsWith('video/'));
        otherFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'post-file';
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
    
    // Футер с апвоутами
    const footer = document.createElement('div');
    footer.className = 'post-footer';
    footer.innerHTML = `
        <div class="votes">
            <button class="vote-btn upvote-btn" onclick="upvotePost(${post.id})" title="Апвоут">▲</button>
            <span class="vote-count">${post.upvotes}</span>
            <button class="vote-btn downvote-btn" onclick="downvotePost(${post.id})" title="Даунвоут">▼</button>
        </div>
    `;

    postDiv.appendChild(header);
    postDiv.appendChild(content);
    postDiv.appendChild(footer);

    return postDiv;
}

// Загрузка комментариев
async function loadComments(postId) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/comments`);
        
        if (response.ok) {
            const comments = await response.json();
            
            if (comments.length === 0) {
                commentsList.innerHTML = '<p class="no-comments">Комментариев пока нет</p>';
                return;
            }
            
            // Очищаем список
            commentsList.innerHTML = '';
            
            // Отображаем комментарии
            comments.forEach(comment => {
                if (!comment.is_deleted) {
                    const commentElement = createCommentElement(comment, postId);
                    commentsList.appendChild(commentElement);
                }
            });
        } else {
            commentsList.innerHTML = '<p class="no-comments">Ошибка загрузки комментариев</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        commentsList.innerHTML = '<p class="no-comments">Ошибка загрузки комментариев</p>';
    }
}

// Создание элемента комментария
function createCommentElement(comment, postId) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment';
    commentDiv.id = `comment-${comment.id}`;
    
    const date = new Date(comment.date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Проверяем, является ли комментарий созданным текущим пользователем
    const currentUserId = getUserId();
    const isOwnComment = comment.author_id && currentUserId && comment.author_id === currentUserId;
    
    let deleteButtonHtml = '';
    if (isOwnComment) {
        deleteButtonHtml = `<button class="delete-comment-btn" onclick="deleteComment(${postId}, ${comment.id})" title="Удалить комментарий">🗑️</button>`;
    }
    
    commentDiv.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${escapeHtml(comment.author_nick || 'Аноним')}</span>
            <span class="comment-date">${date}</span>
            ${deleteButtonHtml}
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
    `;
    
    return commentDiv;
}

// Отправка комментария
async function submitComment(postId) {
    const commentText = document.getElementById('comment-text');
    const text = commentText.value.trim();
    
    if (!text) {
        alert('Введите текст комментария');
        return;
    }
    
    const authToken = getAuthToken();
    if (!authToken) {
        alert('Необходима авторизация для отправки комментария');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok) {
            // Очищаем форму
            commentText.value = '';
            
            // Перезагружаем комментарии
            await loadComments(postId);
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert(errorData.detail || 'Ошибка отправки комментария');
        }
    } catch (error) {
        console.error('Ошибка отправки комментария:', error);
        alert('Ошибка отправки комментария: ' + error.message);
    }
}

// Удаление комментария
async function deleteComment(postId, commentId) {
    if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) {
        return;
    }
    
    const authToken = getAuthToken();
    if (!authToken) {
        alert('Необходима авторизация для удаления комментария');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            // Удаляем комментарий из DOM
            const commentElement = document.getElementById(`comment-${commentId}`);
            if (commentElement) {
                commentElement.remove();
            }
            
            // Проверяем, остались ли комментарии
            const commentsList = document.getElementById('comments-list');
            if (commentsList && commentsList.children.length === 0) {
                commentsList.innerHTML = '<p class="no-comments">Комментариев пока нет</p>';
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            alert(errorData.detail || 'Ошибка удаления комментария');
        }
    } catch (error) {
        console.error('Ошибка удаления комментария:', error);
        alert('Ошибка удаления комментария: ' + error.message);
    }
}

// Инициализация формы комментария
function initCommentForm(postId) {
    const commentForm = document.getElementById('comment-form');
    if (!commentForm) return;
    
    // Удаляем старый обработчик, если есть
    const newForm = commentForm.cloneNode(true);
    commentForm.parentNode.replaceChild(newForm, commentForm);
    
    // Добавляем новый обработчик
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitComment(postId);
    });
}

