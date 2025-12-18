import requests

# The URL of your NEW YOLO endpoint
API_URL = "http://127.0.0.1:5000/predict-yolo"
IMAGE_PATH = "test_doc.png"

# --- PASTE YOUR TOKEN HERE ---
FIREBASE_ID_TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4MWYwNTJhZWYwNDBhOTdjMzlkMjY1MzgxZGU2Y2I0MzRiYzM1ZjMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcXVhbnR1bS01MGJmMiIsImF1ZCI6InF1YW50dW0tNTBiZjIiLCJhdXRoX3RpbWUiOjE3NjAwMjA4OTcsInVzZXJfaWQiOiI0N2E5N05SZjF3U29xNGE2M2ZaTjhLcGE4am8xIiwic3ViIjoiNDdhOTdOUmYxd1NvcTRhNjNmWk44S3BhOGpvMSIsImlhdCI6MTc2MDAyMDg5NywiZXhwIjoxNzYwMDI0NDk3LCJlbWFpbCI6Imtzd2V0aGEyMDIyQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJrc3dldGhhMjAyMkBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.UEyIgxyzDSH6kH08H4D4Pz2pmhGPoP7xb0tWSTc7UyFq708irh-kX2I4-8QjNNmdI2gepmkh9LShFM3wBsp99GzL88KJnZo87ArfyRdtFozYYp19ywk57TQPXNu1UniX40HvmFU3PeH0hCVZNOBoHyx69yPmSjhwIpcz28oCiZ6bBxOUy2IJg_Y-zJsojp3C0Kgxe01n579e-oma_VoKPAxMGRR0m8niJMD-cu3R5e_3vYRcOmcBZ8W7INNLlYIMqO_L0lR20HK0OUUSUCI7Pvzrg9tUhUNjXvVUCdOMLFCqbPzB7q13PUYOElhlKqwAwaJghajGH2ycdJMY-Hc6EA"

# --- Create the authentication headers ---
headers = {
    "Authorization": f"Bearer {FIREBASE_ID_TOKEN}"
}

print(f"--- Sending '{IMAGE_PATH}' to the YOLO API with authentication... ---")

try:
    with open(IMAGE_PATH, 'rb') as image_file:
        files = {'file': (IMAGE_PATH, image_file, 'image/jpeg')}
        
        # Send the request with the file AND the headers
        response = requests.post(API_URL, files=files, headers=headers)

        print(f"\nStatus Code: {response.status_code}")
        print("--- API Response ---")
        print(response.json())

except FileNotFoundError:
    print(f"\nERROR: The test image '{IMAGE_PATH}' was not found.")
except requests.exceptions.ConnectionError:
    print("\nERROR: Could not connect to the server.")