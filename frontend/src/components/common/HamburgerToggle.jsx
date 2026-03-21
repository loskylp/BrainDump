/**
 * HamburgerToggle component.
 *
 * A button that shows and hides the sidebar on tablet and mobile viewports
 * (ADR-009 responsive design, TASK-018). Visible only at breakpoints < 1024px
 * via the lg:hidden Tailwind class.
 *
 * At 768px-1023px (tablet): sidebar is hidden by default; toggle slides it in
 * as an overlay panel from the left with a 0.2s CSS transition.
 * At < 768px (mobile): toggle behaves the same but the entire workspace layout
 * switches to a single-panel view with a tab bar for panel switching.
 *
 * The toggle button itself is always positioned by the parent layout. On desktop
 * (>= 1024px) this component is hidden via the lg:hidden CSS class.
 *
 * Accessibility:
 *   - aria-label: "Toggle sidebar" when closed, "Close sidebar" when open
 *   - aria-expanded reflects current sidebar open state
 *   - Minimum touch target: 44px x 44px via h-11 w-11 (ADR-009 / TASK-018 AC-5)
 *
 * Props:
 *   @prop {boolean} isOpen - Current sidebar open state
 *   @prop {function} onToggle - Callback to toggle the sidebar; called with
 *     no arguments. Parent (WorkspacePage) owns the open/closed state.
 */
export default function HamburgerToggle({ isOpen, onToggle }) {
  return (
    <button
      type="button"
      aria-label={isOpen ? 'Close sidebar' : 'Toggle sidebar'}
      aria-expanded={isOpen}
      onClick={onToggle}
      className="lg:hidden h-11 w-11 flex items-center justify-center bg-bg-secondary border border-border"
    >
      {isOpen ? (
        /* X icon — rendered with two diagonal lines using CSS */
        <span className="relative w-5 h-5 flex items-center justify-center" aria-hidden="true">
          <span className="absolute w-5 h-0.5 bg-current rotate-45" />
          <span className="absolute w-5 h-0.5 bg-current -rotate-45" />
        </span>
      ) : (
        /* Hamburger icon — three horizontal bars */
        <span className="flex flex-col gap-1" aria-hidden="true">
          <span className="block w-5 h-0.5 bg-current" />
          <span className="block w-5 h-0.5 bg-current" />
          <span className="block w-5 h-0.5 bg-current" />
        </span>
      )}
    </button>
  );
}
