import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Initialize Firebase with vhelp-user config
const firebaseConfig = {
    apiKey: "AIzaSyA5niYNZKpEcyuLija7SlKqE1tuOwwCFu0",
    appId: "1:746633533881:web:ad21a7c7e8c95000383e68",
    messagingSenderId: "746633533881",
    projectId: "vhelp-user",
    authDomain: "vhelp-user.firebaseapp.com",
    storageBucket: "vhelp-user.firebasestorage.app",
    measurementId: "G-MV0MHNXHWE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

class VendorApp {
    constructor() {
        this.initDOM();
        this.setupEventListeners();
        this.setupAuthObserver();
        this.setupIntersectionObserver();
    }

    initDOM() {
        // Auth UI Elements
        this.authStateContainer = document.getElementById("authStateContainer");
        this.authModal = document.getElementById("authModal");
        this.loginForm = document.getElementById("loginForm");
        this.emailInput = document.getElementById("email");
        this.passwordInput = document.getElementById("password");
        this.authError = document.getElementById("authError");
        this.closeModalBtn = document.getElementById("closeModal");

        // Download Elements
        this.downloadBtn = document.getElementById("downloadAppBtn");
        this.downloadHint = document.getElementById("downloadHint");
    }

    setupEventListeners() {
        // Modal controls
        this.closeModalBtn.addEventListener("click", () => this.closeModal());

        // Close modal on outside click
        window.addEventListener("click", (e) => {
            if (e.target === this.authModal) {
                this.closeModal();
            }
        });

        // Login Form Submit
        this.loginForm.addEventListener("submit", (e) => this.handleLogin(e));

        // Download Button Click
        this.downloadBtn.addEventListener("click", () => this.handleDownloadClick());
    }

    setupAuthObserver() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.updateUIForLoggedInUser(user);
            } else {
                this.updateUIForLoggedOutUser();
            }
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        this.hideError();
        const loginBtn = document.getElementById("loginBtn");

        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;

        try {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

            await signInWithEmailAndPassword(auth, email, password);

            // Success - observer will handle UI update
            this.closeModal();
            this.loginForm.reset();
        } catch (error) {
            console.error("Login failed:", error);
            this.showError(this.getReadableErrorMessage(error.code));
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Sign In";
        }
    }

    handleLogout() {
        signOut(auth).catch((error) => console.error("Logout error:", error));
    }

    showModal() {
        this.authModal.classList.add("active");
        this.hideError();
    }

    closeModal() {
        this.authModal.classList.remove("active");
    }

    showError(msg) {
        this.authError.textContent = msg;
        this.authError.classList.add("visible");
    }

    hideError() {
        this.authError.classList.remove("visible");
    }

    getReadableErrorMessage(code) {
        switch (code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'Invalid email or password.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Please try again later.';
            default:
                return 'An error occurred during sign in.';
        }
    }

    updateUIForLoggedInUser(user) {
        // Update Nav
        this.authStateContainer.innerHTML = `
      <div class="user-profile">
        <span class="user-email"><i class="fas fa-user-shield" style="margin-right: 6px; color: #8b5cf6;"></i>${user.email}</span>
        <button id="logoutBtn" class="logout-btn">Sign Out</button>
      </div>
    `;

        document.getElementById("logoutBtn").addEventListener("click", () => this.handleLogout());

        // Update Download Section
        this.downloadBtn.classList.remove("locked");
        this.downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Admin App';
        this.downloadHint.textContent = `Authorized as ${user.email}`;
        this.downloadHint.style.color = "var(--success)";
    }

    updateUIForLoggedOutUser() {
        // Update Nav
        this.authStateContainer.innerHTML = `
      <button id="navLoginBtn" class="login-trigger-btn">Admin Login</button>
    `;

        document.getElementById("navLoginBtn").addEventListener("click", () => this.showModal());

        // Update Download Section
        this.downloadBtn.classList.add("locked");
        this.downloadBtn.innerHTML = '<i class="fas fa-lock"></i> Login to Download App';
        this.downloadHint.textContent = "Requires authorized admin account access.";
        this.downloadHint.style.color = "var(--text-muted)";
    }

    async handleDownloadClick() {
        const user = auth.currentUser;
        if (!user) {
            this.showModal();
            return;
        }

        const originalText = this.downloadBtn.innerHTML;
        this.downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching Release...';

        try {
            // Fetch latest release from V HELP-ADMIN or shared GitHub repo
            // Note: Adjust the repository URL to where the Admin APK is stored.
            // Assuming it's in the same repo, or change if diff repo.
            const response = await fetch("https://api.github.com/repos/vhelpcc/VHELP-releases/releases/latest");

            if (!response.ok) throw new Error("Failed to fetch latest release");

            const release = await response.json();

            // Look for the admin APK or universal APK
            const apkAsset = release.assets.find(
                (asset) => asset.name.includes("ADMIN") || asset.name.endsWith("universal.apk")
            );

            if (!apkAsset) throw new Error("Admin APK file not found in latest release");

            this.downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting Download...';
            window.location.href = apkAsset.browser_download_url;

        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to fetch the latest download link automatically. Please try again later or contact support.");
        } finally {
            setTimeout(() => {
                this.downloadBtn.innerHTML = originalText;
            }, 2000);
        }
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = "1";
                    entry.target.style.transform = "translateY(0)";
                }
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

        document.querySelectorAll(".fade-in").forEach((el) => {
            el.style.opacity = "0";
            el.style.transform = "translateY(20px)";
            el.style.transition = "all 0.6s ease";
            observer.observe(el);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new VendorApp();
});
