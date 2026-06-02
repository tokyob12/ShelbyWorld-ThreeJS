import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF, useAnimations, useKeyboardControls, Html } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { useFrame, useThree } from '@react-three/fiber';
import { SHELBY_URLS } from '../constants/urls'; // Imported Shelby URLs

export default function PlayerCharacter({ playerName = "PLAYER" }) {
  const rigidBodyRef = useRef();
  const avatarGroup = useRef();
  const lastLogTime = useRef(0);
  
  const { gl } = useThree();

  const cameraYaw = useRef(0);
  const cameraPitch = useRef(0.2);
  const isDragging = useRef(false);
  const cameraTarget = useRef(new THREE.Vector3());

  // Stream the Meebit avatar model directly from Shelby Storage
  const { scene, animations } = useGLTF(SHELBY_URLS.meebit);
  const { actions } = useAnimations(animations, avatarGroup);

  const [animationState, setAnimationState] = useState('idle');
  const [, getKeys] = useKeyboardControls();

  useEffect(() => {
    if (animations && animations.length > 0) {
      console.log(" Meebit animations found in file:", animations.map(a => a.name));
    }
  }, [animations]);

  // Drag-to-Look Event Binding
  useEffect(() => {
    const canvas = gl.domElement;

    const handlePointerDown = (e) => {
      isDragging.current = true;
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e) => {
      isDragging.current = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    const handlePointerMove = (e) => {
      if (!isDragging.current) return;

      const sensitivity = 0.003;
      cameraYaw.current -= e.movementX * sensitivity;
      cameraPitch.current = Math.max(
        -0.2,
        Math.min(1.0, cameraPitch.current - e.movementY * sensitivity)
      );
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointermove', handlePointerMove);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
    };
  }, [gl]);

  // Animation Blending System
  useEffect(() => {
    const clipMap = {
      idle: 'idle',
      walk: 'run',
      jump: 'jump'
    };

    const targetClip = clipMap[animationState] || 'idle';
    let finalClipName = targetClip;

    if (targetClip === 'run' && !actions['run']) {
      const foundWalk = animations.find(a => a.name.toLowerCase().includes('walk') || a.name.toLowerCase().includes('run'));
      if (foundWalk) finalClipName = foundWalk.name;
    }

    const activeAction = actions[finalClipName];

    if (activeAction) {
      activeAction.reset().fadeIn(0.15).play();
      return () => activeAction.fadeOut(0.15);
    }
  }, [animationState, actions, animations]);

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) return;

    const { forward, backward, left, right, strafeLeft, strafeRight, jump, boost } = getKeys();
    const currentVelocity = rigidBodyRef.current.linvel();
    const currentPos = rigidBodyRef.current.translation();

    // High-performance coordinates dispatch
    const coordsEl = document.getElementById('hud-coords-value');
    if (coordsEl) {
      coordsEl.innerText = `X: ${currentPos.x.toFixed(2)} Y: ${currentPos.y.toFixed(2)} Z: ${currentPos.z.toFixed(2)}`;
    }

    // Camera-relative directions
    const cameraForward = new THREE.Vector3();
    state.camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    const cameraRight = new THREE.Vector3()
      .crossVectors(cameraForward, new THREE.Vector3(0, 1, 0))
      .normalize();

    const moveDirection = new THREE.Vector3(0, 0, 0);

    if (forward) moveDirection.add(cameraForward);
    if (backward) moveDirection.sub(cameraForward);
    if (left || strafeLeft) moveDirection.sub(cameraRight);
    if (right || strafeRight) moveDirection.add(cameraRight);

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
    }

    // Smooth turning
    if (moveDirection.lengthSq() > 0) {
      const targetRotationY = Math.atan2(moveDirection.x, moveDirection.z);
      avatarGroup.current.rotation.y = THREE.MathUtils.lerp(
        avatarGroup.current.rotation.y,
        targetRotationY,
        0.15
      );
    }

    const baseSpeed = 4.5;
    const speedMultiplier = boost ? 1.8 : 1.0;
    const movementSpeed = baseSpeed * speedMultiplier;

    const velocityX = moveDirection.x * movementSpeed;
    const velocityZ = moveDirection.z * movementSpeed;

    // Apply linear velocity
    rigidBodyRef.current.setLinvel(
      { x: velocityX, y: currentVelocity.y, z: velocityZ },
      true
    );

    // Ground check
    const isOnGround = Math.abs(currentVelocity.y) < 0.3;
    const isJumpingOrFalling = Math.abs(currentVelocity.y) > 2.0; 

    if (jump && isOnGround) {
      rigidBodyRef.current.setLinvel(
        { x: currentVelocity.x, y: 8.5, z: currentVelocity.z },
        true
      );
    }

    // Determine target animation state
    const isMoving = forward || backward || left || right || strafeLeft || strafeRight;

    if (isJumpingOrFalling) {
      if (animationState !== 'jump') setAnimationState('jump');
    } else if (isMoving) {
      if (animationState !== 'walk') setAnimationState('walk');
    } else {
      if (animationState !== 'idle') setAnimationState('idle');
    }

    // Camera follow offsets
    const cameraDistance = 6.0;
    const offsetVec = new THREE.Vector3(0, 0, cameraDistance);
    offsetVec.applyAxisAngle(new THREE.Vector3(1, 0, 0), cameraPitch.current);
    offsetVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw.current);

    const targetCameraPosition = new THREE.Vector3(
      currentPos.x + offsetVec.x,
      currentPos.y + offsetVec.y + 1.2,
      currentPos.z + offsetVec.z
    );

    state.camera.position.lerp(targetCameraPosition, 0.08);

    // Smooth Camera Look-At
    const idealLookTarget = new THREE.Vector3(
      currentPos.x,
      currentPos.y + 0.8,
      currentPos.z
    );

    cameraTarget.current.lerp(idealLookTarget, 0.1);
    state.camera.lookAt(cameraTarget.current);
  });

  useEffect(() => {
    scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      position={[0, 8, 0]}
      enabledRotations={[false, false, false]} 
      canSleep={false}
      friction={0}
      restitution={0}
    >
      <CapsuleCollider args={[0.65, 0.45]} position={[0, 0.2, 0]} friction={0} restitution={0} />

      <Html position={[0, 1.8, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          backgroundColor: 'rgba(5, 5, 8, 0.85)',
          color: 'white',
          border: '1px solid var(--shelby-cyan)',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: 'Space Grotesk, sans-serif',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 15px rgba(0, 229, 255, 0.25)'
        }}>
          {playerName}
        </div>
      </Html>

      <group ref={avatarGroup} scale={1.3}>
        <primitive object={scene} position={[0, -0.7, 0]} />
      </group>
    </RigidBody>
  );
}

useGLTF.preload(SHELBY_URLS.meebit);