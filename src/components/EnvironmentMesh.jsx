import React, { useEffect, useState } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { SHELBY_URLS } from '../constants/urls';

// =========================================================================
// STABLE NATIVE BLOB FETCH (100% Shelby-Native & HTTP/2 Safe)
// Uses the browser's native background network engine to download the blob.
// This prevents main-thread JS delays from causing HTTP/2 RST_STREAM timeouts.
// =========================================================================
async function fetchStreamedBlob(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch. Status: ${response.status}`);
  }
  
  // Leverage native browser-optimized engine instead of custom getReader() loops
  const blob = await response.blob();
  if (onProgress) onProgress(100); // Instantly set loading to 100% when finished
  return blob;
}

export default function EnvironmentMesh({ onEnvironmentLoaded }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let localUrl = null;

    // Fetch directly from the Shelby Storage Network
    fetchStreamedBlob(SHELBY_URLS.environment)
      .then((blob) => {
        if (!active) return;
        localUrl = URL.createObjectURL(blob);
        setBlobUrl(localUrl);
        onEnvironmentLoaded(true); // Unlock start button
      })
      .catch((err) => {
        if (!active) return;
        console.error("Shelby streaming failed:", err);
        setError(err);
      });

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [onEnvironmentLoaded]);

  if (error) {
    return (
      <Html center style={{ pointerEvents: 'none' }}>
        <div style={{
          backgroundColor: 'rgba(255, 68, 68, 0.95)',
          color: 'white',
          border: '2px solid #ff4444',
          padding: '16px 24px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '1px',
          fontFamily: 'Space Grotesk, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 15px rgba(255, 68, 68, 0.4)'
        }}>
          SHELBY OUTPOST STREAM ABORTED (HTTP/2 LIMIT EXCEEDED)
        </div>
      </Html>
    );
  }

  if (!blobUrl) {
    return null;
  }

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