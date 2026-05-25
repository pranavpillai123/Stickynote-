import os
import time
import sqlite3
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from twilio.rest import Client

# Load environment variables
load_dotenv()

ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
DATABASE = os.path.join(os.path.dirname(__file__), 'stickyboard.db')

def get_twilio_client():
    if ACCOUNT_SID and AUTH_TOKEN:
        try:
            return Client(ACCOUNT_SID, AUTH_TOKEN)
        except Exception as e:
            print(f"[Worker] Error initializing Twilio client: {e}")
    return None

def send_whatsapp(to_number, message_body):
    client = get_twilio_client()
    if not client or not WHATSAPP_FROM:
        print(f"[Worker] Twilio not configured. Would send to {to_number}:\n---\n{message_body}\n---")
        return False
    try:
        # Twilio WhatsApp number requires "whatsapp:" prefix
        to_whatsapp = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
        from_whatsapp = WHATSAPP_FROM if WHATSAPP_FROM.startswith("whatsapp:") else f"whatsapp:{WHATSAPP_FROM}"
        
        message = client.messages.create(
            body=message_body,
            from_=from_whatsapp,
            to=to_whatsapp
        )
        print(f"[Worker] WhatsApp sent to {to_number}. SID: {message.sid}")
        return True
    except Exception as e:
        print(f"[Worker] Failed to send WhatsApp to {to_number}: {e}")
        return False

def parse_datetime(val):
    if not val:
        return None
    # If it's a digit string or int, it's a timestamp
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
        if isinstance(val, str) and val.isdigit():
            return datetime.fromtimestamp(int(val) / 1000.0, tz=timezone.utc)
    except Exception:
        pass

    # Try parsing as ISO format
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            s = val
            if s.endswith('Z'):
                s = s[:-1] + '+00:00'
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None

