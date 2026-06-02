import React from 'react';

export default function Leaderboard({ data, onReload, isReloading }) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getShortAddress = (addr) => {
    if (!addr) return "Unknown";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div style={{
      position: 'absolute',
      top: '30px',
      right: '30px',
      bottom: '30px',
      width: 'min(420px, 90vw)',
      background: 'linear-gradient(135deg, rgba(15, 15, 20, 0.85) 0%, rgba(5, 5, 8, 0.95) 100%)',
      backdropFilter: 'blur(15px)',
      border: '1px solid rgba(0, 229, 255, 0.25)',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 10px 45px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
      fontFamily: 'Space Grotesk, sans-serif',
      color: 'white',
      pointerEvents: 'auto', // Allows scrolling and click interactions
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 'bold', color: 'var(--shelby-cyan)' }}>
          DECENTRALIZED LEADERBOARD
        </h3>
        <button 
          onClick={onReload}
          disabled={isReloading}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 229, 255, 0.3)',
            color: 'var(--shelby-cyan)',
            padding: '4px 10px',
            fontSize: '0.75rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'Space Grotesk, sans-serif'
          }}
        >
          {isReloading ? "LOADING..." : "REFRESH"}
        </button>
      </div>

      <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: '#8892b0', lineHeight: 1.4 }}>
        Scores are retrieved live from Shelby Storage and verified against on-chain mint signatures.
      </p>

      {/* Scrollable table container */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '8px 0', color: '#8892b0', fontSize: '0.75rem', width: '50px' }}>RANK</th>
              <th style={{ padding: '8px 0', color: '#8892b0', fontSize: '0.75rem' }}>PLAYER</th>
              <th style={{ padding: '8px 0', color: '#8892b0', fontSize: '0.75rem', textAlign: 'right' }}>SCORE</th>
              <th style={{ padding: '8px 0', color: '#8892b0', fontSize: '0.75rem', textAlign: 'right' }}>TIME</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player, idx) => (
              <tr 
                key={idx} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  backgroundColor: idx === 0 ? 'rgba(0, 229, 255, 0.02)' : 'transparent'
                }}
              >
                {/* Rank with Gold/Silver/Bronze crown indicators */}
                <td style={{ padding: '12px 0', fontWeight: 'bold', color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : 'white' }}>
                  #{idx + 1}
                </td>
                <td style={{ padding: '12px 0' }}>
                  <a 
                    href={`https://explorer.aptoslabs.com/txn/${player.tx_hash}?network=testnet`}
                    target="_blank" 
                    rel="noreferrer"
                    style={{ 
                      color: 'white', 
                      textDecoration: 'none', 
                      borderBottom: '1px dotted rgba(255,255,255,0.3)',
                      fontSize: '0.85rem'
                    }}
                    title="View Verified Mint on Aptos Explorer"
                  >
                    {getShortAddress(player.wallet_address)}
                  </a>
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 'bold', color: 'var(--shelby-cyan)' }}>
                  {player.score}
                </td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatTime(player.time_elapsed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}