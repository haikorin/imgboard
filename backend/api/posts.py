from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Request, Header
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from urllib.parse import quote
from database import get_db
from models import Post, User, PostFile
from schemas import PostResponse, PostFileResponse
from dependencies import get_current_user
from file_utils import save_uploaded_file, delete_file, get_file_path, SUPPORTED_TYPES

router = APIRouter(prefix="/posts", tags=["posts"])


def add_file_url_to_post(post: Post, request: Request) -> dict:
    """Добавляет file_url, files и author_nick к посту для отображения в Swagger"""
    base_url = str(request.base_url).rstrip('/')
    
    post_dict = {
        "id": post.id,
        "text": post.text,
        # Старые поля для обратной совместимости
        "file_path": post.file_path,
        "file_type": post.file_type,
        "file_name": post.file_name,
        "file_url": None,
        # Новые поля
        "files": [],
        "date": post.date,
        "is_deleted": post.is_deleted,
        "upvotes": post.upvotes,
        "author_nick": None,
        "author_id": post.user_id if post.user_id else None
    }
    
    # Добавляем URL для старого файла, если он есть (обратная совместимость)
    if post.file_path:
        post_dict["file_url"] = f"{base_url}/posts/{post.id}/file"
    
    # Добавляем информацию о новых файлах
    if hasattr(post, 'files') and post.files:
        for file in post.files:
            file_dict = {
                "id": file.id,
                "file_path": file.file_path,
                "file_type": file.file_type,
                "file_name": file.file_name,
                "file_url": f"{base_url}/posts/{post.id}/files/{file.id}",
                "file_size": file.file_size,
                "order": file.order
            }
            post_dict["files"].append(file_dict)
    
    # Добавляем ник пользователя, если связь загружена
    if post.user:
        post_dict["author_nick"] = post.user.nick
    
    return post_dict


@router.get("", response_model=List[PostResponse])
def get_posts(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_deleted: bool = Query(False, description="Включить удалённые посты"),
    db: Session = Depends(get_db)
):
    """Получить список постов"""
    query = db.query(Post).options(joinedload(Post.user), joinedload(Post.files))
    
    if not include_deleted:
        query = query.filter(Post.is_deleted == False)
    
    posts = query.order_by(Post.date.desc()).offset(skip).limit(limit).all()
    
    # Добавляем file_url к каждому посту
    return [add_file_url_to_post(post, request) for post in posts]


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: int, request: Request, db: Session = Depends(get_db)):
    """Получить пост по ID"""
    post = db.query(Post).options(joinedload(Post.user), joinedload(Post.files)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    # Добавляем file_url для отображения в Swagger
    return add_file_url_to_post(post, request)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    request: Request,
    text: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),  # Теперь принимаем список файлов
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый пост с возможностью загрузки одного или нескольких файлов"""
    
    # Проверяем, что есть либо текст, либо файлы
    if not text and (not files or len(files) == 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать текст поста или загрузить хотя бы один файл"
        )
    
    new_post = Post(
        text=text if text and text.strip() else None,  # Сохраняем None вместо пустой строки
        user_id=current_user.id
    )
    
    db.add(new_post)
    db.flush()  # Получаем ID поста
    
    # Сохраняем все файлы
    for order, file in enumerate(files):
        if file and file.filename:  # Проверяем, что файл действительно передан
            try:
                file_path, file_type, file_name, file_size = await save_uploaded_file(file)
                
                # Создаём запись о файле
                post_file = PostFile(
                    post_id=new_post.id,
                    file_path=file_path,
                    file_type=file_type,
                    file_name=file_name,
                    file_size=file_size,
                    order=order
                )
                db.add(post_file)
                
                # Для обратной совместимости сохраняем первый файл в старые поля
                if order == 0:
                    new_post.file_path = file_path
                    new_post.file_type = file_type
                    new_post.file_name = file_name
            except Exception as e:
                # Если ошибка при сохранении файла, пропускаем его
                print(f"Ошибка при сохранении файла {file.filename}: {e}")
                continue
    
    db.commit()
    db.refresh(new_post)
    
    # Загружаем пользователя и файлы для отображения
    db.refresh(new_post, ['user', 'files'])
    
    # Добавляем file_url для отображения в Swagger
    return add_file_url_to_post(new_post, request)


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: int,
    request: Request,
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить пост (можно обновить текст и/или файл)"""
    post = db.query(Post).options(joinedload(Post.user), joinedload(Post.files)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    if post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя обновить удалённый пост"
        )
    
    # Обновляем текст, если передан
    if text is not None:
        post.text = text
    
    # Обновляем файл, если загружен новый
    if file:
        # Удаляем старый файл, если он был
        if post.file_path:
            delete_file(post.file_path)
        
        # Сохраняем новый файл
        file_path, file_type, file_name, file_size = await save_uploaded_file(file)
        
        # Удаляем все старые файлы из PostFile
        db.query(PostFile).filter(PostFile.post_id == post_id).delete()
        
        # Создаём новую запись о файле
        post_file = PostFile(
            post_id=post.id,
            file_path=file_path,
            file_type=file_type,
            file_name=file_name,
            file_size=file_size,
            order=0
        )
        db.add(post_file)
        
        # Для обратной совместимости сохраняем в старые поля
        post.file_path = file_path
        post.file_type = file_type
        post.file_name = file_name
    
    db.commit()
    db.refresh(post, ['user', 'files'])
    
    # Добавляем file_url для отображения в Swagger
    return add_file_url_to_post(post, request)


