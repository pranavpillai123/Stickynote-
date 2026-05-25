"""Clean up test data from the database."""
import sqlite3
conn = sqlite3.connect('stickyboard.db')
c = conn.cursor()
c.execute("DELETE FROM notes WHERE username = 'testuser'")
c.execute("DELETE FROM users WHERE username = 'testuser'")
conn.commit()
print(f"Cleaned up test data.")
c.execute("SELECT COUNT(*) FROM users")
print(f"Users remaining: {c.fetchone()[0]}")
c.execute("SELECT COUNT(*) FROM notes")
print(f"Notes remaining: {c.fetchone()[0]}")
conn.close()
