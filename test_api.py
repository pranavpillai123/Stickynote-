"""Test the StickyBoard API endpoints."""
import json
import time
import http.cookiejar
from urllib.request import urlopen, Request, build_opener, HTTPCookieProcessor

base = 'http://127.0.0.1:5000/api'
cj = http.cookiejar.CookieJar()
opener = build_opener(HTTPCookieProcessor(cj))

import urllib.error

def api(method, path, data=None, headers=None):
    body = json.dumps(data).encode() if data else None
    req = Request(f'{base}{path}', data=body, method=method)
    if body:
        req.add_header('Content-Type', 'application/json')
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        res = opener.open(req)
        return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode())
        except Exception:
            err_body = {}
        return e.code, err_body

# Generate dynamic test credentials to avoid 409 Conflict
timestamp = int(time.time())
test_user = f"testuser_{timestamp}"
test_email = f"test_{timestamp}@example.com"
test_phone = f"+1415{str(timestamp)[-7:]}"

# 1) Check auth status (should be unauthenticated)
status, body = api('GET', '/me')
print(f'1. GET /api/me -> {status}: {body}')
assert body['authenticated'] == False, 'Should not be authenticated'

# 2) Request OTP first
status, body = api('POST', '/otp/send', {
    'username': test_user,
    'email': test_email,
    'phone_number': test_phone
}, headers={'X-Testing': 'true'})
print(f'2a. POST /api/otp/send -> {status}: {body}')
assert status == 200, f'Expected 200, got {status}'
otp_code = body.get('otp', '000000')

# 2a-bis) Verify OTP
status, body = api('POST', '/otp/verify', {
    'channel': 'phone',
    'otp': otp_code,
    'target': test_phone
})
print(f'2a-bis. POST /api/otp/verify -> {status}: {body}')
assert status == 200, f'Expected 200, got {status}'

# 2b) Register with the OTP
status, body = api('POST', '/register', {
    'username': test_user,
    'email': test_email,
    'password': 'test123',
    'phone_number': test_phone,
    'reminder_method': 'whatsapp'
})
print(f'2b. POST /api/register -> {status}: {body}')
assert status == 201, f'Expected 201, got {status}'

# 2c) Try to request OTP with the duplicate phone number
status, body = api('POST', '/otp/send', {
    'username': f"{test_user}_other",
    'email': f"other_{timestamp}@example.com",
    'phone_number': test_phone
}, headers={'X-Testing': 'true'})
print(f'2c. POST /api/otp/send (duplicate phone) -> {status}: {body}')
assert status == 409, f'Expected 409, got {status}'
assert 'phone number' in body['error'].lower(), f'Expected phone number error, got: {body["error"]}'

# 3) Check auth status (should be authenticated now)
status, body = api('GET', '/me')
print(f'3. GET /api/me -> {status}: {body}')
assert body['authenticated'] == True, 'Should be authenticated'
assert body['username'] == test_user

# 4) Get notes (should be empty)
status, body = api('GET', '/notes')
print(f'4. GET /api/notes -> {status}: {body}')
assert body == [], 'Should have no notes'

# 5) Save some notes
notes = [
    {'id': 'test1', 'title': 'Hello', 'content': 'World', 'color': 'yellow',
     'createdAt': '2026-05-17T10:00:00', 'updatedAt': '2026-05-17T10:00:00', 'reminderAt': None},
    {'id': 'test2', 'title': 'Reminder Note', 'content': 'Do laundry', 'color': 'pink',
     'createdAt': '2026-05-17T10:00:00', 'updatedAt': '2026-05-17T10:00:00', 'reminderAt': '2026-06-01T09:00:00'},
]
status, body = api('POST', '/notes', notes)
print(f'5. POST /api/notes -> {status}: {body}')

# 6) Get notes back
status, body = api('GET', '/notes')
print(f'6. GET /api/notes -> {status}: {len(body)} notes')
assert len(body) == 2, f'Expected 2 notes, got {len(body)}'
print(f'   Note 1: {body[0]["title"]} ({body[0]["color"]})')
print(f'   Note 2: {body[1]["title"]} ({body[1]["color"]})')

# 7) Logout
status, body = api('POST', '/logout')
print(f'7. POST /api/logout -> {status}: {body}')

# 8) Verify logged out
status, body = api('GET', '/me')
print(f'8. GET /api/me -> {status}: {body}')
assert body['authenticated'] == False

# 9) Login back
status, body = api('POST', '/login', {'username': test_user, 'password': 'test123'})
print(f'9. POST /api/login -> {status}: {body}')
assert status == 200

# 10) Notes still there after re-login
status, body = api('GET', '/notes')
print(f'10. GET /api/notes -> {status}: {len(body)} notes persisted')
assert len(body) == 2

# 11) Delete the account (this will cascade delete notes)
status, body = api('DELETE', '/account')
print(f'11. DELETE /api/account -> {status}: {body}')
assert status == 200, f'Expected 200, got {status}'

# 13) Test double verification flow (both phone and email)
double_user = f"doubleuser_{timestamp}"
double_email = f"double_{timestamp}@example.com"
double_phone = f"+1415{str(timestamp+1)[-7:]}"

# 13a) Send phone OTP
status, body = api('POST', '/otp/send', {
    'username': double_user,
    'email': double_email,
    'phone_number': double_phone,
    'channel': 'phone'
}, headers={'X-Testing': 'true'})
print(f'13a. POST /api/otp/send (phone) -> {status}: {body}')
assert status == 200
phone_otp = body.get('otp')

# 13b) Verify phone OTP
status, body = api('POST', '/otp/verify', {
    'channel': 'phone',
    'otp': phone_otp,
    'target': double_phone
})
print(f'13b. POST /api/otp/verify (phone) -> {status}: {body}')
assert status == 200

# 13c) Send email OTP
status, body = api('POST', '/otp/send', {
    'username': double_user,
    'email': double_email,
    'phone_number': double_phone,
    'channel': 'email'
}, headers={'X-Testing': 'true'})
print(f'13c. POST /api/otp/send (email) -> {status}: {body}')
assert status == 200
email_otp = body.get('otp')

# 13d) Verify email OTP
status, body = api('POST', '/otp/verify', {
    'channel': 'email',
    'otp': email_otp,
    'target': double_email
})
print(f'13d. POST /api/otp/verify (email) -> {status}: {body}')
assert status == 200

# 13e) Register with reminder_method = both
status, body = api('POST', '/register', {
    'username': double_user,
    'email': double_email,
    'password': 'testpassword',
    'phone_number': double_phone,
    'reminder_method': 'both'
})
print(f'13e. POST /api/register (both) -> {status}: {body}')
assert status == 201

print('\n  [+] ALL TESTS PASSED! SQLite backend is fully functional (with OTP & Delete Account).')

