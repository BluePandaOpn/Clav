import React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle
};

export default function ToastStack({ items, onClose }) {
  return (
    <div className="toast-stack">
      {items.map((item) => {
        const Icon = icons[item.type] || icons.info;
        return (
          <div key={item.id} className={`toast ${item.type}`}>
            <Icon size={16} />
            <span>{item.message}</span>
            <button type="button" onClick={() => onClose(item.id)}>
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
