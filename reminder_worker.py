import os
import sys

# Reconfigure stdout/stderr to replace unencodable characters (like emojis) on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(errors='replace')

import time
import sqlite3
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from twilio.rest import Client

# Load environment variables
load_dotenv()

ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER

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


def send_email(to_email, subject, html_body):
    """Send an HTML email via SMTP. Falls back to console output if SMTP is not configured."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        print(f"\n{'='*60}")
        print(f"[Email Fallback] SMTP not configured. Email details:")
        print(f"  To: {to_email}")
        print(f"  Subject: {subject}")
        print(f"  Body (HTML): {html_body[:200]}...")
        print(f"{'='*60}\n")
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())

        print(f"[Worker] Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"[Worker] Failed to send email to {to_email}: {e}")
        return False


def _build_reminder_email_html(title, content, local_time_str, desc, is_expired=False):
    """Build a styled HTML email for a note reminder."""
    status_color = "#ef4444" if is_expired else "#7c3aed"
    status_label = "Expired" if is_expired else desc
    header_text = "Reminder Expired!" if is_expired else "Note Reminder"
    header_icon = "🔔" if is_expired else "⏰"
    
    safe_content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') if content else "<em>(no content)</em>"
    safe_title = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    return f'''
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #f472b6); margin: 0 auto; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 24px;">{header_icon}</span>
        </div>
        <h3 style="color: {status_color}; margin-top: 8px; margin-bottom: 0; font-weight: 700;">StickyBoard {header_text}</h3>
      </div>
      <div style="background: linear-gradient(135deg, #7c3aed 0%, #f472b6 100%); padding: 2px; border-radius: 10px; margin-bottom: 20px;">
        <div style="background: #ffffff; padding: 18px; border-radius: 8px;">
          <h4 style="color: #1e293b; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">{safe_title}</h4>
          <p style="color: #475569; font-size: 14px; margin: 0 0 16px 0; font-style: italic;">
            Scheduled Time: {local_time_str} &mdash; <span style="color: {status_color}; font-weight: 600;">{status_label}</span>
          </p>
          <div style="background-color: #fefcbf; border-left: 4px solid #facc15; padding: 12px; border-radius: 4px; font-family: 'Courier New', Courier, monospace; font-size: 15px; color: #451a03; min-height: 40px; white-space: pre-wrap;">{safe_content}</div>
        </div>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <div style="text-align: center; font-size: 12px; color: #94a3b8;">
        <p>Configure reminder channels anytime in your StickyBoard account settings.</p>
      </div>
    </div>
    '''


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

        # Fetch all notes that have reminders and their users' contact info + reminder preferences
        query = """
            SELECT n.id, n.username, n.title, n.content, n.created_at, n.updated_at, n.reminder_at, 
                   u.phone_number, u.email, u.reminder_method, u.is_phone_verified, u.is_email_verified
            FROM notes n
            JOIN users u ON n.username = u.username
            WHERE n.reminder_at IS NOT NULL
        """
        cursor.execute(query)
        notes = cursor.fetchall()
        
        now = datetime.now(timezone.utc)
        
        for note in notes:
            note_id = note['id']
            title = note['title'] or "Untitled"
            content = note['content'] or ""
            phone = note['phone_number']
            email_addr = note['email']
            reminder_method = note['reminder_method'] or 'whatsapp'
            is_phone_verified = note['is_phone_verified']
            is_email_verified = note['is_email_verified']
            
            # Determine which channels to use
            send_whatsapp_flag = reminder_method in ('whatsapp', 'both') and phone and is_phone_verified
            send_email_flag = reminder_method in ('email', 'both') and email_addr and is_email_verified
            
            if not send_whatsapp_flag and not send_email_flag:
                continue
            
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
                
                # Check chronological appropriateness
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
                
                try:
                    cursor.execute(
                        "INSERT INTO reminder_notifications (note_id, threshold, reminder_at, sent_at) VALUES (?, ?, ?, ?)",
                        (note_id, threshold, note['reminder_at'], now.isoformat())
                    )
                    conn.commit()
                except sqlite3.IntegrityError:
                    continue

                is_expired = threshold == 'expired'
                any_success = False
                
                # ── Send WhatsApp ──
                if send_whatsapp_flag:
                    bold_content = f"*{content}*" if content else "*(no content)*"
                    if is_expired:
                        wa_msg = f"🔔 *StickyBoard Reminder Expired!*\n\nYour note *{title}* was scheduled for *{local_time_str}* and has now expired.\n\nContent:\n{bold_content}"
                    else:
                        wa_msg = f"⏰ *StickyBoard Reminder*\n\nYour note *{title}* is scheduled for *{local_time_str}* ({desc} remaining).\n\nContent:\n{bold_content}"
                    
                    wa_success = send_whatsapp(phone, wa_msg)
                    if wa_success:
                        any_success = True
                
                # ── Send Email ──
                if send_email_flag:
                    if is_expired:
                        email_subject = f"🔔 StickyBoard Reminder Expired: {title}"
                    else:
                        email_subject = f"⏰ StickyBoard Reminder: {title}"
                    
                    email_html = _build_reminder_email_html(title, content, local_time_str, desc, is_expired)
                    email_success = send_email(email_addr, email_subject, email_html)
                    if email_success:
                        any_success = True
                
                # If sending failed on all channels and twilio/smtp variables are present, remove lock so it can be retried
                if not any_success and (ACCOUNT_SID or SMTP_HOST):
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
