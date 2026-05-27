import os
import sys

# Reconfigure stdout/stderr to replace unencodable characters (like emojis) on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(errors='replace')

import time
import psycopg2
import psycopg2.extras
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

DATABASE_URL = os.getenv("DATABASE_URL")

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


def _build_reminder_email_html(title, content, color, font, local_time_str, desc, is_expired=False):
    """Build a styled HTML email for a note reminder."""
    status_color = "#ef4444" if is_expired else "#4f46e5"
    status_bg = "#fef2f2" if is_expired else "#eeebff"
    status_label = "Expired" if is_expired else f"Due {desc}"
    header_text = "Reminder Expired!" if is_expired else "Note Reminder"
    header_icon = "🔔" if is_expired else "⏰"
    
    safe_content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') if content else "<em>(no content)</em>"
    safe_title = title.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    color_map = {
        'yellow': {'bg': 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 'border': '#facc15', 'text': '#713f12', 'tape': 'rgba(250, 204, 21, 0.3)'},
        'pink':   {'bg': 'linear-gradient(135deg, #fce7f3 0%, #f9a8d4 100%)', 'border': '#ec4899', 'text': '#701a75', 'tape': 'rgba(236, 72, 153, 0.25)'},
        'blue':   {'bg': 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)', 'border': '#3b82f6', 'text': '#0c4a6e', 'tape': 'rgba(59, 130, 246, 0.25)'},
        'green':  {'bg': 'linear-gradient(135deg, #d1fae5 0%, #6ee7b7 100%)', 'border': '#10b981', 'text': '#14532d', 'tape': 'rgba(16, 185, 129, 0.25)'},
        'purple': {'bg': 'linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%)', 'border': '#8b5cf6', 'text': '#581c87', 'tape': 'rgba(139, 92, 246, 0.25)'},
        'orange': {'bg': 'linear-gradient(135deg, #ffedd5 0%, #fdba74 100%)', 'border': '#f97316', 'text': '#7c2d12', 'tape': 'rgba(249, 115, 22, 0.25)'},
        'teal':   {'bg': 'linear-gradient(135deg, #ccfbf1 0%, #5eead4 100%)', 'border': '#14b8a6', 'text': '#042f2e', 'tape': 'rgba(20, 184, 166, 0.25)'},
        'rose':   {'bg': 'linear-gradient(135deg, #ffe4e6 0%, #fda4af 100%)', 'border': '#f43f5e', 'text': '#4c0519', 'tape': 'rgba(244, 63, 94, 0.25)'},
    }
    
    c_style = color_map.get(color.lower() if color else 'yellow', color_map['yellow'])
    font_family = f"'{font}', 'Caveat', 'Segoe UI', cursive" if font else "'Caveat', 'Segoe UI', cursive"
    font_weight = "700" if font in ("Caveat", "Patrick Hand") else "600"
    
    return f'''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Patrick+Hand&family=Inter:wght@600&family=Poppins:wght@600&family=Roboto:wght@700&family=Lora:ital,wght@0,600;1,600&family=Nunito:wght@700&family=Outfit:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Outfit', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f8fafc; padding: 48px 20px; min-height: 100%;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
      <!-- Top Accent Bar -->
      <div style="height: 6px; background: {"linear-gradient(90deg, #f43f5e 0%, #e11d48 100%)" if is_expired else "linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)"};"></div>
      
      <div style="padding: 40px 32px;">
        <!-- Header Info -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 56px; height: 56px; border-radius: 14px; background-color: {status_bg}; display: inline-block; line-height: 56px; font-size: 28px; text-align: center; color: {status_color};">
            {header_icon}
          </div>
          <h2 style="color: #1e293b; margin-top: 16px; margin-bottom: 4px; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">{header_text}</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0; font-weight: 500;">
            Scheduled: {local_time_str} &bull; <span style="color: {status_color}; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">{status_label}</span>
          </p>
        </div>

        <!-- Sticky Note Container -->
        <div style="position: relative; margin-bottom: 32px;">
          <!-- Tape overlay graphic -->
          <div style="text-align: center; width: 100%; margin-bottom: -9px; position: relative; z-index: 2;">
            <div style="width: 80px; height: 18px; background-color: {c_style['tape']}; border: 1px dashed rgba(0, 0, 0, 0.06); display: inline-block;"></div>
          </div>
          
          <!-- Sticky Note Card -->
          <div style="background: {c_style['bg']}; border: 1px solid {c_style['border']}; border-radius: 12px; padding: 24px; color: {c_style['text']}; box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06); min-height: 120px;">
            <h3 style="font-family: 'Outfit', 'Segoe UI', sans-serif; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              {safe_title}
            </h3>
            <div style="font-family: {font_family}; font-size: 18px; font-weight: {font_weight}; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">{safe_content}</div>
          </div>
        </div>

        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        
        <!-- Footer -->
        <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0 0 4px 0;">Configure reminder channels anytime in your StickyBoard settings.</p>
          <p style="margin: 0;">&copy; 2026 StickyBoard. All rights reserved.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
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
    if not DATABASE_URL:
        return
        
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    except Exception as e:
        print(f"[Worker] Failed to connect to database: {e}")
        return

    try:
        # Check if the tables exist
        cursor.execute("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes')")
        if not cursor.fetchone()['exists']:
            return

        # Fetch all notes that have reminders and their users' contact info + reminder preferences
        query = """
            SELECT n.id, n.username, n.title, n.content, n.color, n.font, n.created_at, n.updated_at, n.reminder_at, 
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
            color = note['color'] or "yellow"
            font = note['font'] or "Caveat"
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
                "SELECT threshold FROM reminder_notifications WHERE note_id = %s AND reminder_at = %s",
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
                        "INSERT INTO reminder_notifications (note_id, threshold, reminder_at, sent_at) VALUES (%s, %s, %s, %s)",
                        (note_id, threshold, note['reminder_at'], now.isoformat())
                    )
                    conn.commit()
                except psycopg2.IntegrityError:
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
                    
                    email_html = _build_reminder_email_html(title, content, color, font, local_time_str, desc, is_expired)
                    email_success = send_email(email_addr, email_subject, email_html)
                    if email_success:
                        any_success = True
                
                # If sending failed on all channels and twilio/smtp variables are present, remove lock so it can be retried
                if not any_success and (ACCOUNT_SID or SMTP_HOST):
                    cursor.execute(
                        "DELETE FROM reminder_notifications WHERE note_id = %s AND threshold = %s AND reminder_at = %s",
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
