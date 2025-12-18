import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./Firebase";
import "./App.css";
// 1. Make sure `Link` is imported from react-router-dom
import { useNavigate, Link } from "react-router-dom";
import logo from './images/logo.jpeg';

export default function Login() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [passwordShown, setPasswordShown] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLoginClick = () => setOpen(true);
  const togglePasswordVisibility = () => setPasswordShown(!passwordShown);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => setShowForm(true), 600);
      return () => clearTimeout(timer);
    } else {
        setShowForm(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      let msg = "Login failed. Please try again.";
      if (err.code === "auth/invalid-credential") {
        msg = "Incorrect email or password.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Too many attempts. Try again later.";
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a.75.75 0 010-1.113zM12.001 18.75c3.96 0 7.625-2.545 9.081-6.423a.75.75 0 000-.654C19.622 7.79 15.961 5.25 12.001 5.25c-3.96 0-7.625 2.545-9.081 6.423a.75.75 0 000 .654c1.456 3.878 5.121 6.423 9.081 6.423z" clipRule="evenodd" />
    </svg>
  );

  const EyeOffIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
       <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L8.717 5.05A11.25 11.25 0 0122.676 12.553zM11.247 15.75a5.25 5.25 0 01-6.71-6.71L1.323 5.824a.75.75 0 00-1.06 1.06l3.099 3.099A11.25 11.25 0 001.323 12.553a.75.75 0 000 1.113 11.249 11.249 0 0011.012 5.684l-2.099-2.099a5.25 5.25 0 01-1.003-1.7z" />
    </svg>
  );

  return (
    <div className={`neon-box login-view ${open ? "open" : ""}`}>
      <div className="box-content">
        {!open ? (
          <button className="neon-btn" onClick={handleLoginClick}>
            LOGIN
          </button>
        ) : (
          showForm && (
            <div className="login-form fade-in">
              <img src={logo} alt="App Logo" className="box-logo" />
              <h2>Login</h2>

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
                  <div className="input-group password-container">
                      <input
                          type={passwordShown ? "text" : "password"}
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                      />
                      <div className="eye-icon" onClick={togglePasswordVisibility}>
                          {passwordShown ? <EyeOffIcon /> : <EyeIcon />}
                      </div>
                  </div>

                  {error && <div className="error-text">{error}</div>}

                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                      {isSubmitting ? "Signing In..." : "Sign In"}
                  </button>
              </form>

              {/* 2. Place the "Sign Up" link here, after the form */}
              <div className="form-link">
                  <p>Don't have an account? <Link to="/signup">Sign Up</Link></p>
              </div>
              
            </div>
          )
        )}
      </div>
    </div>
  );
}