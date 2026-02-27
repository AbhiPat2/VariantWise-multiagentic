import pandas as pd
import json
from variant_links import variant_links
from variant_data import variant_data

# Load car models from JSON file
with open('car_models.json', 'r') as file:
    car_models = json.load(file)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/",
    "Connection": "keep-alive"
}

# Iterate through each brand and its models
for brand, models in car_models.items():
    print(f"\nProcessing brand: {brand}")

    for model in models:
        print(f"Processing model: {model}")
        url = f"https://www.cardekho.com/{brand}/{model}/specs"

        try:
            # Fetch all variant links and prices
            variant_list = variant_links(url, headers)
            if len(variant_list) == 0:
                print(f"Error: {brand} {model} not found")
                continue

            # Initialize a list to store all variants data
            all_variants_data = []

            # Iterate through each variant and fetch specifications
            for variant_name, details in variant_list.items():
                variant_info = variant_data(
                    variant_name, details["url"], headers, details["price"])

                # Ensure data is appended correctly
                if variant_info:
                    all_variants_data.extend(variant_info)

            # Convert to DataFrame and save
            if all_variants_data:
                df = pd.DataFrame(all_variants_data)
                df = df.drop_duplicates()
                df.to_csv(f"../data/specs/{brand}-{model}.csv", index=False)
                print(f"{brand}-{model}.csv created successfully.")
            else:
                print(f"No data found for {brand} {model}")

        except Exception as e:
            print(f"Error processing {brand} {model}: {str(e)}")
            continue

print("\nScraping completed!")
