import React, { useState } from 'react';
import { getAuth } from "firebase/auth";

const HandwrittenForgeryTester = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
        setResult(null);
        setError('');
    };

    const handleAnalyze = async () => {
        if (!selectedFile) {
            setError('Please select a file first.');
            return;
        }

        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            setError('You must be logged in to perform an analysis.');
            return;
        }

        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const token = await user.getIdToken();
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('http://127.0.0.1:5000/predict-forgery', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Analysis failed on the server.');
            }

            const data = await response.json();
            setResult(data);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="forgery-detector">
            <h4>Handwritten Forgery Test</h4>
            <p>Test your new forgery classification model directly.</p>
            
            <div className="upload-new-section">
                <input type="file" accept="image/*" onChange={handleFileChange} />
                <button onClick={handleAnalyze} className="submit-btn" disabled={isLoading || !selectedFile}>
                    {isLoading ? "ANALYZING..." : "Analyze Handwriting"}
                </button>
            </div>

            <div className="forgery-results">
                {isLoading && <p className="loading-text">AI is analyzing the handwriting...</p>}
                {error && <p className="error-text-small">{error}</p>}
                {result && (
                    <div className={`prediction-box ${result.prediction}`}>
                        <p>Result: <span className={`prediction-text-${result.prediction}`}>{result.prediction.toUpperCase()}</span></p>
                        <p>Confidence: {result.confidence}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HandwrittenForgeryTester;