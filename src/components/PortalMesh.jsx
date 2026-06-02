import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CylinderCollider } from '@react-three/rapier';

const VortexShader = {
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    uniform float uTime;
    void main() {
      float wave = sin(vPosition.y * 3.0 - uTime * 8.0) * 0.5 + 0.5;
      float angle = atan(vPosition.z, vPosition.x) + uTime * 1.5;
      float stripes = sin(angle * 6.0 + vPosition.y * 4.0);
      vec3 coreColor = vec3(0.0, 0.9, 1.0);
      vec3 rimColor = vec3(0.5, 0.0, 1.0);
      vec3 finalColor = mix(rimColor, coreColor, wave * 0.7 + stripes * 0.3);
      float verticalFade = smoothstep(2.0, 0.5, abs(vPosition.y));
      float alpha = (wave * 0.5 + stripes * 0.5) * verticalFade * 0.65;
      if (alpha < 0.05) discard;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

export default function PortalMesh({ position, onPlayerEnter }) {
  const innerVortexRef = useRef();
  const triggered = useRef(false);

  // Instantiating directly in JS ensures shaders exist at the exact moment of compilation
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VortexShader.vertexShader,
      fragmentShader: VortexShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(VortexShader.uniforms),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }, []);

  useFrame((state, delta) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
    if (innerVortexRef.current) {
      innerVortexRef.current.rotation.y += 1.5 * delta;
    }
  });

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <CylinderCollider 
        args={[2.0, 2.0]} 
        position={[0, 1.1, 0]} 
        sensor
        onIntersectionEnter={() => {
          if (!triggered.current) {
            triggered.current = true;
            onPlayerEnter();
          }
        }}
      />

      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
          <ringGeometry args={[1.8, 2.2, 32]} />
          <meshBasicMaterial color="#00E5FF" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>

        <mesh ref={innerVortexRef} position={[0, 1.1, 0]} material={material}>
          <cylinderGeometry args={[2.0, 2.0, 4.0, 32, 1, true]} />
        </mesh>
      </group>
    </RigidBody>
  );
}