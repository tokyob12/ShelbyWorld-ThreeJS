import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const ShelbySignShader = {
  uniforms: {
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }
    float drawS(vec2 p) {
      float d = sdBox(p - vec2(0.0, 0.15), vec2(0.18, 0.035));
      d = min(d, sdBox(p - vec2(0.0, 0.0), vec2(0.18, 0.035)));
      d = min(d, sdBox(p - vec2(0.0, -0.15), vec2(0.18, 0.035)));
      d = min(d, sdBox(p - vec2(-0.15, 0.075), vec2(0.035, 0.05)));
      d = min(d, sdBox(p - vec2(0.15, -0.075), vec2(0.035, 0.05)));
      return d;
    }
    float drawH(vec2 p) {
      float d = sdBox(p - vec2(-0.15, 0.0), vec2(0.035, 0.22));
      d = min(d, sdBox(p - vec2(0.15, 0.0), vec2(0.035, 0.22)));
      d = min(d, sdBox(p - vec2(0.0, 0.0), vec2(0.13, 0.035)));
      return d;
    }
    float drawE(vec2 p) {
      float d = sdBox(p - vec2(-0.15, 0.0), vec2(0.035, 0.22));
      d = min(d, sdBox(p - vec2(0.0, 0.18), vec2(0.12, 0.035)));
      d = min(d, sdBox(p - vec2(-0.02, 0.0), vec2(0.09, 0.035)));
      d = min(d, sdBox(p - vec2(0.0, -0.18), vec2(0.12, 0.035)));
      return d;
    }
    float drawL(vec2 p) {
      float d = sdBox(p - vec2(-0.15, 0.0), vec2(0.035, 0.22));
      d = min(d, sdBox(p - vec2(0.0, -0.18), vec2(0.12, 0.035)));
      return d;
    }
    float drawB(vec2 p) {
      float d = sdBox(p - vec2(-0.15, 0.0), vec2(0.035, 0.22));
      d = min(d, sdBox(p - vec2(0.0, 0.18), vec2(0.15, 0.035)));
      d = min(d, sdBox(p - vec2(0.0, 0.0), vec2(0.12, 0.035)));
      d = min(d, sdBox(p - vec2(0.0, -0.18), vec2(0.15, 0.035)));
      d = min(d, sdBox(p - vec2(0.15, 0.09), vec2(0.035, 0.09)));
      d = min(d, sdBox(p - vec2(0.15, -0.09), vec2(0.035, 0.09)));
      return d;
    }
    float drawY(vec2 p) {
      float d = sdBox(p - vec2(0.0, -0.1), vec2(0.035, 0.12));
      vec2 pLeft = p - vec2(-0.09, 0.1);
      pLeft *= mat2(cos(0.56), sin(0.56), -sin(0.56), cos(0.56));
      d = min(d, sdBox(pLeft, vec2(0.035, 0.13)));
      vec2 pRight = p - vec2(0.09, 0.1);
      pRight *= mat2(cos(-0.56), sin(-0.56), -sin(-0.56), cos(-0.56));
      d = min(d, sdBox(pRight, vec2(0.035, 0.13)));
      return d;
    }
    float combinedShape(vec2 p) {
      float d = 1e9;
      d = min(d, drawS(p - vec2(-1.5, 0.0)));
      d = min(d, drawH(p - vec2(-0.9, 0.0)));
      d = min(d, drawE(p - vec2(-0.3, 0.0)));
      d = min(d, drawL(p - vec2(0.3, 0.0)));
      d = min(d, drawB(p - vec2(0.9, 0.0)));
      d = min(d, drawY(p - vec2(1.5, 0.0)));
      return d;
    }
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      p.x *= 4.0;
      float glitch = sin(uTime * 15.0) * cos(uTime * 10.0);
      if (abs(glitch) > 0.85) {
        p.x += sin(p.y * 40.0) * 0.08;
      }
      float distance = combinedShape(p);
      float border = smoothstep(0.08, 0.01, abs(distance));
      vec3 neonColor = mix(vec3(0.0, 0.9, 1.0), vec3(0.8, 0.0, 1.0), p.x * 0.25 + 0.5);
      vec3 finalColor = neonColor * border * 2.0;
      float alpha = border;
      if (alpha < 0.05) discard;
      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};

export default function ShelbySign() {
  // Instantiating directly in JS ensures shaders exist at the exact moment of compilation
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: ShelbySignShader.vertexShader,
      fragmentShader: ShelbySignShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(ShelbySignShader.uniforms),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }, []);

  useFrame((state) => {
    if (material.uniforms) {
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <mesh position={[0, 6, 20]} material={material}>
      <planeGeometry args={[16, 4]} />
    </mesh>
  );
}