@router.delete("/{post_id}", response_model=PostResponse)
def delete_post(
    post_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить пост (soft delete) - только свой пост"""
    post = db.query(Post).options(joinedload(Post.user), joinedload(Post.files)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    # Проверяем, что пользователь может удалять только свои посты
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете удалять только свои посты"
        )
    
    if post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пост уже удалён"
        )
    
    # Удаляем файл с диска при удалении поста (старый способ)
    if post.file_path:
        delete_file(post.file_path)
    
    # Удаляем все файлы из PostFile
    for post_file in post.files:
        if post_file.file_path:
            delete_file(post_file.file_path)
    
    post.is_deleted = True
    post.file_path = None
    post.file_type = None
    post.file_name = None
    db.commit()
    db.refresh(post, ['user', 'files'])
    
    # Добавляем file_url (будет None, так как файл удалён)
    return add_file_url_to_post(post, request)

@router.post("/{post_id}/upvote", response_model=PostResponse)
def upvote_post(
    post_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Увеличить количество апвоутов поста"""
    post = db.query(Post).options(joinedload(Post.user)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    if post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя апвоутить удалённый пост"
        )
    
    post.upvotes += 1
    db.commit()
    db.refresh(post, ['user'])
    
    # Добавляем file_url для отображения в Swagger
    return add_file_url_to_post(post, request)

@router.post("/{post_id}/downvote", response_model=PostResponse)
def downvote_post(
    post_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Уменьшить количество апвоутов поста (даунвоут)"""
    post = db.query(Post).options(joinedload(Post.user), joinedload(Post.files)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    if post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя даунвоутить удалённый пост"
        )
    
    post.upvotes -= 1
    db.commit()
    db.refresh(post, ['user', 'files'])
    
    # Добавляем file_url для отображения в Swagger
    return add_file_url_to_post(post, request)


@router.get(
    "/{post_id}/file",
    responses={
        200: {
            "content": {
                "image/jpeg": {},
                "image/png": {},
                "image/gif": {},
                "image/webp": {},
                "video/mp4": {},
                "video/webm": {},
                "video/ogg": {},
                "video/quicktime": {},
                "audio/mpeg": {},
                "audio/ogg": {},
                "audio/wav": {},
                "audio/webm": {},
                "audio/flac": {},
                "audio/x-flac": {},
            },
            "description": "Файл поста. Swagger UI автоматически отобразит изображения и видео. Примечание: FLAC может не воспроизводиться в некоторых браузерах из-за ограничений поддержки формата."
        }
    }
)
def get_post_file(
    post_id: int,
    range_header: Optional[str] = Header(None, alias="Range"),
    db: Session = Depends(get_db)
):
    """
    Получить файл поста
    
    **Для просмотра в Swagger UI:**
    - Изображения (JPEG, PNG, GIF, WebP) будут отображены автоматически
    - Видео (MP4, WebM, OGG, MOV) можно воспроизвести прямо в Swagger UI
    - Аудио файлы (MP3, OGG, WAV, WebM) можно воспроизвести в Swagger UI
    - FLAC файлы могут не воспроизводиться в некоторых браузерах (Chrome, Firefox не поддерживают FLAC в HTML5 audio)
      В этом случае файл можно скачать и воспроизвести во внешнем плеере
    - Или используйте file_url из ответа GET /posts/{id} для прямого доступа
    """
    post = db.query(Post).options(joinedload(Post.files)).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    # Сначала проверяем новые файлы (из post_files)
    post_file = None
    if post.files and len(post.files) > 0:
        # Используем первый файл из списка
        post_file = post.files[0]
        file_path = get_file_path(post_file.file_path)
        media_type = post_file.file_type or "application/octet-stream"
        filename = post_file.file_name or "file"
    # Если новых файлов нет, используем старые поля (обратная совместимость)
    elif post.file_path:
        file_path = get_file_path(post.file_path)
        media_type = post.file_type or "application/octet-stream"
        filename = post.file_name or "file"
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="У поста нет файла"
        )
    
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    # Для изображений, видео и аудио используем inline, чтобы Swagger UI мог их отобразить
    # Для других файлов - attachment (скачивание)
    is_media = (
        media_type.startswith('image/') or 
        media_type.startswith('video/') or 
        media_type.startswith('audio/')
    )
    
    # Формируем имя файла для заголовка
    filename = post.file_name or "file"
    
    if is_media:
        # Получаем размер файла
        file_size = file_path.stat().st_size
        
        # Обработка Range requests для потоковой передачи (важно для аудио/видео)
        if range_header:
            # Парсим Range заголовок (формат: bytes=start-end)
            try:
                range_match = range_header.replace('bytes=', '').split('-')
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if range_match[1] and range_match[1] else file_size - 1
                
                if start >= file_size or end >= file_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        detail="Range Not Satisfiable"
                    )
                
                # Читаем только нужную часть файла
                with open(file_path, 'rb') as f:
                    f.seek(start)
                    content = f.read(end - start + 1)
                
                # Кодируем имя файла
                try:
                    filename_ascii = filename.encode('ascii', 'ignore').decode('ascii')
                    if not filename_ascii or filename_ascii != filename:
                        filename_encoded = quote(filename, safe='')
                        content_disposition = f'inline; filename*=UTF-8\'\'{filename_encoded}'
                    else:
                        content_disposition = f'inline; filename="{filename_ascii}"'
                except:
                    content_disposition = 'inline; filename="file"'
                
                headers = {
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(content)),
                    "Content-Disposition": content_disposition
                }
                
                return Response(
                    content=content,
                    media_type=media_type,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    headers=headers
                )
            except (ValueError, IndexError):
                # Если Range заголовок некорректный, возвращаем весь файл
                pass
        
        # Обычный запрос - возвращаем весь файл
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Кодируем имя файла для заголовка согласно RFC 2231
        try:
            filename_ascii = filename.encode('ascii', 'ignore').decode('ascii')
            if not filename_ascii or filename_ascii != filename:
                filename_encoded = quote(filename, safe='')
                content_disposition = f'inline; filename*=UTF-8\'\'{filename_encoded}'
            else:
                content_disposition = f'inline; filename="{filename_ascii}"'
        except:
            content_disposition = 'inline; filename="file"'
        
        # Заголовки для медиа-файлов
        headers = {
            "Content-Disposition": content_disposition,
            "Accept-Ranges": "bytes",  # Поддержка частичных запросов для потоковой передачи
            "Content-Length": str(len(content))
        }
        
        # Для аудио файлов добавляем дополнительные заголовки
        if media_type.startswith('audio/'):
            headers["Cache-Control"] = "public, max-age=3600"
        
        return Response(
            content=content,
            media_type=media_type,
            headers=headers
        )
    else:
        # Для других файлов - attachment (скачивание)
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=filename
        )


@router.get("/{post_id}/files/{file_id}")
def get_post_file_by_id(
    post_id: int,
    file_id: int,
    range_header: Optional[str] = Header(None, alias="Range"),
    db: Session = Depends(get_db)
):
    """
    Получить конкретный файл поста по ID файла
    
    Поддерживает любые типы файлов:
    - Изображения, видео, аудио - отображаются/воспроизводятся в браузере
    - Остальные файлы - скачиваются
    """
    post_file = db.query(PostFile).filter(
        PostFile.id == file_id,
        PostFile.post_id == post_id
    ).first()
    
    if not post_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )
    
    file_path = get_file_path(post_file.file_path)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    media_type = post_file.file_type or "application/octet-stream"
    filename = post_file.file_name or "file"
    
    # Определяем, является ли файл медиа-файлом
    is_media = (
        media_type.startswith('image/') or 
        media_type.startswith('video/') or 
        media_type.startswith('audio/')
    )
    
    if is_media:
        file_size = file_path.stat().st_size
        
        # Обработка Range requests
        if range_header:
            try:
                range_match = range_header.replace('bytes=', '').split('-')
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if range_match[1] and range_match[1] else file_size - 1
                
                if start >= file_size or end >= file_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        detail="Range Not Satisfiable"
                    )
                
                with open(file_path, 'rb') as f:
                    f.seek(start)
                    content = f.read(end - start + 1)
                
                try:
                    filename_ascii = filename.encode('ascii', 'ignore').decode('ascii')
                    if not filename_ascii or filename_ascii != filename:
                        filename_encoded = quote(filename, safe='')
                        content_disposition = f'inline; filename*=UTF-8\'\'{filename_encoded}'
                    else:
                        content_disposition = f'inline; filename="{filename_ascii}"'
                except:
                    content_disposition = 'inline; filename="file"'
                
                headers = {
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(content)),
                    "Content-Disposition": content_disposition
                }
                
                return Response(
                    content=content,
                    media_type=media_type,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    headers=headers
                )
            except (ValueError, IndexError):
                pass
        
        # Обычный запрос
        with open(file_path, 'rb') as f:
            content = f.read()
        
        try:
            filename_ascii = filename.encode('ascii', 'ignore').decode('ascii')
            if not filename_ascii or filename_ascii != filename:
                filename_encoded = quote(filename, safe='')
                content_disposition = f'inline; filename*=UTF-8\'\'{filename_encoded}'
            else:
                content_disposition = f'inline; filename="{filename_ascii}"'
        except:
            content_disposition = 'inline; filename="file"'
        
        headers = {
            "Content-Disposition": content_disposition,
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(content))
        }
        
        if media_type.startswith('audio/'):
            headers["Cache-Control"] = "public, max-age=3600"
        
        return Response(
            content=content,
            media_type=media_type,
            headers=headers
        )
    else:
        # Для других файлов - attachment (скачивание)
        return FileResponse(
            path=str(file_path),
            media_type=media_type,
            filename=filename
        )

