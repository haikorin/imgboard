"""
Скрипт миграции для обновления структуры таблицы posts
"""
from sqlalchemy import text
from database import engine


def migrate_posts_table():
    """Миграция таблицы posts: переименование file в file_path и добавление новых полей"""
    try:
        with engine.begin() as conn:  # begin() автоматически делает commit
            # Проверяем, существует ли таблица posts
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'posts'
                )
            """))
            
            if not result.scalar():
                print("Таблица posts не найдена. Будет создана автоматически.")
                return
            
            # Проверяем, существует ли старая колонка file
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'posts' AND column_name = 'file'
            """))
            
            if result.fetchone():
                print("Найдена старая структура таблицы. Выполняется миграция...")
                
                # Переименовываем file в file_path
                conn.execute(text("ALTER TABLE posts RENAME COLUMN file TO file_path"))
                print("✓ Колонка 'file' переименована в 'file_path'")
            
            # Добавляем новые колонки, если их нет
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'posts' AND column_name = 'file_type'
            """))
            
            if not result.fetchone():
                conn.execute(text("ALTER TABLE posts ADD COLUMN file_type VARCHAR(50)"))
                print("✓ Добавлена колонка 'file_type'")
            
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'posts' AND column_name = 'file_name'
            """))
            
            if not result.fetchone():
                conn.execute(text("ALTER TABLE posts ADD COLUMN file_name VARCHAR(255)"))
                print("✓ Добавлена колонка 'file_name'")
            
            # Проверяем, существует ли колонка user_id
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'posts' AND column_name = 'user_id'
            """))
            
            if not result.fetchone():
                print("Добавление колонки 'user_id'...")
                
                # Сначала добавляем колонку как nullable
                conn.execute(text("ALTER TABLE posts ADD COLUMN user_id INTEGER"))
                print("✓ Добавлена колонка 'user_id' (пока nullable)")
                
                # Получаем первого пользователя
                user_result = conn.execute(text("""
                    SELECT id FROM users ORDER BY id LIMIT 1
                """))
                first_user = user_result.fetchone()
                
                if first_user:
                    user_id = first_user[0]
                    # Устанавливаем user_id для всех существующих постов
                    conn.execute(text(f"""
                        UPDATE posts SET user_id = {user_id} WHERE user_id IS NULL
                    """))
                    print(f"✓ Установлен user_id = {user_id} для существующих постов")
                    
                    # Добавляем внешний ключ
                    conn.execute(text("""
                        ALTER TABLE posts 
                        ADD CONSTRAINT fk_posts_user_id 
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    """))
                    print("✓ Добавлен внешний ключ на users.id")
                    
                    # Делаем колонку NOT NULL
                    conn.execute(text("ALTER TABLE posts ALTER COLUMN user_id SET NOT NULL"))
                    print("✓ Колонка 'user_id' теперь NOT NULL")
                else:
                    print("⚠ Пользователи не найдены. Колонка 'user_id' останется nullable.")
                    print("  После создания пользователей запустите миграцию снова или установите user_id вручную.")
                
                # Создаём индекс (даже если колонка nullable)
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_user_id ON posts(user_id)"))
                print("✓ Создан индекс на user_id")
            
            # Проверяем, является ли колонка text nullable
            result = conn.execute(text("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'posts' AND column_name = 'text'
            """))
            
            column_info = result.fetchone()
            if column_info and column_info[0] == 'NO':
                # Колонка NOT NULL, делаем её nullable
                print("Изменение колонки 'text' на nullable...")
                conn.execute(text("ALTER TABLE posts ALTER COLUMN text DROP NOT NULL"))
                print("✓ Колонка 'text' теперь nullable")
            
            # Проверяем, существует ли таблица post_files
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'post_files'
                )
            """))
            
            if not result.scalar():
                print("Создание таблицы 'post_files'...")
                conn.execute(text("""
                    CREATE TABLE post_files (
                        id SERIAL PRIMARY KEY,
                        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                        file_path VARCHAR(500) NOT NULL,
                        file_type VARCHAR(100) NOT NULL,
                        file_name VARCHAR(255) NOT NULL,
                        file_size INTEGER,
                        "order" INTEGER NOT NULL DEFAULT 0
                    )
                """))
                print("✓ Создана таблица 'post_files'")
                
                # Создаём индекс на post_id
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_post_files_post_id ON post_files(post_id)"))
                print("✓ Создан индекс на post_id")
            
            # Проверяем, существует ли таблица comments
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'comments'
                )
            """))
            
            if not result.scalar():
                print("Создание таблицы 'comments'...")
                conn.execute(text("""
                    CREATE TABLE comments (
                        id SERIAL PRIMARY KEY,
                        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        text TEXT NOT NULL,
                        date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
                    )
                """))
                print("✓ Создана таблица 'comments'")
                
                # Создаём индексы
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_comments_post_id ON comments(post_id)"))
                print("✓ Создан индекс на post_id")
                
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_comments_user_id ON comments(user_id)"))
                print("✓ Создан индекс на user_id")
            
            print("Миграция завершена успешно!")
            
    except Exception as e:
        print(f"Ошибка при выполнении миграции: {e}")
        # Не поднимаем исключение, чтобы приложение могло запуститься


if __name__ == "__main__":
    migrate_posts_table()

