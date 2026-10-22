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
import { CompositionResult } from '../camera/compositionAnalyzer';
import { calculate2DAngle, calculateHorizontalTilt } from '../geometry/angles';

export interface OverlayRenderData {
  userLandmarks: NormalizedLandmark[] | null;
  targetLandmarks: NormalizedLandmark[] | null;
  secondaryPersons?: NormalizedLandmark[][];
  showSkeleton: boolean;
  showTargetGuide: boolean;
  showTestPattern?: boolean;
  showRuleOfThirds?: boolean;
  inspectorMode?: boolean;
  cameraComposition?: CompositionResult | null;
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

    ctx.save();

    // 0. Draw Alignment Test Pattern (Section A7, A12)
    if (data.showTestPattern) {
      this.drawTestPattern(bounds);
    }

    // 0.5 Draw Camera Composition Guide (Rule of Thirds Grid & Framing Corners)
    if (data.showRuleOfThirds) {
      this.drawRuleOfThirdsGrid(bounds, data.cameraComposition);
    }

    // 1. Draw Target Pose Guide (Section A9: 2.5px dashed Antique Brass, 55% opacity)
    // Always visible when enabled so user has a reference target before entering frame
    if (data.showTargetGuide && data.targetLandmarks && data.targetLandmarks.length > 0) {
      this.drawTargetSkeleton(data.targetLandmarks, bounds);
    }

    // 2. Draw Detected User Skeleton & Live Guidance (fades based on tracking presence)
    if (data.fadeOpacity > 0.01) {
      ctx.save();
      ctx.globalAlpha = data.fadeOpacity;

      // 2.1 Draw Secondary Persons (faint dashed Sage Gray at 30% opacity)
      if (data.showSkeleton && data.secondaryPersons && data.secondaryPersons.length > 0) {
        for (const sec of data.secondaryPersons) {
          this.drawSecondarySkeleton(sec, bounds);
        }
      }

      // 2.2 Draw Detected Skeleton (Section A9: 3px Mint Cyan with 1.5px dark halo)
      if (data.showSkeleton && data.userLandmarks && data.userLandmarks.length > 0 && !data.trackingLost) {
        this.drawDetectedSkeleton(data.userLandmarks, bounds);
        this.drawDetectedJoints(data.userLandmarks, data.matchedJoints, data.needsAdjustmentJoints, bounds);
      }

      // 2.3 Draw Correction Indicators & Arrows (Section A9: 3px stroke with 10px head, dark halo)
      if (data.corrections.length > 0 && !data.trackingLost) {
        this.drawCorrectionArrows(data.corrections, bounds);
      }

      ctx.restore();
    }

    // 3. Draw Hold Progress / Success Ring if holding or matched
    if (data.holdProgress > 0 || data.isStableMatched) {
      this.drawHoldIndicator(data.holdProgress, data.isStableMatched, bounds);
    }

