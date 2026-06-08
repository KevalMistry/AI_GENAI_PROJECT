from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import JWTError, jwt

from pydantic import BaseModel
import sqlite3
import os

# Simple SQLite DB file in project root
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'auth.db'))

SECRET_KEY = os.environ.get('INTERVAI_SECRET_KEY', 'change_this_secret_in_prod')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='/api/auth/token')


def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_conn()
    with conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                created_at TEXT NOT NULL
            )
            '''
        )
    conn.close()


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class User(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def get_user_by_email(email: str) -> Optional[User]:
    conn = get_db_conn()
    row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    if not row:
        return None
    return User(id=row['id'], email=row['email'], first_name=row['first_name'], last_name=row['last_name'])


def authenticate_user(email: str, password: str) -> Optional[User]:
    conn = get_db_conn()
    row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    if not row:
        return None
    if not verify_password(password, row['hashed_password']):
        return None
    return User(id=row['id'], email=row['email'], first_name=row['first_name'], last_name=row['last_name'])


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({'exp': expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_user(email: str, password: str, first_name: Optional[str] = None, last_name: Optional[str] = None) -> User:
    hashed = get_password_hash(password)
    conn = get_db_conn()
    now = datetime.utcnow().isoformat()
    try:
        cur = conn.execute(
            'INSERT INTO users (email, hashed_password, first_name, last_name, created_at) VALUES (?, ?, ?, ?, ?)',
            (email, hashed, first_name, last_name, now),
        )
        conn.commit()
        user_id = cur.lastrowid
    finally:
        conn.close()
    return User(id=user_id, email=email, first_name=first_name, last_name=last_name)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get('sub')
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(email)
    if user is None:
        raise credentials_exception
    return 


# Initialize DB on import
init_db()
