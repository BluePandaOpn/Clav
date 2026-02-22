import React from "react";

export default function Card({ as: Component = "div", className = "", children, ...props }) {
  const classes = ["panel", className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
