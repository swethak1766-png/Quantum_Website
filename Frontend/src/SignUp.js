// src/SignUp.js

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./Firebase";
import "./App.css";
import { useNavigate, Link } from "react-router-dom";
import logo from './images/logo.jpeg';

export default function SignUp() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
            // This is the Firebase function to create a new user
            await createUserWithEmailAndPassword(auth, email, password);
            
            // On success, navigate to the dashboard
            alert("Account created successfully! Logging you in...");
            navigate("/dashboard");

        } catch (err) {
            console.error("❌ Sign-up failed:", err);
            let msg = "Failed to create account. Please try again.";

            // This is how you catch the "email already in use" error
            if (err.code === "auth/email-already-in-use") {
                msg = "This email address is already in use by another account.";
            } else if (err.code === 'auth/invalid-email') {
                msg = "Please enter a valid email address.";
            } else if (err.code === 'auth/weak-password') {
                msg = "Password is too weak. It should be at least 6 characters.";
            }
            
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="neon-box open"> {/* Simplified to always be open */}
            <div className="box-content">
                <div className="login-form fade-in">
                    <img src={logo} alt="App Logo" className="box-logo" />
                    <h2>Create Account</h2>

                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="password"
                                placeholder="Password (min. 6 characters)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="error-text">{error}</div>}

                        <button type="submit" className="submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? "Creating Account..." : "Sign Up"}
                        </button>
                        
                        <div className="form-link">
                            <p>Already have an account? <Link to="/">Log In</Link></p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}