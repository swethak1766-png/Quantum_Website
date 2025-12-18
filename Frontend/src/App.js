// src/App.js

import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import SignUp from "./SignUp"; 
import Dashboard from "./Dashboard";
import "./App.css";
import backgroundImage from './images/background2.jpeg';
import Chatbot from "./components/Chatbot"; // Import the Chatbot component

function App() {
    // Defines the full-screen background style
    const appStyle = {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };

    return (
        // Apply the background style to the main container
        <div className="main-container" style={appStyle}>
            <BrowserRouter>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} /> 
                    
                    {/* Authenticated Routes */}
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/chat" element={<Chatbot />} /> 
                </Routes>
            </BrowserRouter>
        </div>
    );
}

export default App;