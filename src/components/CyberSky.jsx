import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const SpaceSkyShader = {
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    uniform float uTime;
    
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    
    void main() {
      vec3 localPos = normalize(vNormal);
      
      // Cosmic background space gradient
      vec3 spaceBase = mix(vec3(0.01, 0.003, 0.02), vec3(0.03, 0.01, 0.06), localPos.y + 0.5);
      
      // Swirling cosmic nebulae
      float swirlAngle = localPos.x * 2.0 + uTime * 0.12;
      float gasWave = sin(swirlAngle + localPos.y * 4.0) * 0.5 + 0.5;
      
      vec3 neonPurple = vec3(0.5, 0.0, 0.95);
      vec3 neonCyan = vec3(0.0, 0.75, 1.0);
      vec3 gasColor = mix(neonPurple, neonCyan, gasWave);
      
      vec3 skyBase = mix(spaceBase, gasColor, gasWave * 0.3);
      
      // Sparking stardust fields
      float starPosition = localPos.x * 200.0 + localPos.z * 200.0;
      float starTwinkle = sin(starPosition + uTime * 2.5);
      float starValue = clamp(starTwinkle - 0.96, 0.0, 1.0) * 25.0;
      
      vec3 finalColor = skyBase + vec3(starValue);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export default function CyberSky() {
  // Instantiating directly in JS ensures shaders exist at the exact moment of compilation
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SpaceSkyShader.vertexShader,
      fragmentShader: SpaceSkyShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(SpaceSkyShader.uniforms),
      side: THREE.BackSide,
      depthWrite: false
    });
  }, []);

  useFrame((state) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh scale={[-800, 800, 800]} material={material}>
      <sphereGeometry args={[1, 16, 16]} />
    </mesh>
  );
}