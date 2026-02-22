import React from "react";
import { getStrengthLabel, getStrengthScore } from "../../utils/password.js";

export default function StrengthMeter({ value }) {
  const score = getStrengthScore(value);
  const label = getStrengthLabel(value);
  const width = `${Math.max((score / 5) * 100, value ? 10 : 0)}%`;
  const tone = score <= 2 ? "weak" : score <= 4 ? "medium" : "strong";

  return (
    <div className="strength-wrap">
      <div className="strength-track">
        <div className={`strength-fill ${tone}`} style={{ width }} />
      </div>
      <span className={`strength-label ${tone}`}>{label}</span>
    </div>
  );
}
