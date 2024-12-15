const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 1081;

// Telegram Bot Token
const token = '7326110638:AAGTL5Wkwa-CK4Y9Kh0WhOzRvnWIz0889xs';
const bot = new TelegramBot(token, { polling: true });

// Путь для хранения данных пользователей
const userSurveyDataPath = path.join(__dirname, 'userSurveyData.json');

// Инициализация файла, если он не существует
if (!fs.existsSync(userSurveyDataPath)) {
    fs.writeFileSync(userSurveyDataPath, JSON.stringify({}));
}

// Функция для создания уникального токена
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// Функция сохранения данных пользователей
function saveUserSurveyData(userId, data) {
    let userSurveyData = {};
    if (fs.existsSync(userSurveyDataPath)) {
        try {
            userSurveyData = JSON.parse(fs.readFileSync(userSurveyDataPath, 'utf-8'));
        } catch (err) {
            console.error('Ошибка при чтении JSON:', err);
            userSurveyData = {};
        }
    }
    userSurveyData[userId] = data;
    fs.writeFileSync(userSurveyDataPath, JSON.stringify(userSurveyData, null, 2));
}

// Функция загрузки данных пользователей
function loadUserSurveyData(userId) {
    let userSurveyData = {};
    if (fs.existsSync(userSurveyDataPath)) {
        try {
            const data = fs.readFileSync(userSurveyDataPath, 'utf-8');
            if (data) {
                userSurveyData = JSON.parse(data);
            }
        } catch (err) {
            console.error('Ошибка при чтении JSON:', err);
            userSurveyData = {};
        }
    }
    return userSurveyData[userId] || { answers: {}, completed: false, readPrivacy: false, readInstructions: false, currentQuestionIndex: 0, token: null };
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/survey', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'survey.html'));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.post('/auth', (req, res) => {
    const { token } = req.body;
    let userData = Object.values(loadUserSurveyData()).find(data => data.token === token);
    if (userData) {
        res.json({ success: true, data: userData });
    } else {
        res.json({ success: false, message: 'Неверный токен' });
    }
});

app.post('/save-survey', (req, res) => {
    const { token, answers, currentQuestionIndex, readPrivacy, readInstructions } = req.body;
    let userData = Object.values(loadUserSurveyData()).find(data => data.token === token);
    if (userData) {
        userData.answers = answers;
        userData.currentQuestionIndex = currentQuestionIndex;
        userData.readPrivacy = readPrivacy;
        userData.readInstructions = readInstructions;
        saveUserSurveyData(userData.userId, userData);
        res.json({ message: 'Данные сохранены.' });
    } else {
        res.json({ message: 'Ошибка при сохранении данных.' });
    }
});

app.post('/submit-survey', (req, res) => {
    const { token, answers, completed, readPrivacy, readInstructions } = req.body;
    let userData = Object.values(loadUserSurveyData()).find(data => data.token === token);
    if (userData) {
        if (completed && !userData.completed) {
            userData.completed = true;
            userData.completionTime = Date.now();
        }
        saveUserSurveyData(userData.userId, { ...userData, answers, completed, readPrivacy, readInstructions });
        res.json({ message: 'Спасибо за ваш ответ. С вами свяжутся в ближайшее время.' });
    } else {
        res.json({ message: 'Ошибка при завершении опроса.' });
    }
});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    let userData = loadUserSurveyData(chatId) || { userId: chatId, answers: {}, completed: false, readPrivacy: false, readInstructions: false, token: generateToken() };

    if (!userData.token) {
        userData.token = generateToken();
    }

    saveUserSurveyData(chatId, userData);

    bot.sendMessage(chatId, `Ваш токен для авторизации: ${userData.token}. Перейдите по [ссылке](http://localhost:${PORT}/survey) и используйте его для входа.`, {
        parse_mode: 'Markdown'
    });
});

