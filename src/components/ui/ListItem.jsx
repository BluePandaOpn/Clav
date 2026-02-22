import React from "react";

export default function ListItem({ as: Component = "li", className = "", children, ...props }) {
  const classes = ["ui-list-item", className].filter(Boolean).join(" ");
  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
