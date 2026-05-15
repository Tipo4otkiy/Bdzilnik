# Smart CRM for E-commerce & Apiary Management 🐝

🌍 **Choose language / Выберите язык / Оберіть мову:**
* [🇬🇧 English](#english)
* [🇷🇺 Русский](#crm-ru)
* [🇺🇦 Українська](#crm-ua)

---

<h2 id="english">Smart CRM [EN]</h2>

A lightweight, mobile-first Progressive Web App (PWA) designed to manage sales, track logistics, and maintain customer databases for small businesses and private sellers. Built with Vanilla JavaScript (ES6 Modules) and Firebase Firestore, it provides a seamless cross-platform experience with real-time synchronization and a modular architecture. 

### 🚀 Key Features

* **Role-Based Access Control (RBAC):** Supports 'Admin' and 'Seller' roles. Administrators can register new sellers, monitor all system orders, and securely transfer order histories between accounts.
* **Smart Order Management:** Features a custom touch-optimized "bottom sheet" UI for rapid order entry. Includes multi-currency support (UAH/USD) with live NBU (National Bank of Ukraine) exchange rate conversion for accurate analytics.
* **Automated Logistics & Tracking:** Deeply integrated with the Nova Poshta API for real-time city and branch autocomplete. Automatically resolves Ukrposhta postal codes based on the selected city. Includes an automated tracking pipeline that fetches live parcel statuses directly from courier APIs.
* **Intelligent Client Database:** Automatically deduplicates client profiles by merging multiple known name aliases under a single phone number.
* **Global Blacklist System:** Features a shared database to flag unreliable customers with specific reasons, instantly warning any seller who attempts to create a new order for a blacklisted phone number.
* **Product Presets:** Allows sellers to save frequently sold items with predefined prices and currencies for quick 1-click addition to orders.

### 🛠 Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules).
* **Backend / BaaS:** Firebase (Firestore v10, Authentication).
* **External APIs:** Nova Poshta API, NBU Stat API.
* **Architecture:** PWA (Progressive Web App) with Service Worker.

### 📦 Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/smart-crm.git](https://github.com/yourusername/smart-crm.git)
    cd smart-crm
    ```
2.  **Firebase & API Configuration:**
    Open `firebase.js` and replace the `firebaseConfig` object with your own Firebase project credentials. Open `Location.js` and insert your Nova Poshta API key into the `this.apiKey` variable.
3.  **Run Locally:**
    Since the app uses ES6 modules, it must be served via a local web server.
    ```bash
    npx http-server ./
    ```

---

<h2 id="crm-ru">Smart CRM [RU]</h2>

Легкое мобильное PWA-приложение для управления продажами, отслеживания логистики и ведения клиентской базы для малого бизнеса. Создано на чистом JavaScript (ES6 модули) и Firebase Firestore, обеспечивает мгновенную синхронизацию данных и модульную архитектуру.

### 🚀 Главные функции

* **Управление доступом (RBAC):** Поддержка ролей 'Администратор' и 'Продавец'. Администраторы могут регистрировать новых сотрудников, просматривать все заказы в системе и безопасно переносить историю заказов между аккаунтами.
* **Умное управление заказами:** Оптимизированный сенсорный интерфейс (bottom sheet) для быстрого создания заказов. Поддержка мультивалютности (ГРН/USD) с конвертацией по актуальному курсу НБУ для точной статистики.
* **Автоматизация логистики:** Глубокая интеграция с API "Новой Почты" для автозаполнения городов и отделений. Автоматический поиск индексов Укрпочты по выбранному населенному пункту. Встроенный парсер для отслеживания статусов посылок в реальном времени.
* **Интеллектуальная база клиентов:** Система автоматически объединяет различные варианты имен клиента (алиасы) под одним номером телефона для предотвращения дублей.
* **Глобальный Черный список:** Единая база недобросовестных покупателей. Система мгновенно предупреждает продавца, если он вводит номер телефона из черного списка.
* **Пресеты товаров:** Возможность сохранять частые позиции товаров с заданными ценами и валютой для добавления в заказ в один клик.

### 🛠 Технологический стек

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules).
* **Backend / BaaS:** Firebase (Firestore v10, Authentication).
* **Внешние API:** Nova Poshta API, NBU Stat API.
* **Архитектура:** PWA (Progressive Web App) с Service Worker.

### 📦 Установка и запуск

1.  **Клонируйте репозиторий:**
    ```bash
    git clone [https://github.com/yourusername/smart-crm.git](https://github.com/yourusername/smart-crm.git)
    cd smart-crm
    ```
2.  **Настройка API:**
    Откройте `firebase.js` и вставьте ключи вашего проекта Firebase. Откройте `Location.js` и добавьте ваш ключ "Новой Почты" в переменную `this.apiKey`.
3.  **Локальный запуск:**
    Запускайте проект через локальный веб-сервер, так как используются ES6 модули.
    ```bash
    npx http-server ./
    ```

---

<h2 id="crm-ua">Smart CRM [UA]</h2>

Легкий мобільний PWA-додаток для управління продажами, відстеження логістики та ведення клієнтської бази для малого бізнесу. Створений на чистому JavaScript (ES6 модулі) та Firebase Firestore, забезпечує миттєву синхронізацію даних та кросплатформність завдяки модульній архітектурі.

### 🚀 Головні функції

* **Управління доступом (RBAC):** Підтримка ролей 'Адміністратор' та 'Продавець'. Адміністратори можуть створювати нових співробітників, переглядати всі замовлення та безпечно переносити історію замовлень між акаунтами.
* **Розумне управління замовленнями:** Оптимізований сенсорний інтерфейс (bottom sheet) для швидкого створення замовлень. Підтримка мультивалютності (ГРН/USD) із конвертацією за актуальним курсом НБУ для точної статистики.
* **Автоматизація логістики:** Глибока інтеграція з API "Нової Пошти" для автозаповнення міст та відділень. Автоматичний пошук індексів Укрпошти за обраним населеним пунктом. Вбудований парсер для відстеження статусів посилок у реальному часі.
* **Інтелектуальна база клієнтів:** Система автоматично об'єднує різні варіанти імен клієнта (аліаси) під одним номером телефону для уникнення дублів.
* **Глобальний Чорний список:** Єдина база недобросовісних покупців. Система миттєво попереджає продавця, якщо він вводить номер телефону з чорного списку.
* **Пресети товарів:** Можливість зберігати часті позиції товарів із заданими цінами та валютою для додавання у замовлення в один клік.

### 🛠 Технологічний стек

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules).
* **Backend / BaaS:** Firebase (Firestore v10, Authentication).
* **Зовнішні API:** Nova Poshta API, NBU Stat API.
* **Архітектура:** PWA (Progressive Web App) з Service Worker.

### 📦 Встановлення та запуск

1.  **Клонуйте репозиторій:**
    ```bash
    git clone [https://github.com/yourusername/smart-crm.git](https://github.com/yourusername/smart-crm.git)
    cd smart-crm
    ```
2.  **Налаштування API:**
    Відкрийте `firebase.js` та вставте ключі вашого проєкту Firebase. Відкрийте `Location.js` та додайте ваш ключ "Нової Пошти" у змінну `this.apiKey`.
3.  **Локальний запуск:**
    Запускайте проєкт через локальний веб-сервер, оскільки використовуються ES6 модулі.
    ```bash
    npx http-server ./
    ```
