// src/components/Chatbot.js

import React, { useState } from 'react';
import { getAuth } from "firebase/auth";
import '../App.css'; 
import { Link } from 'react-router-dom'; 
import logo from '../images/logo.jpeg'; // <--- 1. IMPORT LOGO

const Chatbot = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const auth = getAuth();

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);

        // Add user message to state
        setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);

        const user = auth.currentUser;
        if (!user) {
            setMessages(prev => [...prev, { sender: 'bot', text: 'Authentication required to use the chatbot.' }]);
            setIsLoading(false);
            return;
        }

        try {
            const token = await user.getIdToken();

            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                // Try to parse the JSON error first
                let errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                } catch {
                     // If JSON fails, it might be a connectivity or server setup error (like CORS preflight failure)
                    throw new Error(`Failed to fetch. Server status: ${response.status}. Ensure server is running and API key is set.`);
                }
            }

            const data = await response.json();
            
            // Add bot response to state
            setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);

        } catch (error) {
            console.error("Chatbot error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: `Error: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    return (
        <div className="neon-box chat-view open" style={{ height: '95vh', maxHeight: '900px', width: '500px' }}>
            <div className="box-content" style={{ display: 'flex', flexDirection: 'column' }}>
                
                {/* --- 2. ADDED LOGO --- */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 10px 0' }}>
                    <img src={logo} alt="App Logo" className="box-logo" />
                </div>
                {/* ------------------- */}
                
                <h2 style={{ textAlign: 'center', margin: '0 0 1rem 0' }}>AI Security Chat</h2>
                
                {/* Optional: Add a back button */}
                <Link to="/dashboard" style={{ position: 'absolute', top: '10px', right: '10px', color: '#00ccff', textDecoration: 'none', fontSize: '0.9rem' }}>
                    &larr; Back to Dashboard
                </Link>

                {/* Chat Messages Area */}
                <div className="chat-messages" style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', background: '#1a1a1a', borderRadius: '10px', marginBottom: '1rem' }}>
                    {messages.length === 0 && (
                        <p style={{ color: '#00ccff', textAlign: 'center', marginTop: '10px' }}>Ask me about document security, forgery, or encryption!</p>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.sender}`} style={{ 
                            textAlign: msg.sender === 'user' ? 'right' : 'left', 
                            marginBottom: '10px' 
                        }}>
                            <span style={{ 
                                display: 'inline-block', 
                                padding: '8px 12px', 
                                borderRadius: '15px',
                                background: msg.sender === 'user' ? '#3300ff' : '#ff006e', 
                                color: '#fff',
                                maxWidth: '80%'
                            }}>
                                {msg.text}
                            </span>
                        </div>
                    ))}
                    {isLoading && (
                        <p style={{ color: '#ccc', fontStyle: 'italic' }}>Thinking...</p>
                    )}
                </div>
                
                {/* Input Area */}
                <div className="chat-input" style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading || !auth.currentUser}
                        style={{ flexGrow: 1, padding: '10px', borderRadius: '10px', border: '1px solid #444', background: '#333', color: '#fff' }}
                    />
                    <button 
                        onClick={sendMessage} 
                        className="submit-btn" 
                        disabled={isLoading || !input.trim() || !auth.currentUser}
                        style={{ width: '100px', padding: '10px', fontSize: '1rem' }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Chatbot;