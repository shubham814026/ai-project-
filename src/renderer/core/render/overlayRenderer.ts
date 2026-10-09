/**
 * Canvas Overlay Renderer
 * High-performance 60fps canvas renderer running in rAF
 * Layers (bottom to top):
 * 1. Target pose guide (Antique Brass dashed)
 * 2. Detected skeleton (Mint Cyan with dark halo)
 * 3. Detected landmarks (Aligned / Needs correction / Low confidence)
 * 4. Correction arrows (Warm Amber with dark halo, away from face)
 * 5. Success hold ring / status indicator
 * Strictly adheres to Sections A6, A7, A9
 */

import { NormalizedLandmark, STANDARD_CONNECTIONS } from '../library/types';
import { TransformBounds, mapNormalizedToScreen, KNOWN_TEST_MARKERS } from './coordinates';
import { PALETTE } from '../settings/constants';
import { CorrectionInstruction } from '../guidance/correctionGenerator';

export interface OverlayRenderData {
  userLandmarks: NormalizedLandmark[] | null;
  targetLandmarks: NormalizedLandmark[] | null;
  secondaryPersons?: NormalizedLandmark[][];
  showSkeleton: boolean;
  showTargetGuide: boolean;
  showTestPattern?: boolean;
  corrections: CorrectionInstruction[];
  matchedJoints: Set<number>;
  needsAdjustmentJoints: Set<number>;
  holdProgress: number; // [0, 1]
  isStableMatched: boolean;
  trackingLost: boolean;
  fadeOpacity: number; // [0, 1]
}

