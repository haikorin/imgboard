from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import Comment, Post, User
from schemas import CommentCreate, CommentResponse
from dependencies import get_current_user

router = APIRouter(prefix="/posts/{post_id}/comments", tags=["comments"])


@router.get("", response_model=List[CommentResponse])
def get_comments(
    post_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    include_deleted: bool = Query(False, description="Включить удалённые комментарии"),
    db: Session = Depends(get_db)
):
    """Получить список комментариев к посту"""
    # Проверяем, что пост существует
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    query = db.query(Comment).options(joinedload(Comment.user)).filter(Comment.post_id == post_id)
    
    if not include_deleted:
        query = query.filter(Comment.is_deleted == False)
    
    comments = query.order_by(Comment.date.asc()).offset(skip).limit(limit).all()
    
    # Преобразуем в формат ответа
    result = []
    for comment in comments:
        comment_dict = {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.user_id,
            "text": comment.text,
            "date": comment.date,
            "is_deleted": comment.is_deleted,
            "author_nick": comment.user.nick if comment.user else None,
            "author_id": comment.user_id
        }
        result.append(comment_dict)
    
    return result


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать новый комментарий к посту"""
    # Проверяем, что пост существует и не удалён
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пост не найден"
        )
    
    if post.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя комментировать удалённый пост"
        )
    
    # Создаём комментарий
    new_comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        text=comment_data.text
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment, ['user'])
    
    return {
        "id": new_comment.id,
        "post_id": new_comment.post_id,
        "user_id": new_comment.user_id,
        "text": new_comment.text,
        "date": new_comment.date,
        "is_deleted": new_comment.is_deleted,
        "author_nick": new_comment.user.nick if new_comment.user else None,
        "author_id": new_comment.user_id
    }


@router.delete("/{comment_id}", response_model=CommentResponse)
def delete_comment(
    post_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить комментарий (soft delete) - только свой комментарий"""
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.post_id == post_id
    ).first()
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Комментарий не найден"
        )
    
    # Проверяем, что пользователь может удалять только свои комментарии
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы можете удалять только свои комментарии"
        )
    
    if comment.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Комментарий уже удалён"
        )
    
    comment.is_deleted = True
    db.commit()
    db.refresh(comment, ['user'])
    
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "user_id": comment.user_id,
        "text": comment.text,
        "date": comment.date,
        "is_deleted": comment.is_deleted,
        "author_nick": comment.user.nick if comment.user else None,
        "author_id": comment.user_id
    }

