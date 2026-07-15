# 📖 MILES – Media & Information Literacy Engagement System

MILES is a **modern, community-driven web platform** designed to help users build critical media and information literacy skills.
It combines **AI-powered fact-checking**, **community reviews**, and **gamification** to fight misinformation and strengthen trust in credible information.

---

## 🚀 Features

### 🔑 Authentication

* Sign Up / Sign In pages with a clean, minimal design.
* New users learn what MILES is about before joining.

### Web Sockets
* Use of web Sockets for chatbot

### Idempotency
* Use idompotency for reputation points awarding to prevent susbsequent addition of points.

### 🏠 Home Feed

* Social feed 
* Posts contain:

  * Text or image content.
  * **AI Review Panel** showing credibility % and color-coded badge:

    * ✅ Green: Highly credible (≥70%)
    * 🟡 Yellow: Somewhat credible (60–69%)
    * 🟠 Orange: Low credibility (50–59%)
    * 🔴 Red: Not credible (<50%)
  * Short AI explanation (expandable for details).
* Click a post → open modal with **community comments/reviews**.

### ➕ Post Upload

* Upload text or image content.

### 👤 Profile Page

* Displays username, email, reputation score, and activity stats.

### 🤖 Chatbot – *MILES AI Tutor*

* Interactive AI chatbot that teaches **media & information literacy** concepts.
* Conversational UI with bot/user bubbles.
* Helps users learn fact-checking frameworks, spot misinformation, and build critical skills.

### 🎮 Gamification

* Points for participation.
* Encourages healthy engagement and rewards reliable contributors.

---

## 🧑‍💻 Tech Stack

* **Frontend:** HTML + CSS + JS (fully responsive, modern, aesthetic).
* **Backend:** NodeJs (Express).
* **Database:** MySQL

---

## 📦 Installation & Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/KyleOkunda/media-information-literacy-platform.git
   cd miles
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run development server**

   ```bash
   nodemon index
   ```

4. Open [http://localhost:3003/signin] in your browser.

---

## 🌍 Objectives

1. Enhance **media & information literacy** by teaching critical thinking and fact-checking skills.
2. Encourage **active community participation** in fighting misinformation.
3. Leverage **AI fact-checking** transparently, showing evidence and sources.
4. Build **long-term engagement** via gamification and recognition.
5. **Bridge human + AI efforts** by connecting to external fact-check databases (PolitiFact, Africa Check, FullFact, etc.).

---

## 🔒 Content Safety

MILES automatically evaluates uploaded images and text for appropriateness.

* **Inappropriate content (e.g., nudity, harmful imagery)** is declined before processing.
* AI + community moderation ensures a safe, credible environment.

---

✨ **MILES** empowers communities to think critically, check sources, and fight misinformation together.
