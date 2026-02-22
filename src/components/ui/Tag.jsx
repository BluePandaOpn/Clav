import React from "react";

export default function Tag({ as: Component = "span", className = "", children, ...props }) {
  const classes = ["tag-chip", className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
