import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

export default function GhostPlayer({ replayData, onFinish }) {
  const groupRef = useRef();
  const startTime = useRef(Date.now());
  const isDone = useRef(false);
  const cameraInit = useRef(false);

  const frames = replayData?.frames || [];
  const shortAddr = replayData?.wallet_address
    ? `${replayData.wallet_address.substring(0, 6)}...${replayData.wallet_address.substring(replayData.wallet_address.length - 4)}`
    : "GHOST";

  useFrame((state) => {
    if (!groupRef.current || isDone.current || frames.length < 2) return;

    const elapsed = Date.now() - startTime.current;
    const lastFrame = frames[frames.length - 1];

    if (elapsed >= lastFrame.t) {
      isDone.current = true;
      groupRef.current.visible = false;
      if (onFinish) onFinish();
      return;
    }

    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].t <= elapsed) i++;

    const f0 = frames[i];
    const f1 = frames[Math.min(i + 1, frames.length - 1)];
    const span = f1.t - f0.t;
    const alpha = span > 0 ? Math.min((elapsed - f0.t) / span, 1) : 0;

    const gx = THREE.MathUtils.lerp(f0.x, f1.x, alpha);
    const gy = THREE.MathUtils.lerp(f0.y, f1.y, alpha);
    const gz = THREE.MathUtils.lerp(f0.z, f1.z, alpha);
    const gry = THREE.MathUtils.lerp(f0.ry, f1.ry, alpha);

    groupRef.current.position.set(gx, gy, gz);
    groupRef.current.rotation.y = gry;

    // ---- Chase camera follows the ghost ----
    const cameraDistance = 6.0;
    const cameraPitch = 0.35;
    // Position the camera behind the ghost based on its facing direction
    const offsetVec = new THREE.Vector3(0, 0, cameraDistance);
    offsetVec.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch);
    offsetVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), gry + Math.PI);

    const targetCameraPosition = new THREE.Vector3(
      gx + offsetVec.x,
      gy + offsetVec.y + 2.5,
      gz + offsetVec.z
    );

    if (!cameraInit.current) {
      // Snap on the first frame so we don't sweep across the whole map
      state.camera.position.copy(targetCameraPosition);
      cameraInit.current = true;
    } else {
      state.camera.position.lerp(targetCameraPosition, 0.1);
    }

    state.camera.lookAt(gx, gy + 1.2, gz);
  });

  if (frames.length < 2) return null;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.1, 0]}>
        <capsuleGeometry args={[0.42, 1.3, 8, 16]} />
        <meshStandardMaterial
          color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.6}
          transparent opacity={0.32} depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.33, 12, 12]} />
        <meshStandardMaterial
          color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.6}
          transparent opacity={0.32} depthWrite={false}
        />
      </mesh>
      <Html position={[0, 2.7, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          backgroundColor: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff',
          border: '1px solid rgba(0, 229, 255, 0.5)', padding: '3px 10px',
          borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
          letterSpacing: '1px', fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap',
        }}>
          GHOST — {shortAddr}
        </div>
      </Html>
    </group>
  );
}