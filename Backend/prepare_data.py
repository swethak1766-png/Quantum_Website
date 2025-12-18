import os
from pdf2image import convert_from_path

# --- Configuration ---
# 1. Set the path to your folder containing the 38 tender PDFs.
PDF_SOURCE_FOLDER = 'geniue_doc'

# 2. Set the path to the folder where you want to save the output images.
#    It's best to create a new, clean folder for this.
IMAGE_OUTPUT_FOLDER = 'genuine_images'

# 3. For Windows users: specify the path to your Poppler installation.
#    (e.g., r'C:\poppler\bin')
#    For macOS/Linux users, you can often leave this as None.
# For Windows users: specify the path to your Poppler installation.
POPPLER_PATH = r'C:\poppler-25.07.0\Library\bin' # <-- CHANGE THIS

def convert_pdfs_to_images():
    """
    Finds all PDF files in the PDF_SOURCE_FOLDER, converts each page of
    each PDF into a PNG image, and saves them in the IMAGE_OUTPUT_FOLDER.
    """
    print("--- Starting PDF to Image Conversion ---")

    # Create the output folder if it doesn't exist
    if not os.path.exists(IMAGE_OUTPUT_FOLDER):
        os.makedirs(IMAGE_OUTPUT_FOLDER)
        print(f"Created output directory: {IMAGE_OUTPUT_FOLDER}")

    # Get a list of all files in the source folder
    try:
        pdf_files = [f for f in os.listdir(PDF_SOURCE_FOLDER) if f.lower().endswith('.pdf')]
    except FileNotFoundError:
        print(f"ERROR: The source folder '{PDF_SOURCE_FOLDER}' was not found.")
        print("Please make sure the folder exists and contains your PDF files.")
        return

    if not pdf_files:
        print(f"No PDF files found in '{PDF_SOURCE_FOLDER}'.")
        return

    print(f"Found {len(pdf_files)} PDF files to convert.")

    # Loop through each PDF file
    for pdf_file in pdf_files:
        pdf_path = os.path.join(PDF_SOURCE_FOLDER, pdf_file)
        print(f"\nProcessing: {pdf_path}...")

        try:
            # This is where the magic happens.
            # convert_from_path returns a list of Image objects, one for each page.
            images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)

            print(f"-> Found {len(images)} pages. Converting to PNG...")

            # Loop through all the pages and save them as images
            for i, image in enumerate(images):
                # Create a unique filename for each page
                # e.g., 'tender_document_1_page_1.png', 'tender_document_1_page_2.png'
                base_filename = os.path.splitext(pdf_file)[0]
                output_filename = f"{base_filename}_page_{i + 1}.png"
                image_path = os.path.join(IMAGE_OUTPUT_FOLDER, output_filename)

                # Save the image
                image.save(image_path, 'PNG')

            print(f"-> Successfully saved {len(images)} pages to '{IMAGE_OUTPUT_FOLDER}'")

        except Exception as e:
            print(f"!! ERROR processing {pdf_file}: {e}")
            print("   Please ensure Poppler is installed and the path is correct (for Windows).")

    print("\n--- Conversion Complete ---")

if __name__ == '__main__':
    # This makes the script runnable from the command line
    convert_pdfs_to_images()
