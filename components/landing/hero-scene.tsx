"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  MeshDistortMaterial,
  Environment,
  RoundedBox,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Group, Mesh } from "three";

/**
 * HeroScene — R3F 3D backdrop for the Beagle Classroom landing hero
 * (ADR-0029 T1 Showcase — real WebGL, landing only).
 *
 * Floating glossy shapes in the brand palette drift + slowly rotate and
 * lean toward the pointer. Soft environment lighting gives them a
 * premium "liquid glass" read. Kept abstract (no model assets) so it
 * loads fast and never blocks.
 *
 * Mounted via next/dynamic(ssr:false) from the page, wrapped in its own
 * Suspense. prefers-reduced-motion is handled at the page level (the
 * page renders a static gradient instead of this canvas).
 */

const BRAND = {
  blue: "#0a84ff",
  sky: "#5eaedb",
  tan: "#e8a646",
  violet: "#7a7ae5",
  cream: "#fdf6e8",
};

function Shapes() {
  const group = useRef<Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    // Lean the whole cluster toward the pointer for parallax depth.
    const { x, y } = state.pointer;
    group.current.rotation.y += (x * 0.35 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-y * 0.25 - group.current.rotation.x) * 0.04;
  });

  return (
    <group ref={group}>
      <Float speed={1.6} rotationIntensity={0.7} floatIntensity={1.2}>
        <mesh position={[-2.6, 0.6, 0]} castShadow>
          <icosahedronGeometry args={[1.15, 4]} />
          <MeshDistortMaterial
            color={BRAND.blue}
            roughness={0.15}
            metalness={0.1}
            distort={0.35}
            speed={1.4}
          />
        </mesh>
      </Float>

      <Float speed={1.2} rotationIntensity={0.5} floatIntensity={1.5}>
        <RoundedBox
          args={[1.7, 1.7, 1.7]}
          radius={0.28}
          smoothness={6}
          position={[2.5, -0.4, -0.5]}
          castShadow
        >
          <meshStandardMaterial
            color={BRAND.tan}
            roughness={0.2}
            metalness={0.05}
          />
        </RoundedBox>
      </Float>

      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[1.1, 1.7, -1]} castShadow>
          <torusGeometry args={[0.7, 0.28, 32, 64]} />
          <meshStandardMaterial
            color={BRAND.violet}
            roughness={0.18}
            metalness={0.1}
          />
        </mesh>
      </Float>

      <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.3}>
        <mesh position={[-1.4, -1.6, -0.6]} castShadow>
          <sphereGeometry args={[0.62, 48, 48]} />
          <MeshDistortMaterial
            color={BRAND.sky}
            roughness={0.1}
            metalness={0.15}
            distort={0.28}
            speed={2}
          />
        </mesh>
      </Float>

      <Float speed={1.8} rotationIntensity={0.8} floatIntensity={1.1}>
        <mesh position={[3.2, 1.4, -1.4]} castShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial
            color={BRAND.cream}
            roughness={0.25}
            metalness={0.05}
          />
        </mesh>
      </Float>
    </group>
  );
}

function SpinLight() {
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.3;
    ref.current.position.x = Math.sin(t) * 6;
    ref.current.position.z = Math.cos(t) * 6;
  });
  return (
    <mesh ref={ref} position={[6, 4, 2]}>
      <pointLight intensity={40} color="#ffffff" distance={20} />
    </mesh>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 5]} intensity={1.5} />
        <SpinLight />
        <Shapes />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
