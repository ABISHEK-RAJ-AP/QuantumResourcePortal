import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'

import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/components/ui/cube-wave-utils/use-shadcn-theme'

export type SceneContainerProps = {
  className?: string
  theme?: ThemeMode
  environment?: 'studio' | 'none'
  camera?: [number, number, number]
  fov?: number
  children: ReactNode
}

/** Lean R3F canvas — low DPR, one key light, transparent clear (perf for portal hero). */
export function SceneContainer({
  className,
  camera = [8, 7, 8],
  fov = 32,
  children,
}: SceneContainerProps) {
  return (
    <div className={cn('relative h-full w-full min-h-[280px]', className)}>
      <Canvas
        camera={{ position: camera, fov, near: 0.1, far: 100 }}
        dpr={[1, 1.25]}
        frameloop="always"
        performance={{ min: 0.5 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent' }}
        onCreated={({ camera: cam, gl }) => {
          cam.lookAt(0, 0, 0)
          gl.setClearColor(0x000000, 0)
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 10, 4]} intensity={1.05} />
        <group rotation={[-0.42, 0.55, 0.08]}>{children}</group>
      </Canvas>
    </div>
  )
}
