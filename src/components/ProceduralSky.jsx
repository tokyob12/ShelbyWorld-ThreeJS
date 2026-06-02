import React, { useMemo } from 'react';
import * as THREE from 'three';

const SkyShader = {
  uniforms: {},
  vertexShader: `
    varying vec3 vLocalPos;
    void main() {
      vLocalPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vLocalPos;
    void main() {
      vec3 localPos = normalize(vLocalPos);
      
      // Ground mask to darken lower hemisphere
      float skyMask = clamp(localPos.y + 0.15, 0.0, 1.0);
      
      // Sky blue daytime gradient
      vec3 zenithColor = vec3(0.08, 0.35, 0.75);
      vec3 horizonColor = vec3(0.45, 0.75, 0.95);
      
      float horizonWeight = pow(clamp(1.0 - localPos.y, 0.0, 1.0), 2.5);
      vec3 skyGradient = mix(zenithColor, horizonColor, horizonWeight);
      
      // Sun position matching light direction [10, 15, 35]
      vec3 sunDirection = normalize(vec3(10.0, 15.0, 35.0));
      float cosTheta = dot(localPos, sunDirection);
      
      vec3 sunHalo = pow(clamp(cosTheta, 0.0, 1.0), 35.0) * vec3(1.0, 0.88, 0.7) * 1.6;
      vec3 sunDisk = pow(clamp(cosTheta, 0.0, 1.0), 1500.0) * vec3(2.0, 2.0, 1.8) * 3.0;
      
      vec3 finalColor = (skyGradient + sunHalo + sunDisk) * skyMask;
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};

export default function ProceduralSky() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SkyShader.vertexShader,
      fragmentShader: SkyShader.fragmentShader,
      uniforms: SkyShader.uniforms,
      side: THREE.BackSide,
      depthWrite: false
    });
  }, []);

  return (
    <mesh scale={[-600, 600, 600]} material={material}>
      <sphereGeometry args={[1, 32, 32]} />
    </mesh>
  );
}