# To merge all the csv files in data/specs directory into a single final_dataset.csv after adding the experience features scores manually out of 5 for each car
import os
import pandas as pd

# Folder containing all CSV files
data_folder = '../data/specs'
# Final merged CSV filename
output_file = '../data/final_dataset.csv'

# Get list of all CSV files in the folder
csv_files = [f for f in os.listdir(data_folder) if f.endswith('.csv')]

# Initialize an empty list to hold all dataframes
df_list = []

# Read and store all CSVs
for file in csv_files:
    file_path = os.path.join(data_folder, file)
    try:
        df = pd.read_csv(file_path)
        df_list.append(df)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")

# Merge all dataframes, aligning columns and filling missing values with NaN
final_df = pd.concat(df_list, ignore_index=True, sort=False)

# Write to final CSV
final_df.to_csv(output_file, index=False)

print(f"Merged {len(csv_files)} files into {output_file}")
