'use client';
import { useEffect, useRef } from 'react';
export function Starfield() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Reduced-motion visitors keep the CSS starfield without downloading Three.js.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cleanup = () => {};
    let disposed = false;
    import('three')
      .then((THREE) => {
        if (disposed || !host.current) return;
        const el = host.current;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
        } catch {
          return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
        camera.position.z = 5;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(750 * 3);
        for (let i = 0; i < positions.length; i++) positions[i] = (Math.random() - 0.5) * 24;
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
          color: '#d7d5ff',
          size: 0.018,
          transparent: true,
          opacity: 0.7,
        });
        const stars = new THREE.Points(geometry, material);
        scene.add(stars);
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        let frame = 0;
        const render = () => {
          if (!media.matches) stars.rotation.y += 0.00012;
          renderer.render(scene, camera);
          if (!media.matches && !document.hidden) frame = requestAnimationFrame(render);
        };
        const restart = () => {
          cancelAnimationFrame(frame);
          if (!document.hidden) render();
        };
        const resize = () => {
          const { width, height } = el.getBoundingClientRect();
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          restart();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        document.addEventListener('visibilitychange', restart);
        media.addEventListener('change', restart);
        cleanup = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          document.removeEventListener('visibilitychange', restart);
          media.removeEventListener('change', restart);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {});
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return <div ref={host} className="starfield" aria-hidden="true" />;
}