export class OverlayRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Failed to acquire 2D canvas context');
    this.ctx = ctx;
  }

  public render(data: OverlayRenderData, bounds: TransformBounds): void {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.fadeOpacity <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = data.fadeOpacity;

    // 0. Draw Alignment Test Pattern (Section A7, A12)
    if (data.showTestPattern) {
      this.drawTestPattern(bounds);
    }

    // 1. Draw Target Pose Guide (Section A9: 2.5px dashed Antique Brass, 55% opacity)
    if (data.showTargetGuide && data.targetLandmarks && data.targetLandmarks.length > 0) {
      this.drawTargetSkeleton(data.targetLandmarks, bounds);
    }

    // 1.5 Draw Secondary Persons (faint dashed Sage Gray at 30% opacity)
    if (data.showSkeleton && data.secondaryPersons && data.secondaryPersons.length > 0) {
      for (const sec of data.secondaryPersons) {
        this.drawSecondarySkeleton(sec, bounds);
      }
    }

    // 2. Draw Detected Skeleton (Section A9: 3px Mint Cyan with 1.5px dark halo)
    if (data.showSkeleton && data.userLandmarks && data.userLandmarks.length > 0 && !data.trackingLost) {
      this.drawDetectedSkeleton(data.userLandmarks, bounds);
      this.drawDetectedJoints(data.userLandmarks, data.matchedJoints, data.needsAdjustmentJoints, bounds);
    }

    // 3. Draw Correction Indicators & Arrows (Section A9: 3px stroke with 10px head, dark halo)
    if (data.corrections.length > 0 && !data.trackingLost) {
      this.drawCorrectionArrows(data.corrections, bounds);
    }

    // 4. Draw Hold Progress / Success Ring if holding or matched
    if (data.holdProgress > 0 || data.isStableMatched) {
      this.drawHoldIndicator(data.holdProgress, data.isStableMatched, bounds);
    }

    ctx.restore();
  }

  public drawTestPattern(bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;

    ctx.save();
    // Rendered Viewport Border
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = PALETTE.ACCENT_BRASS;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.strokeRect(
      bounds.offsetX * dpr,
      bounds.offsetY * dpr,
      bounds.renderedWidth * dpr,
      bounds.renderedHeight * dpr
    );
    ctx.setLineDash([]);

    // Draw reference markers at known normalized positions
    for (const m of KNOWN_TEST_MARKERS) {
      const pt = mapNormalizedToScreen(m.normX, m.normY, bounds);

      // Dark halo
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = PALETTE.SKELETON_HALO;
      ctx.beginPath();
      ctx.arc(pt.bufferX, pt.bufferY, 8 * dpr, 0, Math.PI * 2);
      ctx.stroke();

      // Outer ring
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = PALETTE.SKELETON_MINT;
      ctx.beginPath();
      ctx.arc(pt.bufferX, pt.bufferY, 8 * dpr, 0, Math.PI * 2);
      ctx.stroke();

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(pt.bufferX - 12 * dpr, pt.bufferY);
      ctx.lineTo(pt.bufferX + 12 * dpr, pt.bufferY);
      ctx.moveTo(pt.bufferX, pt.bufferY - 12 * dpr);
      ctx.lineTo(pt.bufferX, pt.bufferY + 12 * dpr);
      ctx.stroke();

      // Center pin
      ctx.fillStyle = PALETTE.ACCENT_BRASS;
      ctx.beginPath();
      ctx.arc(pt.bufferX, pt.bufferY, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Label (never mirrored)
      ctx.font = `600 ${10 * dpr}px Inter, sans-serif`;
      ctx.fillStyle = PALETTE.TEXT_PRIMARY;
      ctx.fillText(m.label, pt.bufferX + 14 * dpr, pt.bufferY - 6 * dpr);
    }
    ctx.restore();
  }

  private drawTargetSkeleton(landmarks: NormalizedLandmark[], bounds: TransformBounds): void {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 2.5 * bounds.dpr;
    ctx.strokeStyle = PALETTE.TARGET_GUIDE;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([8 * bounds.dpr, 6 * bounds.dpr]);

    for (const [i1, i2] of STANDARD_CONNECTIONS) {
      // Don't draw across face
      if (i1 < 11 && i2 < 11) continue;

      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
        const s1 = mapNormalizedToScreen(p1.x, p1.y, bounds);
        const s2 = mapNormalizedToScreen(p2.x, p2.y, bounds);
        ctx.beginPath();
        ctx.moveTo(s1.bufferX, s1.bufferY);
        ctx.lineTo(s2.bufferX, s2.bufferY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawDetectedSkeleton(landmarks: NormalizedLandmark[], bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;

    for (const [i1, i2] of STANDARD_CONNECTIONS) {
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      if (p1 && p2 && p1.visibility >= 0.35 && p2.visibility >= 0.35) {
        const s1 = mapNormalizedToScreen(p1.x, p1.y, bounds);
        const s2 = mapNormalizedToScreen(p2.x, p2.y, bounds);

        // Dark halo underneath (1.5px extra width)
        ctx.save();
        ctx.lineWidth = (3 + 3) * dpr;
        ctx.strokeStyle = PALETTE.SKELETON_HALO;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s1.bufferX, s1.bufferY);
        ctx.lineTo(s2.bufferX, s2.bufferY);
        ctx.stroke();

        // Main stroke: Mint Cyan
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = PALETTE.SKELETON_MINT;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawDetectedJoints(
    landmarks: NormalizedLandmark[],
    matchedJoints: Set<number>,
    needsAdjustmentJoints: Set<number>,
    bounds: TransformBounds
  ): void {
    const { ctx } = this;
    const dpr = bounds.dpr;
    const radius = 5 * dpr;

    for (let i = 0; i < landmarks.length; i++) {
      // Do not draw individual points over the face (Section A6, A9)
      if (i < 11) continue;

      const lm = landmarks[i];
      if (!lm) continue;

      const pt = mapNormalizedToScreen(lm.x, lm.y, bounds);

      if (lm.visibility < 0.35) {
        // Low confidence: dashed and faint (Sage Gray 40%)
        ctx.save();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = PALETTE.LOW_CONFIDENCE;
        ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.globalAlpha = 0.40;
        ctx.beginPath();
        ctx.arc(pt.bufferX, pt.bufferY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (needsAdjustmentJoints.has(i)) {
        // Needs adjustment: Warm Amber with ring and halo
        ctx.save();
        ctx.lineWidth = 2.5 * dpr;
        ctx.strokeStyle = PALETTE.NEEDS_ADJUSTMENT;
        ctx.fillStyle = '#0F251E';
        ctx.beginPath();
        ctx.arc(pt.bufferX, pt.bufferY, radius + 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (matchedJoints.has(i)) {
        // Aligned: Fresh Green solid ring with inner dot
        ctx.save();
        ctx.lineWidth = 2 * dpr;
        ctx.strokeStyle = PALETTE.ALIGNED_GREEN;
        ctx.fillStyle = PALETTE.ALIGNED_GREEN;
        ctx.beginPath();
        ctx.arc(pt.bufferX, pt.bufferY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pt.bufferX, pt.bufferY, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Default detected joint: Mint Cyan
        ctx.save();
        ctx.fillStyle = PALETTE.SKELETON_MINT;
        ctx.strokeStyle = PALETTE.SKELETON_HALO;
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.arc(pt.bufferX, pt.bufferY, radius - 1 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawCorrectionArrows(corrections: CorrectionInstruction[], bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;

    for (const c of corrections) {
      if (!c.arrow) continue;
      const fromPt = mapNormalizedToScreen(c.arrow.from.x, c.arrow.from.y, bounds);
      const toPt = mapNormalizedToScreen(c.arrow.to.x, c.arrow.to.y, bounds);

      const dx = toPt.bufferX - fromPt.bufferX;
      const dy = toPt.bufferY - fromPt.bufferY;
      const angle = Math.atan2(dy, dx);
      const headLen = 10 * dpr;

      ctx.save();
      // Halo behind arrow
      ctx.strokeStyle = PALETTE.SKELETON_HALO;
      ctx.lineWidth = (3 + 3) * dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fromPt.bufferX, fromPt.bufferY);
      ctx.lineTo(toPt.bufferX, toPt.bufferY);
      ctx.stroke();

      // Main arrow body: Warm Amber
      ctx.strokeStyle = PALETTE.NEEDS_ADJUSTMENT;
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.moveTo(fromPt.bufferX, fromPt.bufferY);
      ctx.lineTo(toPt.bufferX, toPt.bufferY);
      ctx.stroke();

      // Arrow head
      ctx.fillStyle = PALETTE.NEEDS_ADJUSTMENT;
      ctx.beginPath();
      ctx.moveTo(toPt.bufferX, toPt.bufferY);
      ctx.lineTo(
        toPt.bufferX - headLen * Math.cos(angle - Math.PI / 6),
        toPt.bufferY - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        toPt.bufferX - headLen * Math.cos(angle + Math.PI / 6),
        toPt.bufferY - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private drawHoldIndicator(holdProgress: number, isStableMatched: boolean, bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;
    const cx = bounds.offsetX * dpr + (bounds.renderedWidth * dpr) / 2;
    const cy = (bounds.offsetY * dpr) + 40 * dpr;
    const radius = 24 * dpr;

    ctx.save();
    // Background disc
    ctx.fillStyle = 'rgba(15, 37, 30, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4 * dpr, 0, Math.PI * 2);
    ctx.fill();

    // Track circle
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = 'rgba(244, 246, 244, 0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Progress arc
    ctx.strokeStyle = isStableMatched ? PALETTE.ALIGNED_GREEN : PALETTE.ACCENT_BRASS;
    ctx.lineWidth = 4 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * holdProgress);
    ctx.stroke();

    // Center icon / text
    ctx.fillStyle = PALETTE.TEXT_PRIMARY;
    ctx.font = `600 ${11 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isStableMatched ? '✓' : `${Math.round(holdProgress * 100)}%`, cx, cy);

    ctx.restore();
  }

  private drawSecondarySkeleton(landmarks: NormalizedLandmark[], bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;

    ctx.save();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = PALETTE.LOW_CONFIDENCE;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.globalAlpha = 0.35;

    for (const [i1, i2] of STANDARD_CONNECTIONS) {
      if (i1 < 11 && i2 < 11) continue;
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      if (p1 && p2 && p1.visibility >= 0.35 && p2.visibility >= 0.35) {
        const s1 = mapNormalizedToScreen(p1.x, p1.y, bounds);
        const s2 = mapNormalizedToScreen(p2.x, p2.y, bounds);
        ctx.beginPath();
        ctx.moveTo(s1.bufferX, s1.bufferY);
        ctx.lineTo(s2.bufferX, s2.bufferY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
