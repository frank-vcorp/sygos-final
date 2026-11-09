/** Mínimo para que el alta MOT no ofrezca marcas ni tipos de equipo electrónico. */
export const MOTOR_CATALOG_SEED = [
  { type: "SERVOMOTOR", brand: "YASKAWA", model: "SGM7J" },
  { type: "SERVOMOTOR", brand: "SIEMENS", model: "1FK7" },
  { type: "MOTOR", brand: "SEW", model: "DRN" },
] as const;
