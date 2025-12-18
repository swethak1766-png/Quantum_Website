import os
import pandas as pd
import ast # Used to safely evaluate the string representation of the bbox list

# --- CONFIGURATION (WINDOWS-SPECIFIC PATH) ---
DATASET_BASE_DIR = r'C:\Users\kswet\firebase_project\datasets\signature_detector_mini'
ANNOTATIONS_TRAIN_PATH = os.path.join(DATASET_BASE_DIR, 'train.csv') # Using the full original train file
ANNOTATIONS_TEST_PATH = os.path.join(DATASET_BASE_DIR, 'test.csv')   # Using the full original test file
IMAGE_IDS_PATH = os.path.join(DATASET_BASE_DIR, 'image_ids.csv')     # Path to the image ids file
# ---------------------------------------------------

def process_and_convert(annotations_path, images_info_df, image_set_name):
    """
    Reads annotation data, merges it with image info, and converts to YOLO format.
    """
    print(f"\n--- Processing {os.path.basename(annotations_path)} for '{image_set_name}' set ---")
    
    try:
        annotations_df = pd.read_csv(annotations_path)
    except FileNotFoundError:
        print(f"--> ERROR: Cannot find annotations file: {annotations_path}")
        return

    # Merge the annotations with the image information based on 'image_id'
    data_df = pd.merge(annotations_df, images_info_df, on='image_id')
    
    labels_dir = os.path.join(DATASET_BASE_DIR, 'labels', image_set_name)
    os.makedirs(labels_dir, exist_ok=True)
    
    # Get a list of the image filenames that actually exist in our mini-dataset folder
    mini_dataset_image_path = os.path.join(DATASET_BASE_DIR, 'images', image_set_name)
    existing_images = set(os.listdir(mini_dataset_image_path))
    
    count = 0
    for index, row in data_df.iterrows():
        try:
            image_filename = row['file_name']
            
            # --- IMPORTANT: Only process rows for images that exist in our mini-dataset ---
            if image_filename not in existing_images:
                continue

            img_width = int(row['width'])
            img_height = int(row['height'])
            
            bbox_list = ast.literal_eval(row['bbox'])
            x_min, y_min, box_width, box_height = bbox_list
            
            center_x = x_min + (box_width / 2)
            center_y = y_min + (box_height / 2)
            
            norm_center_x = center_x / img_width
            norm_center_y = center_y / img_height
            norm_width = box_width / img_width
            norm_height = box_height / img_height
            
            class_index = 0
            
            label_filename = os.path.splitext(image_filename)[0] + '.txt'
            label_filepath = os.path.join(labels_dir, label_filename)
            
            with open(label_filepath, 'w') as f:
                f.write(f"{class_index} {norm_center_x} {norm_center_y} {norm_width} {norm_height}\n")
            count += 1
        except Exception as e:
            print(f"An error occurred on row {index} for file {row.get('file_name', 'N/A')}: {e}")

    print(f"--> SUCCESS: Created {count} label files in {labels_dir}")


# --- Main Execution ---
try:
    images_df = pd.read_csv(IMAGE_IDS_PATH)
    images_df = images_df.rename(columns={'id': 'image_id'}) 
    print("--- Successfully loaded image_ids.csv ---")
    
    process_and_convert(ANNOTATIONS_TRAIN_PATH, images_df, 'train')
    process_and_convert(ANNOTATIONS_TEST_PATH, images_df, 'test')
    
    print("\n--- Data preparation for YOLO is complete! ---")

except FileNotFoundError:
    print(f"FATAL ERROR: A required CSV file was not found in {DATASET_BASE_DIR}.")
except Exception as e:
    print(f"FATAL ERROR: An unexpected error occurred: {e}")

