"""Clean up test data from the database."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL is not set.")
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
c = conn.cursor()
c.execute("DELETE FROM notes WHERE username = 'testuser'")
c.execute("DELETE FROM users WHERE username = 'testuser'")
conn.commit()
print(f"Cleaned up test data on Neon.")
c.execute("SELECT COUNT(*) FROM users")
print(f"Users remaining: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM notes")
print(f"Notes remaining: {c.fetchone()[0]}")
conn.close()
