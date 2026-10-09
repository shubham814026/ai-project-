/**
 * Instruction Templates
 * All templates are short imperative phrases, 8 words or fewer (Section A8 Rule 7).
 * Left and right always refer to the user's anatomical body.
 */

export interface InstructionTemplateParams {
  jointName: string;
  direction: 'up' | 'down' | 'in' | 'out' | 'bend' | 'straighten' | 'level';
  slightly: boolean;
  anatomicalSide?: 'left' | 'right';
}

export const TEMPLATES: Record<string, (params: InstructionTemplateParams) => string> = {
  // Arm elevation
  raise_arm: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly raise' : 'Raise'} your ${anatomicalSide ?? ''} arm`.trim(),
  lower_arm: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly lower' : 'Lower'} your ${anatomicalSide ?? ''} arm`.trim(),

  // Elbow flexion
  bend_elbow: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly bend' : 'Bend'} your ${anatomicalSide ?? ''} elbow`.trim(),
  straighten_elbow: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly straighten' : 'Straighten'} your ${anatomicalSide ?? ''} arm`.trim(),

  // Hand position
  hand_to_hip: ({ anatomicalSide }) =>
    `Place your ${anatomicalSide ?? ''} hand on hip`.trim(),
  hand_near_chin: ({ anatomicalSide }) =>
    `Bring your ${anatomicalSide ?? ''} hand toward chin`.trim(),
  hands_crossed: () =>
    `Fold arms across your chest`,

  // Shoulders & Spine
  level_shoulders: () =>
    `Keep both shoulders level`,
  straighten_torso: () =>
    `Stand upright with spine tall`,
  angle_shoulders: () =>
    `Turn torso slightly to side`,

  // Legs & Knees
  bend_knee: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly bend' : 'Bend'} your ${anatomicalSide ?? ''} knee`.trim(),
  straighten_knee: ({ slightly, anatomicalSide }) =>
    `${slightly ? 'Slightly straighten' : 'Straighten'} your ${anatomicalSide ?? ''} leg`.trim(),
  shift_weight: ({ anatomicalSide }) =>
    `Shift weight onto ${anatomicalSide ?? ''} leg`.trim(),

  // Framing
  step_back: () => `Step back so full body is visible`,
  step_closer: () => `Move closer to the camera`,
  hold_still: () => `Hold still, tracking is unsteady`,
};
