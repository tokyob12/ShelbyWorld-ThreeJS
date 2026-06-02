import React, { Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';

import { WebGPURenderer } from 'three/webgpu';

import EnvironmentMesh from './EnvironmentMesh';
import PlayerCharacter from './PlayerCharacter';
import CrateItem from './CrateItem';
import ShelbyKeyItem from './ShelbyKeyItem';
import PortalMesh from './PortalMesh';
import CyberGround from './CyberGround';
import CyberSky from './CyberSky';
import ShelbySign from './ShelbySign';
import ProceduralSky from './ProceduralSky';

export default function GameCanvas({ 
  cratesList, 
  onCollectCrate, 
  isKeySpawned, 
  onCollectKey,
  isPaused,
  playerName,
  stage, 
  isKeyCollected,
  onTeleport,
  showPlayer,
  onEnvironmentLoaded // Prop added (Step 2)
}) {
  const isShelbyWorld = stage === 'shelbyworld';

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [0, 8, -18], fov: 60 }}
        
        gl={async (canvas) => {
          const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false });
          await renderer.init();
          renderer.toneMappingExposure = 1.35; 
          return renderer;
        }}
      >
        <hemisphereLight args={['#ffffff', '#444444', 1.2]} />
        <ambientLight intensity={1.2} /> 

        <directionalLight
          castShadow
          position={[10, 15, 35]} 
          intensity={2.2}        
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
          shadow-normalBias={0.04} 
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-camera-near={0.1}
          shadow-camera-far={150}
        />

        <Suspense fallback={null}>
          {isShelbyWorld ? (
            <CyberSky />
          ) : (
            <ProceduralSky /> 
          )}
        </Suspense>
        
        <Physics gravity={[0, -18, 0]} paused={isPaused}>
          {isShelbyWorld ? (
            <CyberGround />
          ) : (
            <Suspense fallback={null}>
              {/* Pass the loading callback into the EnvironmentMesh */}
              <EnvironmentMesh onEnvironmentLoaded={onEnvironmentLoaded} />
            </Suspense>
          )}
          
          {showPlayer && (
            <Suspense fallback={null}>
              <PlayerCharacter playerName={playerName} />
            </Suspense>
          )}

          {!isShelbyWorld && cratesList.map((crate) => (
            <Suspense key={crate.id} fallback={null}>
              <CrateItem 
                id={crate.id} 
                position={crate.position} 
                onCollect={onCollectCrate} 
              />
            </Suspense>
          ))}

          {!isShelbyWorld && isKeySpawned && (
            <Suspense fallback={null}>
              <ShelbyKeyItem 
                position={[0, 1.2, 8]} 
                onCollect={onCollectKey}
              />
            </Suspense>
          )}

          {!isShelbyWorld && isKeyCollected && (
            <PortalMesh 
              position={[-36, 1.0, 5]} 
              onPlayerEnter={onTeleport}
            />
          )}
        </Physics>
      </Canvas>
    </div>
  );
}