    // 4. Draw Mathematical Inspector HUD (Telemetry Inspection)
    if (data.inspectorMode) {
      this.drawInspectorHUD(data, bounds);
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
      // Don't draw across face (Face Occlusion Protection - Section A6, A8, A9)
      if (i1 < 11 || i2 < 11) continue;
      // Do not draw hips or lower-body connections for upper-body desk target guide (prevents chest trapezoid)
      if (i1 >= 23 || i2 >= 23) continue;

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
      // Do not draw across face (Face Occlusion Protection - Section A6, A8, A9)
      if (i1 < 11 || i2 < 11) continue;

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

      // On-screen visual guidance text badge next to arrow
      if (c.text) {
        ctx.save();
        ctx.font = `600 ${10 * dpr}px Inter, sans-serif`;
        const textMetrics = ctx.measureText(c.text);
        const padding = 5 * dpr;
        const pillW = textMetrics.width + padding * 2;
        const pillH = 16 * dpr;
        // Position badge safely relative to target point
        const pillX = Math.max(
          bounds.offsetX * dpr + 4,
          Math.min(toPt.bufferX + 8 * dpr, (bounds.offsetX + bounds.renderedWidth) * dpr - pillW - 4)
        );
        const pillY = Math.max(bounds.offsetY * dpr + pillH + 4, toPt.bufferY - 10 * dpr);

        ctx.fillStyle = 'rgba(15, 37, 30, 0.90)';
        ctx.beginPath();
        const ctxAny = ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
        if (typeof ctxAny.roundRect === 'function') {
          ctxAny.roundRect(pillX, pillY - pillH + 4 * dpr, pillW, pillH, 4 * dpr);
        } else {
          ctx.rect(pillX, pillY - pillH + 4 * dpr, pillW, pillH);
        }
        ctx.fill();
        ctx.strokeStyle = PALETTE.NEEDS_ADJUSTMENT;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        ctx.fillStyle = PALETTE.TEXT_PRIMARY;
        ctx.fillText(c.text, pillX + padding, pillY - 2 * dpr);
        ctx.restore();
      }

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

    // Success outer glow ring when matched
    if (isStableMatched) {
      ctx.lineWidth = 6 * dpr;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Background disc
    ctx.fillStyle = isStableMatched ? 'rgba(22, 56, 45, 0.90)' : 'rgba(15, 37, 30, 0.75)';
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
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (isStableMatched ? 1.0 : holdProgress));
    ctx.stroke();

    // Center icon / text
    ctx.fillStyle = isStableMatched ? PALETTE.ALIGNED_GREEN : PALETTE.TEXT_PRIMARY;
    ctx.font = `700 ${isStableMatched ? 15 * dpr : 11 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isStableMatched ? '✓' : `${Math.round(holdProgress * 100)}%`, cx, cy);

    ctx.restore();
  }

  private drawSecondarySkeleton(landmarks: NormalizedLandmark[], bounds: TransformBounds): void {
    // Only render secondary skeleton if it represents a genuine secondary person (>= 8 visible landmarks)
    const validCount = landmarks.filter((l) => (l.visibility ?? 0) >= 0.40).length;
    if (validCount < 8) return;

    const { ctx } = this;
    const dpr = bounds.dpr;

    ctx.save();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = PALETTE.LOW_CONFIDENCE;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.globalAlpha = 0.35;

    for (const [i1, i2] of STANDARD_CONNECTIONS) {
      if (i1 < 11 || i2 < 11) continue;
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

  /**
   * Draws Rule-of-Thirds composition grid and subtle golden framing brackets (Engine 1: Camera Guidance)
   */
  private drawRuleOfThirdsGrid(bounds: TransformBounds, composition?: CompositionResult | null): void {
    const { ctx } = this;
    const dpr = bounds.dpr;

    ctx.save();

    // Map 1/3 and 2/3 lines within the active video area in physical buffer pixels
    const xThird1 = (bounds.offsetX + bounds.renderedWidth * (1.0 / 3.0)) * dpr;
    const xThird2 = (bounds.offsetX + bounds.renderedWidth * (2.0 / 3.0)) * dpr;
    const yThird1 = (bounds.offsetY + bounds.renderedHeight * (1.0 / 3.0)) * dpr;
    const yThird2 = (bounds.offsetY + bounds.renderedHeight * (2.0 / 3.0)) * dpr;

    const xLeft = bounds.offsetX * dpr;
    const xRight = (bounds.offsetX + bounds.renderedWidth) * dpr;
    const yTop = bounds.offsetY * dpr;
    const yBottom = (bounds.offsetY + bounds.renderedHeight) * dpr;

    // Faint grid lines
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.20)'; // Antique Brass with subtle transparency
    ctx.setLineDash([4 * dpr, 6 * dpr]);

    // Vertical third lines
    ctx.beginPath();
    ctx.moveTo(xThird1, yTop);
    ctx.lineTo(xThird1, yBottom);
    ctx.moveTo(xThird2, yTop);
    ctx.lineTo(xThird2, yBottom);
    // Horizontal third lines
    ctx.moveTo(xLeft, yThird1);
    ctx.lineTo(xRight, yThird1);
    ctx.moveTo(xLeft, yThird2);
    ctx.lineTo(xRight, yThird2);
    ctx.stroke();

    // Golden crosshairs at the 4 Rule-of-Thirds power intersection points
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = 'rgba(197, 160, 89, 0.45)';
    const arm = 6 * dpr;
    const intersections = [
      [xThird1, yThird1],
      [xThird2, yThird1],
      [xThird1, yThird2],
      [xThird2, yThird2],
    ];

    for (const [ix, iy] of intersections) {
      ctx.beginPath();
      ctx.moveTo(ix - arm, iy);
      ctx.lineTo(ix + arm, iy);
      ctx.moveTo(ix, iy - arm);
      ctx.lineTo(ix, iy + arm);
      ctx.stroke();
    }

    // If composition bounding box is present, draw stylish corner brackets
    if (composition && composition.boundingBox && composition.metrics.shotScale !== 'out-of-frame') {
      const bb = composition.boundingBox;
      const topLeft = mapNormalizedToScreen(bb.minX, bb.minY, bounds);
      const bottomRight = mapNormalizedToScreen(bb.maxX, bb.maxY, bounds);

      const bx = topLeft.bufferX;
      const by = topLeft.bufferY;
      const bw = bottomRight.bufferX - topLeft.bufferX;
      const bh = bottomRight.bufferY - topLeft.bufferY;

      if (bw > 20 && bh > 20) {
        ctx.strokeStyle = composition.status === 'optimal'
          ? 'rgba(74, 222, 128, 0.50)' // Aligned Green
          : 'rgba(197, 160, 89, 0.50)'; // Antique Brass
        ctx.lineWidth = 1.5 * dpr;
        const cornerLen = Math.min(20 * dpr, Math.min(bw, bh) * 0.2);

        // Top-left
        ctx.beginPath();
        ctx.moveTo(bx, by + cornerLen);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + cornerLen, by);
        // Top-right
        ctx.moveTo(bx + bw - cornerLen, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(bx + bw, by + cornerLen);
        // Bottom-left
        ctx.moveTo(bx, by + bh - cornerLen);
        ctx.lineTo(bx, by + bh);
        ctx.lineTo(bx + cornerLen, by + bh);
        // Bottom-right
        ctx.moveTo(bx + bw - cornerLen, by + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw, by + bh - cornerLen);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draws Live Mathematical X-Ray Inspector HUD (Telemetry Inspection)
   * Visualizes real-time joint angle arccos derivations, Cauchy robust losses,
   * shoulder horizontal plane tilt, and bounding-box coordinates.
   */
  private drawInspectorHUD(data: OverlayRenderData, bounds: TransformBounds): void {
    const { ctx } = this;
    const dpr = bounds.dpr;
    const lms = data.userLandmarks;

    ctx.save();

    // 1. Joint-level mathematical badges and angle arcs
    if (lms && lms.length >= 17 && !data.trackingLost) {
      // Left Elbow Angle (11 -> 13 -> 15)
      if (lms[11]?.visibility > 0.4 && lms[13]?.visibility > 0.4 && lms[15]?.visibility > 0.4) {
        const lElbowDeg = calculate2DAngle(lms[11], lms[13], lms[15]);
        const pt = mapNormalizedToScreen(lms[13].x, lms[13].y, bounds);
        this.drawAnglePill(pt.bufferX, pt.bufferY - 14 * dpr, 'L.Elbow', lElbowDeg, dpr);
      }

      // Right Elbow Angle (12 -> 14 -> 16)
      if (lms[12]?.visibility > 0.4 && lms[14]?.visibility > 0.4 && lms[16]?.visibility > 0.4) {
        const rElbowDeg = calculate2DAngle(lms[12], lms[14], lms[16]);
        const pt = mapNormalizedToScreen(lms[14].x, lms[14].y, bounds);
        this.drawAnglePill(pt.bufferX, pt.bufferY - 14 * dpr, 'R.Elbow', rElbowDeg, dpr);
      }

      // Shoulder Horizontal Plane & Tilt Angle
      if (lms[11]?.visibility > 0.4 && lms[12]?.visibility > 0.4) {
        const p1 = mapNormalizedToScreen(lms[11].x, lms[11].y, bounds);
        const p2 = mapNormalizedToScreen(lms[12].x, lms[12].y, bounds);
        const tiltDeg = calculateHorizontalTilt(lms[11], lms[12]);

        // Shoulder level axis
        ctx.save();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = tiltDeg <= 3.5 ? 'rgba(74, 222, 128, 0.7)' : 'rgba(255, 159, 67, 0.8)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.beginPath();
        ctx.moveTo(p1.bufferX, p1.bufferY);
        ctx.lineTo(p2.bufferX, p2.bufferY);
        ctx.stroke();

        // Midpoint badge
        const midX = (p1.bufferX + p2.bufferX) / 2;
        const midY = (p1.bufferY + p2.bufferY) / 2;
        this.drawAnglePill(midX, midY - 16 * dpr, 'Tilt', tiltDeg, dpr, tiltDeg <= 3.5);
        ctx.restore();
      }
    }

    // 2. High-Tech Mathematical Telemetry Glass HUD Card
    const cardX = (bounds.offsetX + 14) * dpr;
    const cardY = (bounds.offsetY + 14) * dpr;
    const cardW = 295 * dpr;
    const cardH = 150 * dpr;

    // Glass panel background
    ctx.fillStyle = 'rgba(7, 18, 14, 0.88)';
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.4)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8 * dpr);
    ctx.fill();
    ctx.stroke();

    // Card Header
    ctx.font = `700 ${10 * dpr}px monospace`;
    ctx.fillStyle = '#5EEAD4';
    ctx.fillText('⚡ AI KINEMATIC & OPTICAL X-RAY', cardX + 12 * dpr, cardY + 18 * dpr);

    ctx.font = `500 ${8.5 * dpr}px monospace`;
    ctx.fillStyle = '#94A39E';
    ctx.fillText('arccos(u·v / |u||v|) & Cauchy Loss', cardX + 12 * dpr, cardY + 30 * dpr);

    // Separator line
    ctx.strokeStyle = 'rgba(244, 246, 244, 0.1)';
    ctx.beginPath();
    ctx.moveTo(cardX + 10 * dpr, cardY + 36 * dpr);
    ctx.lineTo(cardX + cardW - 10 * dpr, cardY + 36 * dpr);
    ctx.stroke();

    // Telemetry items
    const comp = data.cameraComposition;
    const compScore = comp ? comp.framingScore : 0;
    const shotScale = comp ? comp.metrics.shotScale : 'N/A';
    const headroom = comp ? `${(comp.metrics.headroomRatio * 100).toFixed(0)}%` : 'N/A';

    const metrics = [
      { label: 'Feature Metric', val: 'Cosine Distance D_c' },
      { label: 'Robust Estimator', val: 'Cauchy L(r)=c²/2·ln(1+(r/c)²)' },
      { label: 'Shot Framing', val: `${shotScale.toUpperCase()} (${compScore}%)` },
      { label: 'Golden Headroom', val: `${headroom} (target: 8-15%)` },
      { label: '1€ Jitter Filter', val: 'fc=1.0Hz, β=0.007 [ACTIVE]' },
      { label: 'Edge Inference', val: 'Client-Side WASM (0 Cloud Latency)' },
    ];

    let rowY = cardY + 50 * dpr;
    for (const m of metrics) {
      ctx.font = `600 ${8 * dpr}px monospace`;
      ctx.fillStyle = '#C5A059';
      ctx.fillText(m.label + ':', cardX + 12 * dpr, rowY);

      ctx.font = `500 ${8 * dpr}px monospace`;
      ctx.fillStyle = '#F4F6F4';
      ctx.fillText(m.val, cardX + 118 * dpr, rowY);
      rowY += 15 * dpr;
    }

    ctx.restore();
  }

  private drawAnglePill(
    x: number,
    y: number,
    name: string,
    deg: number,
    dpr: number,
    isGood: boolean = true
  ): void {
    const { ctx } = this;
    const text = `${name}: ${deg.toFixed(0)}°`;
    ctx.save();
    ctx.font = `700 ${9 * dpr}px monospace`;
    const textW = ctx.measureText(text).width;
    const pillW = textW + 10 * dpr;
    const pillH = 16 * dpr;
    const pillX = x - pillW / 2;
    const pillY = y - pillH / 2;

    // Dark pill background
    ctx.fillStyle = 'rgba(15, 37, 30, 0.90)';
    ctx.strokeStyle = isGood ? 'rgba(74, 222, 128, 0.7)' : 'rgba(197, 160, 89, 0.7)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 4 * dpr);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = isGood ? '#4ADE80' : '#C5A059';
    ctx.fillText(text, pillX + 5 * dpr, pillY + 11.5 * dpr);
    ctx.restore();
  }
}
