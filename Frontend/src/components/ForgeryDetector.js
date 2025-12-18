import React, { useState, useEffect } from 'react';
import { getAuth } from "firebase/auth";

const ForgeryDetector = ({ fileToAnalyze }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [predictionResult, setPredictionResult] = useState(null);
    const [error, setError] = useState('');

    const handlePredict = async (file) => {
        if (!file) return;
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            setError('Authentication error.');
            return;
        }
        const token = await user.getIdToken();
        setIsLoading(true);
        setPredictionResult(null);
        setError('');
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('http://127.0.0.1:5000/predict', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `Server error: ${response.status}`);
            }
            const data = await response.json();
            setPredictionResult(data);
        } catch (err) {
            console.error("Prediction error:", err);
            setError(err.message || 'AI analysis failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (fileToAnalyze) {
            handlePredict(fileToAnalyze);
        } else {
            setPredictionResult(null);
            setError('');
        }
    }, [fileToAnalyze]);

    return (
        <div className="forgery-detector">
            <div className="forgery-results">
                {!fileToAnalyze && !isLoading && <p>Select a document above to begin analysis.</p>}
                {isLoading && <p className="loading-text">AI is running a full analysis...</p>}
                {error && <p className="error-text-small">{error}</p>}
                
                {predictionResult && (
                    <div className="multi-result-container">
                        {/* Document Type Analysis (Unchanged) */}
                        {predictionResult.classification && (
                            <div className="prediction-box classification">
                                <h4>Document Type Analysis</h4>
                                <p>Predicted Type: <span className="prediction-text-classification">{predictionResult.classification.type.replace('_', ' ').toUpperCase()}</span></p>
                                <p>Confidence: {predictionResult.classification.confidence}</p>
                            </div>
                        )}

                        {/* Overall Document Analysis (Unchanged) */}
                        {predictionResult.document_analysis && (
                            <div className={`prediction-box ${predictionResult.document_analysis.prediction}`}>
                                <h4>Overall Document Analysis</h4>
                                <p>Result: <span className={`prediction-text-${predictionResult.document_analysis.prediction}`}>{predictionResult.document_analysis.prediction.toUpperCase()}</span></p>
                                <p>Confidence: {predictionResult.document_analysis.confidence}</p>
                            </div>
                        )}
                        
                        {/* <<< MODIFIED SECTION START >>> */}
                        {/* Signature Detection and Analysis */}
                        {predictionResult.signature_analysis && (
                            <>
                                {/* Box 1: Detection Result */}
                                <div className={`prediction-box ${predictionResult.signature_analysis.status === 'Signature found and analyzed.' ? 'genuine' : 'forged'}`}>
                                    <h4>Signature Detection</h4>
                                    <p>{predictionResult.signature_analysis.status === 'Signature found and analyzed.' ? '✅ Signature Found' : '❌ No Signature Found'}</p>
                                </div>

                                {/* Box 2 & 3: Analysis Results (only show if detection was successful) */}
                                {predictionResult.signature_analysis.status === 'Signature found and analyzed.' && (
                                    <>
                                        {/* Original Model Result */}
                                        <div className={`prediction-box ${predictionResult.signature_analysis.original_model_result.prediction}`}>
                                            <h4>Signature Analysis (Old Model)</h4>
                                            <p>Result: <span className={`prediction-text-${predictionResult.signature_analysis.original_model_result.prediction}`}>{predictionResult.signature_analysis.original_model_result.prediction.replace('_', ' ').toUpperCase()}</span></p>
                                            <p>Confidence: {predictionResult.signature_analysis.original_model_result.confidence}</p>
                                        </div>

                                        
                                        
                                    </>
                                )}
                            </>
                        )}
                         {/* <<< MODIFIED SECTION END >>> */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgeryDetector;