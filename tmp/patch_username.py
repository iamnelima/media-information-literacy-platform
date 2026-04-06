import os
import glob

files = glob.glob('c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/*.ejs')

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replacement for profile.ejs
    content = content.replace(
        "var navEmailEl = document.getElementById('nav-user-email');\n      if (navEmailEl) navEmailEl.textContent = sessionEmail;",
        "var navEmailEl = document.getElementById('nav-user-email');\n      var sessionUsername = sessionStorage.getItem('username');\n      if (navEmailEl) navEmailEl.textContent = sessionUsername ? '@' + sessionUsername : sessionEmail;"
    )

    # Replacement for other views
    content = content.replace(
        "var emailEl = document.getElementById('nav-user-email');\n        if (emailEl) emailEl.textContent = sessionEmail;",
        "var emailEl = document.getElementById('nav-user-email');\n        var sessionUsername = sessionStorage.getItem('username');\n        if (emailEl) emailEl.textContent = sessionUsername ? '@' + sessionUsername : sessionEmail;"
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {file}")