function startSurvey(chatId, userData) {
    const questions = [
        { question: "1. Ваше имя?", options: [] },
        { question: "2. Ваш пол?", options: ["Мужской", "Женский", "Другой"] },
        { question: "3. Дата рождения (в формате 00.00.0000)?", options: [] },
        { question: "4. Ваш контактный номер телефона?", options: [] },
        { question: "5. Ваш электронный адрес?", options: [] },
        { question: "6. Ваш ID в Telegram?", options: [] },
        { question: "7. Ваше семейное положение?", options: ["Женат", "Холост", "В разводе", "Состою в отношениях"] },
        { question: "8. Вы владеете иностранными языками?", options: ["Да", "Нет"] },
        { question: "9. Какой у вас опыт в IT?", options: ["Новичок", "Уверенный пользователь", "Профессионал"] },
        { question: "10. На каких платформах вы работали?", options: ["Windows", "macOS", "Linux", "Другие"] },
        { question: "11. Какие технологии вы знаете?", options: ["JavaScript", "Python", "Java", "C++", "Другие"] },
        { question: "12. Какой ваш уровень владения английским языком?", options: ["Начальный", "Средний", "Продвинутый", "Свободное владение"] },
        { question: "13. Работали ли вы с Agile или Scrum методологиями?", options: ["Да", "Нет"] },
        { question: "14. Есть ли у вас опыт работы в международных командах?", options: ["Да", "Нет"] },
        { question: "15. Вы используете Git или другие системы контроля версий?", options: ["Да", "Нет"] },
        { question: "16. Как вы справляетесь с трудными задачами?", options: ["Анализирую", "Консультируюсь", "Действую"] },
        { question: "17. Вы предпочитаете работать в команде или самостоятельно?", options: ["В команде", "Самостоятельно"] },
        { question: "18. Как вы обучаетесь новым навыкам?", options: ["Онлайн-курсы", "Книги", "Практика", "Семинары"] },
        { question: "19. Как вы оцениваете свои лидерские качества?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "20. Как вы принимаете решения в стрессовых ситуациях?", options: ["Холодный расчет", "Интуиция", "Консультация"] },
        { question: "21. Вы готовы работать удаленно?", options: ["Да", "Нет"] },
        { question: "22. Вы согласны с нашими условиями работы?", options: ["Да", "Нет"] },
        { question: "23. Готовы ли вы к обучению новым технологиям?", options: ["Да", "Нет"] },
        { question: "24. Вам комфортно работать в условиях неопределенности?", options: ["Да", "Нет"] },
        { question: "25. Готовы ли вы к командировкам?", options: ["Да", "Нет"] },
        { question: "26. Вы заинтересованы в карьерном росте?", options: ["Да", "Нет"] },
        { question: "27. Вы имеете опыт работы в команде?", options: ["Да", "Нет"] },
        { question: "28. Вы готовы к гибкому графику?", options: ["Да", "Нет"] },
        { question: "29. Вы используете Agile методологии?", options: ["Да", "Нет"] },
        { question: "30. Вы знакомы с DevOps практиками?", options: ["Да", "Нет"] },
        { question: "31. Вы имеете опыт работы с клиентами?", options: ["Да", "Нет"] },
        { question: "32. Вы готовы работать в условиях стресса?", options: ["Да", "Нет"] },
        { question: "33. Вы открыты для новых идей?", options: ["Да", "Нет"] },
        { question: "34. Вы готовы делиться знаниями?", options: ["Да", "Нет"] },
        { question: "35. Вы имеете опыт наставничества?", options: ["Да", "Нет"] },
        { question: "36. Вы готовы к изменениям в проекте?", options: ["Да", "Нет"] },
        { question: "37. Вы имеете опыт работы с API?", options: ["Да", "Нет"] },
        { question: "38. Вы заинтересованы в долгосрочных проектах?", options: ["Да", "Нет"] },
        { question: "39. Вы владеете навыками презентации?", options: ["Да", "Нет"] },
        { question: "40. Вы имеете опыт ведения переговоров?", options: ["Да", "Нет"] },
        { question: "41. Что вас мотивирует в работе?", options: ["Успех", "Деньги", "Развитие", "Признание"] },
        { question: "42. Какой ваш подход к решению проблем?", options: ["Стратегический", "Тактический", "Аналитический"] },
        { question: "43. Как вы справляетесь с неудачами?", options: ["Анализ", "Перерыв", "Продолжение"] },
        { question: "44. Что для вас значит качество работы?", options: ["Точность", "Эффективность", "Креативность"] },
        { question: "45. Как вы строите отношения с коллегами?", options: ["Дружелюбие", "Профессионализм", "Дистанция"] },
        { question: "46. Как вы настраиваете свою команду на успех?", options: ["Мотивация", "Планирование", "Поддержка"] },
        { question: "47. Как вы обучаетесь новым навыкам?", options: ["Онлайн-курсы", "Книги", "Практика"] },
        { question: "48. Как вы оцениваете свои лидерские качества?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "49. Какой ваш самый успешный проект?", options: [] },
        { question: "50. Как вы решаете конфликты в коллективе?", options: ["Обсуждение", "Игнорирование", "Посредничество"] },
        { question: "51. Как вы оцениваете свои коммуникативные навыки?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "52. Как вы относитесь к критике?", options: ["Конструктивно", "Негативно", "Спокойно"] },
        { question: "53. Как вы мотивируете себя на работу?", options: ["Цели", "Награды", "Развитие"] },
        { question: "54. Что для вас важно в работе?", options: ["Качество", "Эффективность", "Творчество"] },
        { question: "55. Как вы справляетесь с конфликтными ситуациями?", options: ["Обсуждение", "Игнорирование", "Посредничество"] },
        { question: "56. Какие у вас хобби и увлечения?", options: ["Спорт", "Чтение", "Музыка", "Путешествия"] },
        { question: "57. Как вы видите свое профессиональное развитие?", options: ["Карьера", "Навыки", "Проекты"] },
        { question: "58. Что вы делаете для поддержания здорового баланса между работой и личной жизнью?", options: ["Планирование", "Отдых", "Спорт"] },
        { question: "59. Как вы относитесь к командной работе?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "60. Как вы справляетесь с многозадачностью?", options: ["Приоритеты", "Планирование", "Фокусировка"] },
        { question: "61. Как вы определяете приоритеты в работе?", options: ["Срочность", "Важность", "Ресурсы"] },
        { question: "62. Как вы относитесь к обучению и саморазвитию?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "63. Какой ваш самый большой профессиональный успех?", options: [] },
        { question: "64. Какой ваш самый большой профессиональный провал?", options: [] },
        { question: "65. Как вы видите себя через 5 лет?", options: ["Карьера", "Навыки", "Проекты"] },
        { question: "66. Что для вас значит быть лидером?", options: ["Ответственность", "Вдохновение", "Управление"] },
        { question: "67. Как вы относитесь к изменениям?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "68. Что вас вдохновляет в жизни?", options: ["Цели", "Люди", "Опыт"] },
        { question: "69. Как вы определяете успех?", options: ["Достижения", "Признание", "Удовлетворение"] },
        { question: "70. Как вы оцениваете свои организационные способности?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "71. Как вы относитесь к новым вызовам?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "72. Как вы справляетесь с критикой?", options: ["Конструктивно", "Негативно", "Спокойно"] },
        { question: "73. Как вы поддерживаете мотивацию в команде?", options: ["Мотивация", "Планирование", "Поддержка"] },
        { question: "74. Как вы оцениваете свои навыки решения проблем?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "75. Как вы адаптируетесь к изменениям?", options: ["Быстро", "Медленно", "Спокойно"] },
        { question: "76. Как вы планируете свою карьеру?", options: ["Карьера", "Навыки", "Проекты"] },
        { question: "77. Как вы видите роль технологии в вашей работе?", options: ["Важная", "Необходимая", "Второстепенная"] },
        { question: "78. Как вы используете обратную связь для улучшения?", options: ["Анализ", "Корректировка", "Обучение"] },
        { question: "79. Как вы определяете свои сильные и слабые стороны?", options: ["Анализ", "Обратная связь", "Самоанализ"] },
        { question: "80. Как вы управляете стрессом?", options: ["Отдых", "Спорт", "Медитация"] },
        { question: "81. Как вы развиваетесь профессионально?", options: ["Курсы", "Проекты", "Обучение"] },
        { question: "82. Как вы оцениваете свои коммуникативные навыки?", options: ["Высокие", "Средние", "Низкие"] },
        { question: "83. Как вы относитесь к критике?", options: ["Конструктивно", "Негативно", "Спокойно"] },
        { question: "84. Как вы мотивируете себя на работу?", options: ["Цели", "Награды", "Развитие"] },
        { question: "85. Что для вас важно в работе?", options: ["Качество", "Эффективность", "Творчество"] },
        { question: "86. Как вы справляетесь с конфликтными ситуациями?", options: ["Обсуждение", "Игнорирование", "Посредничество"] },
        { question: "87. Какие у вас хобби и увлечения?", options: ["Спорт", "Чтение", "Музыка", "Путешествия"] },
        { question: "88. Как вы видите свое профессиональное развитие?", options: ["Карьера", "Навыки", "Проекты"] },
        { question: "89. Что вы делаете для поддержания здорового баланса между работой и личной жизнью?", options: ["Планирование", "Отдых", "Спорт"] },
        { question: "90. Как вы относитесь к командной работе?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "91. Как вы справляетесь с многозадачностью?", options: ["Приоритеты", "Планирование", "Фокусировка"] },
        { question: "92. Как вы определяете приоритеты в работе?", options: ["Срочность", "Важность", "Ресурсы"] },
        { question: "93. Как вы относитесь к обучению и саморазвитию?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "94. Какой ваш самый большой профессиональный успех?", options: [] },
        { question: "95. Какой ваш самый большой профессиональный провал?", options: [] },
        { question: "96. Как вы видите себя через 5 лет?", options: ["Карьера", "Навыки", "Проекты"] },
        { question: "97. Что для вас значит быть лидером?", options: ["Ответственность", "Вдохновение", "Управление"] },
        { question: "98. Как вы относитесь к изменениям?", options: ["Положительно", "Нейтрально", "Отрицательно"] },
        { question: "99. Что вас вдохновляет в жизни?", options: ["Цели", "Люди", "Опыт"] },
        { question: "100. Как вы определяете успех?", options: ["Достижения", "Признание", "Удовлетворение"] }
    ];

    let index = userData.currentQuestionIndex || 0;

    const askQuestion = () => {
        if (index < questions.length) {
            const currentQuestionObj = questions[index];
            const options = {
                reply_markup: {
                    keyboard: currentQuestionObj.options.length > 0 ? [...currentQuestionObj.options.map(option => [option]), ['Пропустить']] : [['Пропустить']],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            };
            bot.sendMessage(chatId, currentQuestionObj.question, options);
            bot.once('message', (answer) => {
                if (answer.text !== 'Пропустить') {
                    userData.answers[currentQuestionObj.question] = answer.text;
                }
                index++;
                userData.currentQuestionIndex = index;
                saveUserSurveyData(chatId, userData);
                askQuestion();
            });
        } else {
            userData.completed = true;
            saveUserSurveyData(chatId, userData);
            bot.sendMessage(chatId, 'Опрос завершен. Спасибо за участие!');
        }
    };

    askQuestion();
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});