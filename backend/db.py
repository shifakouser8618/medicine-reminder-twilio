# db.py – Handles SQLite logging

import sqlite3
from datetime import datetime

DB_NAME = "reminder_logs.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            medicine TEXT,
            phone TEXT,
            action TEXT,
            timestamp TEXT
        )
    """)
    conn.commit()
    conn.close()

def log_event(name, medicine, phone, action):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO logs (name, medicine, phone, action, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (name, medicine, phone, action, timestamp))
    conn.commit()
    conn.close()
