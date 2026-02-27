import requests
from bs4 import BeautifulSoup

all_variants_data = []


def variant_data(variant_name, url, headers, price):
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    specs_div = soup.find("div", {"id": "scrollDiv"})
    if not specs_div:
        print(f"Div not found for {variant_name}!")
        return

    cleaned_rows = clean_data(specs_div)
    fields, values = [], []
    i = 0
    while i < len(cleaned_rows):
        field = cleaned_rows[i]
        if field.lower() in ["yes", "no"] and values:
            values[-1] += " " + field
            i += 1
            continue
        if i + 1 < len(cleaned_rows):
            value = cleaned_rows[i + 1]
            fields.append(field)
            values.append(value)
            i += 2
        else:
            if len(fields) > len(values):
                values.append(field)
            else:
                fields.append(field)
                values.append("")
            i += 1

    # Store price along with other data
    variant_data = {"variant": variant_name, "price": price}
    for f, v in zip(fields, values):
        variant_data[f] = v

    all_variants_data.append(variant_data)
    return all_variants_data


def clean_data(specs_div):
    for check_icon in specs_div.select("i.icon-check"):
        check_icon.replace_with("yes")
    for cross_icon in specs_div.select("i.icon-deletearrow"):
        cross_icon.replace_with("no")

    text_content = specs_div.get_text(separator="\n", strip=True)

    subheadings_to_remove = [
        "Engine & Transmission", "Fuel & Performance", "Suspension, Steering & Brakes",
        "Dimensions & Capacity", "Comfort & Convenience", "Interior", "Exterior",
        "Safety", "Entertainment & Communication", "ADAS Feature", "Advance Internet Feature"
    ]

# Add any unwanted offer texts here you see on the webite's specs page to get clean data
    unwanted_lines = {
        "Report Incorrect Specs",
        "Don't miss out on the best offers for this Month",
        "Check January Offers",
        "Check February Offers",
        "View Complete Offers",
        "View Holi Offers",
        "View March Offers",
        "View April Offers",
        "View May Offers",
        "View June Offers",
        "View July Offers",
        "View August Offers",
        "View September Offers",
        "View October Offers",
        "View November Offers",
        "View December Offers",
    }

    rows = text_content.split("\n")
    rows = [r.strip() for r in rows if r.strip()]
    rows = [r for r in rows if r not in subheadings_to_remove]

    cleaned_rows = []
    i = 0
    while i < len(rows):
        line = rows[i].strip()
        if line in unwanted_lines:
            i += 1
            continue
        # cleaning some exceptions while scraping
        if line.lower() == 'no' and (i + 1 < len(rows)) and rows[i + 1].strip() == 'Transmission Type':
            i += 1
            continue
        cleaned_rows.append(line)
        i += 1
    return cleaned_rows
