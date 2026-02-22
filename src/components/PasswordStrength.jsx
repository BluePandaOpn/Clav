import React from "react";
import StrengthMeter from "./ui/StrengthMeter.jsx";

export default function PasswordStrength({ value }) {
  return <StrengthMeter value={value} />;
}
