/**
 * Application Constants and Thresholds Configuration
 * Strictly adheres to Pose Coach specification Sections A6, A7, A8, A9, A12
 * Rule: "Keep every threshold in one config file" (Section A8)
 */

export const CAMERA_CONFIG = {
  DEFAULT_WIDTH: 1280,
  DEFAULT_HEIGHT: 720,
  DEFAULT_FPS: 30,
  DEFAULT_MIRROR: true,
  SUPPORTED_RESOLUTIONS: [
    { width: 1920, height: 1080, label: '1080p (FHD)' },
    { width: 1280, height: 720, label: '720p (HD - Recommended)' },
    { width: 640, height: 480, label: '480p (SD - Performance)' },
  ],
} as const;

export const INFERENCE_CONFIG = {
  TARGET_RATE_HZ: 30,
  MIN_ACCEPTABLE_RATE_HZ: 10,
  WARNING_RATE_HZ: 15,
  P95_BUDGET_MS: 50,
  DEGRADE_AFTER_MISS_MS: 5000,
  RECOVER_AFTER_HEALTHY_MS: 10000,
  PRIMARY_MODEL: 'pose_landmarker_full.task',
  FALLBACK_MODEL: 'pose_landmarker_lite.task',
  WASM_PATH: '/wasm',
} as const;

export const FILTER_CONFIG = {
  VISIBILITY_THRESHOLD: 0.5,
  ONE_EURO_MIN_CUTOFF: 1.0,  // Hz
  ONE_EURO_BETA: 0.007,
  ONE_EURO_D_CUTOFF: 1.0,    // Hz
  EMA_ALPHA: 0.6,
  DISAPPEAR_FADE_MS: 300,
  RESET_AFTER_ABSENT_MS: 500,
  EASE_TIME_CONSTANT_MS: 100, // rAF interpolation smoothing
} as const;

export const MATCHING_THRESHOLDS = {
  // Score thresholds
  MATCH_SCORE_THRESHOLD: 85.0,     // Match achieved when score >= 85
  MATCH_HYSTERESIS_EXIT_SCORE: 75.0, // Match lost when score < 75
  
  // Tolerance ratios (r = |delta| / tolerance)
  MAX_CRITICAL_R_FOR_MATCH: 1.5,
  MAX_CRITICAL_R_EXIT_HYSTERESIS: 2.0,
  
  // Hold timing
  HOLD_DURATION_MS: 1500,          // 1.5s stable hold to complete match
  EXIT_HYSTERESIS_DURATION_MS: 500, // 0.5s out-of-tolerance before exiting matched state

  // Weight thresholds
  MIN_REQUIRED_WEIGHT_COVERAGE_RATIO: 0.70, // 70% of required weight must pass visibility

  // Baseline default tolerances
  DEFAULT_ANGLE_TOLERANCE_DEG: 12.0,
  DEFAULT_POSITION_TOLERANCE_NORM: 0.12,
  DEFAULT_TILT_TOLERANCE_DEG: 5.0,

  // Weights
  WEIGHT_CRITICAL: 2.0,
  WEIGHT_NORMAL: 1.0,
  WEIGHT_OPTIONAL: 0.5,
} as const;

export const GUIDANCE_CONFIG = {
  MAX_PRIMARY_INSTRUCTIONS: 1,
  MAX_SECONDARY_INSTRUCTIONS: 2,
  ONSET_PERSIST_MS: 400,          // Instruction must persist 400ms before appearing
  MIN_DISPLAY_DURATION_MS: 1200,   // Stays at least 1.2s once displayed
  CLEAR_TOLERANCE_R: 0.8,         // Clears when r drops below 0.8
  ARROW_MIN_LENGTH_PX: 24,
  ARROW_MAX_LENGTH_PX: 90,
  ARROW_HEAD_SIZE_PX: 10,
  QUALIFIER_SLIGHTLY_R_MAX: 2.0,  // "Slightly" prefix added when 1 < r <= 2
} as const;

export const PALETTE = {
  BACKGROUND: '#0F251E',       // Deep Forest Reserve
  SURFACE: '#16382D',          // Dark Moss
  TEXT_PRIMARY: '#F4F6F4',     // Soft Off-White
  TEXT_SECONDARY: '#94A39E',   // Sage Gray
  ACCENT_BRASS: '#C5A059',     // Antique Brass / Warm Gold
  
  SKELETON_MINT: '#5EEAD4',    // Mint Cyan
  SKELETON_HALO: 'rgba(7, 18, 14, 0.75)',
  NEEDS_ADJUSTMENT: '#FF9F43', // Warm Amber
  ALIGNED_GREEN: '#4ADE80',    // Fresh Green
  LOW_CONFIDENCE: '#94A39E',   // Sage Gray (40% opacity)
  TARGET_GUIDE: '#C5A059',     // Antique Brass (55% opacity)
  ERROR_CORAL: '#F0746B',      // Soft Coral
  BORDER_SUBTLE: 'rgba(244, 246, 244, 0.10)',
} as const;
