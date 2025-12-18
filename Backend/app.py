import shutil
import os
import secrets
import io
# Added datetime for audit timestamps
import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from functools import wraps
import firebase_admin
from firebase_admin import credentials, auth

# --- IMPORTS FOR AI (TensorFlow,GEMINI) ---
import tensorflow as tf
from PIL import Image
import numpy as np
import cv2
from pdf2image import convert_from_bytes, exceptions
from ultralytics import YOLO

import google.generativeai as genai

# --- App Initialization ---
app = Flask(__name__)
# GLOBAL CORS INITIALIZATION
CORS(app)

# --- Define an upload folder ---
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Audit Log Setup ---
LOG_FILE = 'audit.log'

def write_audit_log(uid, action, details=""):
    """Writes an audit entry to the log file (File-based logging)."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] UID: {uid} | ACTION: {action} | DETAILS: {details}\n"
    try:
        with open(LOG_FILE, 'a') as f:
            f.write(log_entry)
    except Exception as e:
        print(f"ERROR writing to audit log: {e}")
# -------------------------

# --- Firebase Admin SDK Initialization ---
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    print("✅ Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"❌ Error initializing Firebase Admin SDK: {e}")

# --- Gemini Client Initialization ---
# NOTE: Ensure GEMINI_API_KEY is set as an environment variable!
# --- Gemini Client Initialization ---
# NOTE: Ensure GEMINI_API_KEY is set as an environment variable!
# --- Gemini Client Initialization ---
# NOTE: Ensure GEMINI_API_KEY is set as an environment variable!
# GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") # Comment this line out for now
GEMINI_API_KEY = "AIzaSyCCTcFLBbriywjgjlNCTELn6xbE1LWGkns"
if not GEMINI_API_KEY:
    print("❌ WARNING: GEMINI_API_KEY environment variable not set. Chatbot will not work.")
else:
    try:
        # Modern way to configure the genai library
        genai.configure(api_key=GEMINI_API_KEY)
        print("✅ Gemini Client configured successfully.")
    except Exception as e:
        print(f"❌ Error configuring Gemini client: {e}")
        
# --- AI MODEL LOADING (ALL MODELS) ---
# <<< MODIFIED SECTION START >>>
doc_forgery_model = None
sig_verification_model = None  # Renamed for clarity
handwritten_forgery_model = None # New model variable
doc_classifier_model = None
yolo_signature_detector = None
try:
    doc_forgery_model = tf.keras.models.load_model('document_forgery_model.h5')
    print("✅ Document Forgery Model loaded successfully.")
    
    # Load the original model
    sig_verification_model = tf.keras.models.load_model('signature_verification_model.h5')
    print("✅ Signature Verification Model (Old) loaded successfully.")

    # Load your new, more accurate model
    handwritten_forgery_model = tf.keras.models.load_model('handwritten_forgery_model.h5')
    print("✅ Handwritten Forgery Model (New) loaded successfully.")

    doc_classifier_model = tf.keras.models.load_model('document_classifier_model.h5')
    print("✅ Document Classifier Model loaded successfully.")
    
    yolo_signature_detector = YOLO('best.pt')
    print("✅ YOLO Signature Detector loaded successfully.")

except Exception as e:
    print(f"❌ Error loading AI models: {e}")
# <<< MODIFIED SECTION END >>>

# --- AI Model Configuration ---
IMG_HEIGHT = 256
IMG_WIDTH = 256
DOC_FORGERY_CLASSES = ["forged", "genuine"]
SIG_FORGERY_CLASSES = ["forged_signature", "genuine_signature"]
DOC_CLASSIFIER_CLASSES = ['advertisement', 'budget', 'email', 'file_folder', 'form', 'handwritten', 'invoice', 'letter', 'memo', 'news_article', 'presentation', 'questionnaire', 'resume', 'scientific_publication', 'scientific_report', 'specification']

# --- Original Signature Cropping Function (for /predict endpoint) ---
def find_and_crop_signature(image_bytes):
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None: return None
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours: return None
        sig_contours = [c for c in contours if 2000 < cv2.contourArea(c) < 50000]
        if not sig_contours: return None
        largest_contour = max(sig_contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        padding = 20
        cropped_signature = img[max(0, y-padding):y+h+padding, max(0, x-padding):x+w+padding]
        cropped_signature_rgb = cv2.cvtColor(cropped_signature, cv2.COLOR_BGR2RGB)
        return Image.fromarray(cropped_signature_rgb)
    except Exception as e:
        print(f"WARNING: Could not find or crop signature: {e}")
        return None

# --- Authentication Decorator (Unchanged) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers: token = request.headers['Authorization'].split(" ")[1]
        if not token: return jsonify({'message': 'Token is missing!'}), 401
        try:
            request.user = auth.verify_id_token(token)
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(*args, **kwargs)
    return decorated

# ====================================================================
# --- FILE MANAGEMENT AND AUDIT ENDPOINTS ---
# ====================================================================

@app.route('/generate-key', methods=['GET'])
@token_required
def generate_key():
    uid = request.user['uid']
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], uid)
    os.makedirs(user_folder, exist_ok=True)
    key_file_path = os.path.join(user_folder, 'user.key')
    
    # Retrieve or Generate Key
    if os.path.exists(key_file_path):
        with open(key_file_path, 'r') as f: key = f.read()
        log_action = "KEY_RETRIEVED"
    else:
        key = secrets.token_hex(32)
        with open(key_file_path, 'w') as f: f.write(key)
        log_action = "KEY_GENERATED"
        
    # Audit Log Entry (Persistence for QKD generation)
    write_audit_log(uid, log_action, f"Key created/retrieved. Key snippet: {key[:8]}...")
    
    return jsonify({'status': 'success', 'key': key})

@app.route('/verify-token', methods=['POST'])
@token_required
def verify_token(): return jsonify({'status': 'success', 'uid': request.user['uid']})
    
@app.route('/upload', methods=['POST'])
@token_required
def upload_file():
    if 'file' not in request.files: return jsonify({'message': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'message': 'No selected file'}), 400
    uid = request.user['uid']
    user_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], uid)
    os.makedirs(user_upload_folder, exist_ok=True)
    for filename in os.listdir(user_upload_folder):
        if filename.endswith('.encrypted'):
            os.remove(os.path.join(user_upload_folder, filename))
            
    file.save(os.path.join(user_upload_folder, file.filename))
    
    # Audit Log Entry (Log Uploads)
    write_audit_log(request.user['uid'], "DOCUMENT_UPLOADED", f"File: {file.filename}")
    
    return jsonify({'message': f'File "{file.filename.replace(".encrypted", "")}" stored!'}), 200

@app.route('/list-files', methods=['GET'])
@token_required
def list_files():
    uid = request.user['uid']
    user_folder = os.path.join(app.config['UPLOAD_FOLDER'], uid)
    if not os.path.exists(user_folder): return jsonify([])
    files = [f for f in os.listdir(user_folder) if f.endswith('.encrypted')]
    return jsonify(files)

# --- SECURE DOWNLOAD ENDPOINT (New Module: Secure Download) ---
@app.route('/download/<filename>', methods=['GET'])
@token_required
def download_file(filename):
    uid = request.user['uid']
    user_download_folder = os.path.join(app.config['UPLOAD_FOLDER'], uid)
    
    if not os.path.exists(os.path.join(user_download_folder, filename)):
        return jsonify({'error': 'File not found or unauthorized access.'}), 404
        
    # Audit Log Entry (Log Downloads)
    write_audit_log(uid, "DOCUMENT_DOWNLOADED", f"File: {filename}")
    
    # Send the encrypted file bytes (client handles local decryption)
    return send_from_directory(user_download_folder, filename, as_attachment=True)

# --- SESSION TERMINATION ENDPOINT (New Module: Session Termination) ---
@app.route('/logout', methods=['POST'])
@token_required
def handle_logout():
    uid = request.user['uid']
    key_file_path = os.path.join(app.config['UPLOAD_FOLDER'], uid, 'user.key')
    
    log_details = f"Session terminated."
    
    # 1. Destroy Key File (Server-side key destruction)
    if os.path.exists(key_file_path):
        try:
            os.remove(key_file_path)
            log_details += " Key file destroyed."
        except Exception as e:
            print(f"WARNING: Could not destroy key file for {uid}: {e}")
            
    # 2. Audit Log Entry (Log Session Termination)
    write_audit_log(uid, "SESSION_TERMINATED", log_details)
    
    return jsonify({'status': 'success', 'message': 'Session and keys terminated.'})


# ====================================================================
# --- AI PREDICTION AND CHAT ENDPOINTS ---
# ====================================================================

@app.route('/predict', methods=['POST'])
@token_required
def handle_prediction():
    if 'file' not in request.files: return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No file selected'}), 400
    
    if not all([doc_forgery_model, sig_verification_model, handwritten_forgery_model, doc_classifier_model]):
        return jsonify({'error': 'One or more AI models are not loaded on the server'}), 500
    
    try:
        # ... (Image Loading) ...
        file_bytes = file.read()
        img = None

        if file.mimetype == 'application/pdf':
            try:
                poppler_path = r"C:\poppler-25.07.0\Library\bin" 
                images = convert_from_bytes(file_bytes, first_page=1, last_page=1, poppler_path=poppler_path)
                if not images: return jsonify({'error': 'Could not extract an image from the PDF'}), 500
                img = images[0]
            except exceptions.PDFInfoNotInstalledError:
                return jsonify({'error': 'Poppler dependency not found or path is incorrect in app.py.'}), 500
        else:
            img = Image.open(io.BytesIO(file_bytes))
        
        img_rgb = img.convert('RGB')
        img_resized = img_rgb.resize((IMG_WIDTH, IMG_HEIGHT))
        img_array = np.array(img_resized) / 255.0
        img_array = np.expand_dims(img_array, axis=0) # Shape (1, 256, 256, 3)

        # ---------------------------------------------
        # 1. Document Classification
        doc_type = "Classification Failed"
        doc_type_confidence = 0.0
        try:
            classifier_pred = doc_classifier_model.predict(img_array)
            doc_type_index = np.argmax(classifier_pred[0])
            doc_type_confidence = float(classifier_pred[0][doc_type_index])
            doc_type = DOC_CLASSIFIER_CLASSES[doc_type_index]
        except Exception as e:
            print(f"ERROR: Doc Classification failed (direct input): {e}")
            
        # 2. Document Forgery Analysis
        doc_forgery_class = "error"
        doc_forgery_confidence = 0.0
        try:
            doc_forgery_pred = doc_forgery_model.predict(img_array)
            doc_score = float(doc_forgery_pred[0][0])
            # THRESHOLD RESTORED TO 50%
            doc_forgery_class = DOC_FORGERY_CLASSES[1] if doc_score > 0.5 else DOC_FORGERY_CLASSES[0]
            doc_forgery_confidence = doc_score if doc_score > 0.5 else 1 - doc_score
        except Exception as e:
            print(f"ERROR: Doc Forgery Analysis failed (direct input): {e}")
                 
        # 3. Signature Forgery Analysis
        with io.BytesIO() as output:
            img_rgb.save(output, format="PNG")
            image_for_cv_bytes = output.getvalue()
        cropped_signature_pil = find_and_crop_signature(image_for_cv_bytes)
        
        signature_analysis = {}
        if cropped_signature_pil:
            sig_resized = cropped_signature_pil.resize((IMG_WIDTH, IMG_HEIGHT))
            sig_array = np.array(sig_resized) / 255.0
            sig_array = np.expand_dims(sig_array, axis=0) # Shape (1, 256, 256, 3)

            # --- Run prediction with the OLD model ---
            old_model_class = "error"
            old_model_confidence = 0.0
            try:
                old_model_pred = sig_verification_model.predict(sig_array)
                old_model_score = float(old_model_pred[0][0])
                # THRESHOLD RESTORED TO 50%
                old_model_class = SIG_FORGERY_CLASSES[1] if old_model_score > 0.5 else SIG_FORGERY_CLASSES[0]
                old_model_confidence = old_model_score if old_model_score > 0.5 else 1 - old_model_score
            except Exception as e:
                print(f"ERROR: Signature Verification (Old Model) failed: {e}")
                
            # --- Run prediction with the NEW model ---
            new_model_class = "error"
            new_model_confidence = 0.0
            try:
                # FIX: Flattening the signature image input 
                new_sig_array = tf.keras.layers.Flatten()(sig_array)
                
                new_model_pred = handwritten_forgery_model.predict(new_sig_array)
                new_model_score = float(new_model_pred[0][0])
                # THRESHOLD RESTORED TO 50%
                new_model_class = SIG_FORGERY_CLASSES[1] if new_model_score > 0.5 else SIG_FORGERY_CLASSES[0]
                new_model_confidence = new_model_score if new_model_score > 0.5 else 1 - new_model_score
            except Exception as e:
                print(f"ERROR: Signature Verification (New Handwritten Model) failed: {e}")
                

            signature_analysis = {
                'status': 'Signature found and analyzed.',
                'original_model_result': { 'prediction': old_model_class, 'confidence': f"{old_model_confidence:.2%}" },
                'new_model_result': { 'prediction': new_model_class, 'confidence': f"{new_model_confidence:.2%}" }
            }
        else:
            signature_analysis = { 'status': 'No signature was detected on the document.' }

        results = {
            'classification': {'type': doc_type, 'confidence': f"{doc_type_confidence:.2%}"},
            'document_analysis': { 'prediction': doc_forgery_class, 'confidence': f"{doc_forgery_confidence:.2%}" },
            'signature_analysis': signature_analysis
        }
        
        # Audit Log AI Analysis (Log AI Analysis)
        doc_verdict = results['document_analysis']['prediction'].upper()
        sig_verdict = results['signature_analysis']['original_model_result']['prediction'].upper()
        
        write_audit_log(
            request.user['uid'], 
            "AI_ANALYSIS_COMPLETED", 
            f"Doc: {doc_verdict}, Sig(Old): {sig_verdict}"
        )
        
        return jsonify(results)

    except Exception as e:
        # Catches file loading or other global pipeline errors
        print(f"FATAL ERROR in AI pipeline: {e}")
        return jsonify({'error': 'An unexpected error occurred on the server.'}), 500

# --- NEW CHATBOT ENDPOINT (FIXED CORS) ---
# --- REPLACE YOUR OLD /chat ENDPOINT WITH THIS CORRECTED VERSION ---
@app.route('/chat', methods=['POST'])
@token_required
def handle_chat():
    # --- DELETE THE IF STATEMENT THAT WAS HERE ---

    data = request.get_json()
    user_message = data.get('message', '')

    if not user_message:
        return jsonify({'error': 'No message provided.'}), 400

    try:
        # Use the FLASH model
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(user_message)
        
        return jsonify({
            'response': response.text,
            'status': 'success'
        })

    except Exception as e:
        print(f"FATAL ERROR in Gemini chat pipeline: {e}")
        return jsonify({'error': f'AI chat failed: {str(e)}'}), 500
  # Execute the authenticated request handler
    return process_chat_request()

# --- NEWLY ADDED ENDPOINT FOR YOLO MODEL (Unchanged) ---
@app.route('/predict-yolo', methods=['POST'])
@token_required
def handle_yolo_prediction():
    if 'file' not in request.files: return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No file selected'}), 400
    if not yolo_signature_detector:
        return jsonify({'error': 'YOLO model is not loaded on the server'}), 500
    
    try:
        image = Image.open(file.stream).convert("RGB")
        
        results = yolo_signature_detector(image)
        
        detections = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = box.conf[0].item()
                class_id = int(box.cls[0].item())
                class_name = yolo_signature_detector.names[class_id]
                
                detections.append({
                    'class_name': class_name,
                    'confidence': round(confidence, 4),
                    'bounding_box': [round(x, 2) for x in [x1, y1, x2, y2]]
                })
        
        return jsonify(detections)

    except Exception as e:
        print(f"FATAL ERROR in YOLO pipeline: {e}")
        return jsonify({'error': 'An unexpected error occurred during YOLO prediction.'}), 500

if __name__ == '__main__':
    # REMINDER: Set GEMINI_API_KEY environment variable before running.
    app.run(debug=True, port=5000)