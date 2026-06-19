import React, { useState, useEffect, Suspense } from 'react';
import { useProgress } from '@react-three/drei';
import WelcomeOverlay from './components/WelcomeOverlay';
import GameCanvas from './components/GameCanvas';
import TriviaPopup from './components/TriviaPopup';
import Leaderboard from './components/Leaderboard';
import { CRATE_QUESTIONS } from './constants/questions';
import { ShelbyManager } from './managers/ShelbyManager';
import { replayRecorder } from './managers/ReplayRecorder';
import './App.css';

import collectSoundFile from './assets/sound/assets_sounds_effects_collect.m4a';

function Notification({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', backgroundColor: 'rgba(10, 10, 30, 0.95)', color: 'white',
      border: '2px solid var(--shelby-cyan)', borderRadius: '4px',
      boxShadow: '0 8px 30px rgba(0, 229, 255, 0.2)', zIndex: 20000,
      fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.95rem',
      fontWeight: 'bold', letterSpacing: '1px', animation: 'fadeDown 0.3s ease-out'
    }}>
      {message}
    </div>
  );
}

function PassportBadge({ passport }) {
  if (!passport) return null;
  const attr = (t) => passport.attributes.find(a => a.trait_type === t)?.value;
  const bestScore = attr("Best Score");
  const bestTime = attr("Best Time (s)");
  const totalRuns = attr("Total Runs");
  const formatTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div style={{
      position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)',
      background: 'linear-gradient(135deg, rgba(15,15,20,0.9) 0%, rgba(5,5,8,0.95) 100%)',
      backdropFilter: 'blur(10px)', border: '1px solid rgba(0,229,255,0.3)',
      padding: '10px 20px', borderRadius: '4px', color: 'white',
      fontFamily: 'Space Grotesk, sans-serif', textAlign: 'center',
      display: 'flex', gap: '24px', alignItems: 'center', pointerEvents: 'none',
    }}>
      <div>
        <div style={{ fontSize: '0.65rem', color: '#8892b0', letterSpacing: '1px' }}>BEST SCORE</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shelby-cyan)', fontFamily: 'monospace' }}>{bestScore} CR</div>
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', color: '#8892b0', letterSpacing: '1px' }}>BEST TIME</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#00ff88', fontFamily: 'monospace' }}>{formatTime(bestTime)}</div>
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', color: '#8892b0', letterSpacing: '1px' }}>RUNS</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>{totalRuns}</div>
      </div>
    </div>
  );
}

