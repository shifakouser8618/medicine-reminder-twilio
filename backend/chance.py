# main.py – Medicine Reminder (Voice + WhatsApp) v3  (multi‑time + SQLite logs)
import re
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from dotenv import load_dotenv
import schedule, time, os
from datetime import datetime

# --- local DB helpers ---
from backend.db import init_db, log_event   # <- make sure db.py is in the same folder
init_db()                           # create logs table if it doesn't exist

# -------------------- 1. SETUP --------------------
load_dotenv()
SID       = os.getenv("TWILIO_ACCOUNT_SID")
TOKEN     = os.getenv("TWILIO_AUTH_TOKEN")
VOICE_NO  = os.getenv("TWILIO_VOICE_PHONE")
WA_NO     = os.getenv("TWILIO_WHATSAPP_PHONE")   # +14155238886

if not all([SID, TOKEN, VOICE_NO, WA_NO]):
    raise ValueError("❌  Missing one or more env vars in .env")

client = Client(SID, TOKEN)

# -------------------- 2. VOICE CALL --------------------
def call_reminder(to_number: str, elder: str, med: str) -> None:
    msg = f"Hello {elder}, it is time to take your {med}. Please take care!"
    print(f"[{datetime.now()}] 📞 Calling {to_number}: {msg}")
    try:
        call = client.calls.create(
            twiml=f"<Response><Say>{msg}</Say><Hangup/></Response>",
            to=to_number,
            from_=VOICE_NO
        )
        print("✅ Voice call queued, SID:", call.sid)
        log_event(elder, med, "voice", "queued")
    except TwilioRestException as e:
        print("❌ Voice call error:", e.msg)
        log_event(elder, med, "voice", f"error:{e.code}")

# -------------------- 3. WHATSAPP --------------------
def send_whatsapp(to_number: str, elder: str, med: str) -> None:
    msg = f"Hello {elder}, it's time to take your {med}. Take care!"
    print(f"[{datetime.now()}] 📲 WhatsApp → {to_number}: {msg}")
    try:
        client.messages.create(
            from_=f"whatsapp:{WA_NO}",
            to=f"whatsapp:{to_number}",
            body=msg
        )
        print("✅ WhatsApp message queued")
        log_event(elder, med, "whatsapp", "queued")
    except TwilioRestException as e:
        print("❌ WhatsApp error:", e.msg)
        log_event(elder, med, "whatsapp", f"error:{e.code}")

# -------------------- 4. USER INPUT --------------------
elder_name = input("👵  Elder's Name                : ").strip()
medicine_name = input("💊  Medicine Name               : ").strip()

times_raw = input("⏰  Enter Times (HH:MM, comma‑separated e.g. 08:00,13:00,21:00): ")
# Clean any non-ASCII (weird) characters and use normal commas
times_raw = re.sub(r"[^\x00-\x7F]+", ",", times_raw)
reminder_times = [t.strip() for t in times_raw.split(",") if t.strip()]


recipient_number = input("📞  Phone (+CountryCodeNumber)  : ").strip()  # e.g. +91XXXXXXXXXX

# -------------------- 5. SCHEDULER --------------------
def daily_job():
    call_reminder(recipient_number, elder_name, medicine_name)
    send_whatsapp(recipient_number, elder_name, medicine_name)

for t in reminder_times:
    schedule.every().day.at(t).do(daily_job)
    print(f"✅  Scheduled daily reminder at {t}")

print("\n⏳  Waiting for next reminder… (Ctrl‑C to exit)")

# -------------------- 6. LOOP FOREVER --------------------
while True:
    schedule.run_pending()
    time.sleep(1)
