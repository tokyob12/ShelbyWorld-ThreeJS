import React, { useState, useEffect, Suspense } from 'react';
import { useProgress } from '@react-three/drei';
import WelcomeOverlay from './components/WelcomeOverlay';
import GameCanvas from './components/GameCanvas';
import TriviaPopup from './components/TriviaPopup';
import Leaderboard from './components/Leaderboard';
import { CRATE_QUESTIONS } from './constants/questions';
import { ShelbyManager } from './managers/ShelbyManager';
import './App.css';

import collectSoundFile from './assets/sound/assets_sounds_effects_collect.m4a';

// ---------------------------------------------------------------------------
// PASSPORT ATTRIBUTE BADGE — dynamic NFT attributes pulled from Shelby
// ---------------------------------------------------------------------------
function PassportBadge({ passport }) {
  if (!passport) return null;

  const get = (traitType) =>
    passport.attributes?.find((a) => a.trait_type === traitType)?.value ?? '—';

  const formatTime = (s) => {
    if (typeof s !== 'number') return '—';
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div style={{
      position: 'absolute', top: '140px', left: '30px',
      background: 'linear-gradient(135deg, rgba(15,15,20,0.9) 0%, rgba(5,5,8,0.97) 100%)',
      backdropFilter: 'blur(12px)', border: '1px solid rgba(0,229,255,0.35)',
      borderRadius: '6px', padding: '14px 20px', color: 'white',
      fontFamily: 'Space Grotesk, sans-serif', minWidth: '220px',
      boxShadow: '0 4px 24px rgba(0,229,255,0.1)', animation: 'fadeDown 0.5s ease-out',
    }}>
      <div style={{
        fontSize: '0.65rem', color: 'rgba(0,229,255,0.7)', letterSpacing: '2px',
        textTransform: 'uppercase', marginBottom: '10px',
        borderBottom: '1px solid rgba(0,229,255,0.15)', paddingBottom: '6px',
      }}>
        Portal Pass — Returning Operative
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {[
          { label: 'Best Score',   value: `${get('Decryption Credits')} CR` },
          { label: 'Best Time',    value: formatTime(get('Speedrun Time')) },
          { label: 'Total Runs',   value: get('Total Runs') },
          { label: 'Outpost',      value: get('Outpost Secured') },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '0.8rem' }}>
            <span style={{ color: '#8892b0' }}>{label}</span>
            <span style={{ color: 'var(--shelby-cyan)', fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: '0.65rem', color: 'rgba(0,255,136,0.6)', letterSpacing: '1px',
      }}>
        ⬡ LIVE ON SHELBY STORAGE
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NOTIFICATION TOAST
// ---------------------------------------------------------------------------
function Notification({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', backgroundColor: 'rgba(10,10,30,0.95)', color: 'white',
      border: '2px solid var(--shelby-cyan)', borderRadius: '4px',
      boxShadow: '0 8px 30px rgba(0,229,255,0.2)', zIndex: 20000,
      fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.95rem',
      fontWeight: 'bold', letterSpacing: '1px', animation: 'fadeDown 0.3s ease-out',
    }}>
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP
// ---------------------------------------------------------------------------
function App() {
  const [showOverlay, setShowOverlay] = useState(true);

  // Game stats
  const [credits, setCredits] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isKeySpawned, setIsKeySpawned] = useState(false);
  const [isKeyCollected, setIsKeyCollected] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Web3
  const [playerName, setPlayerName] = useState('PLAYER');
  const [walletAddress, setWalletAddress] = useState(null);
  const [showMintPopup, setShowMintPopup] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  // Stage
  const [stage, setStage] = useState('outpost');

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [isReloadingLeaderboard, setIsReloadingLeaderboard] = useState(false);

  // Dynamic passport (NFT attributes from Shelby)
  const [playerPassport, setPlayerPassport] = useState(null);
  const [isPassportLoading, setIsPassportLoading] = useState(false);

  // Loading gate
  const [isEnvironmentLoaded, setIsEnvironmentLoaded] = useState(false);
  const { active, progress } = useProgress();
  const isEngineReady = !active && progress === 100 && isEnvironmentLoaded;

  const [cratesList, setCratesList] = useState([
    { id: 'crate_1',  position: [24,    2.2,   6]     },
    { id: 'crate_2',  position: [44,    2.2,  -7]     },
    { id: 'crate_3',  position: [-0.7,  2.2,  33]     },
    { id: 'crate_4',  position: [0,     2.2, -45]     },
    { id: 'crate_5',  position: [-22,   2.2,  -4.1]   },
    { id: 'crate_6',  position: [-5.26, 4.29,  1.39]  },
    { id: 'crate_7',  position: [8.09,  7.47, -6.61]  },
    { id: 'crate_8',  position: [55.93, 1.12, -2.86]  },
    { id: 'crate_9',  position: [60.72, 1.12,-16.23]  },
    { id: 'crate_10', position: [7.86,  7.47,-39.55]  },
  ]);

  // Stopwatch
  useEffect(() => {
    if (showOverlay) return;
    const timer = setInterval(() => setTimeElapsed((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [showOverlay]);

  // Load leaderboard on entering ShelbyWorld
  useEffect(() => {
    if (stage === 'shelbyworld') loadLeaderboard();
  }, [stage]);

  // Sub-second passport read the moment a wallet address is known
  useEffect(() => {
    if (!walletAddress) return;

    const loadPassport = async () => {
      setIsPassportLoading(true);
      try {
        const passport = await ShelbyManager.fetchPlayerPassport(walletAddress);
        setPlayerPassport(passport);
        if (passport) {
          const best = passport.attributes?.find((a) => a.trait_type === 'Decryption Credits')?.value;
          triggerNotification(`RETURNING OPERATIVE — BEST: ${best} CR`);
        }
      } catch (e) {
        console.warn('Passport load failed:', e);
      } finally {
        setIsPassportLoading(false);
      }
    };

    loadPassport();
  }, [walletAddress]);

  // Helpers
  const playCollectSound = () => {
    try {
      const audio = new Audio(collectSoundFile);
      audio.volume = 0.6;
      audio.play().catch((err) => console.warn('Autoplay blocked:', err));
    } catch (error) {
      console.warn('Failed to play audio:', error);
    }
  };

  const loadLeaderboard = async () => {
    setIsReloadingLeaderboard(true);
    try {
      const liveRecords = await ShelbyManager.fetchLeaderboard();
      if (Array.isArray(liveRecords)) {
        liveRecords.sort((a, b) =>
          b.score !== a.score ? b.score - a.score : a.time_elapsed - b.time_elapsed
        );
        setLeaderboard(liveRecords);
      }
    } catch (e) {
      console.warn('Failed to update leaderboard:', e);
    } finally {
      setIsReloadingLeaderboard(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const triggerNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // Game handlers
  const handleStartGame = (connectedShortAddress, fullAddress) => {
    setPlayerName(connectedShortAddress || 'PLAYER');
    if (fullAddress) setWalletAddress(fullAddress);
    setShowOverlay(false);
    triggerNotification('WELCOME OUTPOST SECURED. FIND CODES.');
  };

  const handleCollectCrate = (crateId) => {
    setCratesList((prev) => prev.filter((c) => c.id !== crateId));
    const idx = Math.floor(Math.random() * CRATE_QUESTIONS.length);
    setActiveQuestion(CRATE_QUESTIONS[idx]);
  };

  const handleAnswerTrivia = (isCorrect) => {
    setActiveQuestion(null);
    if (isCorrect) {
      playCollectSound();
      setCredits((prev) => {
        const next = prev + 100;
        if (next >= 100 && !isKeySpawned) {
          setIsKeySpawned(true);
          triggerNotification('MILESTONE REACHED! OBJECTIVE KEY SPAWNED AT ORIGIN.');
        }
        return next;
      });
      setCorrectAnswersCount((prev) => prev + 1);
      triggerNotification('DECRYPTION SUCCESSFUL. +100 CR.');
    } else {
      triggerNotification('DECRYPTION FAILED. NO REWARD.');
    }
  };

  const handleCollectKey = () => {
    setIsKeySpawned(false);
    setIsKeyCollected(true);
    playCollectSound();
    setShowMintPopup(true);
  };

  const handleExecuteMint = async () => {
    if (isMinting) return;
    setIsMinting(true);
    try {
      await ShelbyManager.submitFinalScore(credits, timeElapsed);

      // Re-read the freshly synced passport so the HUD updates immediately
      const addr = walletAddress || ShelbyManager.walletAddress;
      if (addr) {
        setWalletAddress(addr);
        const updated = await ShelbyManager.fetchPlayerPassport(addr);
        if (updated) setPlayerPassport(updated);
      }

      triggerNotification('MINTING COMPLETED! PORTAL PASSPORT SECURED.');
      setShowMintPopup(false);
    } catch (err) {
      console.warn('Minting transaction failed:', err);
      triggerNotification('TRANSACTION REJECTED OR FAILED.');
    } finally {
      setIsMinting(false);
    }
  };

  const handleTeleportPortal = () => {
    playCollectSound();
    setStage('shelbyworld');
    triggerNotification('PORTAL STABILIZED. WELCOME TO SHELBY WORLD.');
  };

  // Live PB comparison for the credits panel
  const passportBest = playerPassport?.attributes?.find(
    (a) => a.trait_type === 'Decryption Credits'
  )?.value;

  // RENDER
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {/* HUD */}
      {!showOverlay && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>

          {/* Time Elapsed */}
          <div style={{
            position: 'absolute', top: '30px', left: '30px',
            background: 'linear-gradient(135deg, rgba(15,15,20,0.85) 0%, rgba(5,5,8,0.95) 100%)',
            backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,136,0.2)',
            padding: '12px 24px', borderRadius: '4px', color: 'white',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Time Elapsed
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00ff88', textShadow: '0 0 15px rgba(0,255,136,0.4)', fontFamily: 'monospace' }}>
              {formatTime(timeElapsed)}
            </div>
          </div>

          {/* Dynamic Passport Badge */}
          {isPassportLoading ? (
            <div style={{
              position: 'absolute', top: '140px', left: '30px',
              background: 'rgba(5,5,8,0.85)', border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: '6px', padding: '12px 20px', color: '#8892b0',
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.75rem', letterSpacing: '1px',
            }}>
              SYNCING PASSPORT...
            </div>
          ) : (
            <PassportBadge passport={playerPassport} />
          )}

          {/* Network Credits */}
          {stage !== 'shelbyworld' && (
            <div style={{
              position: 'absolute', top: '30px', right: '30px',
              background: 'linear-gradient(135deg, rgba(15,15,20,0.85) 0%, rgba(5,5,8,0.95) 100%)',
              backdropFilter: 'blur(10px)', border: '1px solid rgba(0,229,255,0.2)',
              padding: '12px 24px', borderRadius: '4px', color: 'white',
              fontFamily: 'Space Grotesk, sans-serif',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Network Credits
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--shelby-cyan)', textShadow: '0 0 15px rgba(0,229,255,0.4)', fontFamily: 'monospace' }}>
                {credits} <span style={{ fontSize: '1rem', color: 'white' }}>CR</span>
              </div>
              {passportBest !== undefined && credits > 0 && (
                <div style={{ fontSize: '0.7rem', color: credits > passportBest ? '#00ff88' : '#8892b0', marginTop: '4px', letterSpacing: '1px' }}>
                  {credits > passportBest ? `▲ NEW PB (+${credits - passportBest} CR)` : `PB: ${passportBest} CR`}
                </div>
              )}
            </div>
          )}

          {/* Coordinates */}
          <div style={{
            position: 'absolute', bottom: '30px', left: '30px',
            background: 'linear-gradient(135deg, rgba(15,15,20,0.85) 0%, rgba(5,5,8,0.95) 100%)',
            backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 24px', borderRadius: '4px', color: 'white',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Sys.Coords
            </div>
            <div id="hud-coords-value" style={{ fontSize: '1rem', fontWeight: 700, color: '#a0aec0', fontFamily: 'monospace' }}>
              X: 0.00 Y: 0.00 Z: 0.00
            </div>
          </div>

        </div>
      )}

      <Notification message={toastMessage} />

      <Suspense fallback={null}>
        <GameCanvas
          cratesList={cratesList}
          onCollectCrate={handleCollectCrate}
          isKeySpawned={isKeySpawned}
          onCollectKey={handleCollectKey}
          isPaused={activeQuestion !== null || showMintPopup}
          playerName={playerName}
          stage={stage}
          isKeyCollected={isKeyCollected}
          onTeleport={handleTeleportPortal}
          showPlayer={!showOverlay}
          onEnvironmentLoaded={setIsEnvironmentLoaded}
        />
      </Suspense>

      {showOverlay && (
        <WelcomeOverlay
          onStart={handleStartGame}
          isEngineReady={isEngineReady}
          loadingProgress={progress}
        />
      )}

      {activeQuestion && (
        <TriviaPopup questionData={activeQuestion} onAnswer={handleAnswerTrivia} />
      )}

      {/* NFT Passport Mint Modal */}
      {showMintPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 25000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(5,5,8,0.95)', backdropFilter: 'blur(5px)',
          fontFamily: 'Space Grotesk, sans-serif', color: 'white',
        }}>
          <div style={{
            width: 'min(550px, 90vw)', padding: '40px', textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.9)', border: '2px solid var(--shelby-cyan)',
            borderRadius: '12px', boxShadow: '0 0 25px rgba(0,229,255,0.4)',
          }}>
            <h1 style={{ color: 'var(--shelby-cyan)', fontSize: '2.2rem', marginBottom: '15px' }}>
              SHELBY KEY SECURED!
            </h1>
            <p style={{ color: '#8892b0', fontSize: '1.1rem', lineHeight: '1.5', marginBottom: '30px' }}>
              Your scores are verified. Click below to sign the on-chain transaction, mint your Portal Pass NFT, and sync your dynamic passport to Shelby Storage.
            </p>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--shelby-cyan)', marginBottom: '16px' }}>
              FINAL SCORE: {credits} CREDITS
            </div>

            {/* Live attributes preview — exactly what gets written to {wallet}_passport.json */}
            <div style={{
              background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)',
              borderRadius: '6px', padding: '14px 18px', marginBottom: '30px', textAlign: 'left',
            }}>
              <div style={{ fontSize: '0.65rem', color: 'rgba(0,229,255,0.6)', letterSpacing: '2px', marginBottom: '10px' }}>
                NFT PASSPORT ATTRIBUTES
              </div>
              {[
                { trait_type: 'Decryption Credits', value: credits },
                { trait_type: 'Speedrun Time',      value: formatTime(timeElapsed) },
                { trait_type: 'Completed Levels',   value: 1 },
                { trait_type: 'Outpost Secured',    value: 'Yes' },
                { trait_type: 'Storage Layer',      value: 'Shelby Storage' },
              ].map(({ trait_type, value }) => (
                <div key={trait_type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: '#8892b0' }}>{trait_type}</span>
                  <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                disabled={isMinting}
                onClick={handleExecuteMint}
                style={{
                  width: '100%', padding: '16px 0', fontSize: '1.1rem', fontWeight: 'bold',
                  background: 'var(--shelby-cyan)', color: 'black', border: 'none',
                  borderRadius: '4px', cursor: 'pointer', transition: 'opacity 0.2s',
                }}
              >
                {isMinting ? 'SIGNING APTOS TRANSACTION...' : 'MINT PORTAL PASS NFT'}
              </button>
              <button
                disabled={isMinting}
                onClick={() => setShowMintPopup(false)}
                style={{
                  width: '100%', padding: '14px 0', fontSize: '1rem',
                  background: 'transparent', border: '1px solid #8892b0',
                  color: '#8892b0', borderRadius: '4px', cursor: 'pointer',
                }}
              >
                CLOSE AND EXPLORE
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'shelbyworld' && (
        <Leaderboard data={leaderboard} onReload={loadLeaderboard} isReloading={isReloadingLeaderboard} />
      )}

    </div>
  );
}

export default App;