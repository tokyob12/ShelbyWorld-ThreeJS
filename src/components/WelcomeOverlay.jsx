import React, { useState, useEffect, useRef } from 'react';
import { ShelbyManager } from '../managers/ShelbyManager';

export default function WelcomeOverlay({ onStart, isEngineReady, loadingProgress }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  
  // Wallet Connection States
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const contentRef = useRef(null);

  useEffect(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setMousePos({ x: centerX, y: centerY });
    setTargetPos({ x: centerX, y: centerY });
  }, []);

  const handleMouseMove = (e) => {
    setTargetPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    let animationFrameId;
    const updatePosition = () => {
      setMousePos((current) => {
        const dx = targetPos.x - current.x;
        const dy = targetPos.y - current.y;
        return {
          x: current.x + dx * 0.08,
          y: current.y + dy * 0.08,
        };
      });
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetPos]);

  // Execute AIP-62 Connect Wallet Standard
  const handleConnectWallet = async () => {
    if (isConnecting) return;
    setIsConnecting(true);

    try {
      const data = await ShelbyManager.connectWallet();
      setWalletAddress(data.shortAddress);
    } catch (error) {
      console.warn("Wallet connection aborted:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const getTiltStyle = () => {
    const rx = (window.innerHeight / 2 - mousePos.y) / (window.innerHeight / 2) * 4;
    const ry = (window.innerWidth / 2 - mousePos.x) / (window.innerWidth / 2) * -4;
    return {
      transform: `rotateY(${ry}deg) rotateX(${rx}deg)`,
      transformStyle: 'preserve-3d',
    };
  };

  const isStartButtonDisabled = !isEngineReady || walletAddress === null;

  const getStartButtonText = () => {
    if (walletAddress === null) {
      return "CONNECT WALLET TO START";
    }
    if (!isEngineReady) {
      return `LOADING ASSETS... (${Math.round(loadingProgress)}%)`;
    }
    return "START GAME";
  };

  // Keyboard Keycap CSS Styling
  const keycapStyle = {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
    margin: '0 2px'
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: 'var(--bg-dark)',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {/* Background grids */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundSize: '50px 50px',
        backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)'
      }} />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundSize: '50px 50px',
        backgroundImage: 'linear-gradient(to right, rgba(0, 229, 255, 0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 229, 255, 0.3) 1px, transparent 1px)',
        WebkitMaskImage: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
        maskImage: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, black 0%, transparent 100%)`,
        mixBlendMode: 'screen'
      }} />

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle 500px at ${mousePos.x}px ${mousePos.y}px, rgba(0, 229, 255, 0.08) 0%, transparent 80%)`,
        mixBlendMode: 'screen'
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at center, transparent 30%, rgba(5,5,8,0.9) 100%)',
        zIndex: 1, pointerEvents: 'none'
      }} />

      {/* Header */}
      <header style={{
        position: 'relative', zIndex: 2, padding: '2rem 4rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        animation: 'fadeDown 1s forwards 0.2s', opacity: 0
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '2px' }}>
          SHELBYWORLD <span style={{ color: 'var(--shelby-cyan)' }}>QUEST</span>
        </div>
        <div style={{ fontSize: '0.85rem', letterSpacing: '1px', color: 'var(--text-muted)' }}>
          BUILT WITH THREE.JS & REACT
        </div>
      </header>

      {/* Main content wrapper */}
      <div style={{
        position: 'relative', zIndex: 2, display: 'flex',
        alignItems: 'center', justifyCenter: 'center', flex: 1,
        perspective: '1000px', padding: '2rem 0'
      }}>
        <main 
          ref={contentRef}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center', padding: '0 2rem', maxWidth: '800px',
            willChange: 'transform', margin: '0 auto', ...getTiltStyle()
          }}
        >
          <div style={{
            background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)',
            color: 'var(--shelby-cyan)', padding: '0.5rem 1.5rem', borderRadius: '50px',
            fontSize: '0.85rem', fontWeight: 500, letterSpacing: '1px',
            textTransform: 'uppercase', marginBottom: '1.5rem', animation: 'fadeUp 1s forwards 0.4s',
            opacity: 0, backdropFilter: 'blur(5px)'
          }}>
            SHELBY SUBMISSION
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5.5vw, 4rem)', fontWeight: 700,
            lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 1.5rem 0',
            color: 'var(--text-main)', textShadow: '0 0 40px rgba(0, 229, 255, 0.15)',
            animation: 'fadeUp 1s forwards 0.6s', opacity: 0
          }}>
            ZERO LAG. S3-LIKE SPEEDS.
          </h1>

          <p style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', color: 'var(--text-muted)',
            maxWidth: '700px', margin: '0 0 1.5rem 0', lineHeight: 1.6,
            animation: 'fadeUp 1s forwards 0.8s', opacity: 0
          }}>
            Welcome to a real-time 3D scavenger hunt where <b>all 3D assets are stored directly on Shelby</b>. 
            Explore the Outpost and correctly answer 7 out of 10 questions to mint your <b>Portal Pass NFT</b> on Aptos. 
            After minting, find the hidden teleport door to enter Shelbyworld!
            <br /><br />
            Assets are streamed with cryptographic provenance for a seamless, verifiable gaming experience.
          </p>

          {/* ===================================================================
              KEYBOARD CONTROLS HUD OVERLAY WIDGET (Step 7.12)
              Using responsive, styled HTML keycaps
              =================================================================== */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '2.5rem',
            animation: 'fadeUp 1s forwards 0.9s',
            opacity: 0,
            letterSpacing: '0.5px'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <kbd style={keycapStyle}>W</kbd>
              <kbd style={keycapStyle}>A</kbd>
              <kbd style={keycapStyle}>S</kbd>
              <kbd style={keycapStyle}>D</kbd>
              <span style={{ marginLeft: '4px' }}>Move / Rotate</span>
            </span>
            
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <kbd style={keycapStyle}>SHIFT</kbd>
              <span style={{ marginLeft: '4px' }}>Sprint Boost</span>
            </span>
            
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <kbd style={keycapStyle}>SPACE</kbd>
              <span style={{ marginLeft: '4px' }}>Jump</span>
            </span>
          </div>
          {/* =================================================================== */}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '100%' }}>
            {/* Wallet Connect Action */}
            <button 
              disabled={isConnecting || walletAddress !== null}
              onClick={handleConnectWallet}
              style={{
                padding: '1rem 2.2rem',
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: walletAddress ? 'var(--shelby-cyan)' : 'var(--bg-dark)',
                background: walletAddress ? 'rgba(0,229,255,0.05)' : 'var(--shelby-cyan)',
                border: walletAddress ? '1px solid var(--shelby-cyan)' : 'none',
                borderRadius: '4px',
                cursor: walletAddress ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
                letterSpacing: '1px',
                boxShadow: walletAddress ? 'none' : '0 0 20px var(--shelby-cyan-glow)'
              }}
            >
              {isConnecting ? "CONNECTING WALLET..." : walletAddress ? `CONNECTED: ${walletAddress}` : "CONNECT APTOS WALLET"}
            </button>

            {/* Start Game Action */}
            <button 
              disabled={isStartButtonDisabled}
              onClick={() => onStart(walletAddress)}
              style={{
                padding: '1rem 3rem',
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: !isStartButtonDisabled ? 'var(--bg-dark)' : 'rgba(136,146,176,0.3)',
                background: !isStartButtonDisabled ? 'var(--shelby-cyan)' : 'transparent',
                border: !isStartButtonDisabled ? 'none' : '1px solid rgba(136, 146, 176, 0.3)',
                borderRadius: '4px',
                cursor: !isStartButtonDisabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                letterSpacing: '1px',
                boxShadow: !isStartButtonDisabled ? '0 0 20px var(--shelby-cyan-glow)' : 'none'
              }}
            >
              {getStartButtonText()}
            </button>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 2, padding: '2rem 4rem',
        color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex',
        flexDirection: 'column', gap: '15px', animation: 'fadeUp 1s forwards 1.2s', opacity: 0
      }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>POWERED BY SHELBY & THREE.JS</div>
          <div style={{ color: 'var(--shelby-cyan)', fontWeight: 'bold' }}>SHELBYNET ACTIVE</div>
        </div>
        <div style={{ width: '100%', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px', marginTop: '5px', fontSize: '0.8rem', letterSpacing: '0.5px' }}>
          CREATED BY ARASH | TWITTER: @ARASHB122 | DISCORD: arashb12
        </div>
      </footer>
    </div>
  );
}