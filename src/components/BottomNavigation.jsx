function NavIcon({ id }) {
  const iconProps = {
    className: "bottom-nav-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
  };

  if (id === "calendar") {
    return (
      <svg {...iconProps}>
        <path d="M7 3.5V6.5" />
        <path d="M17 3.5V6.5" />
        <path d="M4.5 9H19.5" />
        <path d="M6.5 5H17.5C18.6046 5 19.5 5.89543 19.5 7V18C19.5 19.1046 18.6046 20 17.5 20H6.5C5.39543 20 4.5 19.1046 4.5 18V7C4.5 5.89543 5.39543 5 6.5 5Z" />
        <path d="M8 13H8.01" />
        <path d="M12 13H12.01" />
        <path d="M16 13H16.01" />
        <path d="M8 17H8.01" />
        <path d="M12 17H12.01" />
      </svg>
    );
  }

  if (id === "settings") {
    return (
      <svg {...iconProps}>
        <path d="M12 8.75C10.2051 8.75 8.75 10.2051 8.75 12C8.75 13.7949 10.2051 15.25 12 15.25C13.7949 15.25 15.25 13.7949 15.25 12C15.25 10.2051 13.7949 8.75 12 8.75Z" />
        <path d="M18.55 13.15C18.6 12.78 18.6 12.38 18.55 11.98L20.18 10.7L18.62 8L16.72 8.78C16.4 8.54 16.06 8.34 15.68 8.18L15.4 6.15H12.28L12 8.18C11.62 8.34 11.27 8.54 10.96 8.78L9.05 8L7.5 10.7L9.13 11.98C9.08 12.37 9.08 12.76 9.13 13.15L7.5 14.43L9.05 17.13L10.96 16.35C11.27 16.59 11.62 16.8 12 16.95L12.28 19H15.4L15.68 16.95C16.06 16.8 16.4 16.59 16.72 16.35L18.62 17.13L20.18 14.43L18.55 13.15Z" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M4.5 10.75L12 4.5L19.5 10.75" />
      <path d="M6.5 9.75V18.5C6.5 19.0523 6.94772 19.5 7.5 19.5H10V14.5H14V19.5H16.5C17.0523 19.5 17.5 19.0523 17.5 18.5V9.75" />
    </svg>
  );
}

export function BottomNavigation({ tabs, activeTab, onChange }) {
  return (
    <nav className="bottom-navigation" aria-label="주요 화면">
      <div className="bottom-navigation-inner">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={`bottom-nav-button ${active ? "is-active" : ""}`}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(tab.id)}
            >
              <NavIcon id={tab.id} />
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
