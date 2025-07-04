from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from twilio.rest import Client
from dotenv import load_dotenv
import schedule, time, threading, os, csv
from datetime import datetime
from db import init_db, log_event
import sqlite3
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
VOICES_FOLDER = 'voices'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VOICES_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['VOICES_FOLDER'] = VOICES_FOLDER

load_dotenv()
SID = os.getenv("TWILIO_ACCOUNT_SID")
TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
VOICE_NO = os.getenv("TWILIO_VOICE_PHONE")
WA_NO = os.getenv("TWILIO_WHATSAPP_PHONE")

client = Client(SID, TOKEN)

# --------------------- 📞 CALL FUNCTION ---------------------
def call_reminder(to_number, elder, meds, voice_url=None):
    if voice_url:
        twiml = f"<Response><Play>{voice_url}</Play></Response>"
    else:
        # ✅ Use your direct vocaroo MP3 fallback
        fallback_voice = "http://tmpfiles.org/dl/4403865/samplevoice.mp3"
        twiml = f"<Response><Play>{fallback_voice}</Play></Response>"

    print(f"[{datetime.now()}] 📞 Calling {to_number}")
    try:
        call = client.calls.create(
            twiml=twiml,
            to=to_number,
            from_=VOICE_NO
        )
        print(f"Call SID: {call.sid}")
    except Exception as e:
        print(f"Error making call to {to_number}: {e}")

# --------------------- 💬 WHATSAPP FUNCTION ---------------------
def send_whatsapp(to_number, elder, meds):
    for med in meds:
        msg_body = (
            f"Hello {elder}, it’s time to take your medicine:\n\n"
            f"💊 *{med['name']}*\n"
            f" Dosage: {med['dosage']}\n"
            f" Type: {med['type']}\n"
            f" Notes: {med['notes'] if med['notes'] else 'N/A'}\n\n"
            f"Take care, {elder} ❤️"
        )

        media_url_to_send = med.get("image")
        try:
            if media_url_to_send:
                client.messages.create(
                    from_='whatsapp:' + WA_NO,
                    to='whatsapp:' + to_number,
                    body=msg_body,
                    media_url=[media_url_to_send]
                )
            else:
                client.messages.create(
                    from_='whatsapp:' + WA_NO,
                    to='whatsapp:' + to_number,
                    body=msg_body
                )
            print(f"✅ WhatsApp sent to {to_number} for {med['name']}")
        except Exception as e:
            print(f"❌ WhatsApp error: {e}")

# --------------------- FILE SERVING ---------------------
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/voices/<filename>')
def serve_voice_file(filename):
    return send_from_directory(app.config['VOICES_FOLDER'], filename)

# --------------------- REMINDER API ---------------------
# ... keep all imports and app config the same as your original ...

@app.route('/api/schedule', methods=['POST'])
def schedule_reminder():
    elder_name = request.form.get('elder_name')
    phone_number = request.form.get('phone_number')
    reminder_times_str = request.form.get('reminder_times')

    uploaded_voice_file = request.files.get('voice_upload')
    selected_voice_file = request.form.get('selected_voice_file')
    custom_voice_url = None

    if not all([elder_name, phone_number, reminder_times_str]):
        return jsonify({'error': 'Missing required fields'}), 400

    # --- Handle voice upload ---
    if uploaded_voice_file:
        filename = secure_filename(f"{datetime.now().timestamp()}_{uploaded_voice_file.filename}")
        voice_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        uploaded_voice_file.save(voice_path)
        custom_voice_url = f"{request.host_url}uploads/{filename}"
    elif selected_voice_file:
        custom_voice_url = f"{request.host_url}voices/{secure_filename(selected_voice_file)}"

    try:
        times = eval(reminder_times_str)
    except Exception as e:
        return jsonify({'error': f'Invalid time format: {e}'}), 400

    # --- Extract all medicines from form ---
    medicines = []
    i = 0
    while True:
        name = request.form.get(f'medicines[{i}][name]')
        if not name:
            break
        med_data = {
            'name': name,
            'dosage': request.form.get(f'medicines[{i}][dosage]'),
            'type': request.form.get(f'medicines[{i}][type]'),
            'notes': request.form.get(f'medicines[{i}][notes]'),
            'image': request.form.get(f'medicines[{i}][image]')
        }
        medicines.append(med_data)
        i += 1

    if not medicines:
        return jsonify({'error': 'No medicines provided'}), 400

    print(f"📦 Medicines received: {len(medicines)}")
    for med in medicines:
        print(f"🔹 {med['name']} - {med['dosage']} - {med['image']}")

    # --- Schedule the jobs ---
    for t in times:
        def job(elder=elder_name, phone=phone_number, meds=medicines, time_str=t, vurl=custom_voice_url):
            call_reminder(phone, elder, meds, vurl)
            send_whatsapp(phone, elder, meds)
            for med in meds:
                log_event(elder, med['name'], phone, time_str)

        try:
            schedule.every().day.at(t).do(job)
            print(f"✅ Scheduled job at {t} for {elder_name}")
        except Exception as e:
            return jsonify({'error': f'Scheduling failed at {t}: {e}'}), 500

    return jsonify({'message': f"Reminder set for {elder_name} at {', '.join(times)}"}), 200


# --------------------- OTHER ROUTES ---------------------
@app.route('/api/voice_files', methods=['GET'])
def list_voice_files():
    try:
        files = [f for f in os.listdir(app.config['VOICES_FOLDER']) if os.path.isfile(os.path.join(app.config['VOICES_FOLDER'], f))]
        return jsonify({'voice_files': files}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export_csv', methods=['GET'])
def export_logs():
    conn = sqlite3.connect("reminder_logs.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM logs")
    rows = cursor.fetchall()
    conn.close()

    csv_path = "reminder_logs_export.csv"
    with open(csv_path, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['ID', 'Elder Name', 'Medicine', 'Phone', 'Scheduled Time', 'Logged Time'])
        writer.writerows(rows)

    return send_file(csv_path, as_attachment=True)

# --------------------- RUN SCHEDULER ---------------------
def run_scheduler():
    while True:
        schedule.run_pending()
        time.sleep(1)

threading.Thread(target=run_scheduler, daemon=True).start()

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0')