def check_and_send_reminders():
    if not os.path.exists(DATABASE):
        return
        
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Check if the tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
        if not cursor.fetchone():
            return

        # Fetch all notes that have reminders and their users' phone numbers
        query = """
            SELECT n.id, n.username, n.title, n.content, n.created_at, n.updated_at, n.reminder_at, u.phone_number
            FROM notes n
            JOIN users u ON n.username = u.username
            WHERE n.reminder_at IS NOT NULL AND u.phone_number IS NOT NULL AND u.phone_number != ''
        """
        cursor.execute(query)
        notes = cursor.fetchall()
        
        now = datetime.now(timezone.utc)
        
        for note in notes:
            note_id = note['id']
            title = note['title'] or "Untitled"
            content = note['content'] or ""
            phone = note['phone_number']
            
            reminder_time = parse_datetime(note['reminder_at'])
            created_time = parse_datetime(note['created_at']) or parse_datetime(note['updated_at']) or now
            
            if not reminder_time:
                continue
                
            total_duration = reminder_time - created_time
            time_to_reminder = reminder_time - now
            
            # Determine allowed thresholds based on the note's total_duration
            allowed_thresholds = set()
            allowed_thresholds.add('expired')  # Expired is always allowed
            
            if total_duration > timedelta(hours=24):
                allowed_thresholds.update(['24h', '1h', '10m'])
            elif total_duration > timedelta(hours=1):
                allowed_thresholds.update(['1h', '10m'])
            elif total_duration > timedelta(minutes=10):
                allowed_thresholds.update(['10m'])
            elif total_duration > timedelta(minutes=5):
                allowed_thresholds.update(['5m'])
            elif total_duration > timedelta(minutes=2):
                allowed_thresholds.update(['2m'])
            # If total_duration <= 2 mins, only 'expired' is allowed (already added)
            
            # Fetch already sent notifications for this note for the current reminder_at time
            cursor.execute(
                "SELECT threshold FROM reminder_notifications WHERE note_id = ? AND reminder_at = ?",
                (note_id, note['reminder_at'])
            )
            sent_thresholds = {row['threshold'] for row in cursor.fetchall()}
            
            thresholds_to_check = []
            
            if now >= reminder_time:
                if 'expired' in allowed_thresholds:
                    thresholds_to_check.append(('expired', "expired"))
            else:
                if '2m' in allowed_thresholds and time_to_reminder <= timedelta(minutes=2):
                    thresholds_to_check.append(('2m', "in 2 minutes"))
                if '5m' in allowed_thresholds and time_to_reminder <= timedelta(minutes=5):
                    thresholds_to_check.append(('5m', "in 5 minutes"))
                if '10m' in allowed_thresholds and time_to_reminder <= timedelta(minutes=10):
                    thresholds_to_check.append(('10m', "in 10 minutes"))
                if '1h' in allowed_thresholds and time_to_reminder <= timedelta(hours=1):
                    thresholds_to_check.append(('1h', "in 1 hour"))
                if '24h' in allowed_thresholds and time_to_reminder <= timedelta(hours=24):
                    thresholds_to_check.append(('24h', "in 24 hours"))
            
            for threshold, desc in thresholds_to_check:
                if threshold in sent_thresholds:
                    continue
                
                # Check chronological appropriateness to prevent duplicate alerts or spamming old thresholds
                if threshold == '24h' and time_to_reminder <= timedelta(hours=1):
                    continue
                if threshold == '1h' and time_to_reminder <= timedelta(minutes=10):
                    continue
                if threshold == '10m' and time_to_reminder <= timedelta(minutes=5) and '5m' in allowed_thresholds:
                    continue
                if threshold == '5m' and time_to_reminder <= timedelta(minutes=2) and '2m' in allowed_thresholds:
                    continue
                if threshold == '2m' and time_to_reminder <= timedelta(seconds=0):
                    continue
                
                # Format reminder time for human readability in local timezone
                local_time_str = reminder_time.astimezone().strftime("%Y-%m-%d %H:%M")
                
                # Bold content in WhatsApp message using asterisks
                bold_content = f"*{content}*" if content else "*(no content)*"
                if threshold == 'expired':
                    msg = f"🔔 *StickyBoard Reminder Expired!*\n\nYour note *{title}* was scheduled for *{local_time_str}* and has now expired.\n\nContent:\n{bold_content}"
                else:
                    msg = f"⏰ *StickyBoard Reminder*\n\nYour note *{title}* is scheduled for *{local_time_str}* ({desc} remaining).\n\nContent:\n{bold_content}"
                
                # Use database write as a lock to guarantee exactly one worker/thread sends this notification.
                # If another worker inserts first, this fails with IntegrityError, and we gracefully skip sending.
                try:
                    cursor.execute(
                        "INSERT INTO reminder_notifications (note_id, threshold, reminder_at, sent_at) VALUES (?, ?, ?, ?)",
                        (note_id, threshold, note['reminder_at'], now.isoformat())
                    )
                    conn.commit()
                except sqlite3.IntegrityError:
                    # Already sent/recorded by another process
                    continue

                # Lock acquired, now send the message
                success = send_whatsapp(phone, msg)
                
                # If sending failed and twilio variables are present, remove lock so it can be retried
                if not success and ACCOUNT_SID:
                    cursor.execute(
                        "DELETE FROM reminder_notifications WHERE note_id = ? AND threshold = ? AND reminder_at = ?",
                        (note_id, threshold, note['reminder_at'])
                    )
                    conn.commit()
                else:
                    print(f"[Worker] Notification [{threshold}] successfully recorded/sent for note {note_id}")
                    
                # Only send one notification per note per loop cycle
                break
                    
    except Exception as e:
        print(f"[Worker] Error checking reminders: {e}")
    finally:
        conn.close()

def worker_loop():
    print("[Worker] Background reminder worker loop started.")
    while True:
        try:
            check_and_send_reminders()
        except Exception as e:
            print(f"[Worker] Error in loop: {e}")
        time.sleep(30)

if __name__ == '__main__':
    worker_loop()
