# Scraper for the expert reviews

import requests
from bs4 import BeautifulSoup
import time
import re
import os
import json

# Base site URL
BASE_SITE_URL = "https://www.cardekho.com"

headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

def get_expert_reviews(car_name, review_url):
    print(f"Scraping expert review for {car_name}...")
    try:
        response = requests.get(review_url, headers=headers, timeout=30)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        review_data = {}

        expert_review_section = soup.select_one("section#ExpertReviewOverview")
        if not expert_review_section:
            print(f"No expert review section found for {car_name}")
            return review_data if review_data else None

        title_element = expert_review_section.select_one("h2")
        expert_quote = expert_review_section.select_one("div.expertPara")

        if title_element:
            review_data["Title"] = title_element.text.strip()
        if expert_quote:
            review_data["Expert Quote"] = re.sub(
                r'<!--\s*-->', '', expert_quote.text.strip())

        sections = expert_review_section.select("div.toggleAccordion")
        for section in sections:
            section_title = section.select_one("h3")
            section_content = section.select_one(
                "div.featuresIocnsSec div.gs_readmore")
            if section_title and section_content:
                text_content = " ".join(
                    [text.strip() for text in section_content.stripped_strings if not text.startswith(
                        "Read More")]
                )
                review_data[section_title.text.strip()] = text_content.strip()

        pros_cons_section = soup.select_one("section.expertReview")
        if pros_cons_section:
            pros = [li.get_text(strip=True) for li in pros_cons_section.select(
                ".rightthings:not(.wrongthings) li")]
            cons = [li.get_text(strip=True)
                    for li in pros_cons_section.select(".wrongthings li")]

            if pros:
                review_data["Pros"] = "\n".join(f"- {point}" for point in pros)
            if cons:
                review_data["Cons"] = "\n".join(f"- {point}" for point in cons)

        return review_data

    except Exception as e:
        print(f"Error scraping {car_name}: {e}")
        return None


def save_as_text(brand, car_name, review_data):

    base_folder = os.path.join("..", "data", "reviews")
    os.makedirs(base_folder, exist_ok=True)

    formatted_name = f"{brand.capitalize()} {car_name}"
    safe_name = re.sub(r'[\\/*?:"<>|]', "", formatted_name).strip()
    filename = os.path.join(base_folder, f"{safe_name}.txt")

    with open(filename, 'w', encoding='utf-8') as f:
        for section, content in review_data.items():
            f.write(f"{section}\n")
            f.write("-" * len(section) + "\n")
            f.write(f"{content}\n\n")
    return filename


def main():
    # Load car models from JSON file
    with open('car_models.json', 'r') as file:
        car_models = json.load(file)

    for brand, models in car_models.items():
        print(f"\nProcessing reviews for brand: {brand}")

        for model in models:
            print(f"Processing model: {model}")
            car_name = model.replace("-", " ").title()
            review_url = f"{BASE_SITE_URL}/{brand}/{model}"

            try:
                review_data = get_expert_reviews(car_name, review_url)

                if review_data:
                    filename = save_as_text(brand, car_name, review_data)
                    print(f"Saved review to {filename}")
                else:
                    print(f"No review found for {brand} {car_name}")

            except Exception as e:
                print(f"Error processing {brand} {model}: {str(e)}")
                continue

    print("\nReview scraping completed!")


if __name__ == "__main__":
    main()