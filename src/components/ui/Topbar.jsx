import React from "react";

export default function Topbar({ className = "", children, ...props }) {
  const classes = ["topbar", className].filter(Boolean).join(" ");
  return (
    <header className={classes} {...props}>
      {children}
    </header>
  );
}
