import React, { useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { SHELBY_URLS } from '../constants/urls';

// High-performance chunk-streaming downloader
async function fetchChunkedBlob(url, chunkSize = 8 * 1024 * 1024) {
  const initRes = await fetch(url, { headers: { 'Range': 'bytes=0-0' } });
  if (!initRes.ok) throw new Error("Connection failed");
  
  const contentRange = initRes.headers.get('content-range');
  if (!contentRange) {
    console.warn("Ranges not supported, downloading standard...");
    const res = await fetch(url);
    return await res.blob();
  }
  
  const totalSize = parseInt(contentRange.split('/')[1]);
  const chunks = [];
  let downloadedBytes = 0;
  
  while (downloadedBytes < totalSize) {
    const start = downloadedBytes;
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    
    const chunkRes = await fetch(url, { headers: { 'Range': `bytes=${start}-${end}` } });
    if (!chunkRes.ok) throw new Error("Chunk download failed");
    
    const buffer = await chunkRes.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    downloadedBytes += buffer.byteLength;
  }
  
  return new Blob(chunks, { type: 'application/octet-stream' });
}

export default function EnvironmentMesh({ onEnvironmentLoaded }) { // Prop added (Step 1)
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let localUrl = null;

    fetchChunkedBlob(SHELBY_URLS.environment)
      .then((blob) => {
        if (!active) return;
        localUrl = URL.createObjectURL(blob);
        setBlobUrl(localUrl);
        onEnvironmentLoaded(true); // Trigger parent callback: Environment is ready!
      })
      .catch((err) => {
        if (!active) return;
        console.error("Shelby chunked download failed, reverting to local backup:", err);
        setError(err);
        onEnvironmentLoaded(true); // Trigger parent callback so game can run on local fallback
      });

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [onEnvironmentLoaded]);

  if (error) {
    return <EnvironmentMeshLocal />;
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

function EnvironmentMeshLocal() {
  const { scene } = useGLTF('/model/test33.glb');
  
  useEffect(() => {
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <RigidBody type="fixed" colliders="trimesh" scale={1.5} position={[0, 0, 0]}>
      <primitive object={scene} />
    </RigidBody>
  );
}

useGLTF.preload('/model/test33.glb');