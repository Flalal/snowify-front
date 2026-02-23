export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="empty-state">
      {icon && icon}
      {title && <h3>{title}</h3>}
      <p>{message}</p>
      {action && (
        <button className="empty-state-btn" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