function App() {
  const [showOverlay, setShowOverlay] = useState(true);

  const [credits, setCredits] = useState(0);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [isKeySpawned, setIsKeySpawned] = useState(false);
  const [isKeyCollected, setIsKeyCollected] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const [playerName, setPlayerName] = useState('PLAYER');
  const [walletAddress, setWalletAddress] = useState(null);
  const [showMintPopup, setShowMintPopup] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const [stage, setStage] = useState('outpost');

  const [leaderboard, setLeaderboard] = useState([]);
  const [isReloadingLeaderboard, setIsReloadingLeaderboard] = useState(false);

  // Dynamic NFT passport
  const [playerPassport, setPlayerPassport] = useState(null);

  // Ghost replay
  const [ghostReplay, setGhostReplay] = useState(null);
  const [isLoadingGhost, setIsLoadingGhost] = useState(false);
  const [isGhostReplaying, setIsGhostReplaying] = useState(false);

  const [isEnvironmentLoaded, setIsEnvironmentLoaded] = useState(false);
  const { active, progress } = useProgress();
  const isEngineReady = !active && progress === 100 && isEnvironmentLoaded;

  const [cratesList, setCratesList] = useState([
    { id: 'crate_1', position: [24, 2.2, 6] },
    { id: 'crate_2', position: [44, 2.2, -7] },
    { id: 'crate_3', position: [-0.7, 2.2, 33] },
    { id: 'crate_4', position: [0, 2.2, -45] },
    { id: 'crate_5', position: [-22, 2.2, -4.1] },
    { id: 'crate_6', position: [-5.26, 4.29, 1.39] },
    { id: 'crate_7', position: [8.09, 7.47, -6.61] },
    { id: 'crate_8', position: [55.93, 1.12, -2.86] },
    { id: 'crate_9', position: [60.72, 1.12, -16.23] },
    { id: 'crate_10', position: [7.86, 7.47, -39.55] },
  ]);

  const playCollectSound = () => {
    try {
      const audio = new Audio(collectSoundFile);
      audio.volume = 0.6;
      audio.play().catch((err) => console.warn("Autoplay blocked:", err));
    } catch (error) {
      console.warn("Failed to play audio:", error);
    }
  };

  useEffect(() => {
    if (showOverlay) return;
    const timer = setInterval(() => setTimeElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [showOverlay]);

  useEffect(() => {
    if (stage === 'shelbyworld') loadLeaderboard();
  }, [stage]);

  const loadLeaderboard = async () => {
    setIsReloadingLeaderboard(true);
    try {
      const liveRecords = await ShelbyManager.fetchLeaderboard();
      if (Array.isArray(liveRecords)) {
        liveRecords.sort((a, b) => b.score !== a.score ? b.score - a.score : a.time_elapsed - b.time_elapsed);
        setLeaderboard(liveRecords);
      }
    } catch (e) {
      console.warn("Failed to update leaderboard:", e);
    } finally {
      setIsReloadingLeaderboard(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const triggerNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const handleStartGame = async (connectedAddress, fullAddress) => {
    setPlayerName(connectedAddress || "PLAYER");
    setWalletAddress(fullAddress || null);
    setShowOverlay(false);
    replayRecorder.start();
    triggerNotification("WELCOME OUTPOST SECURED. FIND CODES.");

    if (fullAddress) {
      try {
        const passport = await ShelbyManager.fetchPlayerPassport(fullAddress);
        setPlayerPassport(passport);
      } catch (e) {
        console.warn("Could not load passport on start:", e);
      }
    }
  };

  const handleCollectCrate = (crateId) => {
    setCratesList((prev) => prev.filter(c => c.id !== crateId));
    const randomQuestionIdx = Math.floor(Math.random() * CRATE_QUESTIONS.length);
    setActiveQuestion(CRATE_QUESTIONS[randomQuestionIdx]);
  };

  const handleAnswerTrivia = (isCorrect) => {
    setActiveQuestion(null);
    if (isCorrect) {
      playCollectSound();
      setCredits((prev) => {
        const newCredits = prev + 100;
        if (newCredits >= 100 && !isKeySpawned) {
          setIsKeySpawned(true);
          triggerNotification("MILESTONE REACHED! OBJECTIVE KEY SPAWNED AT ORIGIN.");
        }
        return newCredits;
      });
      setCorrectAnswersCount((prev) => prev + 1);
      triggerNotification("DECRYPTION SUCCESSFUL. +100 CR.");
    } else {
      triggerNotification("DECRYPTION FAILED. NO REWARD.");
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

    const frames = replayRecorder.stop();

    try {
      await ShelbyManager.submitFinalScore(credits, timeElapsed, frames);
      triggerNotification("MINTING COMPLETED! PORTAL PASSPORT SECURED.");
      setShowMintPopup(false);

      if (walletAddress) {
        const updated = await ShelbyManager.fetchPlayerPassport(walletAddress);
        setPlayerPassport(updated);
      }
    } catch (err) {
      console.warn("Minting transaction failed:", err);
      triggerNotification("TRANSACTION REJECTED OR FAILED.");
      replayRecorder.start();
    } finally {
      setIsMinting(false);
    }
  };

  const handleTeleportPortal = () => {
    playCollectSound();
    setStage('shelbyworld');
    triggerNotification("PORTAL STABILIZED. WELCOME TO SHELBY WORLD.");
  };

  const handleWatchGhost = async (targetWallet) => {
    if (isLoadingGhost || isGhostReplaying) return;
    setIsLoadingGhost(true);
    try {
      const replay = await ShelbyManager.fetchReplay(targetWallet);
      if (replay && replay.frames?.length > 1) {
        // Tag a unique play id so GhostPlayer remounts cleanly even for the same wallet
        replay._playId = `${targetWallet}_${Date.now()}`;
        setGhostReplay(replay);
        setIsEnvironmentLoaded(false); // outpost world needs to stream back in
        setIsGhostReplaying(true);
        triggerNotification(`ENTERING OUTPOST — REPLAYING ${targetWallet.substring(0, 6)}...`);
      } else {
        triggerNotification("NO GHOST REPLAY FOUND FOR THIS PLAYER.");
      }
    } catch (e) {
      triggerNotification("FAILED TO LOAD GHOST REPLAY.");
    } finally {
      setIsLoadingGhost(false);
    }
  };

  const exitGhostReplay = () => {
    setIsGhostReplaying(false);
    setGhostReplay(null);
    triggerNotification("REPLAY COMPLETE — RETURNING TO SHELBY WORLD.");
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>

      {!showOverlay && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
          <div style={{
            position: 'absolute', top: '30px', left: '30px',
            background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.85) 0%, rgba(5, 5, 8, 0.95) 100%)',
            backdropFilter: 'blur(10px)', border: '1px solid rgba(0, 255, 136, 0.2)',
            padding: '12px 24px', borderRadius: '4px', color: 'white',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              {isGhostReplaying ? "Ghost Replay" : "Time Elapsed"}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#00ff88', textShadow: '0 0 15px rgba(0,255,136,0.4)', fontFamily: 'monospace' }}>
              {isGhostReplaying ? "▶ LIVE" : formatTime(timeElapsed)}
            </div>
          </div>

          {playerPassport && !isGhostReplaying && <PassportBadge passport={playerPassport} />}

          {stage !== 'shelbyworld' && !isGhostReplaying && (
            <div style={{
              position: 'absolute', top: '30px', right: '30px',
              background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.85) 0%, rgba(5, 5, 8, 0.95) 100%)',
              backdropFilter: 'blur(10px)', border: '1px solid rgba(0, 229, 255, 0.2)',
              padding: '12px 24px', borderRadius: '4px', color: 'white',
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Network Credits
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--shelby-cyan)', textShadow: '0 0 15px rgba(0,229,255,0.4)', fontFamily: 'monospace' }}>
                {credits} <span style={{ fontSize: '1rem', color: 'white' }}>CR</span>
              </div>
            </div>
          )}

          <div style={{
            position: 'absolute', bottom: '30px', left: '30px',
            background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.85) 0%, rgba(5, 5, 8, 0.95) 100%)',
            backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '12px 24px', borderRadius: '4px', color: 'white',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#8892b0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Sys.Coords
            </div>
            <div id="hud-coords-value" style={{ fontSize: '1rem', fontWeight: 700, color: '#a0aec0', fontFamily: 'monospace' }}>
              X: 0.00 Y: 0.00 Z: 0.00
            </div>
          </div>

          {/* Exit ghost replay button */}
          {isGhostReplaying && (
            <div style={{ position: 'absolute', bottom: '30px', right: '30px', pointerEvents: 'auto' }}>
              <button
                onClick={exitGhostReplay}
                style={{
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  color: '#00e5ff', padding: '10px 20px', fontSize: '0.8rem',
                  borderRadius: '4px', cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '1px', fontWeight: 'bold',
                }}
              >
                EXIT REPLAY → SHELBY WORLD
              </button>
            </div>
          )}
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
          ghostReplay={ghostReplay}
          ghostReplayMode={isGhostReplaying}
          onGhostFinish={exitGhostReplay}
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

      {showMintPopup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 25000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(5, 5, 8, 0.95)', backdropFilter: 'blur(5px)',
          fontFamily: 'Space Grotesk, sans-serif', color: 'white'
        }}>
          <div style={{
            width: 'min(550px, 90vw)', padding: '40px', textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.9)', border: '2px solid var(--shelby-cyan)',
            borderRadius: '12px', boxShadow: '0 0 25px rgba(0, 229, 255, 0.4)'
          }}>
            <h1 style={{ color: 'var(--shelby-cyan)', fontSize: '2.2rem', marginBottom: '15px' }}>
              SHELBY KEY SECURED!
            </h1>
            <p style={{ color: '#8892b0', fontSize: '1.1rem', lineHeight: '1.5', marginBottom: '30px' }}>
              Your scores are verified. Click below to sign the on-chain transaction and mint your Portal Pass NFT. Your run will be saved to your dynamic passport and your ghost replay stored on Shelby so others can race you.
            </p>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--shelby-cyan)', marginBottom: '40px' }}>
              FINAL SCORE: {credits} CREDITS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                disabled={isMinting}
                onClick={handleExecuteMint}
                style={{
                  width: '100%', padding: '16px 0', fontSize: '1.1rem', fontWeight: 'bold',
                  background: 'var(--shelby-cyan)', color: 'black', border: 'none',
                  borderRadius: '4px', cursor: 'pointer', transition: 'opacity 0.2s'
                }}
              >
                {isMinting ? "SIGNING APTOS TRANSACTION..." : "MINT PORTAL PASS NFT"}
              </button>
              <button
                disabled={isMinting}
                onClick={() => setShowMintPopup(false)}
                style={{
                  width: '100%', padding: '14px 0', fontSize: '1rem',
                  background: 'transparent', border: '1px solid #8892b0',
                  color: '#8892b0', borderRadius: '4px', cursor: 'pointer'
                }}
              >
                CLOSE AND EXPLORE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard hides during ghost replay, returns after */}
      {stage === 'shelbyworld' && !isGhostReplaying && (
        <Leaderboard
          data={leaderboard}
          onReload={loadLeaderboard}
          isReloading={isReloadingLeaderboard}
          onWatchGhost={handleWatchGhost}
          isLoadingGhost={isLoadingGhost}
        />
      )}
    </div>
  );
}

export default App;