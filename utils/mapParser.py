import os
from bs4 import BeautifulSoup

def split_svg_map(input_file, output_dir):
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Read the SVG file
    with open(input_file, 'r') as f:
        svg_content = f.read()

    # Parse the SVG content
    soup = BeautifulSoup(svg_content, 'xml')

    # Find all group elements with role="menuitem"
    country_groups = soup.find_all('g', role='menuitem')

    # Create a dictionary to store country data
    countries = {}

    # Process each country group
    for group in country_groups:
        country_name = group['aria-label'].strip()
        if country_name not in countries:
            countries[country_name] = []
        countries[country_name].append(str(group))

    # Create individual SVG files for each country
    svg_template = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">\n{}\n</svg>'

    for country, elements in countries.items():
        filename = os.path.join(output_dir, f"{country.lower().replace(' ', '_')}.svg")
        content = '\n'.join(elements)
        with open(filename, 'w') as f:
            f.write(svg_template.format(content))

    print(f"Created SVG files for {len(countries)} countries in {output_dir}")

# Usage
split_svg_map('pixelmap.svg', 'country_svgs')pythpyt