import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';

const GroundShader = {
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec3 vLocalPos;
    varying vec3 vWorldPos;
    uniform float uTime;
    
    void main() {
      vLocalPos = position;
      
      // High-performance 3D vertex wave deformation
      float waveX = sin(position.x * 0.04 + uTime * 0.4);
      float waveY = cos(position.y * 0.04 + uTime * 0.2);
      
      // Radial distance zone mask
      float distFromCenter = length(position.xy);
      float flatZoneRadius = 20.0;
      float transitionRange = 35.0;
      float mountainWeight = pow(clamp((distFromCenter - flatZoneRadius) / transitionRange, 0.0, 1.0), 2.0);
      
      float height = waveX * waveY * 12.0 * mountainWeight;
      
      vec3 displacedPos = vec3(position.x, position.y, height);
      vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
      vWorldPos = worldPos.xyz;
      
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPos;
    uniform float uTime;
    
    void main() {
      // Draw grid coordinates
      vec2 gridUV = vWorldPos.xz * 0.12;
      vec2 grid = abs(fract(gridUV - 0.5) - 0.5) / fwidth(gridUV);
      float line = min(grid.x, grid.y);
      float gridIntensity = 1.0 - clamp(line, 0.0, 1.0);
      
      // Shifting neon color gradient
      float shift = sin(uTime * 0.8) * 0.5 + 0.5;
      vec3 cyan = vec3(0.0, 0.9, 1.0);
      vec3 hotPink = vec3(0.9, 0.0, 0.8);
      vec3 neonColor = mix(cyan, hotPink, shift);
      
      vec3 finalColor = neonColor * gridIntensity * 1.5;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export default function CyberGround() {
  // Instantiating directly in JS ensures shaders exist at the exact moment of compilation
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: GroundShader.vertexShader,
      fragmentShader: GroundShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(GroundShader.uniforms),
      wireframe: true
    });
  }, []);

  useFrame((state) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <RigidBody type="fixed" colliders="cuboid" position={[0, -0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <planeGeometry args={[500, 500, 128, 128]} />
      </mesh>
    </RigidBody>
  );
}