import os
import re

files = [
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/profile.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/post.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/myposts.ejs',
    'c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/chatbot.ejs'
]

# Desktop:
desktop_profile_re = re.compile(
    r'(>[ \t\r\n]*<a[^>]*href="/profile"[^>]*>[\s\S]*?<span[^>]*>Profile</span></a\s*>)',
    re.IGNORECASE
)
desktop_myposts_re = re.compile(
    r'(>[ \t\r\n]*<a[^>]*href="/myposts"[^>]*>[\s\S]*?<span[^>]*>My Posts</span></a\s*>)',
    re.IGNORECASE
)

# Mobile:
mobile_profile_re = re.compile(
    r'([ \t\r\n]*<a[^>]*href="/profile"[^>]*>[\s\S]*?<span[^>]*>Profile</span></a\s*>)',
    re.IGNORECASE
)
mobile_myposts_re = re.compile(
    r'([ \t\r\n]*<a[^>]*href="/myposts"[^>]*>[\s\S]*?<span[^>]*>My Posts</span></a\s*>)',
    re.IGNORECASE
)

for file in files:
    if not os.path.exists(file):
        print(f"Not found {file}")
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # Move Desktop
    desktop_nav_start = content.find("hidden md:flex")
    desktop_nav_end = content.find("</div>", desktop_nav_start)
    if desktop_nav_start != -1 and desktop_nav_end != -1:
        desktop_nav_content = content[desktop_nav_start:desktop_nav_end]
        
        p_match = desktop_profile_re.search(desktop_nav_content)
        m_match = desktop_myposts_re.search(desktop_nav_content)

        if p_match and m_match:
            if p_match.start() < m_match.start():
                p_text = p_match.group(1)
                new_nav = desktop_nav_content[:p_match.start()] + ">" + desktop_nav_content[p_match.end():]
                
                m_match_new = desktop_myposts_re.search(new_nav)
                if m_match_new:
                    # insert after
                    insert_pos = m_match_new.end()
                    # p_text starts with ">\n   <a ...", so we just paste it over the closing ">" implicitly by replacing that segment.
                    new_nav2 = new_nav[:insert_pos-1] + p_text + new_nav[insert_pos:]
                    
                    content = content[:desktop_nav_start] + new_nav2 + content[desktop_nav_end:]
                    changed = True

    # Move Mobile
    mobile_nav_start = content.find("md:hidden border-t")
    if mobile_nav_start != -1:
        mobile_nav_end = content.find("</div>\n            <div", mobile_nav_start)
        if mobile_nav_end != -1:
            mobile_nav_content = content[mobile_nav_start:mobile_nav_end]
            mp_match = mobile_profile_re.search(mobile_nav_content)
            mm_match = mobile_myposts_re.search(mobile_nav_content)
            
            if mp_match and mm_match:
                if mp_match.start() < mm_match.start():
                    mp_text = mp_match.group(1)
                    new_mnav = mobile_nav_content[:mp_match.start()] + mobile_nav_content[mp_match.end():]
                    
                    mm_match_new = mobile_myposts_re.search(new_mnav)
                    if mm_match_new:
                        m_insert_pos = mm_match_new.end()
                        new_mnav2 = new_mnav[:m_insert_pos] + mp_text + new_mnav[m_insert_pos:]
                        
                        content = content[:mobile_nav_start] + new_mnav2 + content[mobile_nav_end:]
                        changed = True

    if changed:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")
    else:
        print(f"No changes {file}")
