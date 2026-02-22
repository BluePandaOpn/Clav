import React from "react";

export default function Section({ title, description, actions, className = "", children, ...props }) {
  const classes = ["ui-section", className].filter(Boolean).join(" ");
  return (
    <section className={classes} {...props}>
      {title || description || actions ? (
        <header className="ui-section-head">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p className="muted">{description}</p> : null}
          </div>
          {actions ? <div className="ui-section-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-section-body">{children}</div>
    </section>
  );
}
