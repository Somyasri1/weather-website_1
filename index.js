// index.js
const express = require('express');
const path = require('path');
const app = express();
require('dotenv').config();
const axios = require('axios'); // Added for weather API
const session = require('express-session'); // Added for session support

// ===== Firebase Setup =====
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service.json'); // make sure this JSON is in your project root

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // reference to Firestore
// ==========================

// ===== Middleware =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(session({
    secret: 'your-secret-key', // change this to a secure random string
    resave: false,
    saveUninitialized: true
}));

// Set EJS as templating engine
app.set('view engine', 'ejs');

// Set static folder for CSS/JS
app.use(express.static(path.join(__dirname, 'public')));

// ===== Routes =====
app.get('/', (req, res) => {
    res.redirect('/login'); // redirect root to login
});

// ===== Login Page =====
app.get('/login', (req, res) => {
    res.render('login');
});

// ===== Signup Page =====
app.get('/signup', (req, res) => {
    res.render('signup');
});

// ===== Signup POST route =====
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Create user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        // Store user info in Firestore
        await db.collection('users').doc(userRecord.uid).set({
            name,
            email,
            createdAt: new Date(),
        });

        res.redirect('/login'); // redirect to login after signup
    } catch (error) {
        console.error('Error creating user:', error);
        res.send(`<h3>Error: ${error.message}</h3><a href="/signup">Try Again</a>`);
    }
});

// ===== Login POST route =====
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find user by email in Firebase Auth
        const user = await admin.auth().getUserByEmail(email);

        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            return res.send(`<h3>User not found in Firestore</h3><a href="/login">Try Again</a>`);
        }

        // Save user info in session
        req.session.user = { uid: user.uid, name: user.displayName || 'User' };
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Error logging in:', error);
        res.send(`<h3>Error: ${error.message}</h3><a href="/login">Try Again</a>`);
    }
});

// ===== Dashboard Page (Protected) =====
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // redirect if not logged in
    }
    res.render('dashboard', { user: req.session.user, weather: null });
});

// ===== Weather POST route =====
app.post('/weather', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // protect weather route as well
    }

    const city = req.body.city;
    const apiKey = process.env.WEATHER_API_KEY;

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
        const response = await axios.get(url);
        const data = response.data;

        const weather = {
            city: data.name,
            temp: data.main.temp,
            condition: data.weather[0].main,
        };

        res.render('dashboard', { user: req.session.user, weather });
    } catch (error) {
        console.error(error);
        res.send(`<h3>City not found or API error</h3><a href="/dashboard">Go Back</a>`);
    }
});

// ===== Logout POST route =====
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
