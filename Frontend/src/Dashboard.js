import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth"; 
import './App.css';
import logo from './images/logo.jpeg';
import ForgeryDetector from "./components/ForgeryDetector";
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom'; // <-- NECESSARY IMPORT

import * as pdfjsLib from 'pdfjs-dist/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

// --- Helper Functions ---
async function importKey(keyHex) {
    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    return await window.crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
async function encryptFile(file, cryptoKey) {
    const fileBuffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContent = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cryptoKey, fileBuffer);
    return new Blob([iv, encryptedContent]);
}
async function decryptFile(encryptedBuffer, cryptoKey) {
    const iv = encryptedBuffer.slice(0, 12);
    const data = encryptedBuffer.slice(12);
    return await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, cryptoKey, data);
}
function getMimeType(filename) {
    const lowercased = filename.toLowerCase();
    if (lowercased.endsWith('.png')) return 'image/png';
    if (lowercased.endsWith('.jpg') || lowercased.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/octet-stream';
}

// --- Main Component ---
export default function Dashboard() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileToAnalyze, setFileToAnalyze] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState('');
    const [pdfDoc, setPdfDoc] = useState(null);
    const canvasRef = useRef(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const navigate = useNavigate(); // <-- INITIALIZED HERE

    // 1. NEW LOGOUT HANDLER FUNCTION
    const handleLogout = async () => {
        if (!currentUser || !encryptionKey) return; // Added key check for safety

        setIsProcessing(true);
        setMessage("Logging out and securely terminating session...");
        setIsError(false);

        try {
            const token = await currentUser.getIdToken();
            
            // 1. Client-side Key Destruction (Console Log)
            console.log("🔥 Client-side key destruction: Encryption key purged from memory.");
            setEncryptionKey(''); // <-- KEY PURGE
            
            // 2. Server-side Session/Key Termination (Calling Flask /logout)
            // Added check for response success for better error handling, as per prompt logic
            const res = await fetch("http://localhost:5000/logout", {
                method: "POST", 
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                 // The actual error is non-critical for the client-side flow, 
                 // but logging it is good practice
                 console.error("Server-side key termination warning/error:", await res.text()); 
            }
            
            // 3. Invalidate Firebase Session
            await signOut(getAuth()); 
            
            setMessage("✅ Session terminated successfully.");
            navigate("/"); // Redirect to login page
            
        } catch (err) {
            setMessage(`ERROR during logout: ${err.message}`);
            setIsError(true);
        } finally {
            setIsProcessing(false);
        }
    };


    useEffect(() => {
        const authInstance = getAuth();
        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setCurrentUser(user);
                try {
                    const token = await user.getIdToken();
                    
                    // --- TOKEN CONSOLE LOG ---
                    console.log("✅ Auth Token Retrieved.");
                    console.log("Token (first 20 chars):", token.substring(0, 20) + '...');
                    // ---------------------------------
                    
                    const keyResponse = await fetch("http://localhost:5000/generate-key", { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!keyResponse.ok) throw new Error('Failed to fetch encryption key');
                    const keyData = await keyResponse.json();
                    setEncryptionKey(keyData.key);
                    
                    // --- QKD KEY CONSOLE LOG ---
                    console.log("🔑 QKD/Encryption Key Retrieved.");
                    console.log("Encryption Key (full):", keyData.key);
                    // -----------------------------------
                    
                    await fetchFiles(token);
                } catch (error) {
                    setMessage(`Error during setup: ${error.message}`);
                    setIsError(true);
                    console.error("Setup Error:", error);
                }
            } else {
                setCurrentUser(null);
                setEncryptionKey('');
                setUploadedFiles([]);
                console.log("User logged out. Token and Key cleared.");
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (pdfDoc && canvasRef.current) {
            const renderPage = async () => {
                const page = await pdfDoc.getPage(1);
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                const viewport = page.getViewport({ scale: 1.5 });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            };
            renderPage().catch(err => {
                setMessage("Error: Could not render PDF preview.");
                setIsError(true);
            });
        }
    }, [pdfDoc]);

    const fetchFiles = async (token) => {
        try {
            const res = await fetch("http://localhost:5000/list-files", { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to fetch file list');
            const data = await res.json();
            setUploadedFiles(Array.isArray(data) ? data : []);
        } catch (error) {
            setMessage(`Error fetching files: ${error.message}`);
            setIsError(true);
        }
    };

    const renderPdfPreview = async (file) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const pdfData = new Uint8Array(event.target.result);
                const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                setPdfDoc(doc);
            } catch (error) {
                setMessage("Error: Could not read local PDF for preview.");
                setIsError(true);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setPdfDoc(null);
        setImagePreviewUrl('');
        setMessage('');
        setIsError(false);
        setFileToAnalyze(null);

        if (file) {
            setSelectedFile(file); 
            if (file.type === "application/pdf") {
                renderPdfPreview(file);
            } else if (file.type.startsWith("image/")) {
                setImagePreviewUrl(URL.createObjectURL(file));
            }
        } else {
            setSelectedFile(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !encryptionKey) return;
        setIsProcessing(true);
        setMessage("Encrypting & uploading...");
        setIsError(false);
        try {
            if (!currentUser) throw new Error("User not authenticated.");
            const cryptoKey = await importKey(encryptionKey);
            const encryptedBlob = await encryptFile(selectedFile, cryptoKey);
            const encryptedFile = new File([encryptedBlob], `${selectedFile.name}.encrypted`, { type: 'application/octet-stream' });
            const token = await currentUser.getIdToken();
            const formData = new FormData();
            formData.append('file', encryptedFile);
            const res = await fetch("http://localhost:5000/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
            if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
            
            const data = await res.json();
            setMessage(`✅ ${data.message}`);
            await fetchFiles(token);
            setFileToAnalyze(selectedFile);
        } catch (err) {
            setMessage(`ERROR: ${err.message}`);
            setIsError(true);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileView = async (filename) => {
        if (!encryptionKey || !currentUser) {
            setMessage("ERROR: Session key not available. Please refresh.");
            setIsError(true);
            return;
        }
        setIsProcessing(true);
        setMessage(`Fetching & decrypting ${filename.replace('.encrypted', '')}...`);
        setPdfDoc(null);
        setImagePreviewUrl('');
        setIsError(false);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`http://localhost:5000/download/${filename}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error("Could not download file.");
            
            const encryptedBuffer = await res.arrayBuffer();
            const cryptoKey = await importKey(encryptionKey);
            const decryptedBuffer = await decryptFile(encryptedBuffer, cryptoKey);
            
            const lowerCaseFilename = filename.toLowerCase();
            if (lowerCaseFilename.endsWith('.pdf.encrypted')) {
                const pdfData = new Uint8Array(decryptedBuffer);
                const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                setPdfDoc(doc);
                setMessage("✅ PDF preview ready.");
            } else if (lowerCaseFilename.match(/\.(jpeg|jpg|png)\.encrypted$/)) {
                const mimeType = getMimeType(lowerCaseFilename);
                const blob = new Blob([decryptedBuffer], { type: mimeType });
                const imageUrl = URL.createObjectURL(blob);
                setImagePreviewUrl(imageUrl);
                setMessage("✅ Image preview ready.");
            } else {
                throw new Error("Unsupported file type for preview.");
            }
        } catch (err) {
            setMessage(`ERROR: Could not decrypt or preview file. ${err.message}`);
            setIsError(true);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="neon-box dashboard-view open" style={{ 
            height: '95vh', 
            maxHeight: '900px', 
            width: '450px',
            overflow: 'hidden' 
        }}>
            {/* --- 2. INNER CONTENT BOX (Handles internal scrolling) --- */}
            <div className="box-content" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '1.5rem', 
                height: '100%',
                overflowY: 'auto' 
            }}>
                <div className="upload-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                    
                    {/* TOP SECTION: Logo, Title, and LOGOUT BUTTON */}
                    <div className="dashboard-top-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                        <img src={logo} alt="App Logo" className="box-logo" />
                        <h2>Secure Document Hub</h2>

                        {/* --- 2. LOGOUT BUTTON (NEW) --- */}
                        <button 
                            onClick={handleLogout} 
                            disabled={isProcessing || !currentUser} 
                            style={{ 
                                position: 'absolute', 
                                top: 0, 
                                right: 0,
                                background: 'transparent',
                                border: '1px solid #ff006e',
                                color: '#ff006e',
                                padding: '5px 10px',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                            }}
                        >
                            Logout
                        </button>
                        {/* --------------------------- */}

                    </div>

                    {/* 1. DOCUMENT PREVIEW AREA (Simplified) */}
                    <div className="preview-container" style={{ width: '100%', textAlign: 'center', padding: '1rem', border: '1px solid #444', borderRadius: '10px', backgroundColor: '#1e1e1e' }}>
                        <strong>Document Preview</strong>
                        {(pdfDoc || imagePreviewUrl) && !isError ? (
                            <div className="preview-area">
                                {pdfDoc && <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />}
                                {imagePreviewUrl && <img src={imagePreviewUrl} alt="Preview" className="image-preview" />}
                            </div>
                        ) : (
                            <div className="preview-area placeholder" style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <p>Select a document to see a preview here.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* 2. FILE LIST AREA */}
                    <div className="file-list-area" style={{ width: '100%', textAlign: 'center', padding: '1rem', border: '1px solid #444', borderRadius: '10px', backgroundColor: '#1e1e1e' }}>
                        <strong>Your Encrypted Documents</strong>
                        {uploadedFiles.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                                {uploadedFiles.map(file => (
                                    <li key={file} onClick={() => handleFileView(file)} style={{ padding: '8px', background: '#333', borderRadius: '5px', cursor: 'pointer', marginBottom: '5px', wordBreak: 'break-all' }}>
                                        {file.replace('.encrypted', '')}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ color: '#888' }}>No documents uploaded yet.</p>
                        )}
                    </div>

                    {/* 3. UPLOAD CONTROLS (Single Column Stack, fixed congestion) */}
                    <div className="upload-new-section" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label htmlFor="file-upload" className="file-input-label">
                            {selectedFile ? `Selected: ${selectedFile.name}` : "Choose New Document"}
                        </label>
                        <input id="file-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                        
                        {/* ENCRYPT & UPLOAD Button */}
                        <button onClick={handleUpload} className="submit-btn" disabled={isProcessing || !selectedFile || !currentUser}>
                            {isProcessing ? "PROCESSING..." : "ENCRYPT & UPLOAD"}
                        </button>
                    </div>
                    
                    {message && <p className={`status-message ${isError ? 'error' : ''}`}>{message}</p>}

                    {/* 4. AI ANALYSIS SECTION */}
                    <div className="dashboard-bottom-section" style={{ width: '100%', marginTop: '1rem' }}>
                        <h3 style={{ textAlign: 'center', margin: '0 0 1rem 0' }}>AI Forgery Analysis</h3>
                        <ForgeryDetector fileToAnalyze={fileToAnalyze} />
                    </div>

                    {/* 5. CHATBOT BUTTON (At the very end) */}
                    <Link to="/chat" style={{ 
                        textDecoration: 'none', 
                        width: '100%', 
                        marginTop: '1.5rem', 
                        marginBottom: '1rem', 
                        display: 'block' 
                    }}>
                        <button className="submit-btn" style={{ background: '#00ccff', width: '100%' }}>
                            Open AI Security Chat
                        </button>
                    </Link>

                </div>
            </div>
        </div>
    );
}