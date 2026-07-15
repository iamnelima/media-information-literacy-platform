import os
import re

files = [
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/index.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/profile.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/post.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/myposts.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/chatbot.ejs'
]

desktop_profile_re = re.compile(
    r'(>\s*<a[^>]*href="/profile"[^>]*>[\s\S]*?<span[^>]*>Profile</span></a\s*>)',
    re.IGNORECASE
)
desktop_myposts_re = re.compile(
    r'(>\s*<a[^>]*href="/myposts"[^>]*>[\s\S]*?<span[^>]*>My Posts</span></a\s*>)',
    re.IGNORECASE
)

# Mobile matching
mobile_profile_re = re.compile(
    r'(<a[^>]*href="/profile"[^>]*>[\s\S]*?<span[^>]*>Profile</span></a\s*>)',
    re.IGNORECASE
)
mobile_myposts_re = re.compile(
    r'(<a[^>]*href="/myposts"[^>]*>[\s\S]*?<span[^>]*>My Posts</span></a\s*>)',
    re.IGNORECASE
)

for file in files:
    if not os.path.exists(file):
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # Move Desktop
    desktop_nav_start = content.find("hidden md:flex")
    desktop_nav_end = content.find("</div>", desktop_nav_start)
    if desktop_nav_start != -1 and desktop_nav_end != -1:
        desktop_nav_content = content[desktop_nav_start:desktop_nav_end]
        
        profile_match = desktop_profile_re.search(desktop_nav_content)
        myposts_match = desktop_myposts_re.search(desktop_nav_content)

        if profile_match and myposts_match:
            if profile_match.start() < myposts_match.start():
                profile_text = profile_match.group(1)
                new_desktop_nav = desktop_nav_content[:profile_match.start()] + desktop_nav_content[profile_match.end():]
                
                # Search again in modified content
                myposts_match = desktop_myposts_re.search(new_desktop_nav)
                if myposts_match:
                    insert_pos = myposts_match.end()
                    new_desktop_nav = new_desktop_nav[:insert_pos] + profile_text + new_desktop_nav[insert_pos:]
                    content = content[:desktop_nav_start] + new_desktop_nav + content[desktop_nav_end:]
                    changed = True

    # Move Mobile
    mobile_nav_start = content.find("md:hidden border-t")
    if mobile_nav_start != -1:
        mobile_nav_end = content.find("</div>\n            <div", mobile_nav_start)
        if mobile_nav_end != -1:
            mobile_nav_content = content[mobile_nav_start:mobile_nav_end]
            m_profile_match = mobile_profile_re.search(mobile_nav_content)
            m_myposts_match = mobile_myposts_re.search(mobile_nav_content)
            if m_profile_match and m_myposts_match:
                if m_profile_match.start() < m_myposts_match.start():
                    m_profile_text = m_profile_match.group(1)
                    new_mobile_nav = mobile_nav_content[:m_profile_match.start()] + mobile_nav_content[m_profile_match.end():]
                    
                    m_myposts_match = mobile_myposts_re.search(new_mobile_nav)
                    if m_myposts_match:
                        insert_pos = m_myposts_match.end()
                        new_mobile_nav = new_mobile_nav[:insert_pos] + "\n              " + m_profile_text + new_mobile_nav[insert_pos:]
                        content = content[:mobile_nav_start] + new_mobile_nav + content[mobile_nav_end:]
                        changed = True

    if changed:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
    else:
        print(f"No changes required or no match found in {file}")
