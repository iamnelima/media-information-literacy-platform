import os, glob, re
files = glob.glob('c:/Users/Tary/Desktop/M.I.L.E.S/media-information-literacy-platform/views/*.ejs')

pattern1 = r"(var navEmailEl = document\.getElementById\('nav-user-email'\);\s*)if \(navEmailEl\) navEmailEl\.textContent = sessionEmail;"
replace1 = r"\1var sessionUsername = sessionStorage.getItem('username');\n      if (navEmailEl) navEmailEl.textContent = sessionUsername ? '@' + sessionUsername : sessionEmail;"

pattern2 = r"(var emailEl = document\.getElementById\('nav-user-email'\);\s*)if \(emailEl\) emailEl\.textContent = sessionEmail;"
replace2 = r"\1var sessionUsername = sessionStorage.getItem('username');\n        if (emailEl) emailEl.textContent = sessionUsername ? '@' + sessionUsername : sessionEmail;"

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(pattern1, replace1, content)
    content = re.sub(pattern2, replace2, content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
