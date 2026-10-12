import os
import re

html_files = []
for root, dirs, files in os.walk('.'):
    # skip .git or other ignored dirs if any
    if '.git' in root or '.gemini' in root:
        continue
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(root, f))

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if we already wrapped it to avoid double wrapping
    if '<div class="table-responsive">' in content:
        continue
    
    # Replace <table...> ... </table>
    # We use re.sub with a function to ensure we don't double wrap if someone added class manually
    def replacer(match):
        table_html = match.group(1)
        return f'<div class="table-responsive">\n{table_html}\n</div>'

    new_content = re.sub(r'(<table[^>]*>.*?</table>)', replacer, content, flags=re.DOTALL | re.IGNORECASE)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
