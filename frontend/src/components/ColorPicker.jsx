import { COLORS } from '../utils/constants';

export default function ColorPicker({ visible, position, activeColor, onSelect }) {
  if (!visible) return null;

  return (
    <div
      className={`color-picker-popover${visible ? ' visible' : ''}`}
      id="color-picker-popover"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="color-picker-grid" id="color-picker-grid">
        {COLORS.map((c) => (
          <div
            key={c.name}
            className={`color-swatch${activeColor === c.name ? ' active' : ''}`}
            data-color={c.name}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => onSelect(c.name)}
          />
        ))}
      </div>
    </div>
  );
}
