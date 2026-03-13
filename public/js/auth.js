document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    showPopup('Welcome!', 'You have logged in successfully.', () => {
                        window.location.href = data.user.role === 'admin' ? '/admin.html' : '/complaint.html';
                    });
                } else {
                    showPopup('Error', data.message || 'Login failed.');
                }
            } catch (err) {
                showPopup('Error', 'Network error. Please try again.');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();
                if (res.ok) {
                    showPopup('Success', 'Registration successful! Please login.', () => {
                        switchTab('login');
                    });
                } else {
                    showPopup('Error', data.message || 'Registration failed.');
                }
            } catch (err) {
                showPopup('Error', 'Network error. Please try again.');
            }
        });
    }
});
