import React, { useEffect, useState } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { SHELBY_URLS } from '../constants/urls';

async function fetchWithRetry(url, maxAttempts = 4) {
  let delay = 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Empty response body");
      return blob;
    } catch (err) {
      const isRetryable =
        err.message.includes("Failed to fetch") ||
        err.message.includes("ERR_HTTP2") ||
        err.message.includes("network") ||
        err.message.includes("Empty response");

      if (!isRetryable || attempt === maxAttempts) throw err;

      console.warn(`[SHELBY] Environment fetch attempt ${attempt} failed — retrying in ${delay}ms...`, err.message);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 1.5;
    }
  }
}

export default function EnvironmentMesh({ onEnvironmentLoaded }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let localUrl = null;

    fetchWithRetry(SHELBY_URLS.environment)
      .then((blob) => {
        if (!active) return;
        localUrl = URL.createObjectURL(blob);
        setBlobUrl(localUrl);
        onEnvironmentLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Shelby environment load failed after all retries:", err);
        setError(err);
      });

    return () => {
      active = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [onEnvironmentLoaded, attempt]);

  if (error) {
    return (
      <Html center style={{ pointerEvents: 'auto' }}>
        <div style={{
          backgroundColor: 'rgba(10, 10, 30, 0.95)',
          color: 'white',
          border: '2px solid var(--shelby-cyan, #00e5ff)',
          padding: '20px 28px',
          borderRadius: '4px',
          fontSize: '14px',
          fontFamily: 'Space Grotesk, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ fontWeight: 'bold', letterSpacing: '1px', color: '#ff6b6b' }}>
            SHELBY STREAM INTERRUPTED
          </div>
          <div style={{ fontSize: '12px', color: '#8892b0' }}>
            Connection dropped while loading environment
          </div>
          <button
            onClick={() => { setError(null); setAttempt(a => a + 1); }}
            style={{
              background: 'var(--shelby-cyan, #00e5ff)',
              color: 'black',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '4px',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 'bold',
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            RETRY
          </button>
        </div>
      </Html>
    );
  }

  if (!blobUrl) return null;

  return <EnvironmentMeshRenderer url={blobUrl} />;
}

function EnvironmentMeshRenderer({ url }) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          node.material.roughness = Math.max(node.material.roughness, 0.4);
          node.material.metalness = Math.min(node.material.metalness, 0.2);
        }
      }
    });
  }, [scene]);

  return (
    <RigidBody type="fixed" colliders="trimesh" scale={1.5} position={[0, 0, 0]}>
      <primitive object={scene} />
    </RigidBody>
  );
}