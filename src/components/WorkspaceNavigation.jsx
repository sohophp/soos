import React from "react";

export function WorkspaceNavigation({
  activeView,
  ariaLabel,
  labels,
  onChange,
  onKeyDown,
  tabRefs,
  views,
}) {
  return (
    <nav className="workspace-nav" aria-label={ariaLabel} role="tablist">
      {views.map(([view, Icon], index) => (
        <button
          className={activeView === view ? "active" : ""}
          type="button"
          key={view}
          id={`workspace-tab-${view}`}
          role="tab"
          aria-selected={activeView === view}
          aria-controls="workspace-panel"
          tabIndex={activeView === view ? 0 : -1}
          ref={(element) => {
            tabRefs.current[index] = element;
          }}
          onClick={() => onChange(view, { focus: false })}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{labels[view]}</span>
        </button>
      ))}
    </nav>
  );
}
