import React from "react";

export default function Sidebar({ className = "", children, ...props }) {
  const classes = ["sidebar", className].filter(Boolean).join(" ");
  return (
    <aside className={classes} {...props}>
      {children}
    </aside>
  );
}
