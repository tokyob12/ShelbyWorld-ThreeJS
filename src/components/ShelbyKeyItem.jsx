import React, { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';

// Add this line to import the Shelby URLs
import { SHELBY_URLS } from '../constants/urls';

export default function ShelbyKeyItem({ position, onCollect }) {
  // Use SHELBY_URLS.key to retrieve the model from Shelby Storage
  const { scene } = useGLTF(SHELBY_URLS.key);
  const meshRef = useRef();
  const collected = useRef(false);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 1.8 * delta;
    }
  });

  return (
    <RigidBody
      type="fixed"
      position={position}
      sensor
      onIntersectionEnter={() => {
        if (!collected.current) {
          collected.current = true;
          onCollect();
        }
      }}
    >
      <group ref={meshRef}>
        <primitive object={scene} scale={1.0} position={[0, 0, 0]} />
      </group>
    </RigidBody>
  );
}

// Preload the key model from the correct Shelby URL
useGLTF.preload(SHELBY_URLS.key);