import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Fires tiny, organic leaf-toned particles around a target coordinate
 * to satisfy the tactile check-off requirement (180-280ms duration)
 */
export function fireOrganicParticles(xRatio: number, yRatio: number): void {
  try {
    confetti({
      particleCount: 14,
      spread: 35,
      startVelocity: 14,
      origin: { x: xRatio, y: yRatio },
      colors: ['#2D5A43', '#C85A32', '#6FA489', '#D97753', '#DDD4C7'],
      scalar: 0.65,
      ticks: 35,
      disableForReducedMotion: true,
    });
  } catch {
    // Graceful fallback if canvas is unavailable
  }
}
