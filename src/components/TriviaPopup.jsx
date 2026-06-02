import React, { useState } from 'react';

export default function TriviaPopup({ questionData, onAnswer }) {
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [answered, setAnswered] = useState(false);

  const handleSelectChoice = (idx) => {
    if (answered) return;
    setSelectedIdx(idx);
    setAnswered(true);

    const isCorrect = idx === questionData.correctIndex;
    
    // Smooth delay before closing the popup to allow the player to see correct/wrong feedback
    setTimeout(() => {
      onAnswer(isCorrect);
    }, 1200);
  };

  const choiceLetters = ['A', 'B', 'C'];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 20000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 5, 8, 0.85)',
      backdropFilter: 'blur(12px)',
      fontFamily: 'Space Grotesk, sans-serif',
      color: '#ffffff'
    }}>
      <div style={{
        width: 'min(650px, 90vw)',
        padding: '40px',
        backgroundColor: 'rgba(15, 15, 20, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: '12px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--shelby-cyan)',
          letterSpacing: '2px',
          marginBottom: '20px',
          textTransform: 'uppercase'
        }}>
          <span>Decrypt Node Data</span>
          <span style={{ backgroundColor: 'rgba(0, 229, 255, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
            REWARD: 100 CR
          </span>
        </div>

        {/* Question Text */}
        <div style={{ fontSize: '1.4rem', fontWeight: 500, lineHeight: 1.4, marginBottom: '30px' }}>
          {questionData.question}
        </div>

        {/* Answer Choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questionData.answers.map((ans, idx) => {
            let btnStyle = {
              width: '100%',
              padding: '16px 20px',
              textAlign: 'left',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '1.05rem',
              cursor: answered ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'Space Grotesk, sans-serif'
            };

            // Apply feedback styling upon answer
            if (answered) {
              if (idx === questionData.correctIndex) {
                btnStyle.backgroundColor = 'rgba(0, 255, 136, 0.15)';
                btnStyle.borderColor = '#00ff88';
                btnStyle.color = '#00ff88';
              } else if (idx === selectedIdx) {
                btnStyle.backgroundColor = 'rgba(255, 68, 68, 0.15)';
                btnStyle.borderColor = '#ff4444';
                btnStyle.color = '#ff4444';
              }
            }

            return (
              <button 
                key={idx} 
                disabled={answered}
                onClick={() => handleSelectChoice(idx)}
                style={btnStyle}
                className="choice-btn"
              >
                <span style={{
                  display: 'inline-block',
                  width: '28px',
                  height: '28px',
                  lineHeight: '26px',
                  textAlign: 'center',
                  background: answered && idx === questionData.correctIndex ? '#00ff88' : 'rgba(255, 255, 255, 0.1)',
                  color: answered && idx === questionData.correctIndex ? '#000' : 'inherit',
                  borderRadius: '4px',
                  marginRight: '15px',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  {choiceLetters[idx]}
                </span>
                {ans}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}