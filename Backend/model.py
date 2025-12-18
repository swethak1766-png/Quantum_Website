import google.generativeai as genai
import sys

print(f"Python Version: {sys.version}")
try:
    print(f"Library Version: {genai.__version__}")
except:
    print("Library Version: Unknown")

# Configure with your specific key
GEMINI_API_KEY = "AIzaSyCCTcFLBbriywjgjlNCTELn6xbE1LWGkns"
genai.configure(api_key=GEMINI_API_KEY)

print("\n------------------------------------------------")
print("SEARCHING FOR AVAILABLE MODELS...")
print("------------------------------------------------")

try:
    found_any = False
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"✅ FOUND: {m.name}")
            found_any = True
    
    if not found_any:
        print("❌ No chat models found. Check API Key permissions.")
        
except Exception as e:
    print(f"❌ ERROR CONNECTING TO GOOGLE: {e}")

print("------------------------------------------------")