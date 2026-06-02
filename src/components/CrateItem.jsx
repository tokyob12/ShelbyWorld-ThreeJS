import React, { useRef } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { SHELBY_URLS } from '../constants/urls'; // Imported Shelby URLs

export default function CrateItem({ id, position, onCollect }) {
  // Stream the crate model directly from Shelby Storage
  const { scene } = useGLTF(SHELBY_URLS.crateAndKey);
  const meshRef = useRef();
  const collected = useRef(false);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 1.2 * delta;
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
          onCollect(id);
        }
      }}
    >
      <group ref={meshRef}>
        <Clone object={scene} scale={1.2} />
      </group>
    </RigidBody>
  );
}

useGLTF.preload(SHELBY_URLS.crateAndKey);