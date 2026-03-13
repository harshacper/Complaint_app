const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const db = require('./db');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_please_change';

// Create a test email account for NodeMailer
let transporter;
nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return process.exit(1);
    }
    console.log('Credentials obtained, listening on ethereal email');
    transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass
        }
    });
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// JWT Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied: No Token Provided!' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid Token' });
        req.user = user;
        next();
    });
}

// Ensure Admin Middleware
function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied: You are not an Admin' });
    }
    next();
}

// Routes
// 1. Auth: Register
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword], function(err) {
            if (err) {
                if(err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Email already exists' });
                }
                return res.status(500).json({ message: 'Database error', error: err.message });
            }
            res.status(201).json({ message: 'User registered successfully!' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// 2. Auth: Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });
});

// 3. Submit Complaint
app.post('/api/complaints', authenticateToken, upload.single('photo'), (req, res) => {
    const { title, description, latitude, longitude } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const user_id = req.user.id;
    const user_name = req.user.name;
    const user_email = req.user.email;

    db.run(`INSERT INTO complaints (user_id, user_name, user_email, title, description, photo_url, latitude, longitude) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [user_id, user_name, user_email, title, description, photo_url, latitude, longitude], function(err) {
        if (err) return res.status(500).json({ message: 'Database error', error: err.message });
        res.status(201).json({ message: 'Complaint submitted successfully!' });
    });
});

// 4. Get all Complaints (Admin or specific User's complaints)
app.get('/api/complaints', authenticateToken, (req, res) => {
    if (req.user.role === 'admin') {
        db.all("SELECT * FROM complaints ORDER BY created_at DESC", [], (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json(rows);
        });
    } else {
        db.all("SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC", [req.user.id], (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            res.json(rows);
        });
    }
});

// 5. Update Complaint Status (Admin Only)
app.put('/api/complaints/:id/status', authenticateToken, isAdmin, (req, res) => {
    const complaintId = req.params.id;
    const { status } = req.body;

    db.get("SELECT user_email, user_name, title FROM complaints WHERE id = ?", [complaintId], (err, complaint) => {
        if (err || !complaint) return res.status(404).json({ message: 'Complaint not found' });

        db.run("UPDATE complaints SET status = ? WHERE id = ?", [status, complaintId], function(err) {
            if (err) return res.status(500).json({ message: 'Database error' });

            if (status === 'Solved' && transporter) {
                // Send email
                const mailOptions = {
                    from: '"Complaint System" <noreply@complaints.com>',
                    to: complaint.user_email,
                    subject: `Complaint Resolved: ${complaint.title}`,
                    text: `Hello ${complaint.user_name},\n\nYour complaint titled "${complaint.title}" has been marked as solved by the administration.\n\nThank you for reaching out to us.`,
                    html: `<h3>Hello ${complaint.user_name},</h3><p>Your complaint titled "<strong>${complaint.title}</strong>" has been marked as <strong>Solved</strong> by the administration.</p><p>Thank you for reaching out to us.</p>`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) return console.log('Error sending mail:', error);
                    console.log('Message sent: %s', info.messageId);
                    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
                });
            }
            res.json({ message: `Complaint status updated to ${status}` });
        });
    });
});

app.get(['/', '/home'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
