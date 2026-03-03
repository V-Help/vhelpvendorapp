import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const storage = getStorage(app);
const db = getFirestore(app);

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
            // Fetch version info from Firestore to get the storage path
            const versionDoc = await getDoc(doc(db, "app_config", "admin_version"));

            let storagePath = null;

            if (versionDoc.exists()) {
                const data = versionDoc.data();
                storagePath = data.storagePath;
            }

            if (!storagePath) {
                // Fallback: look for latest file in admin-releases/ folder
                const releasesRef = ref(storage, "admin-releases/");
                const result = await listAll(releasesRef);

                if (result.prefixes.length === 0) {
                    throw new Error("No releases found in Firebase Storage.");
                }

                // Get newest version folder (last prefix after sorting)
                const sortedFolders = result.prefixes.sort((a, b) => a.name.localeCompare(b.name));
                const latestFolder = sortedFolders[sortedFolders.length - 1];
                const filesInFolder = await listAll(latestFolder);

                // Find the arm64 APK
                const apkItem = filesInFolder.items.find(
                    (item) => item.name.includes("arm64") && item.name.endsWith(".apk")
                );

                if (!apkItem) throw new Error("No APK found in latest release folder.");
                storagePath = apkItem.fullPath;
            }

            // Get download URL from Firebase Storage (requires auth per security rules)
            this.downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting Download...';
            const apkRef = ref(storage, storagePath);
            const downloadUrl = await getDownloadURL(apkRef);

            // Redirect browser to download the APK
            window.location.href = downloadUrl;

            this.downloadBtn.innerHTML = '<i class="fas fa-check"></i> Download Started!';

        } catch (error) {
            console.error("Download error:", error);
            alert("Failed to download the APK. Please try again later or contact support.\n\nError: " + error.message);
        } finally {
            setTimeout(() => {
                this.downloadBtn.innerHTML = originalText;
            }, 3000);
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
