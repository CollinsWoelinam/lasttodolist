import { 
    auth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged,
    updateProfile,
    db,
    setDoc,
    doc,
    serverTimestamp,
    getDoc
} from './firebase-config.js';

// DOM elements
const loginPage = document.getElementById('loginPage');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const loginButton = document.getElementById('loginButton');
const signupButton = document.getElementById('signupButton');
const signOutButton = document.getElementById('signOutButton');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

// Hide error message
function hideError(element) {
    element.textContent = '';
    element.classList.add('hidden');
}

// Toggle between login and signup forms
showSignup.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    hideError(loginError);
});

showLogin.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    hideError(signupError);
});

// Signup function
signupButton.addEventListener('click', async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    hideError(signupError);
    
    if (!name) {
        showError(signupError, 'Please enter your name');
        return;
    }
    
    if (password.length < 6) {
        showError(signupError, 'Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(signupError, 'Passwords do not match');
        return;
    }
    
    if (email && password) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update profile with display name
            await updateProfile(user, {
                displayName: name
            });
            
            // Create user document in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                createdAt: serverTimestamp()
            });
            
            // Clear form
            document.getElementById('signupName').value = '';
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            
            // Switch to login form
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            
            showNotification('Account created successfully! Please sign in.');
        } catch (error) {
            console.error('Error signing up:', error);
            showError(signupError, 'Error creating account: ' + error.message);
        }
    } else {
        showError(signupError, 'Please fill all fields');
    }
});

// Login function
loginButton.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    hideError(loginError);
    
    if (email && password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            
            // Clear form
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
        } catch (error) {
            console.error('Error signing in:', error);
            showError(loginError, 'Invalid email or password');
        }
    } else {
        showError(loginError, 'Please enter both email and password');
    }
});

// Sign out function
signOutButton.addEventListener('click', () => {
    // Unsubscribe from tasks listener before signing out
    if (window.unsubscribeTasks) {
        window.unsubscribeTasks();
        window.unsubscribeTasks = null;
    }
    
    signOut(auth).then(() => {
        // Clear tasks and update UI
        window.tasks = [];
        if (window.renderTasks) window.renderTasks();
        if (window.updateAnalytics) window.updateAnalytics();
        showNotification('Signed out successfully');
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Error signing out: ' + error.message, false);
    });
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        userEmail.textContent = user.email;
        
        // Get user data from Firestore
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userName.textContent = userData.name;
                userAvatar.textContent = userData.name.charAt(0).toUpperCase();
            } else {
                // Fallback to email if no name is available
                userName.textContent = user.email.split('@')[0];
                userAvatar.textContent = user.email.charAt(0).toUpperCase();
            }
        } catch (error) {
            console.error('Error getting user data:', error);
            userName.textContent = user.email.split('@')[0];
            userAvatar.textContent = user.email.charAt(0).toUpperCase();
        }
        
        loginPage.classList.add('hidden');
        appContainer.classList.remove('hidden');
        
        // Ensure Dashboard is the active page
        const navItems = document.querySelectorAll('.nav-item[data-page]');
        navItems.forEach(navItem => navItem.classList.remove('active'));
        document.querySelector('[data-page="dashboard"]').classList.add('active');
        
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById('dashboardPage').classList.add('active');
        
        document.getElementById('pageTitle').textContent = 'Dashboard';
        
        if (window.loadTasks) window.loadTasks();
    } else {
        window.currentUser = null;
        loginPage.classList.remove('hidden');
        appContainer.classList.add('hidden');
        document.getElementById('tasksContainer').innerHTML = '';
        document.getElementById('allTasksContainer').innerHTML = '';
        if (window.updateStats) window.updateStats(0, 0, 0);
        
        // Clear tasks when user signs out
        window.tasks = [];
    }
});

// Export auth functions
export { auth, onAuthStateChanged, signOut };