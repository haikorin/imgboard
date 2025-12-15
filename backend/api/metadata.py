from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Post, PostFile
from file_utils import get_file_path
from mutagen import File as MutagenFile
from mutagen.flac import FLAC, Picture as FLACPicture
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
import base64
from pathlib import Path

router = APIRouter(prefix="/posts", tags=["metadata"])


def extract_audio_metadata(file_path: Path, file_type: str) -> Optional[dict]:
    """Извлекает метаданные из аудио файла"""
    try:
        # Убеждаемся, что путь абсолютный
        if not file_path.is_absolute():
            # Если путь относительный, делаем его абсолютным от текущей рабочей директории
            # В Docker контейнере рабочая директория - /app
            file_path = Path.cwd() / file_path
        
        # Проверяем существование файла
        if not file_path.exists():
            print(f"Файл не найден: {file_path} (абсолютный путь)")
            # Пробуем найти файл относительно /app
            alt_path = Path("/app") / file_path
            if alt_path.exists():
                file_path = alt_path
                print(f"Файл найден по альтернативному пути: {file_path}")
            else:
                return None
        
        # Открываем файл через Mutagen
        # Для FLAC используем специальный класс FLAC для лучшей поддержки
        if file_type and 'flac' in file_type.lower():
            try:
                audio_file = FLAC(str(file_path))
            except Exception as e:
                print(f"Ошибка открытия FLAC файла через FLAC класс: {e}, пробуем MutagenFile")
                # Пробуем через общий MutagenFile
                audio_file = MutagenFile(str(file_path))
        else:
            audio_file = MutagenFile(str(file_path))
        
        if audio_file is None:
            print(f"Не удалось открыть файл через Mutagen: {file_path}")
            return None
        
        metadata = {}
        
        # Название трека
        title = None
        if hasattr(audio_file, 'tags') and audio_file.tags:
            # Для MP3 (ID3 теги)
            if 'TIT2' in audio_file.tags:
                title = str(audio_file.tags['TIT2'][0])
            elif 'TITLE' in audio_file.tags:
                title = str(audio_file.tags['TITLE'][0])
        
        # Для FLAC и других форматов (Vorbis комментарии)
        if not title:
            if 'TITLE' in audio_file:
                title_list = audio_file.get('TITLE', [])
                title = str(title_list[0]) if title_list else None
            elif hasattr(audio_file, 'title'):
                title_val = audio_file.title
                title = str(title_val[0]) if isinstance(title_val, list) else str(title_val)
        
        metadata['title'] = title
        
        # Исполнитель
        artist = None
        if hasattr(audio_file, 'tags') and audio_file.tags:
            # Для MP3 (ID3 теги)
            if 'TPE1' in audio_file.tags:
                artist = str(audio_file.tags['TPE1'][0])
            elif 'ARTIST' in audio_file.tags:
                artist = str(audio_file.tags['ARTIST'][0])
        
        # Для FLAC и других форматов
        if not artist:
            if 'ARTIST' in audio_file:
                artist_list = audio_file.get('ARTIST', [])
                artist = str(artist_list[0]) if artist_list else None
            elif hasattr(audio_file, 'artist'):
                artist_val = audio_file.artist
                artist = str(artist_val[0]) if isinstance(artist_val, list) else str(artist_val)
        
        metadata['artist'] = artist
        
        # Альбом
        album = None
        if hasattr(audio_file, 'tags') and audio_file.tags:
            # Для MP3 (ID3 теги)
            if 'TALB' in audio_file.tags:
                album = str(audio_file.tags['TALB'][0])
            elif 'ALBUM' in audio_file.tags:
                album = str(audio_file.tags['ALBUM'][0])
        
        # Для FLAC и других форматов
        if not album:
            if 'ALBUM' in audio_file:
                album_list = audio_file.get('ALBUM', [])
                album = str(album_list[0]) if album_list else None
            elif hasattr(audio_file, 'album'):
                album_val = audio_file.album
                album = str(album_val[0]) if isinstance(album_val, list) else str(album_val)
        
        metadata['album'] = album
        
        # Обложка
        cover_data = None
        try:
            # Для MP3 файлов (ID3 теги)
            if hasattr(audio_file, 'tags') and audio_file.tags:
                # Пытаемся найти APIC (обложку) в ID3 тегах
                for key in list(audio_file.tags.keys()):
                    if key.startswith('APIC') or key == 'APIC:':
                        apic = audio_file.tags[key]
                        if hasattr(apic, 'data'):
                            cover_data = apic.data
                            break
                        elif isinstance(apic, list) and len(apic) > 0:
                            if hasattr(apic[0], 'data'):
                                cover_data = apic[0].data
                                break
            
            # Для FLAC файлов - используем специальный метод
            if cover_data is None and isinstance(audio_file, FLAC):
                # FLAC хранит обложки в pictures (атрибут объекта FLAC)
                try:
                    if hasattr(audio_file, 'pictures') and audio_file.pictures:
                        if len(audio_file.pictures) > 0:
                            # pictures - это список Picture объектов
                            pic = audio_file.pictures[0]
                            if hasattr(pic, 'data'):
                                cover_data = pic.data
                                print(f"Обложка найдена через FLAC.pictures: {len(cover_data)} байт")
                except Exception as e:
                    print(f"Ошибка при извлечении обложки из FLAC.pictures: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Для OGG и других форматов
            if cover_data is None and hasattr(audio_file, 'pictures'):
                if audio_file.pictures:
                    cover_data = audio_file.pictures[0].data
                    
        except Exception as e:
            print(f"Ошибка извлечения обложки: {e}")
            import traceback
            traceback.print_exc()
            cover_data = None
        
        if cover_data:
            # Конвертируем в base64 для передачи через API
            cover_base64 = base64.b64encode(cover_data).decode('utf-8')
            # Определяем MIME type обложки
            mime_type = 'image/jpeg'  # По умолчанию
            if cover_data[:4] == b'\x89PNG':
                mime_type = 'image/png'
            elif cover_data[:2] == b'\xff\xd8':
                mime_type = 'image/jpeg'
            elif cover_data[:4] == b'RIFF' and cover_data[8:12] == b'WEBP':
                mime_type = 'image/webp'
            
            metadata['cover'] = f"data:{mime_type};base64,{cover_base64}"
        
        return metadata if metadata else None
        
    except Exception as e:
        print(f"Ошибка извлечения метаданных: {e}")
        return None


@router.get("/{post_id}/metadata")
def get_post_metadata(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Получить метаданные аудио файла поста"""
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    if not post.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="У поста нет файла"
        )
    
    # Проверяем, что это аудио файл
    if not post.file_type or not post.file_type.startswith('audio/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Метаданные доступны только для аудио файлов"
        )
    
    file_path = get_file_path(post.file_path)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    # Извлекаем метаданные
    metadata = extract_audio_metadata(file_path, post.file_type)
    
    if not metadata:
        return {
            "title": None,
            "artist": None,
            "album": None,
            "cover": None,
            "cover_url": None
        }
    
    # Формируем URL для обложки (если есть)
    cover_url = None
    if metadata.get('cover'):
        cover_url = f"/posts/{post_id}/cover"
    
    return {
        "title": metadata.get('title'),
        "artist": metadata.get('artist'),
        "album": metadata.get('album'),
        "cover": metadata.get('cover'),  # Base64 для прямого использования
        "cover_url": cover_url  # URL для получения обложки отдельно
    }


@router.get("/{post_id}/files/{file_id}/metadata")
def get_file_metadata(
    post_id: int,
    file_id: int,
    db: Session = Depends(get_db)
):
    """Получить метаданные конкретного аудио файла из поста (для альбомов)"""
    post_file = db.query(PostFile).filter(
        PostFile.id == file_id,
        PostFile.post_id == post_id
    ).first()
    
    if not post_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )
    
    # Проверяем, что это аудио файл
    if not post_file.file_type or not post_file.file_type.startswith('audio/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Метаданные доступны только для аудио файлов"
        )
    
    file_path = get_file_path(post_file.file_path)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )
    
    # Извлекаем метаданные
    metadata = extract_audio_metadata(file_path, post_file.file_type)
    
    if not metadata:
        return {
            "title": None,
            "artist": None,
            "album": None,
            "cover": None,
            "cover_url": None
        }
    
    # Формируем URL для обложки (если есть)
    cover_url = None
    if metadata.get('cover'):
        cover_url = f"/posts/{post_id}/files/{file_id}/cover"
    
    return {
        "title": metadata.get('title'),
        "artist": metadata.get('artist'),
        "album": metadata.get('album'),
        "cover": metadata.get('cover'),  # Base64 для прямого использования
        "cover_url": cover_url  # URL для получения обложки отдельно
    }


@router.get("/{post_id}/files/{file_id}/cover")
def get_file_cover(
    post_id: int,
    file_id: int,
    db: Session = Depends(get_db)
):
    """Получить обложку конкретного аудио файла из поста (для альбомов)"""
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
            detail="Файл не найден"
        )
    
    metadata = extract_audio_metadata(file_path, post_file.file_type)
    
    if not metadata or not metadata.get('cover'):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Обложка не найдена в метаданных файла"
        )
    
    # Парсим data URL
    cover_data_url = metadata['cover']
    if cover_data_url.startswith('data:'):
        # Извлекаем MIME type и данные
        header, data = cover_data_url.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        cover_bytes = base64.b64decode(data)
        
        from fastapi.responses import Response
        return Response(
            content=cover_bytes,
            media_type=mime_type,
            headers={"Cache-Control": "public, max-age=3600"}
        )
    
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Ошибка обработки обложки"
    )


@router.get("/{post_id}/cover")
def get_post_cover(
    post_id: int,
    db: Session = Depends(get_db)
):
    """Получить обложку аудио файла поста (старый формат)"""
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post or not post.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост или файл не найден"
        )
    
    file_path = get_file_path(post.file_path)
    if not file_path or not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )
    
    metadata = extract_audio_metadata(file_path, post.file_type)
    
    if not metadata or not metadata.get('cover'):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Обложка не найдена в метаданных файла"
        )
    
    # Парсим data URL
    cover_data_url = metadata['cover']
    if cover_data_url.startswith('data:'):
        # Извлекаем MIME type и данные
        header, data = cover_data_url.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        cover_bytes = base64.b64decode(data)
        
        from fastapi.responses import Response
        return Response(
            content=cover_bytes,
            media_type=mime_type,
            headers={"Cache-Control": "public, max-age=3600"}
        )
    
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Ошибка обработки обложки"
    )

