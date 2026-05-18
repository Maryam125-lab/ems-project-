import os
import re

emoji_map = {
    '🏢': '<i class="fa-solid fa-building" aria-hidden="true"></i>',
    '👤': '<i class="fa-solid fa-user" aria-hidden="true"></i>',
    '📊': '<i class="fa-solid fa-chart-simple" aria-hidden="true"></i>',
    '👥': '<i class="fa-solid fa-users" aria-hidden="true"></i>',
    '✅': '<i class="fa-solid fa-square-check" aria-hidden="true"></i>',
    '🌍': '<i class="fa-solid fa-earth-americas" aria-hidden="true"></i>',
    '📅': '<i class="fa-regular fa-calendar" aria-hidden="true"></i>',
    '📋': '<i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>',
    '💳': '<i class="fa-regular fa-credit-card" aria-hidden="true"></i>',
    '📍': '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>',
    '🕐': '<i class="fa-regular fa-clock" aria-hidden="true"></i>',
    '💰': '<i class="fa-solid fa-money-bill-wave" aria-hidden="true"></i>',
    '📇': '<i class="fa-solid fa-address-book" aria-hidden="true"></i>',
    '📢': '<i class="fa-solid fa-bullhorn" aria-hidden="true"></i>',
    '👋': '<i class="fa-solid fa-hand" aria-hidden="true"></i>',
    '🔐': '<i class="fa-solid fa-user-lock" aria-hidden="true"></i>',
    '🔥': '<i class="fa-solid fa-fire" aria-hidden="true"></i>',
    '🔑': '<i class="fa-solid fa-key" aria-hidden="true"></i>',
    '📝': '<i class="fa-solid fa-file-pen" aria-hidden="true"></i>',
    '👍': '<i class="fa-solid fa-thumbs-up" aria-hidden="true"></i>',
    '👎': '<i class="fa-solid fa-thumbs-down" aria-hidden="true"></i>',
    '🚀': '<i class="fa-solid fa-rocket" aria-hidden="true"></i>',
}

base_path = r'c:\Users\HP\EMS.Web\Views'

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False
    for emoji, icon in emoji_map.items():
        if emoji in content:
            content = content.replace(emoji, icon)
            changed = True
            
    # Remove AI Slop / boilerplate
    slop1 = "Good afternoon, Admin 🔥"
    target1 = "Good afternoon, Admin"
    if slop1 in content:
        content = content.replace(slop1, target1)
        changed = True
        
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk(base_path):
    for name in files:
        if name.endswith('.cshtml'):
            process_file(os.path.join(root, name))
